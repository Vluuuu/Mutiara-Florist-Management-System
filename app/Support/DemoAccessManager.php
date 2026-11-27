<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Cookie;
use Symfony\Component\HttpFoundation\Cookie as SymfonyCookie;
use Symfony\Component\HttpFoundation\Response;

class DemoAccessManager
{
    public function runtimeMode(): string
    {
        $mode = strtolower(trim((string) Config::get('demo.runtime_mode', 'production')));

        return $mode === 'demo' ? 'demo' : 'production';
    }

    public function isDemoRuntime(): bool
    {
        return $this->runtimeMode() === 'demo';
    }

    public function isProductionRuntime(): bool
    {
        return ! $this->isDemoRuntime();
    }

    public function demoEmail(): string
    {
        return strtolower(trim((string) Config::get('demo.email', 'demo@mutiaraflorist.id')));
    }

    public function demoPassword(): ?string
    {
        $password = Config::get('demo.password');
        if (! is_string($password) || trim($password) === '') {
            return null;
        }

        return $password;
    }

    public function isDemoEmail(?string $email): bool
    {
        if (! is_string($email) || trim($email) === '') {
            return false;
        }

        return strtolower(trim($email)) === $this->demoEmail();
    }

    public function killSwitchPath(): string
    {
        return (string) Config::get('demo.kill_switch_file', storage_path('app/demo/demo.disabled'));
    }

    public function isKillSwitchEngaged(): bool
    {
        $path = $this->killSwitchPath();

        return $path !== '' && is_file($path);
    }

    public function isEnabled(): bool
    {
        if (! (bool) Config::get('demo.enabled', false)) {
            return false;
        }

        if ($this->isKillSwitchEngaged()) {
            return false;
        }

        return true;
    }

    public function activatedAt(): ?Carbon
    {
        $raw = Config::get('demo.activated_at');
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        try {
            return Carbon::parse(trim($raw), 'Asia/Jakarta')->timezone('Asia/Jakarta');
        } catch (\Throwable) {
            return null;
        }
    }

    public function expiresAt(): ?Carbon
    {
        $explicit = Config::get('demo.expires_at');
        if (is_string($explicit) && trim($explicit) !== '') {
            try {
                return Carbon::parse(trim($explicit), 'Asia/Jakarta')->timezone('Asia/Jakarta');
            } catch (\Throwable) {
                return null;
            }
        }

        $activated = $this->activatedAt();
        if ($activated === null) {
            return null;
        }

        $days = max(1, (int) Config::get('demo.duration_days', 14));

        return $activated->copy()->addDays($days);
    }

    public function isExpired(?Carbon $now = null): bool
    {
        $expiresAt = $this->expiresAt();
        if ($expiresAt === null) {
            // Fail closed: if no activation/expiration window is configured, demo is expired.
            return true;
        }

        $current = ($now ?? Carbon::now('Asia/Jakarta'))->copy()->timezone('Asia/Jakarta');

        return $current->greaterThanOrEqualTo($expiresAt);
    }

    public function isActive(?Carbon $now = null): bool
    {
        if (! $this->isDemoRuntime()) {
            return false;
        }

        if (! $this->isEnabled()) {
            return false;
        }

        if ($this->demoPassword() === null) {
            return false;
        }

        return ! $this->isExpired($now);
    }

    /**
     * Determines whether the compact demo credentials section should be
     * rendered below the existing login form.
     *
     * Displayed ONLY inside the isolated demo runtime while active and unexpired.
     */
    public function shouldDisplayCredentials(?Carbon $now = null): bool
    {
        return $this->isActive($now);
    }

    /**
     * Public login view payload for the compact demo credentials section.
     *
     * @return array{available: bool, email?: string, password?: string, reset_interval?: string}|null
     */
    public function loginViewPayload(?Carbon $now = null): ?array
    {
        if (! $this->shouldDisplayCredentials($now)) {
            return null;
        }

        return [
            'available' => true,
            'email' => $this->demoEmail(),
            'password' => (string) $this->demoPassword(),
            'reset_interval' => '24 jam',
        ];
    }

