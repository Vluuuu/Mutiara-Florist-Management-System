<?php

namespace Tests\Feature;

use App\Http\Middleware\VerifyCloudflareAccessJwt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class CloudflareAccessMiddlewareTest extends TestCase
{
    private static ?string $testPrivateKey = null;
    private static ?string $testPublicCert = null;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();

        if (self::$testPrivateKey === null) {
            $configPath = file_exists('D:/xampp/apache/conf/openssl.cnf')
                ? 'D:/xampp/apache/conf/openssl.cnf'
                : null;
            $opts = $configPath ? ['config' => $configPath] : [];

            $res = openssl_pkey_new(array_merge(['private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA], $opts));
            $csr = openssl_csr_new(['commonName' => 'cloudflare-access-test'], $res, $opts);
            $cert = openssl_csr_sign($csr, null, $res, 1, $opts);

            openssl_x509_export($cert, $certOut);
            openssl_pkey_export($res, $privOut, null, $opts);

            self::$testPublicCert = $certOut;
            self::$testPrivateKey = $privOut;
        }
    }

    private function createJwt(array $payload, array $header = ['alg' => 'RS256', 'kid' => 'test-kid'], ?string $signingKey = null): string
    {
        $base64Url = fn ($data) => rtrim(strtr(base64_encode(is_string($data) ? $data : json_encode($data)), '+/', '-_'), '=');
        $rawHeader = $base64Url($header);
        $rawPayload = $base64Url($payload);
        $signingInput = "{$rawHeader}.{$rawPayload}";

        $keyToUse = $signingKey ?? self::$testPrivateKey;
        if ($keyToUse) {
            openssl_sign($signingInput, $signature, $keyToUse, OPENSSL_ALGO_SHA256);
            $rawSignature = $base64Url($signature);
        } else {
            $rawSignature = $base64Url('invalid_dummy_signature');
        }

        return "{$signingInput}.{$rawSignature}";
    }

    private function mockJwks(string $teamDomain, string $kid, ?string $cert = null): void
    {
        $certToUse = $cert ?? self::$testPublicCert;
        Http::fake([
            "https://{$teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs" => Http::response([
                'keys' => [
                    [
                        'kid' => $kid,
                        'kty' => 'RSA',
                        'alg' => 'RS256',
                        'use' => 'sig',
                        'cert' => $certToUse,
                    ],
                ],
                'public_certs' => [
                    [
                        'kid' => $kid,
                        'cert' => $certToUse,
                    ],
                ],
            ], 200),
        ]);
    }

    public function test_allows_request_when_enforcement_is_disabled(): void
    {
        config(['services.cloudflare.access_enforce' => false]);

        $middleware = new VerifyCloudflareAccessJwt();
        $request = Request::create('/dashboard', 'GET');

        $response = $middleware->handle($request, fn ($req) => response('OK', 200));
        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_allows_healthcheck_up_endpoint_even_when_enforced(): void
    {
        config(['services.cloudflare.access_enforce' => true]);

        $middleware = new VerifyCloudflareAccessJwt();
        $request = Request::create('/up', 'GET');

        $response = $middleware->handle($request, fn ($req) => response('OK', 200));
        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_rejects_when_enforced_but_missing_team_domain(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => null,
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Konfigurasi keamanan Cloudflare Access belum lengkap');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle(Request::create('/dashboard', 'GET'), fn () => response('OK', 200));
    }

    public function test_rejects_when_enforced_but_missing_aud_config(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => null,
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Konfigurasi keamanan Cloudflare Access belum lengkap');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle(Request::create('/dashboard', 'GET'), fn () => response('OK', 200));
    }

    public function test_rejects_request_without_jwt_when_enforced(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Autentikasi Cloudflare Access Zero Trust wajib ada');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle(Request::create('/dashboard', 'GET'), fn () => response('OK', 200));
    }

    public function test_rejects_malformed_jwt_parts(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', 'invalid.jwt');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Format token Cloudflare Access tidak valid');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_unsupported_algorithm(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $jwt = $this->createJwt(
            ['aud' => 'aud-123', 'exp' => time() + 3600, 'iss' => 'https://test-team.cloudflareaccess.com'],
            ['alg' => 'HS256', 'kid' => 'test-kid']
        );

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Algoritma token Cloudflare Access harus RS256');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_jwt_without_kid(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $jwt = $this->createJwt(
            ['aud' => 'aud-123', 'exp' => time() + 3600, 'iss' => 'https://test-team.cloudflareaccess.com'],
            ['alg' => 'RS256']
        );

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Token Cloudflare Access tidak memiliki Key ID');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_expired_jwt(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() - 3600,
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Sesi Cloudflare Access telah kedaluwarsa');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_future_nbf(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
            'nbf' => time() + 1800,
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Sesi Cloudflare Access belum aktif');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_wrong_issuer(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://attacker-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Penerbit (issuer) token Cloudflare Access tidak valid');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_mismatched_audience_tag(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $jwt = $this->createJwt([
            'aud' => 'wrong-aud-456',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Target aplikasi Cloudflare Access tidak cocok');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_when_jwks_is_unavailable_fail_closed(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        Http::fake([
            'https://test-team.cloudflareaccess.com/cdn-cgi/access/certs' => Http::response(null, 500),
        ]);

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Validasi tanda tangan digital Cloudflare Access gagal');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_when_jwks_does_not_contain_matching_kid(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $this->mockJwks('test-team', 'different-kid');

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ], ['alg' => 'RS256', 'kid' => 'my-kid']);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Validasi tanda tangan digital Cloudflare Access gagal');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_forged_jwt_with_invalid_signature(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $this->mockJwks('test-team', 'test-kid');

        // Create token with attacker's different key
        $configPath = file_exists('D:/xampp/apache/conf/openssl.cnf') ? 'D:/xampp/apache/conf/openssl.cnf' : null;
        $opts = $configPath ? ['config' => $configPath] : [];
        $attackerRes = openssl_pkey_new(array_merge(['private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA], $opts));
        openssl_pkey_export($attackerRes, $attackerPriv, null, $opts);

        $forgedJwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
            'email' => 'admin@mutiaraflorist.id',
        ], ['alg' => 'RS256', 'kid' => 'test-kid'], $attackerPriv);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $forgedJwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Validasi tanda tangan digital Cloudflare Access gagal');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_rejects_missing_or_invalid_edge_secret_when_configured(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
            'services.cloudflare.edge_secret' => 'super-secret-edge-key-123',
        ]);

        $this->mockJwks('test-team', 'test-kid');

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ]);

        // Request with invalid edge secret
        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);
        $request->headers->set('X-MFMS-Edge-Secret', 'wrong-secret');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Permintaan wajib melalui Cloudflare Edge resmi');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }

    public function test_accepts_valid_jwt_and_attaches_email_attribute(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
            'services.cloudflare.edge_secret' => 'edge-secret-xyz',
        ]);

        $this->mockJwks('test-team', 'test-kid');

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
            'email' => 'dewoxxd6@gmail.com',
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);
        $request->headers->set('X-MFMS-Edge-Secret', 'edge-secret-xyz');

        $middleware = new VerifyCloudflareAccessJwt();
        $response = $middleware->handle($request, function ($req) {
            $this->assertSame('dewoxxd6@gmail.com', $req->attributes->get('cf_access_email'));
            return response('OK', 200);
        });

        $this->assertSame(200, $response->getStatusCode());
    }
}
