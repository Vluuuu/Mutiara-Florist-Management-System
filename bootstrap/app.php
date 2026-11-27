<?php

use App\Support\DemoAccessManager;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(
            at: env('APP_ENV') === 'production' ? '*' : ['127.0.0.1', '::1'],
            headers: Request::HEADER_X_FORWARDED_FOR |
                     Request::HEADER_X_FORWARDED_HOST |
                     Request::HEADER_X_FORWARDED_PORT |
                     Request::HEADER_X_FORWARDED_PROTO |
                     Request::HEADER_X_FORWARDED_PREFIX
        );

        $trustedHosts = [
            'localhost',
            '127.0.0.1',
            'admin.mutiaraflorist.id',
            'staging-admin.mutiaraflorist.id',
            '^.*\.onrender\.com$',
            '^.*\.railway\.app$',
        ];
        if ($appHost = parse_url(env('APP_URL', ''), PHP_URL_HOST)) {
            $trustedHosts[] = $appHost;
        }

        $middleware->trustHosts(at: array_values(array_unique(array_filter($trustedHosts))), subdomains: false);

        $middleware->encryptCookies(except: [
            'mfms_runtime',
            'CF_Authorization',
            'XSRF-TOKEN',
        ]);

        $middleware->append(\App\Http\Middleware\VerifyCloudflareAccessJwt::class);

        $middleware->web(
            replace: [
                ValidateCsrfToken::class => \App\Http\Middleware\ValidateRuntimeCsrfToken::class,
            ],
            append: [
                \App\Http\Middleware\EnforceDemoAccessLifecycle::class,
            ],
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->respond(function (Response $response, \Throwable $exception, Request $request): Response {
            if ($response->getStatusCode() !== 419) {
                return $response;
            }

            $demo = app(DemoAccessManager::class);
            $declaredRuntime = strtolower(trim((string) $request->header($demo->runtimeHeaderName(), '')));
            $recoveryUrl = ($demo->isDemoRuntime() || $declaredRuntime === 'demo')
                ? '/demo?session_expired=1'
                : '/login?session_expired=1';

            if ($request->header('X-Inertia') || $request->expectsJson()) {
                $handled = response()->json([
                    'message' => $demo->sessionExpiredMessage(),
                    'code' => 'SESSION_EXPIRED',
                    'recovery_url' => $recoveryUrl,
                ], 419);
            } else {
                $handled = response()->view('errors.419', [
                    'message' => $demo->sessionExpiredMessage(),
                    'recoveryUrl' => $recoveryUrl,
                ], 419);
            }

            $handled->headers->set('X-MFMS-Session-Expired', '1');
            $handled->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
            $handled->headers->set('Pragma', 'no-cache');
            $handled->headers->set('Expires', '0');
            $handled->headers->set('Vary', 'Cookie, X-Inertia, Cf-Access-Jwt-Assertion');

            if ($demo->isDemoRuntime()) {
                $handled->headers->set('X-Robots-Tag', 'noindex, nofollow');
            }

            return $handled;
        });
    })->create();