    /**
     * Determines whether the primary runtime login page should display a compact
     * link to enter the isolated demo runtime (/demo).
     *
     * Never exposes demo credentials on the primary runtime.
     */
    public function shouldShowDemoEntryLink(?Carbon $now = null): bool
    {
        if (! $this->isProductionRuntime()) {
            return false;
        }

        if (! (bool) Config::get('demo.entry_link_enabled', false)) {
            return false;
        }

        // If an expiration window is also configured on primary, hide the entry link once expired.
        if ($this->expiresAt() !== null && $this->isExpired($now)) {
            return false;
        }

        return true;
    }

    /**
     * Navigation metadata for the login screen only.
     *
     * @return array{is_demo_runtime: bool, demo_entry_url?: string, admin_entry_url?: string, inactive_notice?: string|null}|null
     */
    public function loginNavigationPayload(?Carbon $now = null): ?array
    {
        if ($this->isDemoRuntime()) {
            return [
                'is_demo_runtime' => true,
                'admin_entry_url' => '/admin-entry',
                'inactive_notice' => $this->isActive($now) ? null : $this->inactiveReason($now),
            ];
        }

        if ($this->shouldShowDemoEntryLink($now)) {
            return [
                'is_demo_runtime' => false,
                'demo_entry_url' => '/demo',
            ];
        }

        return null;
    }

    public function inactiveReason(?Carbon $now = null): string
    {
        if (! $this->isEnabled()) {
            return 'Akses demo sementara sedang dinonaktifkan.';
        }

        if ($this->isExpired($now)) {
            return 'Masa akses demo sementara (14 hari) telah berakhir.';
        }

        if ($this->demoPassword() === null) {
            return 'Konfigurasi akun demo belum lengkap.';
        }

        return 'Akses demo tidak tersedia.';
    }

    public function isResetting(): bool
    {
        $flagPath = (string) Config::get('demo.resetting_flag_file', storage_path('app/demo/resetting.flag'));

        if ($flagPath === '' || ! is_file($flagPath)) {
            return false;
        }

        // Self-healing crash recovery: if resetting.flag is stale (> 30s) and no active
        // reset process holds reset.lock, clear the orphaned flag so traffic resumes cleanly.
        $mtime = @filemtime($flagPath);
        if ($mtime !== false && (time() - $mtime) > 30) {
            $lockPath = (string) Config::get('demo.reset_lock_file', dirname($flagPath).'/reset.lock');
            $lockHandle = @fopen($lockPath, 'c+');
            if ($lockHandle !== false) {
                if (flock($lockHandle, LOCK_EX | LOCK_NB)) {
                    @unlink($flagPath);
                    flock($lockHandle, LOCK_UN);
                    fclose($lockHandle);

                    return false;
                }
                fclose($lockHandle);
            }
        }

        return true;
    }

    public function routingCookieName(): string
    {
        return (string) Config::get('demo.routing_cookie_name', 'mfms_runtime');
    }

    public function routingCookieValue(): string
    {
        return (string) Config::get('demo.routing_cookie_value', 'demo');
    }

    public function xsrfCookieName(): string
    {
        return $this->isDemoRuntime()
            ? (string) Config::get('demo.demo_xsrf_cookie_name', 'MFMS-DEMO-XSRF-TOKEN')
            : (string) Config::get('demo.prod_xsrf_cookie_name', 'MFMS-PROD-XSRF-TOKEN');
    }

    public function xsrfHeaderName(): string
    {
        return $this->isDemoRuntime()
            ? (string) Config::get('demo.demo_xsrf_header_name', 'X-MFMS-DEMO-XSRF-TOKEN')
            : (string) Config::get('demo.prod_xsrf_header_name', 'X-MFMS-PROD-XSRF-TOKEN');
    }

