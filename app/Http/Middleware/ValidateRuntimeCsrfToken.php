<?php

namespace App\Http\Middleware;

use App\Support\DemoAccessManager;
use Closure;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class ValidateRuntimeCsrfToken extends VerifyCsrfToken
{
    /**
     * Allows automated feature tests to explicitly enforce CSRF validation
     * without relying solely on Laravel's default unit-test bypass.
     */
    public static bool $enforceInTests = false;

    /**
     * Handle an incoming request with cross-runtime isolation and runtime-specific CSRF.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        if ($mismatchResponse = $this->handleRuntimeMismatch($request)) {
            return $mismatchResponse;
        }

        return parent::handle($request, $next);
    }

    protected function runningUnitTests()
    {
        if (static::$enforceInTests) {
            return false;
        }

        return parent::runningUnitTests();
    }

    /**
     * Rejects stale tabs targeting the wrong runtime before any controller runs,
     * even if both production and demo session cookies exist in the browser.
     */
    protected function handleRuntimeMismatch(Request $request): ?Response
    {
        $demo = app(DemoAccessManager::class);
        $declaredRuntime = strtolower(trim((string) (
            $request->header($demo->runtimeHeaderName())
            ?: $request->input('_mfms_runtime', '')
        )));

        if ($declaredRuntime === '' || ! in_array($declaredRuntime, ['production', 'demo'], true)) {
            return null;
        }

        $activeRuntime = $demo->runtimeMode();
        if ($declaredRuntime === $activeRuntime) {
            return null;
        }

        Log::warning('Blocked cross-runtime request from stale tab context.', [
            'declared_runtime' => $declaredRuntime,
            'active_runtime' => $activeRuntime,
            'method' => $request->method(),
            'path' => $request->path(),
            'ip' => $request->ip(),
        ]);

        // For Inertia GET navigation across runtimes, force a full browser reload so
        // the tab never silently merges props or CSRF state from the wrong runtime.
        if ($this->isReading($request) && $request->header('X-Inertia')) {
            return $this->applySecurityHeaders(Inertia::location($request->fullUrl()), $demo);
        }

        if ($this->isReading($request)) {
            return null;
        }

        $recoveryUrl = $declaredRuntime === 'demo'
            ? '/demo?session_expired=1'
            : '/login?session_expired=1';

        if ($request->header('X-Inertia') || $request->expectsJson()) {
            $response = response()->json([
                'message' => $demo->sessionExpiredMessage(),
                'code' => 'RUNTIME_MISMATCH',
                'declared_runtime' => $declaredRuntime,
                'active_runtime' => $activeRuntime,
                'recovery_url' => $recoveryUrl,
            ], 409);
        } else {
            $response = response()->view('errors.419', [
                'message' => $demo->sessionExpiredMessage(),
                'recoveryUrl' => $recoveryUrl,
            ], 409);
        }

        $response->headers->set('X-MFMS-Runtime-Mismatch', '1');
        $response->headers->set('X-MFMS-Active-Runtime', $activeRuntime);

        return $this->applySecurityHeaders($response, $demo);
    }

    /**
     * Extract and validate the CSRF token strictly scoped to the active runtime.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return string|null
     */
    protected function getTokenFromRequest($request)
    {
        $token = $request->input('_token') ?: $request->header('X-CSRF-TOKEN');

        if (! $token) {
            $demo = app(DemoAccessManager::class);
            $expectedCookieName = $demo->xsrfCookieName();
            $header = $request->header($demo->xsrfHeaderName())
                ?: $request->header('X-XSRF-TOKEN');

            if (is_string($header) && $header !== '') {
                try {
                    $decrypted = $this->encrypter->decrypt($header, static::serialized());
                    $validated = CookieValuePrefix::validate(
                        $expectedCookieName,
                        $decrypted,
                        $this->encrypter->getAllKeys()
                    );
                    $token = is_string($validated) ? $validated : '';
                } catch (DecryptException) {
                    $token = '';
                }
            }
        }

        return $token;
    }

    /**
     * Emit only this runtime's dedicated XSRF cookie without colliding with
     * the other runtime or duplicating Set-Cookie headers.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Symfony\Component\HttpFoundation\Response  $response
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function addCookieToResponse($request, $response)
    {
        $config = config('session');

        if ($response instanceof Responsable) {
            $response = $response->toResponse($request);
        }

        $demo = app(DemoAccessManager::class);
        $xsrfCookieName = $demo->xsrfCookieName();

        // Do not overwrite an intentional cookie expiry (e.g. demo logout leaving demo runtime).
        if (! $demo->hasExpiringCookie($response, $xsrfCookieName)) {
            $response->headers->setCookie($this->newCookie($request, $config));
        }

        // Passively expire legacy shared XSRF-TOKEN cookie from pre-14C.1 browser profiles
        // once, without risking duplicate Set-Cookie headers.
        if ($request->cookies->has('XSRF-TOKEN') && ! $demo->hasCookie($response, 'XSRF-TOKEN')) {
            $response->headers->setCookie($demo->forgetCookie($request, 'XSRF-TOKEN', httpOnly: false));
        }

        return $response;
    }

    /**
     * Create the runtime-specific XSRF cookie (MFMS-PROD-XSRF-TOKEN or MFMS-DEMO-XSRF-TOKEN).
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  array  $config
     * @return \Symfony\Component\HttpFoundation\Cookie
     */
    protected function newCookie($request, $config)
    {
        $demo = app(DemoAccessManager::class);

        return new Cookie(
            $demo->xsrfCookieName(),
            $request->session()->token(),
            $this->availableAt(60 * $config['lifetime']),
            $demo->cookiePath(),
            $demo->cookieDomain(),
            $demo->cookieSecureFlag($request),
            false,
            false,
            $demo->cookieSameSite(),
            $config['partitioned'] ?? false
        );
    }

    public static function serialized()
    {
        return EncryptCookies::serialized(app(DemoAccessManager::class)->xsrfCookieName());
    }

    private function applySecurityHeaders(Response $response, DemoAccessManager $demo): Response
    {
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');
        $response->headers->set('Vary', 'Cookie, X-Inertia, Cf-Access-Jwt-Assertion');

        if ($demo->isDemoRuntime()) {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $response;
    }
}
