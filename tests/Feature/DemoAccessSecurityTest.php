<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\User;
use App\Services\BackupService;
use App\Support\DemoRuntimeGuard;
use Carbon\Carbon;
use Database\Seeders\DemoDatasetSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Tests\TestCase;

class DemoAccessSecurityTest extends TestCase
{
    use RefreshDatabase;

    private string $tempKillSwitch;

    private string $tempResetFlag;

    protected function setUp(): void
    {
        parent::setUp();

        $tmpDir = storage_path('framework/testing/demo-sec');
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
        Carbon::setTestNow();

        foreach ([$this->tempKillSwitch, $this->tempResetFlag] as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }

    private function enableDemoRuntime(
        string $password = 'Mutiara-Demo-9x7K2',
        ?string $activatedAt = null,
        int $durationDays = 14
    ): void {
        $activatedAt ??= Carbon::now('Asia/Jakarta')->subDay()->toIso8601String();

        Config::set('demo.runtime_mode', 'demo');
        Config::set('demo.enabled', true);
        Config::set('demo.email', 'demo@mutiaraflorist.id');
        Config::set('demo.password', $password);
        Config::set('demo.activated_at', $activatedAt);
        Config::set('demo.expires_at', null);
        Config::set('demo.duration_days', $durationDays);
    }

    public function test_production_runtime_hides_demo_credentials_and_rejects_demo_email(): void
    {
        Config::set('demo.runtime_mode', 'production');
        Config::set('demo.enabled', false);
        Config::set('demo.email', 'demo@mutiaraflorist.id');

        // Even if a demo email row somehow existed in production DB, login MUST fail
        User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make('SomeSecretPassword123'),
        ]);

