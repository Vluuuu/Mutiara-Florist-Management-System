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
    private static ?string $testRsaN = null;
    private static ?string $testRsaE = null;

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
            $details = openssl_pkey_get_details($res);

            $base64Url = fn ($data) => rtrim(strtr(base64_encode($data), '+/', '-_'), '=');

            self::$testPublicCert = $certOut;
            self::$testPrivateKey = $privOut;
            self::$testRsaN = $base64Url($details['rsa']['n']);
            self::$testRsaE = $base64Url($details['rsa']['e']);
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

    private function mockJwks(string $teamDomain, string $kid, ?string $cert = null, ?string $rsaN = null, ?string $rsaE = null): void
    {
        $certToUse = $cert ?? self::$testPublicCert;
        $nToUse = $rsaN ?? self::$testRsaN;
        $eToUse = $rsaE ?? self::$testRsaE;

        // Realistic Cloudflare response: keys has JWK RSA (n and e, NO cert), public_certs has PEM certs
        Http::fake([
            "https://{$teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs" => Http::response([
                'keys' => [
                    [
                        'kid' => $kid,
                        'kty' => 'RSA',
                        'alg' => 'RS256',
                        'use' => 'sig',
                        'e' => $eToUse,
                        'n' => $nToUse,
                    ],
                ],
                'public_cert' => [
                    'kid' => $kid,
                    'cert' => $certToUse,
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
            'email' => 'operator@example.com',
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);
        $request->headers->set('X-MFMS-Edge-Secret', 'edge-secret-xyz');

        $middleware = new VerifyCloudflareAccessJwt();
        $response = $middleware->handle($request, function ($req) {
            $this->assertSame('operator@example.com', $req->attributes->get('cf_access_email'));
            return response('OK', 200);
        });

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_accepts_valid_jwt_via_jwk_keys_fallback_without_public_certs(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        // Simulates an endpoint returning only standard JWK RSA keys array (no public_certs/public_cert)
        Http::fake([
            'https://test-team.cloudflareaccess.com/cdn-cgi/access/certs' => Http::response([
                'keys' => [
                    [
                        'kid' => 'test-kid',
                        'kty' => 'RSA',
                        'alg' => 'RS256',
                        'use' => 'sig',
                        'e' => self::$testRsaE,
                        'n' => self::$testRsaN,
                    ],
                ],
            ], 200),
        ]);

        $jwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
            'email' => 'operator@mutiaraflorist.id',
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $middleware = new VerifyCloudflareAccessJwt();
        $response = $middleware->handle($request, fn ($req) => response('OK', 200));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_key_rotation_handles_new_key_id_after_rotation(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        // Initial JWKS only has old-kid
        $oldKid = 'old-kid-1';
        $newKid = 'new-kid-2';

        $configPath = file_exists('D:/xampp/apache/conf/openssl.cnf') ? 'D:/xampp/apache/conf/openssl.cnf' : null;
        $opts = $configPath ? ['config' => $configPath] : [];

        $newRes = openssl_pkey_new(array_merge(['private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA], $opts));
        $newCsr = openssl_csr_new(['commonName' => 'cloudflare-rotation-test'], $newRes, $opts);
        $newCert = openssl_csr_sign($newCsr, null, $newRes, 1, $opts);
        openssl_x509_export($newCert, $newCertOut);
        openssl_pkey_export($newRes, $newPrivOut, null, $opts);
        $newDetails = openssl_pkey_get_details($newRes);
        $base64Url = fn ($data) => rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
        $newN = $base64Url($newDetails['rsa']['n']);
        $newE = $base64Url($newDetails['rsa']['e']);

        $callCount = 0;
        Http::fake([
            'https://test-team.cloudflareaccess.com/cdn-cgi/access/certs' => function () use (&$callCount, $oldKid, $newKid, $newCertOut, $newN, $newE) {
                $callCount++;
                if ($callCount === 1) {
                    // First call: only old kid
                    return Http::response([
                        'keys' => [
                            [
                                'kid' => $oldKid,
                                'kty' => 'RSA',
                                'alg' => 'RS256',
                                'use' => 'sig',
                                'e' => self::$testRsaE,
                                'n' => self::$testRsaN,
                            ],
                        ],
                        'public_certs' => [
                            [
                                'kid' => $oldKid,
                                'cert' => self::$testPublicCert,
                            ],
                        ],
                    ], 200);
                }

                // Subsequent call (after cache bust due to unknown kid): rotated certs contain both keys
                return Http::response([
                    'keys' => [
                        [
                            'kid' => $oldKid,
                            'kty' => 'RSA',
                            'alg' => 'RS256',
                            'use' => 'sig',
                            'e' => self::$testRsaE,
                            'n' => self::$testRsaN,
                        ],
                        [
                            'kid' => $newKid,
                            'kty' => 'RSA',
                            'alg' => 'RS256',
                            'use' => 'sig',
                            'e' => $newE,
                            'n' => $newN,
                        ],
                    ],
                    'public_certs' => [
                        [
                            'kid' => $oldKid,
                            'cert' => self::$testPublicCert,
                        ],
                        [
                            'kid' => $newKid,
                            'cert' => $newCertOut,
                        ],
                    ],
                ], 200);
            },
        ]);

        // Request 1 with old key populates cache
        $oldJwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ], ['alg' => 'RS256', 'kid' => $oldKid]);

        $middleware = new VerifyCloudflareAccessJwt();
        $res1 = $middleware->handle(Request::create('/dashboard', 'GET', server: ['HTTP_CF_ACCESS_JWT_ASSERTION' => $oldJwt]), fn () => response('OK', 200));
        $this->assertSame(200, $res1->getStatusCode());
        $this->assertSame(1, $callCount);

        // Request 2 arrives with rotated key (new-kid) not in initial cache -> triggers automatic cache bust and fresh fetch
        $newJwt = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ], ['alg' => 'RS256', 'kid' => $newKid], $newPrivOut);

        $res2 = $middleware->handle(Request::create('/dashboard', 'GET', server: ['HTTP_CF_ACCESS_JWT_ASSERTION' => $newJwt]), fn () => response('OK', 200));
        $this->assertSame(200, $res2->getStatusCode());
        $this->assertSame(2, $callCount);
    }

    public function test_key_rotation_accepts_multiple_valid_keys_in_public_certs(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
        ]);

        $kid1 = 'key-alpha';
        $kid2 = 'key-beta';

        $configPath = file_exists('D:/xampp/apache/conf/openssl.cnf') ? 'D:/xampp/apache/conf/openssl.cnf' : null;
        $opts = $configPath ? ['config' => $configPath] : [];

        $res2 = openssl_pkey_new(array_merge(['private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA], $opts));
        $csr2 = openssl_csr_new(['commonName' => 'cloudflare-beta'], $res2, $opts);
        $cert2 = openssl_csr_sign($csr2, null, $res2, 1, $opts);
        openssl_x509_export($cert2, $cert2Out);
        openssl_pkey_export($res2, $priv2Out, null, $opts);

        Http::fake([
            'https://test-team.cloudflareaccess.com/cdn-cgi/access/certs' => Http::response([
                'keys' => [
                    ['kid' => $kid1, 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'e' => self::$testRsaE, 'n' => self::$testRsaN],
                ],
                'public_certs' => [
                    ['kid' => $kid1, 'cert' => self::$testPublicCert],
                    ['kid' => $kid2, 'cert' => $cert2Out],
                ],
            ], 200),
        ]);

        $jwt1 = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ], ['alg' => 'RS256', 'kid' => $kid1]);

        $jwt2 = $this->createJwt([
            'aud' => 'aud-123',
            'iss' => 'https://test-team.cloudflareaccess.com',
            'exp' => time() + 3600,
        ], ['alg' => 'RS256', 'kid' => $kid2], $priv2Out);

        $middleware = new VerifyCloudflareAccessJwt();

        $res1 = $middleware->handle(Request::create('/dashboard', 'GET', server: ['HTTP_CF_ACCESS_JWT_ASSERTION' => $jwt1]), fn () => response('OK', 200));
        $this->assertSame(200, $res1->getStatusCode());

        $res2 = $middleware->handle(Request::create('/dashboard', 'GET', server: ['HTTP_CF_ACCESS_JWT_ASSERTION' => $jwt2]), fn () => response('OK', 200));
        $this->assertSame(200, $res2->getStatusCode());
    }

    public function test_edge_secret_valid_without_jwt_is_still_rejected(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_team_domain' => 'test-team',
            'services.cloudflare.access_aud' => 'aud-123',
            'services.cloudflare.edge_secret' => 'edge-secret-xyz',
        ]);

        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('X-MFMS-Edge-Secret', 'edge-secret-xyz');
        // No Cf-Access-Jwt-Assertion header provided

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Autentikasi Cloudflare Access Zero Trust wajib ada');

        $middleware = new VerifyCloudflareAccessJwt();
        $middleware->handle($request, fn () => response('OK', 200));
    }
}
