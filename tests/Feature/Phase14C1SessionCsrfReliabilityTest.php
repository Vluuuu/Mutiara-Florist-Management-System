<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateRuntimeCsrfToken;
use App\Models\Customer;
use App\Models\User;
use App\Support\DemoAccessManager;
use Carbon\Carbon;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Encryption\Encrypter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpFoundation\Cookie as SymfonyCookie;
use Tests\TestCase;

class Phase14C1SessionCsrfReliabilityTest extends TestCase
{
    use RefreshDatabase;

    private string $tempKillSwitch;

    private string $tempResetFlag;

    protected function setUp(): void
    {
        parent::setUp();

        ValidateRuntimeCsrfToken::$enforceInTests = true;

        $tmpDir = storage_path('framework/testing/phase14c1');
        if (! is_dir($tmpDir)) {
            mkdir($tmpDir, 0775, true);
        }

        $this->tempKillSwitch = $tmpDir.'/demo_'.uniqid().'.disabled';
        $this->tempResetFlag = $tmpDir.'/resetting_'.uniqid().'.flag';

        Config::set('demo.kill_switch_file', $this->tempKillSwitch);
        Config::set('demo.resetting_flag_file', $this->tempResetFlag);
    }

    protected function tearDown(): void
    {
        ValidateRuntimeCsrfToken::$enforceInTests = false;
        Carbon::setTestNow();

        foreach ([$this->tempKillSwitch, $this->tempResetFlag] as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }

    private function enableDemoRuntime(string $password = 'Mutiara-14C1-8k2P'): void
    {
        Config::set('demo.runtime_mode', 'demo');
        Config::set('demo.enabled', true);
        Config::set('demo.email', 'demo@mutiaraflorist.id');
        Config::set('demo.password', $password);
        Config::set('demo.activated_at', Carbon::now('Asia/Jakarta')->subDay()->toIso8601String());
        Config::set('demo.expires_at', null);
        Config::set('demo.duration_days', 14);
        Config::set('session.cookie', 'mfms_demo_session');
    }

    private function enableProductionRuntime(): void
    {
        Config::set('demo.runtime_mode', 'production');
        Config::set('demo.enabled', false);
        Config::set('demo.entry_link_enabled', true);
        Config::set('session.cookie', 'mfms_prod_session');
    }

    /**
     * @param  array<int, SymfonyCookie>  $cookies
     */
    private function assertNoDuplicateSetCookieNames(array $cookies): void
    {
        $names = array_map(static fn (SymfonyCookie $c): string => $c->getName(), $cookies);
        $this->assertSame(
            count($names),
            count(array_unique($names)),
            'Duplicate Set-Cookie headers detected: '.implode(', ', $names)
        );
    }

    private function findCookie(array $cookies, string $name): ?SymfonyCookie
    {
        foreach ($cookies as $cookie) {
            if ($cookie->getName() === $name) {
                return $cookie;
            }
        }

        return null;
    }

    public function test_fresh_demo_login_with_csrf_enabled_uses_runtime_specific_xsrf_cookie_and_no_duplicates(): void
    {
        $password = 'Mutiara-Fresh-7k3Q';
        $this->enableDemoRuntime($password);

        $demoUser = User::factory()->create([
            'name' => 'Evaluator Demo',
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        // 1. Entry via /demo sets mfms_runtime and MFMS-DEMO-XSRF-TOKEN with zero duplicate Set-Cookie headers
        $entry = $this->get('/demo');
        $entry->assertRedirect(route('login'));
        $this->assertNoDuplicateSetCookieNames($entry->headers->getCookies());
        $this->assertNotNull($this->findCookie($entry->headers->getCookies(), 'mfms_runtime'));
        $this->assertNotNull($this->findCookie($entry->headers->getCookies(), 'MFMS-DEMO-XSRF-TOKEN'));
        $this->assertNull($this->findCookie($entry->headers->getCookies(), 'XSRF-TOKEN'));

        // 2. GET /login exposes demo runtime metadata and emits MFMS-DEMO-XSRF-TOKEN
        $loginPage = $this->withUnencryptedCookie('mfms_runtime', 'demo')->get('/login');
        $loginPage->assertOk();
        $this->assertNoDuplicateSetCookieNames($loginPage->headers->getCookies());
        $loginPage->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Login')
            ->where('runtime.mode', 'demo')
            ->where('runtime.xsrf_cookie', 'MFMS-DEMO-XSRF-TOKEN')
            ->where('runtime.xsrf_header', 'X-MFMS-DEMO-XSRF-TOKEN')
            ->where('runtime.runtime_header', 'X-MFMS-Runtime')
        );

        $xsrfCookie = $this->findCookie($loginPage->headers->getCookies(), 'MFMS-DEMO-XSRF-TOKEN');
        $this->assertNotNull($xsrfCookie);

        // 3. POST /login using Inertia 3's X-MFMS-DEMO-XSRF-TOKEN + X-MFMS-Runtime succeeds with real CSRF check
        $loginPost = $this->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'demo',
            'X-MFMS-DEMO-XSRF-TOKEN' => (string) $xsrfCookie->getValue(),
        ])->post('/login', [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ]);

        $loginPost->assertRedirect(route('ui-dashboard', absolute: false));
        $this->assertNoDuplicateSetCookieNames($loginPost->headers->getCookies());
        $this->assertAuthenticatedAs($demoUser);
    }

