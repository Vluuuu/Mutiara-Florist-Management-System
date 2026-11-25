<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Support\Facades\Config;

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
}
