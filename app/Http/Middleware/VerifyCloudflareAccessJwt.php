<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class VerifyCloudflareAccessJwt
{
    /**
     * Handle an incoming request.
     * Enforces Cloudflare Access Zero Trust Edge verification on production.
     * Strictly fail-closed: any missing configuration, invalid token, or JWKS failure blocks access.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 0. Healthcheck endpoint is always public and accessible by container orchestrators
        if ($request->is('up')) {
            return $next($request);
        }

        $enforce = config('services.cloudflare.access_enforce');
        if ($enforce === null) {
            $enforce = app()->environment('production');
        }

        // Allow bypassing only in non-enforced environments (e.g. local dev / testing)
        if (! $enforce) {
            return $next($request);
        }

        // 1. Mandatory configuration checks when enforced (Fail-Closed)
        $teamDomain = config('services.cloudflare.access_team_domain');
        $expectedAud = config('services.cloudflare.access_aud');

        if (empty($teamDomain) || empty($expectedAud)) {
            Log::error('Cloudflare Access verification failed: Missing team domain or AUD in configuration.');
            abort(403, 'Akses Ditolak: Konfigurasi keamanan Cloudflare Access belum lengkap.');
        }

        // 2. Optional Edge Pre-Shared Secret Header check
        $expectedEdgeSecret = config('services.cloudflare.edge_secret');
        if ($expectedEdgeSecret) {
            $providedSecret = $request->header('X-MFMS-Edge-Secret');
            if (! $providedSecret || ! hash_equals((string) $expectedEdgeSecret, (string) $providedSecret)) {
                Log::warning('Cloudflare Access verification failed: Invalid X-MFMS-Edge-Secret header.', [
                    'ip' => $request->ip(),
                    'path' => $request->path(),
                ]);
                abort(403, 'Akses Ditolak: Permintaan wajib melalui Cloudflare Edge resmi.');
            }
        }

        // 3. Cloudflare Access JWT Assertion Header check
        $jwt = $request->header('Cf-Access-Jwt-Assertion');
        if (! $jwt || ! is_string($jwt) || trim($jwt) === '') {
            Log::warning('Cloudflare Access verification failed: Missing Cf-Access-Jwt-Assertion header.', [
                'ip' => $request->ip(),
                'path' => $request->path(),
            ]);
            abort(403, 'Akses Ditolak: Autentikasi Cloudflare Access Zero Trust wajib ada.');
        }

        // 4. Parse JWT structure
        $parts = explode('.', trim($jwt));
        if (count($parts) !== 3) {
            abort(403, 'Akses Ditolak: Format token Cloudflare Access tidak valid.');
        }

        [$rawHeader, $rawPayload, $rawSignature] = $parts;
        $header = json_decode($this->base64UrlDecode($rawHeader), true);
        $payload = json_decode($this->base64UrlDecode($rawPayload), true);

        if (! is_array($header) || ! is_array($payload)) {
            abort(403, 'Akses Ditolak: Payload token Cloudflare Access rusak.');
        }

        // 5. Algorithm & Key ID verification
        if (($header['alg'] ?? null) !== 'RS256') {
            Log::warning('Cloudflare Access verification failed: Unsupported algorithm.', [
                'alg' => $header['alg'] ?? 'null',
            ]);
            abort(403, 'Akses Ditolak: Algoritma token Cloudflare Access harus RS256.');
        }

        $kid = $header['kid'] ?? null;
        if (! is_string($kid) || trim($kid) === '') {
            Log::warning('Cloudflare Access verification failed: Missing key ID (kid).');
            abort(403, 'Akses Ditolak: Token Cloudflare Access tidak memiliki Key ID.');
        }

        // 6. Expiry verification
        if (! isset($payload['exp']) || time() >= (int) $payload['exp']) {
            abort(403, 'Akses Ditolak: Sesi Cloudflare Access telah kedaluwarsa.');
        }

        // 7. Not Before (nbf) verification if present
        if (isset($payload['nbf']) && time() < (int) $payload['nbf']) {
            abort(403, 'Akses Ditolak: Sesi Cloudflare Access belum aktif.');
        }

        // 8. Issuer (iss) verification
        $expectedIss = "https://{$teamDomain}.cloudflareaccess.com";
        $iss = $payload['iss'] ?? null;
        if ($iss !== $expectedIss) {
            Log::warning('Cloudflare Access verification failed: Issuer mismatch.', [
                'expected' => $expectedIss,
                'provided' => $iss,
            ]);
            abort(403, 'Akses Ditolak: Penerbit (issuer) token Cloudflare Access tidak valid.');
        }

        // 9. Audience Tag (AUD) verification
        $aud = $payload['aud'] ?? null;
        $audMatches = is_array($aud) ? in_array($expectedAud, $aud, true) : ($aud === $expectedAud);
        if (! $audMatches) {
            Log::warning('Cloudflare Access verification failed: AUD mismatch.', [
                'expected' => $expectedAud,
                'provided' => $aud,
            ]);
            abort(403, 'Akses Ditolak: Target aplikasi Cloudflare Access tidak cocok.');
        }

        // 10. Cryptographic signature verification using Cloudflare Public JWKS certs (STRICTLY FAIL-CLOSED)
        $isValidSignature = $this->verifySignature($teamDomain, $kid, $rawHeader.'.'.$rawPayload, $rawSignature);
        if (! $isValidSignature) {
            Log::error('Cloudflare Access verification failed: Invalid RSA signature or JWKS unavailable.');
            abort(403, 'Akses Ditolak: Validasi tanda tangan digital Cloudflare Access gagal.');
        }

        // Attach verified Cloudflare Access user email to request attributes
        if (isset($payload['email'])) {
            $request->attributes->set('cf_access_email', $payload['email']);
        }

        return $next($request);
    }

    protected function base64UrlDecode(string $input): string
    {
        $remainder = strlen($input) % 4;
        if ($remainder) {
            $input .= str_repeat('=', 4 - $remainder);
        }

        return (string) base64_decode(strtr($input, '-_', '+/'));
    }

    protected function verifySignature(string $teamDomain, string $kid, string $data, string $signature): bool
    {
        $certs = Cache::remember('cf_access_jwks_'.$teamDomain, 3600, function () use ($teamDomain) {
            $url = "https://{$teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs";
            try {
                $response = Http::timeout(5)->get($url);
                return $response->successful() ? $response->json() : null;
            } catch (\Throwable $e) {
                Log::warning("Failed to fetch Cloudflare certs from {$url}: ".$e->getMessage());
                return null;
            }
        });

        // STRICT FAIL-CLOSED: if JWKS is unavailable or malformed, NEVER allow access
        if (! is_array($certs) || ! isset($certs['keys']) || ! is_array($certs['keys'])) {
            Log::error("Cloudflare JWKS keys unavailable or invalid for team {$teamDomain}.");
            return false;
        }

        $targetKey = null;
        foreach ($certs['keys'] as $key) {
            if (($key['kid'] ?? null) === $kid) {
                $targetKey = $key;
                break;
            }
        }

        if (! $targetKey) {
            Log::warning("Cloudflare JWKS does not contain matching key for kid: {$kid}");
            return false;
        }

        $publicKey = null;

        // 1. Try X.509 cert from 'cert' field
        if (! empty($targetKey['cert']) && is_string($targetKey['cert'])) {
            $cert = trim($targetKey['cert']);
            if (! str_contains($cert, '-----BEGIN CERTIFICATE-----')) {
                $cert = "-----BEGIN CERTIFICATE-----\n".chunk_split($cert, 64, "\n")."-----END CERTIFICATE-----";
            }
            $publicKey = openssl_pkey_get_public($cert);
        }

        // 2. Try X.509 cert from 'x5c' array
        if (! $publicKey && ! empty($targetKey['x5c'][0]) && is_string($targetKey['x5c'][0])) {
            $cert = "-----BEGIN CERTIFICATE-----\n".chunk_split(trim($targetKey['x5c'][0]), 64, "\n")."-----END CERTIFICATE-----";
            $publicKey = openssl_pkey_get_public($cert);
        }

        if (! $publicKey) {
            Log::error("Failed to parse public certificate from JWKS for kid: {$kid}");
            return false;
        }

        $rawSig = $this->base64UrlDecode($signature);
        if ($rawSig === '') {
            return false;
        }

        $verifyResult = openssl_verify($data, $rawSig, $publicKey, OPENSSL_ALGO_SHA256);

        return $verifyResult === 1;
    }
}