        $this->get(route('login'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('demoAccess', null)
            );

        $this->post(route('login.store'), [
            'email' => 'demo@mutiaraflorist.id',
            'password' => 'SomeSecretPassword123',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_production_runtime_forbids_cross_environment_demo_session(): void
    {
        Config::set('demo.runtime_mode', 'production');
        Config::set('demo.email', 'demo@mutiaraflorist.id');

        $admin = User::factory()->create([
            'email' => 'owner@mutiaraflorist.id',
            'password' => Hash::make('AdminProdSecret123!'),
        ]);

        // Tampered session carrying mfms_runtime_mode=demo on production runtime -> 403 & logout
        $this->actingAs($admin)
            ->withSession(['mfms_runtime_mode' => 'demo'])
            ->get('/dashboard')
            ->assertForbidden();

        $this->assertGuest();
    }

    public function test_production_admin_authentication_remains_functional_and_isolated(): void
    {
        Config::set('demo.runtime_mode', 'production');

        $admin = User::factory()->create([
            'email' => 'owner@mutiaraflorist.id',
            'password' => Hash::make('AdminProdSecret123!'),
        ]);

        $response = $this->post(route('login.store'), [
            'email' => 'owner@mutiaraflorist.id',
            'password' => 'AdminProdSecret123!',
        ]);

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticatedAs($admin);
        $this->assertSame('production', session('mfms_runtime_mode'));

        $this->get('/dashboard')->assertOk();
    }

    public function test_demo_runtime_renders_compact_demo_credentials_and_authenticates_demo_only(): void
    {
        $password = 'Mutiara-Eval-8k3P5';
        $this->enableDemoRuntime($password);

        $demoUser = User::factory()->create([
            'name' => 'Evaluator Demo',
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        $otherUser = User::factory()->create([
            'email' => 'real-admin@mutiaraflorist.id',
            'password' => Hash::make('RealAdminPass123!'),
        ]);

        $this->get(route('login'))
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('demoAccess.available', true)
                ->where('demoAccess.email', 'demo@mutiaraflorist.id')
                ->where('demoAccess.password', $password)
            );

        // Non-demo account is rejected inside demo runtime
        $this->post(route('login.store'), [
            'email' => $otherUser->email,
            'password' => 'RealAdminPass123!',
        ])->assertSessionHasErrors('email');
        $this->assertGuest();

        // Demo account logs in cleanly and receives isolated routing cookie & runtime marker
        $response = $this->post(route('login.store'), [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ]);

        $response->assertRedirect(route('dashboard'));
        $response->assertPlainCookie('mfms_runtime', 'demo');
        $this->assertAuthenticatedAs($demoUser);
        $this->assertSame('demo', session('mfms_runtime_mode'));
    }

    public function test_demo_expiration_after_14_days_blocks_login_and_immediately_revokes_active_session(): void
    {
        $password = 'Mutiara-Time-4m9Q2';
        $activation = Carbon::create(2026, 11, 25, 8, 0, 0, 'Asia/Jakarta');
        Carbon::setTestNow($activation->copy()->addDays(2));

        $this->enableDemoRuntime($password, $activation->toIso8601String(), 14);

        User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        // Day 2: Login and browse works
        $this->post(route('login.store'), [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ])->assertRedirect(route('dashboard'));

        $this->get('/dashboard')->assertOk();

        // Day 14 + 1 second: Already authenticated session is IMMEDIATELY revoked server-side
        Carbon::setTestNow($activation->copy()->addDays(14)->addSecond());

        $this->get('/dashboard')
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('email');
        $this->assertGuest();

        // Login page no longer displays demo credentials
        $this->get(route('login'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('demoAccess', null)
            );

        // New login attempts are rejected server-side
        $this->post(route('login.store'), [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_emergency_disable_switch_immediately_revokes_demo_access(): void
    {
        $password = 'Mutiara-Kill-7n2R6';
        $this->enableDemoRuntime($password);

        User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        $this->post(route('login.store'), [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ])->assertRedirect(route('dashboard'));
        $this->get('/dashboard')->assertOk();

        // Engage runtime kill switch without restart
        $this->artisan('mfms:demo-disable')->assertSuccessful();

        $this->get('/ui-orders')
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('email');
        $this->assertGuest();

        // Login page hides credentials while disabled
        $this->get(route('login'))
            ->assertInertia(fn (Assert $page) => $page->where('demoAccess', null));

        // Disengaging kill switch restores access
        $this->artisan('mfms:demo-enable')->assertSuccessful();
        $this->get(route('login'))
            ->assertInertia(fn (Assert $page) => $page->where('demoAccess.available', true));
    }

    public function test_demo_runtime_blocks_sensitive_admin_routes_and_cli_operations(): void
    {
        $password = 'Mutiara-Lock-5p8W3';
        $this->enableDemoRuntime($password);

        $demoUser = User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make($password),
        ]);

        $this->actingAs($demoUser)
            ->withSession(['mfms_runtime_mode' => 'demo']);

        // Blocked admin/legacy/debug routes
        $this->get('/admin-entry')->assertForbidden();
        $this->get('/ui-preview')->assertForbidden();
        $this->get('/legacy/dashboard')->assertForbidden();
        $this->get('/blade-dashboard')->assertForbidden();

        // Blocked BackupService
        $this->expectException(RuntimeException::class);
        app(BackupService::class)->createBackup('test-key-should-fail');
    }

    public function test_demo_runtime_blocks_sensitive_artisan_commands(): void
    {
        $this->enableDemoRuntime('Mutiara-Cli-3r6T9');

        $this->artisan('mfms:create-admin')->assertFailed();
        $this->artisan('mfms:reset-password', ['--email' => 'demo@mutiaraflorist.id'])->assertFailed();
        $this->artisan('mfms:backup')->assertFailed();
        $this->artisan('mfms:restore-test')->assertFailed();
        $this->artisan('mfms:migrate-staging', ['--force' => true])->assertFailed();
        $this->artisan('mfms:seed-staging')->assertFailed();
        $this->artisan('mfms:verify-staging')->assertFailed();
    }

    public function test_demo_runtime_scrubs_non_sqlite_connections_and_fails_closed_on_misconfiguration(): void
    {
        $this->enableDemoRuntime('Mutiara-Iso-2v4X8');
        $originalConnections = config('database.connections');
        $originalDefault = config('database.default');

        try {
            // Confirm non-sqlite connections are scrubbed when enforcing isolation
            DemoRuntimeGuard::enforceSqliteOnlyIsolation();
            $connections = config('database.connections');
            $this->assertArrayHasKey('sqlite', $connections);
            $this->assertArrayNotHasKey('pgsql', $connections);
            $this->assertArrayNotHasKey('mysql', $connections);
            $this->assertArrayNotHasKey('mariadb', $connections);
            $this->assertArrayNotHasKey('pgsql_staging', $connections);

            // If default connection is tampered to non-sqlite, middleware fails closed with 503
            Config::set('database.default', 'pgsql');
            $this->get(route('login'))->assertStatus(503);
        } finally {
            Config::set('database.connections', $originalConnections);
            Config::set('database.default', $originalDefault);
        }
    }

    public function test_demo_runtime_returns_503_with_retry_after_during_reset_quiesce_window(): void
    {
        $this->enableDemoRuntime('Mutiara-Quiesce-6z1B');
        file_put_contents($this->tempResetFlag, 'resetting');

        $this->get(route('login'))
            ->assertStatus(503)
            ->assertHeader('Retry-After', '3')
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow');
    }

    public function test_login_rate_limiting_throttles_excessive_attempts(): void
    {
        $this->enableDemoRuntime('Mutiara-Rate-9c5N2');

        User::factory()->create([
            'email' => 'demo@mutiaraflorist.id',
            'password' => Hash::make('Mutiara-Rate-9c5N2'),
        ]);

        for ($i = 0; $i < 6; $i++) {
            $this->post(route('login.store'), [
                'email' => 'demo@mutiaraflorist.id',
                'password' => 'wrong-password-'.$i,
            ])->assertSessionHasErrors('email');
        }

        // 7th attempt within 1 minute hits throttle:login (429)
        $this->post(route('login.store'), [
            'email' => 'demo@mutiaraflorist.id',
            'password' => 'wrong-password-7',
        ])->assertStatus(429);
    }

    public function test_demo_user_can_explore_core_business_features_and_excel_export_on_sqlite(): void
    {
        $password = 'Mutiara-Full-4h8J2';
        $this->enableDemoRuntime($password);

        $this->seed(DemoDatasetSeeder::class);

        $this->post(route('login.store'), [
            'email' => 'demo@mutiaraflorist.id',
            'password' => $password,
        ])->assertRedirect(route('dashboard'));

        // Explore all existing Phase 13 business pages on SQLite
        $this->get('/dashboard')->assertOk();
        $this->get('/ui-customers')->assertOk();
        $this->get('/ui-orders')->assertOk();
        $this->get('/ui-payments')->assertOk();
        $this->get('/ui-expenses')->assertOk();
        $this->get('/ui-expense-categories')->assertOk();
        $this->get('/ui-reports')->assertOk();

        // Create a customer and verify persistence across subsequent request
        $this->post('/ui-customers', [
            'name' => 'Pelanggan Uji Evaluator',
            'phone' => '081200009999',
            'notes' => 'Dibuat selama sesi demo',
        ])->assertRedirect();

        $customer = Customer::query()->where('name', 'Pelanggan Uji Evaluator')->first();
        $this->assertNotNull($customer);

        // Create an order with server-calculated total
        $today = Carbon::now('Asia/Jakarta')->format('Y-m-d');
        $this->post('/ui-orders', [
            'customer_id' => $customer->id,
            'order_date' => $today,
            'notes' => 'Order uji evaluator',
            'items' => [
                [
                    'flower_type' => 'Buket Mawar Putih',
                    'recipient' => 'Penerima Uji',
                    'sender_name' => 'Pengirim Uji',
                    'delivery_date' => $today,
                    'delivery_location' => 'Jl. Simulasi No. 10',
                    'quantity' => 2,
                    'unit_price' => 250000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 35000,
                ],
            ],
        ])->assertRedirect();

        $order = Order::query()->where('customer_id', $customer->id)->first();
        $this->assertNotNull($order);
        $this->assertSame(535000, (int) $order->total_amount);

        // Record a payment against the new order
        $this->post("/ui-orders/{$order->id}/payments", [
            'payment_date' => $today,
            'amount' => 300000,
            'method' => 'TRANSFER',
            'reference' => 'DEMO-UJI-01',
            'idempotency_key' => (string) Str::uuid(),
            'notes' => 'DP simulasi',
        ])->assertRedirect();

        $this->assertSame(300000, (int) $order->payments()->where('status', 'POSTED')->sum('amount'));

        // Record an operational expense
        $category = ExpenseCategory::query()->where('is_active', true)->firstOrFail();
        $this->post('/ui-expenses', [
            'expense_category_id' => $category->id,
            'expense_date' => $today,
            'amount' => 75000,
            'description' => 'Pembelian pita uji demo',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertRedirect();

        // Download Excel report (.xlsx) and verify OpenXML ZIP signature
        $exportResponse = $this->get('/ui-reports/export?preset=30d');
        $exportResponse->assertOk();
        $exportResponse->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $binary = $exportResponse->streamedContent();
        $this->assertStringStartsWith('PK', $binary);
    }
}
