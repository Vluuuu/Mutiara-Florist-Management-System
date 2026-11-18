<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

class UiReportTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();
    }

    private function createCategory(string $name): ExpenseCategory
    {
        $cat = new ExpenseCategory();
        $cat->name = $name;
        $cat->is_active = true;
        $cat->save();

        return $cat;
    }

    private function createOrder(int $customerId, string $date, int $total, string $status = 'NEW', ?string $orderNumber = null): Order
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => $orderNumber ?? 'ORD-'.strtoupper(Str::random(8)),
            'customer_id' => $customerId,
            'created_by' => $this->admin->id,
            'order_date' => $date,
            'status' => $status,
            'total_amount' => $total,
        ])->save();

        return $order;
    }

    private function createItem(Order $order, string $flowerType, int $qty, int $unitPrice, string $shipMode = 'INCLUDED', int $shipFee = 0, string $status = 'NEW'): void
    {
        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => $flowerType,
            'recipient' => 'Penerima',
            'sender_name' => 'Pengirim',
            'delivery_date' => $order->order_date,
            'delivery_location' => 'Jakarta',
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'shipping_mode' => $shipMode,
            'shipping_fee' => $shipFee,
            'fulfillment_status' => $status,
        ])->save();
    }

    private function createPayment(Order $order, string $date, int $amount, string $status = 'POSTED', ?string $reason = null): Payment
    {
        $p = new Payment();
        $p->forceFill([
            'order_id' => $order->id,
            'payment_date' => $date,
            'amount' => $amount,
            'method' => 'TRANSFER',
            'status' => $status,
            'idempotency_key' => (string) Str::uuid(),
            'void_reason' => $reason,
            'voided_at' => $reason ? Carbon::now() : null,
            'recorded_by' => $this->admin->id,
        ])->save();

        return $p;
    }

    private function createExpense(ExpenseCategory $category, string $date, int $amount, string $desc, string $status = 'POSTED', ?string $reason = null): Expense
    {
        $e = new Expense();
        $e->forceFill([
            'expense_category_id' => $category->id,
            'expense_date' => $date,
            'amount' => $amount,
            'description' => $desc,
            'status' => $status,
            'idempotency_key' => (string) Str::uuid(),
            'void_reason' => $reason,
            'voided_at' => $reason ? Carbon::now() : null,
            'recorded_by' => $this->admin->id,
        ])->save();

        return $e;
    }

    public function test_guest_cannot_access_reports_or_export(): void
    {
        $this->get(route('ui-reports.index'))->assertRedirect(route('login'));
        $this->get(route('ui-reports.export'))->assertRedirect(route('login'));
    }

    public function test_admin_can_access_reports_page(): void
    {
        $this->actingAs($this->admin)
            ->get(route('ui-reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->has('report.period')
                ->has('report.summary')
                ->has('report.fulfillment_breakdown')
                ->has('report.payment_breakdown')
                ->has('report.daily_trends')
                ->has('report.notes')
                ->where('report.notes.cash_diff_label', 'Selisih Kas')
            );
    }

    public function test_reports_calculate_metrics_accurately_based_on_dates(): void
    {
        $customer = Customer::create(['name' => 'Budi Santoso']);
        $category = $this->createCategory('Operasional Toko');

        // Order 1: Created on 2026-11-01 (In range)
        $order1 = $this->createOrder($customer->id, '2026-11-01', 500000, 'COMPLETED', 'ORD-20261101-001');
        $this->createItem($order1, 'Buket Mawar Merah', 1, 450000, 'SEPARATE', 50000, 'DELIVERED');

        // Order 2: Created on 2026-10-15 (Out of range for 2026-11-01 to 2026-11-10)
        $order2 = $this->createOrder($customer->id, '2026-10-15', 300000, 'PROCESSING', 'ORD-20261015-001');
        $this->createItem($order2, 'Standing Flower', 1, 300000, 'INCLUDED', 0, 'PROCESSING');

        // Payment 1 for Order 2 paid on 2026-11-05 (In range for cash received!)
        $this->createPayment($order2, '2026-11-05', 200000, 'POSTED');

        // Expense 1 on 2026-11-06 (In range for cash spent!)
        $this->createExpense($category, '2026-11-06', 75000, 'Pita dan Kertas Wrapping', 'POSTED');

        // Request custom period: 2026-11-01 to 2026-11-10
        $response = $this->actingAs($this->admin)
            ->get(route('ui-reports.index', [
                'preset' => 'custom',
                'from' => '2026-11-01',
                'to' => '2026-11-10',
            ]))
            ->assertOk();

        $report = $response->viewData('page')['props']['report'];

        // Orders within period: only order1
        $this->assertSame(1, $report['summary']['orders_count']);
        $this->assertSame(500000, $report['summary']['total_billed']);
        $this->assertSame(450000, $report['summary']['flower_total']);
        $this->assertSame(50000, $report['summary']['shipping_total']);

        // Cash in within period: payment for order2 on 2026-11-05 = 200000
        $this->assertSame(200000, $report['summary']['cash_in']);

        // Cash out within period: expense on 2026-11-06 = 75000
        $this->assertSame(75000, $report['summary']['cash_out']);

        // Cash diff: 200000 - 75000 = 125000
        $this->assertSame(125000, $report['summary']['cash_diff']);

        // Total running receivables across all open orders:
        // order1: 500000 - 0 = 500000
        // order2: 300000 - 200000 = 100000
        // total current outstanding = 600000
        $this->assertSame(600000, $report['summary']['current_outstanding']);
    }

    public function test_voided_payments_and_expenses_are_excluded_from_reports(): void
    {
        $customer = Customer::create(['name' => 'Dewi Lestari']);
        $category = $this->createCategory('Transport');

        $order = $this->createOrder($customer->id, '2026-11-10', 1000000, 'PROCESSING', 'ORD-20261110-001');
        $this->createItem($order, 'Papan Ucapan Selamat', 1, 1000000, 'INCLUDED', 0, 'PROCESSING');

        // Posted Payment
        $this->createPayment($order, '2026-11-10', 400000, 'POSTED');

        // Voided Payment (must NOT count)
        $this->createPayment($order, '2026-11-10', 600000, 'VOIDED', 'Salah catat nominal kelebihan nol');

        // Posted Expense
        $this->createExpense($category, '2026-11-10', 50000, 'Bensin motor kurir', 'POSTED');

        // Voided Expense (must NOT count)
        $this->createExpense($category, '2026-11-10', 150000, 'Bensin salah input', 'VOIDED', 'Salah entri kategori dan tanggal');

        $response = $this->actingAs($this->admin)
            ->get(route('ui-reports.index', [
                'preset' => 'custom',
                'from' => '2026-11-10',
                'to' => '2026-11-10',
            ]))
            ->assertOk();

        $report = $response->viewData('page')['props']['report'];

        // Only POSTED payment of 400.000
        $this->assertSame(400000, $report['summary']['cash_in']);

        // Only POSTED expense of 50.000
        $this->assertSame(50000, $report['summary']['cash_out']);

        // Selisih kas = 400.000 - 50.000 = 350.000
        $this->assertSame(350000, $report['summary']['cash_diff']);

        // Outstanding = 1.000.000 - 400.000 = 600.000 (VOIDED 600.000 is excluded)
        $this->assertSame(600000, $report['summary']['current_outstanding']);
    }

    public function test_excel_export_generates_valid_xlsx_file_and_protects_against_formula_injection(): void
    {
        $customer = Customer::create(['name' => '=HYPERLINK("http://evil.com","Click")']);
        $category = $this->createCategory('+Biaya Berbahaya');

        $order = $this->createOrder($customer->id, '2026-11-12', 250000, 'NEW', '-ORD-20261112-999');
        $this->createItem($order, '@FormulaInjection', 1, 250000, 'INCLUDED', 0, 'NEW');

        $this->createExpense($category, '2026-11-12', 50000, '=SUM(A1:A100)', 'POSTED');

        $response = $this->actingAs($this->admin)
            ->get(route('ui-reports.export', [
                'preset' => 'custom',
                'from' => '2026-11-12',
                'to' => '2026-11-12',
            ]));

        $response->assertOk();
        $this->assertSame(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            $response->headers->get('Content-Type')
        );

        // Save content to temp file and inspect as ZipArchive
        $tempFile = tempnam(sys_get_temp_dir(), 'mfms_test_xlsx_');
        file_put_contents($tempFile, $response->streamedContent());

        $zip = new ZipArchive();
        $openResult = $zip->open($tempFile);
        $this->assertTrue($openResult === true, 'Downloaded file must be a valid zip archive');

        $this->assertNotFalse($zip->locateName('[Content_Types].xml'));
        $contentTypes = $zip->getFromName('[Content_Types].xml');
        $this->assertStringContainsString('xmlns="http://schemas.openxmlformats.org/package/2006/content-types"', $contentTypes);
        $this->assertStringContainsString('PartName="/xl/workbook.xml"', $contentTypes);
        $this->assertStringContainsString('PartName="/xl/styles.xml"', $contentTypes);
        $this->assertStringContainsString('PartName="/docProps/core.xml"', $contentTypes);
        $this->assertStringContainsString('PartName="/docProps/app.xml"', $contentTypes);

        $this->assertNotFalse($zip->locateName('_rels/.rels'));
        $rels = $zip->getFromName('_rels/.rels');
        $this->assertStringContainsString('Target="xl/workbook.xml"', $rels);

        $this->assertNotFalse($zip->locateName('docProps/core.xml'));
        $this->assertNotFalse($zip->locateName('docProps/app.xml'));
        $this->assertNotFalse($zip->locateName('xl/_rels/workbook.xml.rels'));

        $this->assertNotFalse($zip->locateName('xl/workbook.xml'));
        $this->assertNotFalse($zip->locateName('xl/styles.xml'));
        $this->assertNotFalse($zip->locateName('xl/worksheets/sheet1.xml')); // Ringkasan
        $this->assertNotFalse($zip->locateName('xl/worksheets/sheet2.xml')); // Pesanan
        $this->assertNotFalse($zip->locateName('xl/worksheets/sheet3.xml')); // Kas Masuk
        $this->assertNotFalse($zip->locateName('xl/worksheets/sheet4.xml')); // Kas Keluar

        // Verify formula injection sanitization in sheet XML
        $sheet2Xml = $zip->getFromName('xl/worksheets/sheet2.xml');
        // Customer name starting with '=' should be sanitized to '\'=HYPERLINK'
        $this->assertStringContainsString('&apos;=HYPERLINK', $sheet2Xml);
        // Order number starting with '-' should be sanitized to '\'-ORD'
        $this->assertStringContainsString('&apos;-ORD', $sheet2Xml);

        $sheet4Xml = $zip->getFromName('xl/worksheets/sheet4.xml');
        // Expense description starting with '=' should be sanitized to '\'=SUM'
        $this->assertStringContainsString('&apos;=SUM', $sheet4Xml);

        $zip->close();
        @unlink($tempFile);
    }

    public function test_reports_support_weekly_monthly_yearly_chart_series_and_expense_breakdown(): void
    {
        $customer = Customer::create(['name' => 'Pelanggan Grafik']);
        $catFlowers = $this->createCategory('Bunga Segar');
        $catCourier = $this->createCategory('Ongkos Kurir');

        // Out-of-range 2025 activity MUST be excluded from 2026-01-01..2026-02-28 charts in ALL modes
        $order2025 = $this->createOrder($customer->id, '2025-12-10', 800000, 'COMPLETED', 'ORD-20251210-001');
        $this->createPayment($order2025, '2025-12-10', 800000, 'POSTED');
        $this->createExpense($catFlowers, '2025-12-10', 250000, 'Stok mawar tahun lalu', 'POSTED');

        // Same-week out-of-range day immediately before period.from (2025-12-31 is Wednesday of 2026-W01)
        $orderPrevWeek = $this->createOrder($customer->id, '2025-12-31', 700000, 'COMPLETED', 'ORD-20251231-001');
        $this->createPayment($orderPrevWeek, '2025-12-31', 700000, 'POSTED');
        $this->createExpense($catCourier, '2025-12-31', 90000, 'Kurir malam tahun baru', 'POSTED');

        $orderJan = $this->createOrder($customer->id, '2026-01-15', 500000, 'COMPLETED', 'ORD-20260115-001');
        $this->createPayment($orderJan, '2026-01-16', 500000, 'POSTED');
        $this->createExpense($catFlowers, '2026-01-15', 150000, 'Bunga Januari', 'POSTED');
        $this->createExpense($catCourier, '2026-01-16', 50000, 'Kurir Januari', 'POSTED');
        $this->createExpense($catCourier, '2026-01-16', 99999, 'Kurir Void', 'VOIDED', 'Batal karena salah nominal input');

        foreach (['daily', 'weekly', 'monthly', 'yearly'] as $granularity) {
            $resp = $this->actingAs($this->admin)
                ->get(route('ui-reports.index', [
                    'preset' => 'custom',
                    'from' => '2026-01-01',
                    'to' => '2026-02-28',
                    'granularity' => $granularity,
                ]))
                ->assertOk();

            $rep = $resp->viewData('page')['props']['report'];
            $this->assertSame($granularity, $rep['chart_series']['granularity']);
            $this->assertFalse($rep['chart_series']['is_truncated']);
            $this->assertNull($rep['chart_series']['notice']);
            $this->assertNotEmpty($rep['chart_series']['points']);
            $this->assertChartSeriesMatchesSummary($rep);

            if ($granularity === 'weekly') {
                $firstWeek = $rep['chart_series']['points'][0];
                $lastWeek = $rep['chart_series']['points'][count($rep['chart_series']['points']) - 1];
                $this->assertStringContainsString('01/01/2026 - 04/01/2026', $firstWeek['full_label']);
                $this->assertStringContainsString('(parsial)', $firstWeek['full_label']);
                $this->assertStringContainsString('23/02/2026 - 28/02/2026', $lastWeek['full_label']);
                $this->assertStringContainsString('(parsial)', $lastWeek['full_label']);
                $this->assertSame(0, $firstWeek['cash_in']);
            }

            if ($granularity === 'yearly') {
                $byYear = collect($rep['chart_series']['points'])->keyBy('key');
                $this->assertSame(['2026'], collect($rep['chart_series']['points'])->pluck('key')->all());
                $this->assertFalse($byYear->has('2025'));
                $this->assertSame(1, $byYear['2026']['orders_count']);
                $this->assertSame(500000, $byYear['2026']['billed']);
                $this->assertSame(500000, $byYear['2026']['cash_in']);
                $this->assertSame(200000, $byYear['2026']['cash_out']);
                $this->assertStringContainsString('Tahun 2026 (01/01 - 28/02)', $byYear['2026']['full_label']);
            }

            if ($granularity === 'monthly') {
                $byMonth = collect($rep['chart_series']['points'])->keyBy('key');
                $this->assertSame(['2026-01', '2026-02'], $byMonth->keys()->all());
                $this->assertSame(500000, $byMonth['2026-01']['cash_in']);
                $this->assertSame(200000, $byMonth['2026-01']['cash_out']);
                $this->assertSame(300000, $byMonth['2026-01']['cash_diff']);
                $this->assertSame(0, $byMonth['2026-02']['cash_in']);
            }
        }

        // Verify expense breakdown sums only POSTED expenses inside period
        $repBreakdown = $this->actingAs($this->admin)
            ->get(route('ui-reports.index', [
                'preset' => 'custom',
                'from' => '2026-01-01',
                'to' => '2026-02-28',
            ]))
            ->assertOk()
            ->viewData('page')['props']['report']['expense_breakdown'];

        $this->assertCount(2, $repBreakdown);
        $this->assertSame('Bunga Segar', $repBreakdown[0]['category']);
        $this->assertSame(150000, $repBreakdown[0]['amount']);
        $this->assertSame(75, $repBreakdown[0]['percent']);
        $this->assertSame('Ongkos Kurir', $repBreakdown[1]['category']);
        $this->assertSame(50000, $repBreakdown[1]['amount']);
    }

    public function test_chart_series_strictly_matches_summary_across_all_presets_and_granularities(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-15 10:00:00', 'Asia/Jakarta'));

        try {
            $customer = Customer::create(['name' => 'Pelanggan Regresi Periode']);
            $catOps = $this->createCategory('Operasional');

            // 1. Cross-year past out-of-range (Nov 2025) + cross-month out-of-range (late Mar 2026)
            $ordNov = $this->createOrder($customer->id, '2025-11-20', 950000, 'COMPLETED', 'ORD-20251120-001');
            $this->createPayment($ordNov, '2025-11-21', 950000, 'POSTED');
            $this->createExpense($catOps, '2025-11-22', 120000, 'Biaya Nov 2025', 'POSTED');

            // Same calendar week as Apr 1 (2026-03-30 is Monday, inside 2026-W14 before last_month Apr 1)
            $ordMar = $this->createOrder($customer->id, '2026-03-30', 410000, 'COMPLETED', 'ORD-20260330-001');
            $this->createPayment($ordMar, '2026-03-30', 410000, 'POSTED');
            $this->createExpense($catOps, '2026-03-30', 50000, 'Biaya Mar 30', 'POSTED');

            // 2. Inside January 2026 (caught by summary & this_year, excluded when >92d daily truncates)
            $ordJan = $this->createOrder($customer->id, '2026-01-10', 600000, 'COMPLETED', 'ORD-20260110-001');
            $this->createPayment($ordJan, '2026-01-11', 350000, 'POSTED');
            $this->createExpense($catOps, '2026-01-12', 80000, 'Biaya Jan', 'POSTED');

            // 3. Inside April 2026 (covers last_month, 30d partial start, and same-week Apr 29 before May 1)
            $ordAprMid = $this->createOrder($customer->id, '2026-04-18', 450000, 'READY', 'ORD-20260418-001');
            $this->createPayment($ordAprMid, '2026-04-19', 200000, 'POSTED');
            $this->createExpense($catOps, '2026-04-20', 75000, 'Biaya Apr 20', 'POSTED');

            // Same calendar week as May 1 (2026-04-29 is Wednesday of 2026-W18)
            $ordAprEnd = $this->createOrder($customer->id, '2026-04-29', 300000, 'PROCESSING', 'ORD-20260429-001');
            $this->createPayment($ordAprEnd, '2026-04-29', 300000, 'POSTED');
            $this->createExpense($catOps, '2026-04-29', 40000, 'Biaya Apr 29', 'POSTED');

            // 4. Inside May 2026: May 10 (7d), May 12 (same week as May 15), and May 15 (today)
            $ordMay10 = $this->createOrder($customer->id, '2026-05-10', 520000, 'COMPLETED', 'ORD-20260510-001');
            $this->createPayment($ordMay10, '2026-05-11', 520000, 'POSTED');
            $this->createExpense($catOps, '2026-05-11', 60000, 'Biaya May 11', 'POSTED');

            $ordMay12 = $this->createOrder($customer->id, '2026-05-12', 280000, 'NEW', 'ORD-20260512-001');
            $this->createPayment($ordMay12, '2026-05-12', 140000, 'POSTED');

            $ordMay15 = $this->createOrder($customer->id, '2026-05-15', 750000, 'COMPLETED', 'ORD-20260515-001');
            $this->createPayment($ordMay15, '2026-05-15', 750000, 'POSTED');
            $this->createPayment($ordMay15, '2026-05-15', 999000, 'VOIDED', 'Dobel input hari ini');
            $this->createExpense($catOps, '2026-05-15', 95000, 'Biaya Hari Ini', 'POSTED');
            $this->createExpense($catOps, '2026-05-15', 888000, 'Biaya Void', 'VOIDED', 'Batal pengeluaran');

            // 5. Future out-of-range (next month & next year)
            $ordJun = $this->createOrder($customer->id, '2026-06-05', 330000, 'NEW', 'ORD-20260605-001');
            $this->createPayment($ordJun, '2026-06-05', 330000, 'POSTED');
            $ord2027 = $this->createOrder($customer->id, '2027-01-05', 440000, 'NEW', 'ORD-20270105-001');
            $this->createPayment($ord2027, '2027-01-05', 440000, 'POSTED');

            $untruncatedPresets = [
                ['preset' => 'today'],
                ['preset' => '7d'],
                ['preset' => '30d'],
                ['preset' => 'this_month'],
                ['preset' => 'last_month'],
                ['preset' => 'custom', 'from' => '2026-04-10', 'to' => '2026-05-15'], // custom cross-month (36d)
                ['preset' => 'custom', 'from' => '2025-11-15', 'to' => '2026-02-10'], // custom cross-year (88d)
                ['preset' => 'custom', 'from' => '2026-02-01', 'to' => '2026-02-14'], // completely empty period
            ];

            foreach ($untruncatedPresets as $query) {
                foreach (['daily', 'weekly', 'monthly', 'yearly'] as $granularity) {
                    $rep = $this->actingAs($this->admin)
                        ->get(route('ui-reports.index', array_merge($query, ['granularity' => $granularity])))
                        ->assertOk()
                        ->viewData('page')['props']['report'];

                    $series = $rep['chart_series'];
                    $this->assertFalse($series['is_truncated'], "Unexpected truncation for {$query['preset']} {$granularity}");
                    $this->assertNull($series['notice']);
                    $this->assertChartSeriesMatchesSummary($rep);

                    if ($query['preset'] === 'today') {
                        $this->assertCount(1, $series['points'], 'Today filter must only produce 1 bucket per granularity');
                        $this->assertSame(750000, $series['points'][0]['cash_in']);
                        $this->assertSame(95000, $series['points'][0]['cash_out']);
                    }

                    if ($query['preset'] === 'last_month' && $granularity === 'monthly') {
                        $this->assertSame(['2026-04'], collect($series['points'])->pluck('key')->all());
                    }

                    if (($query['from'] ?? null) === '2025-11-15' && $granularity === 'yearly') {
                        $byYear = collect($series['points'])->keyBy('key');
                        $this->assertSame(['2025', '2026'], collect($series['points'])->pluck('key')->all());
                        $this->assertStringContainsString('Tahun 2025 (15/11 - 31/12)', $byYear['2025']['full_label']);
                        $this->assertStringContainsString('Tahun 2026 (01/01 - 10/02)', $byYear['2026']['full_label']);
                    }
                }
            }

            // Test >92 days (`this_year` Jan 1 .. May 15 = 135 days):
            // - weekly, monthly, yearly MUST match full summary strictly
            // - daily keeps 92-day cap as an explicit, user-visible exception
            foreach (['weekly', 'monthly', 'yearly'] as $granularity) {
                $rep = $this->actingAs($this->admin)
                    ->get(route('ui-reports.index', ['preset' => 'this_year', 'granularity' => $granularity]))
                    ->assertOk()
                    ->viewData('page')['props']['report'];

                $this->assertFalse($rep['chart_series']['is_truncated']);
                $this->assertNull($rep['chart_series']['notice']);
                $this->assertChartSeriesMatchesSummary($rep);

                if ($granularity === 'yearly') {
                    $keys = collect($rep['chart_series']['points'])->pluck('key')->all();
                    $this->assertSame(['2026'], $keys);
                }
            }

            $repDailyTruncated = $this->actingAs($this->admin)
                ->get(route('ui-reports.index', ['preset' => 'this_year', 'granularity' => 'daily']))
                ->assertOk()
                ->viewData('page')['props']['report'];

            $dailySeries = $repDailyTruncated['chart_series'];
            $this->assertTrue($dailySeries['is_truncated']);
            $this->assertSame(135, $dailySeries['total_period_days']);
            $this->assertSame(92, $dailySeries['covered_days']);
            $this->assertCount(92, $dailySeries['points']);
            $this->assertNotNull($dailySeries['notice']);
            $this->assertStringContainsString('92 hari terakhir', $dailySeries['notice']);
            $this->assertStringContainsString('135 hari', $dailySeries['notice']);

            // Summary includes Jan 10 order (600k billed / 350k cash_in / 80k cash_out),
            // whereas the 92-day daily window starts Feb 13 and explicitly excludes Jan 10.
            $dailySumCashIn = collect($dailySeries['points'])->sum('cash_in');
            $this->assertSame(
                $repDailyTruncated['summary']['cash_in'] - 350000,
                $dailySumCashIn,
                '92-day daily truncation exception must strictly equal full summary minus pre-cutoff activity'
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    /**
     * Verifies chart bucket totals strictly match report KPI summary figures.
     *
     * @param  array<string, mixed>  $report
     */
    protected function assertChartSeriesMatchesSummary(array $report): void
    {
        $points = collect($report['chart_series']['points'] ?? []);
        $summary = $report['summary'];

        $this->assertSame((int) $summary['orders_count'], (int) $points->sum('orders_count'));
        $this->assertSame((int) $summary['total_billed'], (int) $points->sum('billed'));
        $this->assertSame((int) $summary['cash_in'], (int) $points->sum('cash_in'));
        $this->assertSame((int) $summary['cash_out'], (int) $points->sum('cash_out'));
    }
}
