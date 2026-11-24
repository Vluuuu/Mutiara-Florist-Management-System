<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DashboardService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Phase13CDashboardBiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private int $customerId;

    private int $categoryId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'name' => 'Rina Sari (Operator Uji)',
            'email' => 'operator.bi@example.test',
        ]);

        $this->customerId = DB::table('customers')->insertGetId([
            'name' => 'CV Harmoni Sejahtera',
            'phone' => '081200010001',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->categoryId = DB::table('expense_categories')->insertGetId([
            'name' => 'Belanja Bunga Segar',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_empty_business_returns_clean_zero_states_without_errors(): void
    {
        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('todayStats.cash_in', 0)
                ->where('todayStats.cash_out', 0)
                ->where('todayStats.cash_diff', 0)
                ->where('todayStats.pipeline_new', 0)
                ->where('todayStats.pipeline_processing', 0)
                ->where('todayStats.pipeline_ready', 0)
                ->where('todayStats.pipeline_total', 0)
                ->where('deliveryQueue', [])
                ->missing('receivables')
                ->missing('cashFlowPulse')
                ->missing('recentActivity')
                ->loadDeferredProps('receivables', fn (Assert $d) => $d
                    ->where('receivables', [])
                )
                ->loadDeferredProps('insights', fn (Assert $d) => $d
                    ->where('cashFlowPulse.period_7d.cash_in', 0)
                    ->where('cashFlowPulse.period_7d.cash_out', 0)
                    ->where('cashFlowPulse.period_7d.cash_diff', 0)
                    ->where('cashFlowPulse.period_7d.has_activity', false)
                    ->has('cashFlowPulse.period_7d.points', 7)
                    ->where('cashFlowPulse.period_30d.has_activity', false)
                    ->has('cashFlowPulse.period_30d.points', 30)
                    ->where('recentActivity', [])
                )
            );
    }

    public function test_cash_flow_reconciliation_posted_vs_voided_wib_boundaries_and_negative_net_flow(): void
    {
        // Freeze clock at 2026-11-24 18:30:00 UTC => 2026-11-25 01:30:00 WIB (Asia/Jakarta)!
        Carbon::setTestNow(Carbon::create(2026, 11, 24, 18, 30, 0, 'UTC'));
        $todayWib = '2026-11-25';
        $sixDaysAgo = '2026-11-19'; // Inside 7d window (19..25)
        $tenDaysAgo = '2026-11-15'; // Inside 30d window, outside 7d window
        $fortyDaysAgo = '2026-10-16'; // Outside 30d window

        $orderToday = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261125-01TESTORDER0000001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => $todayWib,
            'status' => 'NEW',
            'total_amount' => 1000000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Payments: POSTED today (250k), VOIDED today (900k - must be excluded!), POSTED 6d ago (400k), POSTED 10d ago (600k), POSTED 40d ago (500k - outside 30d)
        DB::table('payments')->insert([
            [
                'order_id' => $orderToday,
                'recorded_by' => $this->user->id,
                'payment_date' => $todayWib,
                'amount' => 250000,
                'method' => 'TRANSFER',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'order_id' => $orderToday,
                'recorded_by' => $this->user->id,
                'payment_date' => $todayWib,
                'amount' => 900000,
                'method' => 'CASH',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'VOIDED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'order_id' => $orderToday,
                'recorded_by' => $this->user->id,
                'payment_date' => $sixDaysAgo,
                'amount' => 400000,
                'method' => 'QRIS',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now()->subDays(6),
                'updated_at' => now()->subDays(6),
            ],
            [
                'order_id' => $orderToday,
                'recorded_by' => $this->user->id,
                'payment_date' => $tenDaysAgo,
                'amount' => 600000,
                'method' => 'TRANSFER',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now()->subDays(10),
                'updated_at' => now()->subDays(10),
            ],
            [
                'order_id' => $orderToday,
                'recorded_by' => $this->user->id,
                'payment_date' => $fortyDaysAgo,
                'amount' => 500000,
                'method' => 'CASH',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now()->subDays(40),
                'updated_at' => now()->subDays(40),
            ],
        ]);

        // Expenses: POSTED today (800k => negative net cash flow today!), VOIDED today (300k - excluded), POSTED 10d ago (150k)
        DB::table('expenses')->insert([
            [
                'expense_category_id' => $this->categoryId,
                'recorded_by' => $this->user->id,
                'expense_date' => $todayWib,
                'amount' => 800000,
                'description' => 'Stok bunga mawar impor',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'expense_category_id' => $this->categoryId,
                'recorded_by' => $this->user->id,
                'expense_date' => $todayWib,
                'amount' => 300000,
                'description' => 'Kesalahan input harus dibatalkan',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'VOIDED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'expense_category_id' => $this->categoryId,
                'recorded_by' => $this->user->id,
                'expense_date' => $tenDaysAgo,
                'amount' => 150000,
                'description' => 'Pita dan oasis',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now()->subDays(10),
                'updated_at' => now()->subDays(10),
            ],
        ]);

        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('todayStats.today_iso', $todayWib)
                ->where('todayStats.cash_in', 250000)
                ->where('todayStats.cash_out', 800000)
                ->where('todayStats.cash_diff', -550000)
                ->loadDeferredProps('insights', fn (Assert $d) => $d
                    ->where('cashFlowPulse.period_7d.from', $sixDaysAgo)
                    ->where('cashFlowPulse.period_7d.to', $todayWib)
                    ->where('cashFlowPulse.period_7d.cash_in', 650000)
                    ->where('cashFlowPulse.period_7d.cash_out', 800000)
                    ->where('cashFlowPulse.period_7d.cash_diff', -150000)
                    ->where('cashFlowPulse.period_7d.has_activity', true)
                    ->has('cashFlowPulse.period_7d.points', 7)
                    ->where('cashFlowPulse.period_30d.cash_in', 1250000)
                    ->where('cashFlowPulse.period_30d.cash_out', 950000)
                    ->where('cashFlowPulse.period_30d.cash_diff', 300000)
                    ->where('cashFlowPulse.period_30d.has_activity', true)
                    ->has('cashFlowPulse.period_30d.points', 30)
                )
            );
    }

    public function test_multiple_outstanding_orders_for_same_corporate_customer_stay_unambiguous(): void
    {
        $orderA = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261120-01CORPORDERAAAA1',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => '2026-11-20',
            'status' => 'PROCESSING',
            'total_amount' => 1500000,
            'created_at' => now()->subDays(4),
            'updated_at' => now()->subDays(4),
        ]);

        $orderB = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261123-01CORPORDERBBBB2',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => '2026-11-23',
            'status' => 'NEW',
            'total_amount' => 950000,
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);

        // Partial POSTED payment on Order A only
        DB::table('payments')->insert([
            'order_id' => $orderA,
            'recorded_by' => $this->user->id,
            'payment_date' => '2026-11-21',
            'amount' => 500000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now()->subDays(3),
            'updated_at' => now()->subDays(3),
        ]);

        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('todayStats.open_receivables_count', 2)
                ->loadDeferredProps('receivables', fn (Assert $d) => $d
                    ->has('receivables', 2)
                    ->where('receivables.0.id', $orderA)
                    ->where('receivables.0.order_number', 'MF-261120-01CORPORDERAAAA1')
                    ->where('receivables.0.order_date', '20/11/2026')
                    ->where('receivables.0.outstanding', 1000000)
                    ->where('receivables.0.payment_status', 'PARTIAL')
                    ->where('receivables.1.id', $orderB)
                    ->where('receivables.1.order_number', 'MF-261123-01CORPORDERBBBB2')
                    ->where('receivables.1.order_date', '23/11/2026')
                    ->where('receivables.1.outstanding', 950000)
                    ->where('receivables.1.payment_status', 'UNPAID')
                )
            );
    }

    public function test_pipeline_counts_reflect_all_active_items_exceeding_visible_queue_limit(): void
    {
        $today = now('Asia/Jakarta')->toDateString();
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261124-01HIGHVOLUME0001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => $today,
            'status' => 'PROCESSING',
            'total_amount' => 3600000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Insert 18 active items (5 NEW, 7 PROCESSING, 6 READY) + 4 DELIVERED items (must not be counted in active pipeline)
        $statuses = array_merge(
            array_fill(0, 5, 'NEW'),
            array_fill(0, 7, 'PROCESSING'),
            array_fill(0, 6, 'READY'),
            array_fill(0, 4, 'DELIVERED')
        );

        foreach ($statuses as $idx => $status) {
            DB::table('order_items')->insert([
                'order_id' => $orderId,
                'flower_type' => 'Rangkaian #'.($idx + 1),
                'recipient' => 'Penerima '.($idx + 1),
                'sender_name' => 'Pengirim',
                'delivery_date' => $today,
                'delivery_location' => 'Jakarta',
                'quantity' => 1,
                'unit_price' => 200000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
                'fulfillment_status' => $status,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('deliveryQueue', 12) // Capped at queue limit 12
                ->where('queueSummary.total_count', 18)
                ->where('todayStats.pipeline_new', 5)
                ->where('todayStats.pipeline_processing', 7)
                ->where('todayStats.pipeline_ready', 6)
                ->where('todayStats.pipeline_total', 18)
            );
    }

    public function test_recent_activity_respects_limit_ordering_posted_only_and_no_sensitive_fields(): void
    {
        $base = Carbon::create(2026, 11, 24, 10, 0, 0, 'Asia/Jakarta');

        $order1 = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261124-01ACTORD000001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => '2026-11-24',
            'status' => 'NEW',
            'total_amount' => 300000,
            'created_at' => $base->copy()->addMinutes(1),
            'updated_at' => $base->copy()->addMinutes(1),
        ]);

        // Insert 4 POSTED payments, 1 VOIDED payment (excluded), 3 POSTED expenses, 1 VOIDED expense (excluded)
        for ($i = 1; $i <= 4; $i++) {
            DB::table('payments')->insert([
                'order_id' => $order1,
                'recorded_by' => $this->user->id,
                'payment_date' => '2026-11-24',
                'amount' => 50000 * $i,
                'method' => 'TRANSFER',
                'idempotency_key' => '11111111-2222-4333-8444-55555555550'.$i,
                'status' => 'POSTED',
                'created_at' => $base->copy()->addMinutes(10 + $i),
                'updated_at' => $base->copy()->addMinutes(10 + $i),
            ]);
        }

        DB::table('payments')->insert([
            'order_id' => $order1,
            'recorded_by' => $this->user->id,
            'payment_date' => '2026-11-24',
            'amount' => 999000,
            'method' => 'CASH',
            'idempotency_key' => '11111111-2222-4333-8444-555555555599',
            'status' => 'VOIDED',
            'created_at' => $base->copy()->addMinutes(99),
            'updated_at' => $base->copy()->addMinutes(99),
        ]);

        for ($i = 1; $i <= 3; $i++) {
            DB::table('expenses')->insert([
                'expense_category_id' => $this->categoryId,
                'recorded_by' => $this->user->id,
                'expense_date' => '2026-11-24',
                'amount' => 25000 * $i,
                'description' => 'Pengeluaran ke-'.$i,
                'idempotency_key' => '22222222-3333-4444-8555-66666666660'.$i,
                'status' => 'POSTED',
                'created_at' => $base->copy()->addMinutes(20 + $i),
                'updated_at' => $base->copy()->addMinutes(20 + $i),
            ]);
        }

        DB::table('expenses')->insert([
            'expense_category_id' => $this->categoryId,
            'recorded_by' => $this->user->id,
            'expense_date' => '2026-11-24',
            'amount' => 888000,
            'description' => 'Pengeluaran VOID tidak boleh tampil',
            'idempotency_key' => '22222222-3333-4444-8555-666666666699',
            'status' => 'VOIDED',
            'created_at' => $base->copy()->addMinutes(98),
            'updated_at' => $base->copy()->addMinutes(98),
        ]);

        $events = app(DashboardService::class)->recentActivity(6);

        $this->assertCount(6, $events);
        // Newest should be expense #3 (base + 23 min), then #2 (+22), #1 (+21), payment #4 (+14), #3 (+13), #2 (+12)
        $this->assertSame('expense', $events[0]['type']);
        $this->assertSame(75000, $events[0]['amount']);
        $this->assertSame('payment', $events[3]['type']);
        $this->assertSame(200000, $events[3]['amount']);

        // Confirm zero VOIDED records and zero sensitive fields leaked
        $json = json_encode($events);
        $this->assertStringNotContainsString('999000', (string) $json);
        $this->assertStringNotContainsString('888000', (string) $json);
        $this->assertStringNotContainsString('11111111-2222', (string) $json);
        $this->assertStringNotContainsString('22222222-3333', (string) $json);
        $this->assertStringNotContainsString('operator.bi@example.test', (string) $json);
    }

    public function test_initial_dashboard_keeps_baseline_three_domain_queries_and_defers_insights(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();

        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk();

        $initialQueries = array_values(array_filter(
            DB::getQueryLog(),
            fn (array $q): bool => ! str_contains(strtolower($q['query']), 'from "users"')
                && ! str_contains(strtolower($q['query']), 'from "sessions"')
        ));

        // Exactly 3 domain queries on initial GET /dashboard: stats(), todayStats(), activeDeliveryQueue()
        $this->assertCount(3, $initialQueries);

        // Now measure deferred 'insights' group
        DB::flushQueryLog();
        $this->actingAs($this->user)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Inertia-Version' => \Inertia\Inertia::getVersion() ?? '',
                'X-Inertia-Partial-Component' => 'Dashboard',
                'X-Inertia-Partial-Data' => 'cashFlowPulse,recentActivity',
            ])
            ->get(route('dashboard'))
            ->assertOk()
            ->assertJsonPath('props.cashFlowPulse.timezone', 'WIB (Asia/Jakarta)');

        $deferredInsightQueries = array_values(array_filter(
            DB::getQueryLog(),
            fn (array $q): bool => ! str_contains(strtolower($q['query']), 'from "users"')
                && ! str_contains(strtolower($q['query']), 'from "sessions"')
        ));

        // 1 query for cashFlowPulse + 3 tiny LIMIT 6 queries for recentActivity = 4 queries
        $this->assertCount(4, $deferredInsightQueries);
        DB::disableQueryLog();
    }

    public function test_deferred_insights_rescue_on_failure_without_breaking_dashboard(): void
    {
        $realService = app(DashboardService::class);
        $mock = $this->mock(DashboardService::class, function ($mock) use ($realService): void {
            $mock->shouldReceive('stats')->andReturn($realService->stats());
            $mock->shouldReceive('todayStats')->andReturn($realService->todayStats());
            $mock->shouldReceive('activeDeliveryQueue')->andReturn($realService->activeDeliveryQueue());
            $mock->shouldReceive('cashFlowPulse')->andThrow(new \RuntimeException('Simulated pulse timeout'));
        });
        $this->app->instance(DashboardService::class, $mock);

        // Initial GET resolves the active Inertia asset version cleanly
        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk();

        $this->actingAs($this->user)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Inertia-Version' => \Inertia\Inertia::getVersion() ?? '',
                'X-Inertia-Partial-Component' => 'Dashboard',
                'X-Inertia-Partial-Data' => 'cashFlowPulse',
            ])
            ->get(route('dashboard'))
            ->assertOk()
            ->assertJsonPath('rescuedProps', ['cashFlowPulse']);
    }

    public function test_navigation_state_registers_new_deferred_prop_keys(): void
    {
        $src = file_get_contents(resource_path('js/lib/navigation-state.ts'));
        $this->assertIsString($src);
        $this->assertStringContainsString("'cashFlowPulse'", $src);
        $this->assertStringContainsString("'recentActivity'", $src);
        $this->assertStringContainsString('router.flushAll()', $src);
    }
}
