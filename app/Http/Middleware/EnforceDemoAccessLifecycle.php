<?php

namespace App\Http\Middleware;

use App\Support\DemoAccessManager;
use App\Support\DemoRuntimeGuard;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class EnforceDemoAccessLifecycle
{
    /**
     * Routes disabled for demo users (legacy/debug/admin-entry endpoints).
     * Core business routes (dashboard, customers, orders, payments, expenses,
     * expense categories, reports, and Excel export) remain fully accessible.
     */
    private const BLOCKED_DEMO_PATHS = [
        'admin-entry',
        'ui-preview',
        'legacy/dashboard',
        'blade-dashboard',
        'blade-login',
    ];

    public function __construct(
        private readonly DemoAccessManager $demo
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('up')) {
            return $next($request);
        }

        if ($this->demo->isProductionRuntime()) {
            return $this->handleProductionGuard($request, $next);
        }

        return $this->handleDemoRuntime($request, $next);
    }

    private function handleProductionGuard(Request $request, Closure $next): Response
    {
        $user = Auth::user();
        $sessionMode = $request->session()->get('mfms_runtime_mode');

        if (
            ($user !== null && $this->demo->isDemoEmail($user->email))
            || $sessionMode === 'demo'
        ) {
            Log::warning('Blocked cross-environment demo session on production runtime.', [
                'ip' => $request->ip(),
                'path' => $request->path(),
            ]);

            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            abort(403, 'Akses Ditolak: Sesi demo tidak diizinkan pada lingkungan produksi.');
        }

        return $next($request);
    }

    private function handleDemoRuntime(Request $request, Closure $next): Response
    {
        // 1. Fail-closed database isolation verification (no fallback to pgsql/mysql)
        try {
            DemoRuntimeGuard::enforceSqliteOnlyIsolation();
            DemoRuntimeGuard::assertActiveConnectionIsSqlite();
        } catch (\Throwable $e) {
            Log::critical('Demo runtime isolation check failed.', [
                'error' => $e->getMessage(),
                'path' => $request->path(),
            ]);

            abort(503, 'Layanan demo sementara tidak tersedia karena konfigurasi isolasi belum valid.');
        }

        // 2. Atomic daily reset quiesce window (brief 503 with Retry-After)
        if ($this->demo->isResetting()) {
            return response('Data demo sedang diperbarui otomatis. Silakan muat ulang dalam beberapa detik.', 503)
                ->header('Retry-After', '3')
                ->header('X-Robots-Tag', 'noindex, nofollow');
        }

        // 3. Block sensitive/legacy/admin-only paths in demo runtime
        foreach (self::BLOCKED_DEMO_PATHS as $blockedPath) {
            if ($request->is($blockedPath) || $request->is($blockedPath.'/*')) {
                abort(403, 'Halaman ini tidak tersedia pada mode demo.');
            }
        }

        // 4. Enforce server-side expiration, kill switch, and session integrity for authenticated sessions
        $user = Auth::user();
        if ($user !== null) {
            $sessionMode = $request->session()->get('mfms_runtime_mode');
            $validDemoUser = $this->demo->isDemoEmail($user->email) && $sessionMode === 'demo';

            if (! $validDemoUser || ! $this->demo->isActive()) {
                $reason = ! $validDemoUser
                    ? 'Sesi tidak valid untuk lingkungan demo.'
                    : $this->demo->inactiveReason();

                Log::info('Revoking demo session due to lifecycle or isolation check.', [
                    'reason' => $reason,
                    'path' => $request->path(),
                ]);

                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                $expiredRoutingCookie = Cookie::forget($this->demo->routingCookieName(), '/');

                if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                    return response()
                        ->json(['message' => $reason], 403)
                        ->withCookie($expiredRoutingCookie);
                }

                return redirect()
                    ->route('login')
                    ->withErrors(['email' => $reason])
                    ->withCookie($expiredRoutingCookie);
            }
        }

        $response = $next($request);

        // Prevent search engines from indexing demo pages
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');

        return $response;
    }
}