    public function demoXsrfCookieName(): string
    {
        return (string) Config::get('demo.demo_xsrf_cookie_name', 'MFMS-DEMO-XSRF-TOKEN');
    }

    public function runtimeHeaderName(): string
    {
        return (string) Config::get('demo.runtime_header_name', 'X-MFMS-Runtime');
    }

    public function sessionExpiredMessage(): string
    {
        return 'Sesi telah berakhir. Silakan masuk kembali.';
    }

    public function cookiePath(): string
    {
        $path = Config::get('session.path', '/');

        return is_string($path) && $path !== '' ? $path : '/';
    }

    public function cookieDomain(): ?string
    {
        $domain = Config::get('session.domain');

        return is_string($domain) && trim($domain) !== '' ? $domain : null;
    }

    public function cookieSecureFlag(Request $request): bool
    {
        $configured = Config::get('session.secure');

        return is_bool($configured) ? $configured : $request->isSecure();
    }

    public function cookieSameSite(): string
    {
        $sameSite = Config::get('session.same_site', 'lax');

        return is_string($sameSite) && $sameSite !== '' ? $sameSite : 'lax';
    }

    /**
     * Sliding lifetime for the runtime selector cookie (mfms_runtime=demo).
     * Always meets or exceeds session.lifetime (+15m safety margin against clock skew)
     * and is refreshed on every active demo request so it never expires while a valid
     * demo session remains active.
     */
    public function routingCookieLifetimeMinutes(): int
    {
        if ((bool) Config::get('session.expire_on_close', false)) {
            return 0;
        }

        $sessionLifetime = max(1, (int) Config::get('session.lifetime', 120));
        $configured = (int) Config::get('demo.routing_cookie_lifetime', 0);

        return $configured > 0
            ? max($configured, $sessionLifetime)
            : $sessionLifetime + 15;
    }

    public function makeRoutingCookie(Request $request): SymfonyCookie
    {
        return Cookie::make(
            name: $this->routingCookieName(),
            value: $this->routingCookieValue(),
            minutes: $this->routingCookieLifetimeMinutes(),
            path: $this->cookiePath(),
            domain: $this->cookieDomain(),
            secure: $this->cookieSecureFlag($request),
            httpOnly: true,
            raw: false,
            sameSite: $this->cookieSameSite(),
        );
    }

    public function forgetRoutingCookie(Request $request): SymfonyCookie
    {
        return $this->forgetCookie($request, $this->routingCookieName(), httpOnly: true);
    }

    public function forgetCookie(Request $request, string $name, bool $httpOnly = true): SymfonyCookie
    {
        return new SymfonyCookie(
            name: $name,
            value: null,
            expire: 1,
            path: $this->cookiePath(),
            domain: $this->cookieDomain(),
            secure: $this->cookieSecureFlag($request),
            httpOnly: $httpOnly,
            raw: false,
            sameSite: $this->cookieSameSite(),
        );
    }

    public function hasExpiringCookie(Response $response, string $name): bool
    {
        $now = time();

        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === $name && $cookie->getExpiresTime() > 0 && $cookie->getExpiresTime() <= $now) {
                return true;
            }
        }

        return false;
    }

    public function hasCookie(Response $response, string $name): bool
    {
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === $name) {
                return true;
            }
        }

        return false;
    }

    /**
     * Runtime metadata shared with the browser tab so Inertia 3 binds
     * CSRF cookies/headers and cross-runtime assertions strictly to this runtime.
     *
     * @return array{mode: 'production'|'demo', xsrf_cookie: string, xsrf_header: string, runtime_header: string}
     */
    public function frontendRuntimePayload(): array
    {
        return [
            'mode' => $this->isDemoRuntime() ? 'demo' : 'production',
            'xsrf_cookie' => $this->xsrfCookieName(),
            'xsrf_header' => $this->xsrfHeaderName(),
            'runtime_header' => $this->runtimeHeaderName(),
        ];
    }
}
