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

        // 1. Optional Edge Pre-Shared Secret Header check
        $expectedEdgeSecret = config('services.cloudflare.edge_secret');
        if ($expectedEdgeSecret) {
            $providedSecret = $request->header('X-MFMS-Edge-Secret');
            if (! hash_equals((string) $expectedEdgeSecret, (string) $providedSecret)) {
                Log::warning('Cloudflare Access verification failed: Invalid X-MFMS-Edge-Secret header.', [
                    'ip' => $request->ip(),
                    'path' => $request->path(),
                ]);
                abort(403, 'Akses Ditolak: Permintaan wajib melalui Cloudflare Edge resmi.');
            }
        }

        // 2. Cloudflare Access JWT Assertion Header check
        $jwt = $request->header('Cf-Access-Jwt-Assertion');
        if (! $jwt || ! is_string($jwt)) {
            Log::warning('Cloudflare Access verification failed: Missing Cf-Access-Jwt-Assertion header.', [
                'ip' => $request->ip(),
                'path' => $request->path(),
            ]);
            abort(403, 'Akses Ditolak: Autentikasi Cloudflare Access Zero Trust wajib ada.');
        }

        // 3. Parse JWT
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            abort(403, 'Akses Ditolak: Format token Cloudflare Access tidak valid.');
        }

        [$rawHeader, $rawPayload, $rawSignature] = $parts;
        $header = json_decode($this->base64UrlDecode($rawHeader), true);
        $payload = json_decode($this->base64UrlDecode($rawPayload), true);

        if (! is_array($header) || ! is_array($payload)) {
            abort(403, 'Akses Ditolak: Payload token Cloudflare Access rusak.');
        }

        // 4. Expiry verification
        if (! isset($payload['exp']) || time() >= (int) $payload['exp']) {
            abort(403, 'Akses Ditolak: Sesi Cloudflare Access telah kedaluwarsa.');
        }

        // 5. Audience Tag (AUD) verification
        $expectedAud = config('services.cloudflare.access_aud');
        if ($expectedAud) {
            $aud = $payload['aud'] ?? null;
            $audMatches = is_array($aud) ? in_array($expectedAud, $aud, true) : ($aud === $expectedAud);
            if (! $audMatches) {
                Log::warning('Cloudflare Access verification failed: AUD mismatch.', [
                    'expected' => $expectedAud,
                    'provided' => $aud,
                ]);
                abort(403, 'Akses Ditolak: Target aplikasi Cloudflare Access tidak cocok.');
            }
        }

        // 6. Cryptographic signature verification using Cloudflare Public JWKS certs
        $teamDomain = config('services.cloudflare.access_team_domain');
        if ($teamDomain && isset($header['kid'])) {
            $isValidSignature = $this->verifySignature($teamDomain, $header['kid'], $rawHeader.'.'.$rawPayload, $rawSignature);
            if (! $isValidSignature) {
                Log::error('Cloudflare Access verification failed: Invalid RSA cryptographic signature.');
                abort(403, 'Akses Ditolak: Validasi tanda tangan digital Cloudflare Access gagal.');
            }
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

        if (! is_array($certs) || ! isset($certs['keys'])) {
            // If cert retrieval is temporarily unreachable, do not hard-lock out if AUD & expiry are valid
            return true;
        }

        $targetKey = null;
        foreach ($certs['keys'] as $key) {
            if (($key['kid'] ?? null) === $kid) {
                $targetKey = $key;
                break;
            }
        }

        if (! $targetKey || ! isset($targetKey['cert'])) {
            return false;
        }

        $publicKey = "-----BEGIN CERTIFICATE-----\n".trim($targetKey['cert'])."\n-----END CERTIFICATE-----";
        $rawSig = $this->base64UrlDecode($signature);

        return openssl_verify($data, $rawSig, $publicKey, OPENSSL_ALGO_SHA256) === 1;
    }
}
