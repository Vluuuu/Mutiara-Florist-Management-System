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

        // 3. Cloudflare Access JWT check: prefer Cf-Access-Jwt-Assertion header, fallback to CF_Authorization cookie
        //    (required when same-domain Bypass paths omit the assertion header while preserving the RS256-signed cookie).
        $jwt = $request->header('Cf-Access-Jwt-Assertion');
        if (! is_string($jwt) || trim($jwt) === '') {
            $cookieJwt = $request->cookie('CF_Authorization');
            $jwt = is_string($cookieJwt) ? $cookieJwt : null;
        }
        if (! $jwt || ! is_string($jwt) || trim($jwt) === '') {
            Log::warning('Cloudflare Access verification failed: Missing Cf-Access-Jwt-Assertion header and CF_Authorization cookie.', [
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

        // 9. Audience Tag (AUD) verification (supports single AUD or comma-separated list for path-app transitions)
        $allowedAuds = array_values(array_filter(array_map('trim', explode(',', (string) $expectedAud))));
        $aud = $payload['aud'] ?? null;
        $tokenAuds = is_array($aud) ? $aud : (is_string($aud) ? [$aud] : []);
        $audMatches = count(array_intersect($allowedAuds, $tokenAuds)) > 0;
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
        $publicKey = $this->getPublicKey($teamDomain, $kid);
        if (! $publicKey) {
            return false;
        }

        $rawSig = $this->base64UrlDecode($signature);
        if ($rawSig === '') {
            return false;
        }

        $verifyResult = openssl_verify($data, $rawSig, $publicKey, OPENSSL_ALGO_SHA256);

        return $verifyResult === 1;
    }

    protected function getPublicKey(string $teamDomain, string $kid): mixed
    {
        $certs = $this->fetchCerts($teamDomain);
        if (! is_array($certs)) {
            Log::error("Cloudflare certs unavailable or malformed for team {$teamDomain}.");

            return null;
        }

        $publicKey = $this->extractKeyFromCerts($certs, $kid);

        // Key Rotation: If kid not found in cached JWKS, refresh cache once and retry
        if (! $publicKey) {
            Log::info("Key ID {$kid} not found in cached Cloudflare certs. Refreshing certs cache for team {$teamDomain}...");
            $freshCerts = $this->fetchCerts($teamDomain, forceRefresh: true);
            if (is_array($freshCerts)) {
                $publicKey = $this->extractKeyFromCerts($freshCerts, $kid);
            }
        }

        if (! $publicKey) {
            Log::warning("Cloudflare Access certs do not contain matching or valid public key for kid: {$kid}");
        }

        return $publicKey;
    }

    protected function fetchCerts(string $teamDomain, bool $forceRefresh = false): ?array
    {
        $cacheKey = 'cf_access_jwks_'.$teamDomain;
        if ($forceRefresh) {
            Cache::forget($cacheKey);
        }

        return Cache::remember($cacheKey, 3600, function () use ($teamDomain) {
            $url = "https://{$teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs";
            try {
                $response = Http::timeout(5)->get($url);

                return $response->successful() ? $response->json() : null;
            } catch (\Throwable $e) {
                Log::warning("Failed to fetch Cloudflare certs from {$url}: ".$e->getMessage());

                return null;
            }
        });
    }

    protected function extractKeyFromCerts(array $certs, string $kid): mixed
    {
        // 1. Primary: match kid in public_certs[] array (Cloudflare PEM format)
        if (isset($certs['public_certs']) && is_array($certs['public_certs'])) {
            foreach ($certs['public_certs'] as $certItem) {
                if (is_array($certItem) && ($certItem['kid'] ?? null) === $kid && ! empty($certItem['cert'])) {
                    $key = $this->parsePemCertificate((string) $certItem['cert']);
                    if ($key) {
                        return $key;
                    }
                }
            }
        }

        // 2. Secondary: match kid in public_cert object (if single object)
        if (isset($certs['public_cert']) && is_array($certs['public_cert'])) {
            if (($certs['public_cert']['kid'] ?? null) === $kid && ! empty($certs['public_cert']['cert'])) {
                $key = $this->parsePemCertificate((string) $certs['public_cert']['cert']);
                if ($key) {
                    return $key;
                }
            }
        }

        // 3. Fallback: match kid in keys[] (JWK RSA n and e, or x5c)
        if (isset($certs['keys']) && is_array($certs['keys'])) {
            foreach ($certs['keys'] as $keyItem) {
                if (is_array($keyItem) && ($keyItem['kid'] ?? null) === $kid) {
                    // Try x5c
                    if (! empty($keyItem['x5c'][0]) && is_string($keyItem['x5c'][0])) {
                        $key = $this->parsePemCertificate($keyItem['x5c'][0]);
                        if ($key) {
                            return $key;
                        }
                    }
                    // Try standard JWK RSA (n, e)
                    if (! empty($keyItem['n']) && ! empty($keyItem['e']) && ($keyItem['kty'] ?? '') === 'RSA') {
                        $key = $this->parseRsaJwk((string) $keyItem['n'], (string) $keyItem['e']);
                        if ($key) {
                            return $key;
                        }
                    }
                }
            }
        }

        return null;
    }

    protected function parsePemCertificate(string $cert): mixed
    {
        $cert = trim($cert);
        if (! str_contains($cert, '-----BEGIN CERTIFICATE-----')) {
            $cert = "-----BEGIN CERTIFICATE-----\n".chunk_split($cert, 64, "\n")."-----END CERTIFICATE-----";
        }

        $res = openssl_pkey_get_public($cert);

        return $res !== false ? $res : null;
    }

    protected function parseRsaJwk(string $nB64, string $eB64): mixed
    {
        $modulus = $this->base64UrlDecode($nB64);
        $exponent = $this->base64UrlDecode($eB64);

        if ($modulus === '' || $exponent === '') {
            return null;
        }

        $encodeLength = function (int $len): string {
            if ($len <= 0x7f) {
                return chr($len);
            }
            if ($len <= 0xff) {
                return chr(0x81).chr($len);
            }

            return chr(0x82).chr(($len >> 8) & 0xff).chr($len & 0xff);
        };

        $encodeInteger = function (string $bytes) use ($encodeLength): string {
            if (ord($bytes[0]) > 0x7f) {
                $bytes = "\x00".$bytes;
            }

            return "\x02".$encodeLength(strlen($bytes)).$bytes;
        };

        $modSeq = $encodeInteger($modulus);
        $expSeq = $encodeInteger($exponent);
        $rsaPubKey = "\x30".$encodeLength(strlen($modSeq.$expSeq)).$modSeq.$expSeq;

        $pem = "-----BEGIN RSA PUBLIC KEY-----\n".chunk_split(base64_encode($rsaPubKey), 64, "\n")."-----END RSA PUBLIC KEY-----";

        $res = openssl_pkey_get_public($pem);

        return $res !== false ? $res : null;
    }
}