    public function test_existing_browser_profile_with_stale_legacy_and_prod_xsrf_cookies_logs_into_demo_cleanly(): void
    {
        $password = 'Mutiara-Stale-4p9N';
        $this->enableDemoRuntime($password);

        $demoUser = User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        // Simulate an existing browser profile carrying stale legacy XSRF-TOKEN and prod XSRF encrypted with another APP_KEY
        $otherKeyEncrypter = new Encrypter(random_bytes(32), 'AES-256-CBC');
        $staleLegacyXsrf = $otherKeyEncrypter->encrypt(
            CookieValuePrefix::create('XSRF-TOKEN', $otherKeyEncrypter->getKey()).'old-prod-token',
            false
        );
        $staleProdXsrf = $otherKeyEncrypter->encrypt(
            CookieValuePrefix::create('MFMS-PROD-XSRF-TOKEN', $otherKeyEncrypter->getKey()).'active-prod-token',
            false
        );

        $entry = $this->withUnencryptedCookies([
            'XSRF-TOKEN' => $staleLegacyXsrf,
            'MFMS-PROD-XSRF-TOKEN' => $staleProdXsrf,
        ])->get('/demo');

        $entry->assertRedirect(route('login'));
        $this->assertNoDuplicateSetCookieNames($entry->headers->getCookies());

        // Legacy XSRF-TOKEN is expired cleanly once, while MFMS-DEMO-XSRF-TOKEN is issued fresh
        $expiredLegacy = $this->findCookie($entry->headers->getCookies(), 'XSRF-TOKEN');
        $this->assertNotNull($expiredLegacy);
        $this->assertLessThanOrEqual(time(), $expiredLegacy->getExpiresTime());

        $demoXsrf = $this->findCookie($entry->headers->getCookies(), 'MFMS-DEMO-XSRF-TOKEN');
        $this->assertNotNull($demoXsrf);

        // Demo login succeeds cleanly using its runtime-specific XSRF cookie despite stale prod cookies in the profile
        $loginPost = $this->withUnencryptedCookies([
            'mfms_runtime' => 'demo',
            'XSRF-TOKEN' => $staleLegacyXsrf,
            'MFMS-PROD-XSRF-TOKEN' => $staleProdXsrf,
        ])->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'demo',
            'X-MFMS-DEMO-XSRF-TOKEN' => (string) $demoXsrf->getValue(),
        ])->post('/login', [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ]);

        $loginPost->assertRedirect(route('ui-dashboard', absolute: false));
        $this->assertAuthenticatedAs($demoUser);
    }

    public function test_runtime_selector_cookie_slides_forward_while_demo_session_remains_active(): void
    {
        $password = 'Mutiara-Slide-5m8R';
        $start = Carbon::create(2026, 11, 25, 10, 0, 0, 'Asia/Jakarta');
        Carbon::setTestNow($start);

        Config::set('session.lifetime', 120);
        $this->enableDemoRuntime($password);

        $demoUser = User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        // Initial login sets mfms_runtime with >= 135m lifetime (session.lifetime + 15m safety margin)
        $loginPage = $this->get('/login');
        $xsrf = (string) $this->findCookie($loginPage->headers->getCookies(), 'MFMS-DEMO-XSRF-TOKEN')?->getValue();

        $loginResp = $this->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'demo',
            'X-MFMS-DEMO-XSRF-TOKEN' => $xsrf,
        ])->post('/login', [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ]);
        $loginResp->assertRedirect(route('ui-dashboard', absolute: false));
        $firstCookie = $this->findCookie($loginResp->headers->getCookies(), 'mfms_runtime');
        $this->assertNotNull($firstCookie);
        $firstExpiry = $firstCookie->getExpiresTime();
        $this->assertGreaterThanOrEqual($start->copy()->addMinutes(120)->timestamp, $firstExpiry);

        // Advance 90 minutes and make an authenticated demo request -> mfms_runtime MUST slide forward past original 120m window
        $later = $start->copy()->addMinutes(90);
        Carbon::setTestNow($later);

        $dashboardResp = $this->flushHeaders()
            ->actingAs($demoUser)
            ->withSession(['mfms_runtime_mode' => 'demo'])
            ->withUnencryptedCookie('mfms_runtime', 'demo')
            ->get('/dashboard');

        $dashboardResp->assertOk();
        $this->assertNoDuplicateSetCookieNames($dashboardResp->headers->getCookies());
        $slidCookie = $this->findCookie($dashboardResp->headers->getCookies(), 'mfms_runtime');
        $this->assertNotNull($slidCookie);
        $this->assertGreaterThan($firstExpiry, $slidCookie->getExpiresTime());
        $this->assertGreaterThanOrEqual($later->copy()->addMinutes(120)->timestamp, $slidCookie->getExpiresTime());
    }

    public function test_demo_logout_clears_runtime_and_demo_xsrf_cookies_and_forces_full_inertia_location(): void
    {
        $password = 'Mutiara-Logout-3x6V';
        $this->enableDemoRuntime($password);

        $demoUser = User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        $dashboard = $this->actingAs($demoUser)
            ->withSession(['mfms_runtime_mode' => 'demo'])
            ->withUnencryptedCookie('mfms_runtime', 'demo')
            ->get('/dashboard');
        $dashboard->assertOk();
        $xsrf = (string) $this->findCookie($dashboard->headers->getCookies(), 'MFMS-DEMO-XSRF-TOKEN')?->getValue();

        $logout = $this->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'demo',
            'X-MFMS-DEMO-XSRF-TOKEN' => $xsrf,
        ])->post('/logout');

        $logout->assertStatus(409);
        $logout->assertHeader('X-Inertia-Location', route('login'));
        $this->assertNoDuplicateSetCookieNames($logout->headers->getCookies());

        $routingCookie = $this->findCookie($logout->headers->getCookies(), 'mfms_runtime');
        $demoXsrfCookie = $this->findCookie($logout->headers->getCookies(), 'MFMS-DEMO-XSRF-TOKEN');
        $this->assertNotNull($routingCookie);
        $this->assertLessThanOrEqual(time(), $routingCookie->getExpiresTime());
        $this->assertNotNull($demoXsrfCookie);
        $this->assertLessThanOrEqual(time(), $demoXsrfCookie->getExpiresTime());
        $this->assertGuest();
    }

    public function test_stale_demo_tab_mutation_hitting_production_is_rejected_with_zero_production_data_changes(): void
    {
        $this->enableProductionRuntime();

        $admin = User::factory()->create([
            'email' => 'owner@mutiaraflorist.id',
            'password' => Hash::make('AdminProdSecret123!'),
        ]);

        // Admin has a valid active production session + production CSRF token
        $dashboard = $this->actingAs($admin)
            ->withSession(['mfms_runtime_mode' => 'production'])
            ->get('/dashboard');
        $dashboard->assertOk();
        $prodXsrf = (string) $this->findCookie($dashboard->headers->getCookies(), 'MFMS-PROD-XSRF-TOKEN')?->getValue();

        $beforeCount = Customer::query()->count();

        // Scenario A: Stale Demo tab sends X-MFMS-Runtime: demo even though production session cookie is valid
        $mismatch = $this->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'demo',
            'X-MFMS-PROD-XSRF-TOKEN' => $prodXsrf, // Even if attacker/cookie somehow matched prod XSRF
        ])->post('/ui-customers', [
            'name' => 'Mutasi Bocor Dari Tab Demo',
            'phone' => '081200000001',
        ]);

        $mismatch->assertStatus(409);
        $mismatch->assertHeader('X-MFMS-Runtime-Mismatch', '1');
        $mismatch->assertJson([
            'message' => 'Sesi telah berakhir. Silakan masuk kembali.',
            'code' => 'RUNTIME_MISMATCH',
        ]);
        $this->assertSame($beforeCount, Customer::query()->count());

        // Scenario B: Stale Demo tab Inertia GET navigation hitting production forces full reload (409 X-Inertia-Location)
        $staleGet = $this->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'demo',
        ])->get('/ui-orders');
        $staleGet->assertStatus(409);
        $staleGet->assertHeader('X-Inertia-Location');

        // Scenario C: Even if X-MFMS-Runtime header is stripped, a Demo-prefixed XSRF token is rejected with 419
        $encrypter = app('encrypter');
        $forgedDemoPrefixedToken = $encrypter->encrypt(
            CookieValuePrefix::create('MFMS-DEMO-XSRF-TOKEN', $encrypter->getKey()).session()->token(),
            false
        );

        $wrongPrefixPost = $this->flushHeaders()->withHeaders([
            'X-Inertia' => 'true',
            'X-XSRF-TOKEN' => $forgedDemoPrefixedToken,
        ])->post('/ui-customers', [
            'name' => 'Mutasi Prefix Demo Tanpa Header',
        ]);

        $wrongPrefixPost->assertStatus(419);
        $this->assertSame($beforeCount, Customer::query()->count());
    }

    public function test_expired_login_session_returns_419_recovery_payload_and_fresh_login_notice(): void
    {
        $password = 'Mutiara-Recover-2w7Y';
        $this->enableDemoRuntime($password);

        User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        // Genuine invalid/expired CSRF POST /login MUST be rejected with HTTP 419 (never authenticated, never replayed)
        $expiredPost = $this->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'demo',
            'X-MFMS-DEMO-XSRF-TOKEN' => 'expired-or-tampered-token',
        ])->post('/login', [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ]);

        $expiredPost->assertStatus(419);
        $expiredPost->assertHeader('X-MFMS-Session-Expired', '1');
        $this->assertStringContainsString('no-store', strtolower((string) $expiredPost->headers->get('Cache-Control')));
        $expiredPost->assertJson([
            'message' => 'Sesi telah berakhir. Silakan masuk kembali.',
            'code' => 'SESSION_EXPIRED',
            'recovery_url' => '/demo?session_expired=1',
        ]);
        $this->assertGuest();

        // Following recovery_url restores a fresh demo login page with the exact Indonesian notification
        $recoveryEntry = $this->flushHeaders()->get('/demo?session_expired=1');
        $recoveryEntry->assertRedirect(route('login', ['session_expired' => 1]));

        $freshLogin = $this->flushHeaders()
            ->withUnencryptedCookie('mfms_runtime', 'demo')
            ->get('/login?session_expired=1');
        $freshLogin->assertOk();
        $freshLogin->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Login')
            ->where('sessionNotice', 'Sesi telah berakhir. Silakan masuk kembali.')
            ->where('demoAccess.available', true)
        );
    }

    public function test_genuine_invalid_csrf_requests_remain_rejected_in_both_runtimes(): void
    {
        $this->enableProductionRuntime();

        $admin = User::factory()->create([
            'email' => 'owner-csrf@mutiaraflorist.id',
            'password' => Hash::make('AdminCsrfPass123!'),
        ]);

        // Unauthenticated POST /login without CSRF token -> 419
        $this->post('/login', [
            'email' => $admin->email,
            'password' => 'AdminCsrfPass123!',
        ])->assertStatus(419);
        $this->assertGuest();

        // Authenticated POST /ui-customers without CSRF token -> 419 & zero DB insert
        $this->actingAs($admin)
            ->withSession(['mfms_runtime_mode' => 'production'])
            ->post('/ui-customers', [
                'name' => 'Harus Ditolak CSRF',
            ])->assertStatus(419);

        $this->assertSame(0, Customer::query()->where('name', 'Harus Ditolak CSRF')->count());

        // Valid CSRF token still works cleanly for normal admin operations
        $page = $this->actingAs($admin)
            ->withSession(['mfms_runtime_mode' => 'production'])
            ->get('/ui-customers');
        $prodXsrf = (string) $this->findCookie($page->headers->getCookies(), 'MFMS-PROD-XSRF-TOKEN')?->getValue();

        $this->withHeaders([
            'X-Inertia' => 'true',
            'X-MFMS-Runtime' => 'production',
            'X-MFMS-PROD-XSRF-TOKEN' => $prodXsrf,
        ])->post('/ui-customers', [
            'name' => 'Pelanggan Admin Valid',
            'phone' => '081234567890',
        ])->assertRedirect();

        $this->assertSame(1, Customer::query()->where('name', 'Pelanggan Admin Valid')->count());
    }

    public function test_admin_entry_clears_demo_cookies_without_duplicate_set_cookie_headers(): void
    {
        $this->enableProductionRuntime();

        $resp = $this->withUnencryptedCookies([
            'mfms_runtime' => 'demo',
            'mfms_demo_session' => 'stale-demo-session',
            'MFMS-DEMO-XSRF-TOKEN' => 'stale-demo-xsrf',
            'XSRF-TOKEN' => 'legacy-xsrf',
        ])->get('/admin-entry');

        $resp->assertRedirect(route('login'));
        $cookies = $resp->headers->getCookies();
        $this->assertNoDuplicateSetCookieNames($cookies);

        foreach (['mfms_runtime', 'mfms_demo_session', 'MFMS-DEMO-XSRF-TOKEN', 'XSRF-TOKEN'] as $clearedName) {
            $cookie = $this->findCookie($cookies, $clearedName);
            $this->assertNotNull($cookie, "Expected cookie {$clearedName} to be cleared on /admin-entry");
            $this->assertLessThanOrEqual(time(), $cookie->getExpiresTime());
        }

        // Production XSRF cookie is freshly issued
        $prodXsrf = $this->findCookie($cookies, 'MFMS-PROD-XSRF-TOKEN');
        $this->assertNotNull($prodXsrf);
        $this->assertGreaterThan(time(), $prodXsrf->getExpiresTime());
    }
}
