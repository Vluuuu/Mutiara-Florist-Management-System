<?php

namespace Tests\Feature;

use App\Http\Middleware\VerifyCloudflareAccessJwt;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class CloudflareAccessMiddlewareTest extends TestCase
{
    private function createJwt(array $payload, array $header = ['alg' => 'RS256', 'kid' => 'test-kid']): string
    {
        $base64Url = fn ($data) => rtrim(strtr(base64_encode(json_encode($data)), '+/', '-_'), '=');
        $rawHeader = $base64Url($header);
        $rawPayload = $base64Url($payload);
        $rawSignature = rtrim(strtr(base64_encode('dummy_signature'), '+/', '-_'), '=');

        return "{$rawHeader}.{$rawPayload}.{$rawSignature}";
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

    public function test_rejects_request_without_jwt_when_enforced(): void
    {
        config(['services.cloudflare.access_enforce' => true]);

        $middleware = new VerifyCloudflareAccessJwt();
        $request = Request::create('/dashboard', 'GET');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Autentikasi Cloudflare Access Zero Trust wajib ada');

        $middleware->handle($request, fn ($req) => response('OK', 200));
    }

    public function test_rejects_expired_jwt_when_enforced(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_aud' => 'expected-aud-12345',
        ]);

        $jwt = $this->createJwt([
            'aud' => 'expected-aud-12345',
            'email' => 'dewoxxd6@gmail.com',
            'exp' => time() - 3600, // Expired 1 hour ago
        ]);

        $middleware = new VerifyCloudflareAccessJwt();
        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Sesi Cloudflare Access telah kedaluwarsa');

        $middleware->handle($request, fn ($req) => response('OK', 200));
    }

    public function test_rejects_mismatched_audience_tag(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_aud' => 'valid-aud-tag',
        ]);

        $jwt = $this->createJwt([
            'aud' => 'wrong-aud-tag',
            'email' => 'dewoxxd6@gmail.com',
            'exp' => time() + 3600,
        ]);

        $middleware = new VerifyCloudflareAccessJwt();
        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Target aplikasi Cloudflare Access tidak cocok');

        $middleware->handle($request, fn ($req) => response('OK', 200));
    }

    public function test_accepts_valid_jwt_and_attaches_email_attribute(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.access_aud' => 'valid-aud-tag',
        ]);

        $jwt = $this->createJwt([
            'aud' => 'valid-aud-tag',
            'email' => 'dewoxxd6@gmail.com',
            'exp' => time() + 3600,
        ]);

        $middleware = new VerifyCloudflareAccessJwt();
        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);

        $response = $middleware->handle($request, function ($req) {
            return response($req->attributes->get('cf_access_email'), 200);
        });

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('dewoxxd6@gmail.com', $response->getContent());
    }

    public function test_rejects_missing_or_invalid_edge_secret_when_configured(): void
    {
        config([
            'services.cloudflare.access_enforce' => true,
            'services.cloudflare.edge_secret' => 'super-secret-edge-token-2026',
        ]);

        $jwt = $this->createJwt([
            'email' => 'dewoxxd6@gmail.com',
            'exp' => time() + 3600,
        ]);

        $middleware = new VerifyCloudflareAccessJwt();
        $request = Request::create('/dashboard', 'GET');
        $request->headers->set('Cf-Access-Jwt-Assertion', $jwt);
        $request->headers->set('X-MFMS-Edge-Secret', 'wrong-secret');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Permintaan wajib melalui Cloudflare Edge resmi');

        $middleware->handle($request, fn ($req) => response('OK', 200));
    }
}
