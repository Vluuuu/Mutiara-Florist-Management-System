<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DashboardService;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

class Phase13DFinancialReportsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private int $customerId;

    private int $catFlowerId;

    private int $catCourierId;

    private int $catSmallId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->customerId = DB::table('customers')->insertGetId([
            'name' => 'PT Mawar Sejahtera',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->catFlowerId = DB::table('expense_categories')->insertGetId([
            'name' => 'Belanja Bunga Segar',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->catCourierId = DB::table('expense_categories')->insertGetId([
            'name' => 'Kurir & Transportasi',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->catSmallId = DB::table('expense_categories')->insertGetId([
            'name' => 'Parkir & Materai',
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

    public function test_payment_method_breakdown_reconciles_with_cash_in_and_handles_legacy_methods_and_voids(): void
    {
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261124-01PAYMETH00001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => '2026-11-20',
            'status' => 'PROCESSING',
            'total_amount' => 5000000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Mixed POSTED methods (including lowercase 'transfer' & legacy/unknown 'EDC' -> folded into OTHER) + VOIDED excluded
        $rows = [
            ['method' => 'TRANSFER', 'amount' => 1200000, 'status' => 'POSTED'],
            ['method' => 'transfer', 'amount' => 300000, 'status' => 'POSTED'],
            ['method' => 'CASH', 'amount' => 500000, 'status' => 'POSTED'],
            ['method' => 'QRIS', 'amount' => 450000, 'status' => 'POSTED'],
            ['method' => 'OTHER', 'amount' => 100000, 'status' => 'POSTED'],
            ['method' => 'EDC_LEGACY', 'amount' => 50000, 'status' => 'POSTED'],
            ['method' => 'TRANSFER', 'amount' => 999000, 'status' => 'VOIDED'],
            ['method' => 'CASH', 'amount' => 888000, 'status' => 'VOIDED'],
        ];

        foreach ($rows as $r) {
            DB::table('payments')->insert([
                'order_id' => $orderId,
                'recorded_by' => $this->user->id,
                'payment_date' => '2026-11-22',
                'amount' => $r['amount'],
                'method' => $r['method'],
                'idempotency_key' => (string) Str::uuid(),
                'status' => $r['status'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $report = app(ReportService::class)->getFinancialReport('custom', '2026-11-01', '2026-11-30');

        // Total POSTED cash_in = 1,200,000 + 300,000 + 500,000 + 450,000 + 100,000 + 50,000 = 2,600,000
        $this->assertSame(2600000, $report['summary']['cash_in']);

        $byMethod = collect($report['payment_method_breakdown'])->keyBy('method');
        $this->assertCount(4, $byMethod);
        $this->assertSame(1500000, $byMethod['TRANSFER']['amount']);
        $this->assertSame(2, $byMethod['TRANSFER']['count']);
        $this->assertSame(500000, $byMethod['CASH']['amount']);
        $this->assertSame(1, $byMethod['CASH']['count']);
        $this->assertSame(450000, $byMethod['QRIS']['amount']);
        $this->assertSame(1, $byMethod['QRIS']['count']);
        // OTHER + EDC_LEGACY folded cleanly into OTHER
        $this->assertSame(150000, $byMethod['OTHER']['amount']);
        $this->assertSame(2, $byMethod['OTHER']['count']);

        // Exact reconciliation with summary.cash_in
        $sumMethods = collect($report['payment_method_breakdown'])->sum('amount');
        $this->assertSame($report['summary']['cash_in'], $sumMethods);
    }

    public function test_aud07_expense_category_proportions_reconcile_and_preserve_tiny_nonzero_values(): void
    {
        // Total POSTED expenses = 500,000 + 496,000 + 4,000 = 1,000,000 (tiny category = 0.4%!)
        DB::table('expenses')->insert([
            [
                'expense_category_id' => $this->catFlowerId,
                'recorded_by' => $this->user->id,
                'expense_date' => '2026-11-22',
                'amount' => 500000,
                'description' => 'Stok bunga utama',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'expense_category_id' => $this->catCourierId,
                'recorded_by' => $this->user->id,
                'expense_date' => '2026-11-22',
                'amount' => 496000,
                'description' => 'Armada antar',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'expense_category_id' => $this->catSmallId,
                'recorded_by' => $this->user->id,
                'expense_date' => '2026-11-22',
                'amount' => 4000,
                'description' => 'Parkir pasar bunga',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'POSTED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'expense_category_id' => $this->catFlowerId,
                'recorded_by' => $this->user->id,
                'expense_date' => '2026-11-22',
                'amount' => 750000,
                'description' => 'Dibatalkan harus dikecualikan',
                'idempotency_key' => (string) Str::uuid(),
                'status' => 'VOIDED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $report = app(ReportService::class)->getFinancialReport('custom', '2026-11-01', '2026-11-30');
        $this->assertSame(1000000, $report['summary']['cash_out']);

        $expenses = collect($report['expense_breakdown'])->keyBy('category');
        $this->assertSame(50, $expenses['Belanja Bunga Segar']['percent']);
        $this->assertSame(50.0, $expenses['Belanja Bunga Segar']['percent_exact']);
        $this->assertSame(50, $expenses['Kurir & Transportasi']['percent']);
        $this->assertSame(49.6, $expenses['Kurir & Transportasi']['percent_exact']);
        // Tiny nonzero value preserves 0.4% exact share
        $this->assertSame(4000, $expenses['Parkir & Materai']['amount']);
        $this->assertSame(0.4, $expenses['Parkir & Materai']['percent_exact']);

        // Exact total reconciliation
        $this->assertSame($report['summary']['cash_out'], collect($report['expense_breakdown'])->sum('amount'));
    }

    public function test_all_eight_presets_wib_boundaries_and_all_time_aggregation(): void
    {
        // Freeze at 2026-11-24 18:15 UTC => 2026-11-25 01:15 WIB!
        Carbon::setTestNow(Carbon::create(2026, 11, 24, 18, 15, 0, 'UTC'));

        // Insert a historical order from 2024 to test all_time bounded yearly aggregation
        DB::table('orders')->insert([
            [
                'order_number' => 'MF-240310-01HIST000001',
                'customer_id' => $this->customerId,
                'created_by' => $this->user->id,
                'order_date' => '2024-03-10',
                'status' => 'COMPLETED',
                'total_amount' => 1500000,
                'created_at' => now()->subYears(2),
                'updated_at' => now()->subYears(2),
            ],
            [
                'order_number' => 'MF-261125-01WIBT000002',
                'customer_id' => $this->customerId,
                'created_by' => $this->user->id,
                'order_date' => '2026-11-25',
                'status' => 'NEW',
                'total_amount' => 850000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $service = app(ReportService::class);
        foreach (['today', '7d', '30d', 'this_month', 'last_month', 'this_year', 'all_time'] as $preset) {
            $res = $service->getSummaryReport($preset);
            $this->assertSame($preset, $res['period']['preset']);
        }

        $todayReport = $service->getSummaryReport('today');
        $this->assertSame('2026-11-25', $todayReport['period']['from']);
        $this->assertSame('2026-11-25', $todayReport['period']['to']);
        $this->assertSame(850000, $todayReport['summary']['total_billed']);

        $allTime = $service->getFinancialReport('all_time');
        $this->assertSame('2024-03-10', $allTime['period']['from']);
        $this->assertSame('2026-11-25', $allTime['period']['to']);
        $this->assertSame(2350000, $allTime['summary']['total_billed']);
        $this->assertSame('yearly', $allTime['chart_series']['granularity']);
        $this->assertCount(3, $allTime['chart_series']['points']); // 2024, 2025, 2026 bounded cleanly
    }

    public function test_empty_period_negative_net_cash_flow_large_values_and_table_reconciliation(): void
    {
        // Empty check first
        $empty = app(ReportService::class)->getFinancialReport('30d');
        $this->assertSame(0, $empty['summary']['cash_in']);
        $this->assertSame(0, $empty['summary']['cash_out']);
        $this->assertSame(0, $empty['summary']['cash_diff']);
        $this->assertCount(0, $empty['expense_breakdown']);

        // Large monetary values + negative net cash flow
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261124-01LARGE00001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => '2026-11-20',
            'status' => 'PROCESSING',
            'total_amount' => 150000000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payments')->insert([
            'order_id' => $orderId,
            'recorded_by' => $this->user->id,
            'payment_date' => '2026-11-21',
            'amount' => 120000000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('expenses')->insert([
            'expense_category_id' => $this->catFlowerId,
            'recorded_by' => $this->user->id,
            'expense_date' => '2026-11-22',
            'amount' => 195000000,
            'description' => 'Pengadaan bunga event nasional skala besar',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $report = app(ReportService::class)->getFinancialReport('custom', '2026-11-01', '2026-11-30', 'weekly');
        $this->assertSame(150000000, $report['summary']['total_billed']);
        $this->assertSame(120000000, $report['summary']['cash_in']);
        $this->assertSame(195000000, $report['summary']['cash_out']);
        $this->assertSame(-75000000, $report['summary']['cash_diff']);

        // Table points reconcile 100% with summary
        $pts = collect($report['chart_series']['points']);
        $this->assertSame($report['summary']['orders_count'], $pts->sum('orders_count'));
        $this->assertSame($report['summary']['total_billed'], $pts->sum('billed'));
        $this->assertSame($report['summary']['cash_in'], $pts->sum('cash_in'));
        $this->assertSame($report['summary']['cash_out'], $pts->sum('cash_out'));
        $this->assertSame($report['summary']['cash_diff'], $pts->sum('cash_diff'));
    }

    public function test_dashboard_and_report_reconcile_identically_for_30d_and_all_time(): void
    {
        $today = now('Asia/Jakarta')->toDateString();
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'MF-261124-01RECON00001',
            'customer_id' => $this->customerId,
            'created_by' => $this->user->id,
            'order_date' => $today,
            'status' => 'READY',
            'total_amount' => 2400000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payments')->insert([
            'order_id' => $orderId,
            'recorded_by' => $this->user->id,
            'payment_date' => $today,
            'amount' => 1100000,
            'method' => 'QRIS',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('expenses')->insert([
            'expense_category_id' => $this->catCourierId,
            'recorded_by' => $this->user->id,
            'expense_date' => $today,
            'amount' => 350000,
            'description' => 'Pengiriman papan',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $dashStats = app(DashboardService::class)->stats();
        $dashPulse30 = app(DashboardService::class)->cashFlowPulse()['period_30d'];
        $rep30 = app(ReportService::class)->getSummaryReport('30d')['summary'];
        $repAll = app(ReportService::class)->getSummaryReport('all_time')['summary'];

        $this->assertSame($dashPulse30['cash_in'], $rep30['cash_in']);
        $this->assertSame($dashPulse30['cash_out'], $rep30['cash_out']);
        $this->assertSame($dashPulse30['cash_diff'], $rep30['cash_diff']);
        $this->assertSame($dashStats['billed'], $repAll['total_billed']);
        $this->assertSame($dashStats['received'], $repAll['cash_in']);
        $this->assertSame($dashStats['expenses'], $repAll['cash_out']);
        $this->assertSame($dashStats['cash_flow'], $repAll['cash_diff']);
        $this->assertSame($dashStats['outstanding'], $repAll['current_outstanding']);
    }

    public function test_reports_initial_and_deferred_query_counts_and_excel_export_integrity(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();

        $this->actingAs($this->user)
            ->get(route('ui-reports.index', ['preset' => '30d']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->missing('reportBreakdowns')
                ->missing('reportTrends')
            );

        $initialQueries = array_values(array_filter(
            DB::getQueryLog(),
            fn (array $q): bool => ! str_contains(strtolower($q['query']), 'from "users"')
                && ! str_contains(strtolower($q['query']), 'from "sessions"')
        ));

        // Initial GET /ui-reports?preset=30d executes exactly 1 domain SQL query
        $this->assertCount(1, $initialQueries);

        // Deferred 'details' reload skips core summary query: 3 breakdown queries + 3 trend queries = 6 queries
        DB::flushQueryLog();
        $this->actingAs($this->user)
            ->withHeaders([
                'X-Inertia' => 'true',
                'X-Inertia-Version' => \Inertia\Inertia::getVersion() ?? '',
                'X-Inertia-Partial-Component' => 'Reports/Index',
                'X-Inertia-Partial-Data' => 'reportBreakdowns,reportTrends',
            ])
            ->get(route('ui-reports.index', ['preset' => '30d']))
            ->assertOk()
            ->assertJsonStructure([
                'props' => [
                    'reportBreakdowns' => ['fulfillment_breakdown', 'payment_breakdown', 'payment_method_breakdown', 'expense_breakdown'],
                    'reportTrends' => ['daily_trends', 'chart_series'],
                ],
            ]);

        $deferredQueries = array_values(array_filter(
            DB::getQueryLog(),
            fn (array $q): bool => ! str_contains(strtolower($q['query']), 'from "users"')
                && ! str_contains(strtolower($q['query']), 'from "sessions"')
        ));
        $this->assertCount(6, $deferredQueries);
        DB::disableQueryLog();

        // Excel export works cleanly for all_time preset too
        $exportResponse = $this->actingAs($this->user)
            ->get(route('ui-reports.export', ['preset' => 'all_time']));
        $exportResponse->assertOk();
        $file = $exportResponse->baseResponse->getFile()->getPathname();
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($file) === true);
        $this->assertNotFalse($zip->locateName('xl/workbook.xml'));
        $zip->close();
    }
}
