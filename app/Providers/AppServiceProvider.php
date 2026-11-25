<?php

namespace App\Providers;

use App\Support\DemoAccessManager;
use App\Support\DemoRuntimeGuard;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(DemoAccessManager::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        DemoRuntimeGuard::enforceSqliteOnlyIsolation();

        RateLimiter::for('login', function (Request $request): array {
            $email = strtolower(trim((string) $request->input('email', '')));
            $ip = (string) $request->ip();

            return [
                Limit::perMinute(6)->by($email.'|'.$ip),
                Limit::perMinute(20)->by($ip),
            ];
        });

        RateLimiter::for('demo-export', function (Request $request): Limit {
            if (! app(DemoAccessManager::class)->isDemoRuntime()) {
                return Limit::none();
            }

            return Limit::perMinute(10)->by((string) $request->ip());
        });
    }
}
