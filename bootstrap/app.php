<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

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
        ];
        if ($appHost = parse_url(env('APP_URL', ''), PHP_URL_HOST)) {
            $trustedHosts[] = $appHost;
        }

        $middleware->trustHosts(at: array_values(array_unique(array_filter($trustedHosts))), subdomains: false);

        $middleware->web(append: [
            \App\Http\Middleware\VerifyCloudflareAccessJwt::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();

