<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DashboardService;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiNavigationPerformanceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private int $customerId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->customerId = DB::table('customers')->insertGetId([
            'name' => 'Pelanggan Performa',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_dashboard_defers_receivables_and_preserves_financial_integrity(): void
    {
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'ORD-PERF-0001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 450000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payments')->insert([
            'order_id' => $orderId,
            'recorded_by' => $this->user->id,
            'payment_date' => now()->toDateString(),
            'amount' => 150000,
            'method' => 'transfer',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('stats.billed', 450000)
                ->where('stats.received', 150000)
                ->where('stats.outstanding', 300000)
                ->missing('receivables')
                ->has('nav.dashboard')
                ->has('nav.uiOrders')
                ->has('nav.uiReports')
                ->loadDeferredProps('receivables', fn (Assert $deferred) => $deferred
                    ->has('receivables', 1)
                    ->where('receivables.0.order_number', 'ORD-PERF-0001')
                    ->where('receivables.0.outstanding', 300000)
                )
            );
    }

    public function test_reports_defers_breakdowns_and_trends_matching_full_financial_report(): void
    {
        $catId = DB::table('expense_categories')->insertGetId([
            'name' => 'Bunga Segar',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('orders')->insert([
            'order_number' => 'ORD-RPT-0001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 300000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('expenses')->insert([
            'expense_category_id' => $catId,
            'recorded_by' => $this->user->id,
            'expense_date' => now()->toDateString(),
            'amount' => 75000,
            'description' => 'Stok mawar putih',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $expectedFull = app(ReportService::class)->getFinancialReport('30d');

        $this->actingAs($this->user)
            ->get('/ui-reports?preset=30d')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->where('report.summary.total_billed', $expectedFull['summary']['total_billed'])
                ->where('report.summary.cash_out', $expectedFull['summary']['cash_out'])
                ->missing('reportBreakdowns')
                ->missing('reportTrends')
                ->loadDeferredProps('details', fn (Assert $deferred) => $deferred
                    ->where('reportBreakdowns.fulfillment_breakdown', $expectedFull['fulfillment_breakdown'])
                    ->where('reportBreakdowns.expense_breakdown.0.amount', 75000)
                    ->has('reportTrends.daily_trends')
                    ->has('reportTrends.chart_series.points')
                )
            );
    }

    public function test_payments_defers_history_and_keeps_receivables_fast(): void
    {
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'ORD-PAY-DEFER-1',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 300000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payments')->insert([
            'order_id' => $orderId,
            'recorded_by' => $this->user->id,
            'payment_date' => now()->toDateString(),
            'amount' => 100000,
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->user)
            ->get(route('ui-payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Index')
                ->where('outstanding', 200000)
                ->has('orders.data', 1)
                ->missing('paymentHistory')
                ->loadDeferredProps('history', fn (Assert $deferred) => $deferred
                    ->has('paymentHistory.data', 1)
                    ->where('paymentHistory.data.0.amount', 100000)
                )
            );
    }

    public function test_deferred_dashboard_receivables_uses_rescue_on_failure(): void
    {
        $realService = app(DashboardService::class);
        $mock = $this->mock(DashboardService::class, function ($mock) use ($realService): void {
            $mock->shouldReceive('stats')->andReturn($realService->stats());
            $mock->shouldReceive('todayStats')->andReturn($realService->todayStats());
            $mock->shouldReceive('activeDeliveryQueue')->andReturn($realService->activeDeliveryQueue());
            $mock->shouldReceive('openReceivables')->andThrow(new \RuntimeException('Simulated DB timeout'));
        });

        $this->app->instance(DashboardService::class, $mock);

        $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->has('stats')
                ->reload(only: ['receivables'], callback: fn (Assert $deferred) => $deferred
                    ->missing('receivables')
                )
            );

        $this->actingAs($this->user)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Inertia-Version' => \Inertia\Inertia::getVersion() ?? '',
                'X-Inertia-Partial-Component' => 'Dashboard',
                'X-Inertia-Partial-Data' => 'receivables',
            ])
            ->get(route('dashboard'))
            ->assertOk()
            ->assertJsonPath('rescuedProps', ['receivables']);
    }

    public function test_filter_partial_reloads_return_scoped_props_only(): void
    {
        // Orders partial filter keeps only orders & filters
        $this->actingAs($this->user)
            ->get(route('ui-orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Index')
                ->reload(only: ['orders', 'filters'], callback: fn (Assert $partial) => $partial
                    ->has('orders')
                    ->has('filters')
                )
            );

        // Expenses partial filter omits static categories list
        $this->actingAs($this->user)
            ->get(route('ui-expenses.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Expenses/Index')
                ->reload(only: ['expenses', 'postedTotal', 'filters'], callback: fn (Assert $partial) => $partial
                    ->has('expenses')
                    ->has('postedTotal')
                    ->has('filters')
                    ->missing('categories')
                )
            );

        // Payments history chip partial filter omits receivables & outstanding
        $this->actingAs($this->user)
            ->get(route('ui-payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Index')
                ->reload(only: ['paymentHistory', 'filters'], callback: fn (Assert $partial) => $partial
                    ->has('paymentHistory')
                    ->has('filters')
                    ->missing('orders')
                    ->missing('outstanding')
                )
            );

        // Reports granularity toggle reloads reportTrends only
        $this->actingAs($this->user)
            ->get(route('ui-reports.index', ['preset' => '30d', 'granularity' => 'monthly']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->reload(only: ['reportTrends'], callback: fn (Assert $partial) => $partial
                    ->where('reportTrends.chart_series.granularity', 'monthly')
                    ->missing('report')
                    ->missing('reportBreakdowns')
                )
            );
    }
}
