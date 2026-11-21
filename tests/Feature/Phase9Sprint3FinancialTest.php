<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Payment;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\ExpenseService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

class Phase9Sprint3FinancialTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private OrderService $orderService;
    private PaymentService $paymentService;
    private ExpenseService $expenseService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Admin Keuangan']);
        $this->orderService = app(OrderService::class);
        $this->paymentService = app(PaymentService::class);
        $this->expenseService = app(ExpenseService::class);
    }

    public function test_payments_index_provides_wib_date_filtered_payment_history_and_return_to_payments(): void
    {
        $customer = Customer::query()->create(['name' => 'PT Melati Putih', 'phone' => '081234567890']);
        $today = now('Asia/Jakarta')->toDateString();

        $order = $this->orderService->create([
            'customer_id' => $customer->id,
            'order_date' => $today,
            'items' => [
                [
                    'flower_type' => 'Papan Bunga Ucapan Selamat',
                    'recipient' => 'Ibu Ratih',
                    'sender_name' => 'PT Melati',
                    'delivery_date' => $today,
                    'delivery_location' => 'Jakarta Pusat',
                    'quantity' => 1,
                    'unit_price' => 1200000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                ],
            ],
        ], $this->admin->id);

        // Record one POSTED payment and one VOIDED payment
        $posted = $this->paymentService->record($order, [
            'payment_date' => $today,
            'amount' => 400000,
            'method' => 'TRANSFER',
            'reference' => 'BCA-001',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $toVoid = $this->paymentService->record($order, [
            'payment_date' => $today,
            'amount' => 300000,
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $this->paymentService->void($order, $toVoid, 'Nominal salah catat saat kasir tutup shift', $this->admin->id);

        // Default index returns receivables, todayIso, and both payment history rows
        $this->actingAs($this->admin)
            ->get(route('ui-payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Index')
                ->where('todayIso', $today)
                ->where('outstanding', 800000)
                ->has('orders.data', 1)
                ->missing('paymentHistory')
                ->loadDeferredProps('history', fn (Assert $deferred) => $deferred
                    ->has('paymentHistory.data', 2)
                )
            );

        // Filter paymentHistory by POSTED only
        $this->actingAs($this->admin)
            ->get(route('ui-payments.index', ['history_status' => 'POSTED']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.history_status', 'POSTED')
                ->loadDeferredProps('history', fn (Assert $deferred) => $deferred
                    ->has('paymentHistory.data', 1)
                    ->where('paymentHistory.data.0.id', $posted->id)
                    ->where('paymentHistory.data.0.status', 'POSTED')
                )
            );

        // Filter paymentHistory by VOIDED only
        $this->actingAs($this->admin)
            ->get(route('ui-payments.index', ['history_status' => 'VOIDED']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.history_status', 'VOIDED')
                ->loadDeferredProps('history', fn (Assert $deferred) => $deferred
                    ->has('paymentHistory.data', 1)
                    ->where('paymentHistory.data.0.id', $toVoid->id)
                    ->where('paymentHistory.data.0.status', 'VOIDED')
                )
            );

        // Record installment directly from Payments/Index with return_to=payments
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), [
                'payment_date' => $today,
                'amount' => 800000,
                'method' => 'QRIS',
                'reference' => 'QRIS-LUNAS-99',
                'idempotency_key' => (string) Str::uuid(),
                'return_to' => 'payments',
            ])
            ->assertRedirect(route('ui-payments.index'));

        // Order is now fully paid, receivables should be 0
        $this->actingAs($this->admin)
            ->get(route('ui-payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('outstanding', 0)
                ->has('orders.data', 0)
            );
    }

    public function test_expenses_create_defaults_today_iso_in_wib_across_boundary_hours(): void
    {
        try {
            // 00:30 WIB on 2026-11-18 = 17:30 UTC on 2026-11-17
            Carbon::setTestNow(Carbon::create(2026, 11, 17, 17, 30, 0, 'UTC'));
            $this->actingAs($this->admin)
                ->get(route('ui-expenses.create'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Expenses/Create')
                    ->where('todayIso', '2026-11-18')
                );

            // 06:59 WIB on 2026-11-18 = 23:59 UTC on 2026-11-17
            Carbon::setTestNow(Carbon::create(2026, 11, 17, 23, 59, 0, 'UTC'));
            $this->actingAs($this->admin)
                ->get(route('ui-expenses.create'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->where('todayIso', '2026-11-18')
                );

            // 07:00 WIB on 2026-11-18 = 00:00 UTC on 2026-11-18
            Carbon::setTestNow(Carbon::create(2026, 11, 18, 0, 0, 0, 'UTC'));
            $this->actingAs($this->admin)
                ->get(route('ui-expenses.create'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->where('todayIso', '2026-11-18')
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_expense_category_quick_create_json_and_status_toggle_preserve_history(): void
    {
        // Quick-create JSON returns 201 and category object + audit log
        $jsonResp = $this->actingAs($this->admin)
            ->postJson(route('ui-expense-categories.store'), [
                'name' => 'Bunga Segar Rawa Belong',
            ])
            ->assertCreated()
            ->assertJsonPath('category.name', 'Bunga Segar Rawa Belong')
            ->assertJsonPath('category.is_active', true);

        $catId = $jsonResp->json('category.id');
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'expense_category.created',
            'subject_id' => $catId,
        ]);

        // Record an expense under this category
        $this->expenseService->record([
            'expense_category_id' => $catId,
            'expense_date' => now('Asia/Jakarta')->toDateString(),
            'amount' => 350000,
            'description' => 'Pembelian krisan dan lili putih',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        // Deactivate category
        $this->actingAs($this->admin)
            ->patch(route('ui-expense-categories.status', $catId), ['is_active' => 0])
            ->assertRedirect(route('ui-expense-categories.index'));

        // Category is hidden from active creation list, but historical expense still lists it cleanly
        $this->actingAs($this->admin)
            ->get(route('ui-expenses.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('categories', 0));

        $this->actingAs($this->admin)
            ->get(route('ui-expenses.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('postedTotal', 350000)
                ->has('expenses.data', 1)
                ->where('expenses.data.0.category.name', 'Bunga Segar Rawa Belong')
            );
    }

    public function test_expenses_index_rejects_invalid_date_range_and_prevents_double_idempotency_write(): void
    {
        $category = new ExpenseCategory();
        $category->forceFill(['name' => 'Kurir Toko', 'is_active' => true])->save();

        // Filter validation when to < from
        $this->actingAs($this->admin)
            ->get(route('ui-expenses.index', [
                'from' => '2026-11-20',
                'to' => '2026-11-10',
            ]))
            ->assertSessionHasErrors('to');

        // Idempotency key prevents duplicate expense creation on retry
        $uuid = (string) Str::uuid();
        $payload = [
            'expense_category_id' => $category->id,
            'expense_date' => '2026-11-17',
            'amount' => 125000,
            'description' => 'Ongkos kirim kurir lalamove armada toko',
            'idempotency_key' => $uuid,
        ];

        $this->actingAs($this->admin)->post(route('ui-expenses.store'), $payload)->assertRedirect(route('ui-expenses.index'));
        $this->actingAs($this->admin)->post(route('ui-expenses.store'), $payload)->assertRedirect(route('ui-expenses.index'));

        $this->assertSame(1, Expense::query()->where('idempotency_key', $uuid)->count());
    }

    public function test_full_reconciliation_parity_across_all_modules_and_database_pre_and_post_void(): void
    {
        $today = now('Asia/Jakarta')->toDateString();
        $cust = Customer::query()->create(['name' => 'Hotel Anggrek', 'phone' => '081900001122']);
        $cat = new ExpenseCategory();
        $cat->forceFill(['name' => 'Perlengkapan & Bunga', 'is_active' => true])->save();

        // Order A: flower 600.000 + separate shipping 100.000 = 700.000
        $orderA = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => $today,
            'items' => [
                [
                    'flower_type' => 'Standing Flower Duka Cita',
                    'recipient' => 'Lobby Utama',
                    'sender_name' => 'Hotel Anggrek',
                    'delivery_date' => $today,
                    'delivery_location' => 'Sudirman',
                    'quantity' => 1,
                    'unit_price' => 600000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 100000,
                ],
            ],
        ], $this->admin->id);

        // Order B: INCLUDED shipping => total = 2 * 250.000 = 500.000
        $orderB = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => $today,
            'items' => [
                [
                    'flower_type' => 'Buket Wisuda',
                    'recipient' => 'Dina',
                    'sender_name' => 'Keluarga',
                    'delivery_date' => $today,
                    'delivery_location' => 'Depok',
                    'quantity' => 2,
                    'unit_price' => 250000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 80000,
                ],
            ],
        ], $this->admin->id);

        $pay1 = $this->paymentService->record($orderA, [
            'payment_date' => $today,
            'amount' => 300000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $pay2 = $this->paymentService->record($orderB, [
            'payment_date' => $today,
            'amount' => 500000,
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $exp1 = $this->expenseService->record([
            'expense_category_id' => $cat->id,
            'expense_date' => $today,
            'amount' => 180000,
            'description' => 'Belanja bunga mawar dan lily',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $exp2 = $this->expenseService->record([
            'expense_category_id' => $cat->id,
            'expense_date' => $today,
            'amount' => 70000,
            'description' => 'Plastik wrapping dan pita',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        // Pre-void expected totals:
        // Total Billed: 700k + 500k = 1.200.000
        // Cash In (POSTED): 300k + 500k = 800.000
        // Cash Out (POSTED): 180k + 70k = 250.000
        // Cash Diff: 800k - 250k = 550.000
        // Outstanding: 1.200k - 800k = 400.000
        $this->assertParityMatchesDatabase($today, 1200000, 800000, 250000, 550000, 400000);

        // Void pay1 (300k) and exp2 (70k)
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.void', [$orderA, $pay1]), [
                'void_reason' => 'Transfer masuk dibatalkan oleh pihak bank pengirim',
            ])
            ->assertRedirect();

        $this->actingAs($this->admin)
            ->post(route('ui-expenses.void', $exp2), [
                'void_reason' => 'Salah masuk kategori biaya operasional toko',
            ])
            ->assertRedirect();

        // Post-void expected totals:
        // Total Billed: 1.200.000
        // Cash In (POSTED): 500.000
        // Cash Out (POSTED): 180.000
        // Cash Diff: 320.000
        // Outstanding: 700.000
        $this->assertParityMatchesDatabase($today, 1200000, 500000, 180000, 320000, 700000);
    }

    private function assertParityMatchesDatabase(
        string $date,
        int $expectedBilled,
        int $expectedCashIn,
        int $expectedCashOut,
        int $expectedCashDiff,
        int $expectedOutstanding,
    ): void {
        // 1. Direct DB queries
        $dbBilled = (int) DB::table('orders')->sum('total_amount');
        $dbCashIn = (int) DB::table('payments')->where('status', 'POSTED')->sum('amount');
        $dbCashOut = (int) DB::table('expenses')->where('status', 'POSTED')->sum('amount');
        $dbOutstanding = max($dbBilled - $dbCashIn, 0);

        $this->assertSame($expectedBilled, $dbBilled);
        $this->assertSame($expectedCashIn, $dbCashIn);
        $this->assertSame($expectedCashOut, $dbCashOut);
        $this->assertSame($expectedCashDiff, $dbCashIn - $dbCashOut);
        $this->assertSame($expectedOutstanding, $dbOutstanding);

        // 2. React Dashboard & Legacy Blade Dashboard
        $stats = app(DashboardService::class)->stats();
        $this->assertSame($expectedBilled, (int) $stats['billed']);
        $this->assertSame($expectedCashIn, (int) $stats['received']);
        $this->assertSame($expectedCashOut, (int) $stats['expenses']);
        $this->assertSame($expectedCashDiff, (int) $stats['cash_flow']);
        $this->assertSame($expectedOutstanding, (int) $stats['outstanding']);

        $this->actingAs($this->admin)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.billed', $expectedBilled)
                ->where('stats.received', $expectedCashIn)
                ->where('stats.expenses', $expectedCashOut)
                ->where('stats.cash_flow', $expectedCashDiff)
                ->where('stats.outstanding', $expectedOutstanding)
            );

        $this->actingAs($this->admin)
            ->get(route('legacy.dashboard'))
            ->assertOk()
            ->assertViewHas('stats', fn (array $viewStats) =>
                (int) $viewStats['billed'] === $expectedBilled
                && (int) $viewStats['received'] === $expectedCashIn
                && (int) $viewStats['expenses'] === $expectedCashOut
                && (int) $viewStats['cash_flow'] === $expectedCashDiff
                && (int) $viewStats['outstanding'] === $expectedOutstanding
            );

        // 3. Payments/Index & Expenses/Index
        $this->actingAs($this->admin)
            ->get(route('ui-payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('outstanding', $expectedOutstanding));

        $this->actingAs($this->admin)
            ->get(route('ui-expenses.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('postedTotal', $expectedCashOut));

        // 4. Reports/Index
        $reportResp = $this->actingAs($this->admin)
            ->get(route('ui-reports.index', ['preset' => 'custom', 'from' => $date, 'to' => $date]))
            ->assertOk();

        $report = $reportResp->viewData('page')['props']['report'];
        $this->assertSame($expectedBilled, (int) $report['summary']['total_billed']);
        $this->assertSame($expectedCashIn, (int) $report['summary']['cash_in']);
        $this->assertSame($expectedCashOut, (int) $report['summary']['cash_out']);
        $this->assertSame($expectedCashDiff, (int) $report['summary']['cash_diff']);
        $this->assertSame($expectedOutstanding, (int) $report['summary']['current_outstanding']);
    }

    public function test_excel_export_contains_expected_sheets_numeric_cells_and_reconciled_totals(): void
    {
        $customer = Customer::query()->create(['name' => 'PT Harum Blossom']);
        $category = new ExpenseCategory();
        $category->forceFill(['name' => 'Bunga Segar', 'is_active' => true])->save();

        $order = $this->orderService->create([
            'customer_id' => $customer->id,
            'order_date' => '2026-11-15',
            'items' => [
                [
                    'flower_type' => 'Anggrek Bulan Pot',
                    'recipient' => 'Ibu Sari',
                    'sender_name' => 'Manajemen',
                    'delivery_date' => '2026-11-15',
                    'delivery_location' => 'Kemang',
                    'quantity' => 2,
                    'unit_price' => 450000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 50000,
                ],
            ],
        ], $this->admin->id);

        $this->paymentService->record($order, [
            'payment_date' => '2026-11-15',
            'amount' => 600000,
            'method' => 'TRANSFER',
            'reference' => 'TRF-1511',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $this->expenseService->record([
            'expense_category_id' => $category->id,
            'expense_date' => '2026-11-15',
            'amount' => 175000,
            'description' => 'Pembelian pot keramik anggrek',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $response = $this->actingAs($this->admin)
            ->get(route('ui-reports.export', [
                'preset' => 'custom',
                'from' => '2026-11-15',
                'to' => '2026-11-15',
            ]));

        $response->assertOk();
        $this->assertSame(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            $response->headers->get('Content-Type')
        );
        $this->assertStringContainsString(
            'laporan-mutiara-florist-2026-11-15-sd-2026-11-15.xlsx',
            (string) $response->headers->get('Content-Disposition')
        );

        $tempFile = tempnam(sys_get_temp_dir(), 'mfms_sprint3_xlsx_');
        file_put_contents($tempFile, $response->streamedContent());

        try {
            $zip = new ZipArchive();
            $this->assertTrue($zip->open($tempFile) === true);

            $workbookXml = simplexml_load_string($zip->getFromName('xl/workbook.xml'));
            $sheetNames = [];
            foreach ($workbookXml->sheets->sheet as $sheet) {
                $sheetNames[] = (string) $sheet['name'];
            }
            $this->assertSame(['Ringkasan', 'Pesanan', 'Kas Masuk (POSTED)', 'Kas Keluar (POSTED)'], $sheetNames);

            $sheet1Xml = $zip->getFromName('xl/worksheets/sheet1.xml');
            // Verify numeric totals in Summary sheet match exact integer Rupiah
            // Total Billed = 950000, Flower = 900000, Shipping = 50000, Cash In = 600000, Cash Out = 175000, Cash Diff = 425000, Outstanding = 350000
            foreach ([950000, 900000, 50000, 600000, 175000, 425000, 350000] as $expectedNum) {
                $this->assertStringContainsString("<v>{$expectedNum}</v>", $sheet1Xml);
            }

            $sheet3Xml = $zip->getFromName('xl/worksheets/sheet3.xml');
            $this->assertStringContainsString('15/11/2026', $sheet3Xml);
            $this->assertStringContainsString('<v>600000</v>', $sheet3Xml);

            $sheet4Xml = $zip->getFromName('xl/worksheets/sheet4.xml');
            $this->assertStringContainsString('15/11/2026', $sheet4Xml);
            $this->assertStringContainsString('<v>175000</v>', $sheet4Xml);

            $zip->close();
        } finally {
            @unlink($tempFile);
        }
    }

    public function test_payment_history_literal_search_handles_wildcards_escape_char_and_backslash(): void
    {
        $today = now('Asia/Jakarta')->toDateString();

        $custSpecial = Customer::query()->create(['name' => 'Toko 100%_Bunga!Cabang\\A']);
        $custNormal = Customer::query()->create(['name' => 'Toko Bunga Biasa']);

        $orderSpecial = $this->orderService->create([
            'customer_id' => $custSpecial->id,
            'order_date' => $today,
            'items' => [[
                'flower_type' => 'Buket Spesial',
                'recipient' => 'Budi',
                'sender_name' => 'Sari',
                'delivery_date' => $today,
                'delivery_location' => 'Jakarta',
                'quantity' => 1,
                'unit_price' => 500000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
            ]],
        ], $this->admin->id);

        $orderNormal = $this->orderService->create([
            'customer_id' => $custNormal->id,
            'order_date' => $today,
            'items' => [[
                'flower_type' => 'Buket Biasa',
                'recipient' => 'Andi',
                'sender_name' => 'Rina',
                'delivery_date' => $today,
                'delivery_location' => 'Depok',
                'quantity' => 1,
                'unit_price' => 300000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
            ]],
        ], $this->admin->id);

        $specialPay = $this->paymentService->record($orderSpecial, [
            'payment_date' => $today,
            'amount' => 200000,
            'method' => 'TRANSFER',
            'reference' => 'REF_99%!A\\1',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $this->paymentService->record($orderNormal, [
            'payment_date' => $today,
            'amount' => 100000,
            'method' => 'CASH',
            'reference' => 'REF-NORMAL-001',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        // Literal %, _, !, \ search in both customer name & reference must return ONLY $specialPay
        foreach (['100%', '_Bunga', '!Cabang', 'Cabang\\A', 'REF_99%', '%!A\\1'] as $needle) {
            $this->actingAs($this->admin)
                ->get(route('ui-payments.index', ['q' => $needle]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->loadDeferredProps('history', fn (Assert $deferred) => $deferred
                        ->has('paymentHistory.data', 1)
                        ->where('paymentHistory.data.0.id', $specialPay->id)
                    )
                );
        }
    }

    public function test_reports_index_supports_custom_range_longer_than_thirty_days_with_complete_summary_and_capped_trends(): void
    {
        $cust = Customer::query()->create(['name' => 'PT Panjang Periode']);
        $cat = new ExpenseCategory();
        $cat->forceFill(['name' => 'Operasional', 'is_active' => true])->save();

        // Day inside first month of 123-day range (beyond 92-day trend window, but MUST be in summary!)
        $orderEarly = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => '2026-07-05',
            'items' => [[
                'flower_type' => 'Papan Bunga',
                'recipient' => 'Rektor',
                'sender_name' => 'PT Panjang',
                'delivery_date' => '2026-07-05',
                'delivery_location' => 'Jakarta',
                'quantity' => 1,
                'unit_price' => 1000000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
            ]],
        ], $this->admin->id);

        $this->paymentService->record($orderEarly, [
            'payment_date' => '2026-07-05',
            'amount' => 400000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $this->expenseService->record([
            'expense_category_id' => $cat->id,
            'expense_date' => '2026-10-15',
            'amount' => 120000,
            'description' => 'Pembelian bahan di bulan Oktober',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        $resp = $this->actingAs($this->admin)
            ->get(route('ui-reports.index', [
                'preset' => 'custom',
                'from' => '2026-07-01',
                'to' => '2026-10-31',
            ]))
            ->assertOk();

        $report = $resp->viewData('page')['props']['report'];
        $this->assertSame('2026-07-01', $report['period']['from']);
        $this->assertSame('2026-10-31', $report['period']['to']);
        $this->assertSame(1000000, $report['summary']['total_billed']);
        $this->assertSame(400000, $report['summary']['cash_in']);
        $this->assertSame(120000, $report['summary']['cash_out']);
        $this->assertSame(280000, $report['summary']['cash_diff']);
        $this->assertSame(600000, $report['summary']['current_outstanding']);
        $resp->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('details', fn (Assert $deferred) => $deferred
                ->has('reportTrends.daily_trends', 92)
            )
        );
    }

    public function test_payment_idempotency_conflict_lifecycle_prevents_duplicates_and_recovers_after_reopening_order(): void
    {
        $today = now('Asia/Jakarta')->toDateString();
        $cust = Customer::query()->create(['name' => 'Ibu Anggraini']);

        $order = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => $today,
            'items' => [[
                'flower_type' => 'Papan Bunga Ucapan',
                'recipient' => 'Pak Hendro',
                'sender_name' => 'Ibu Anggraini',
                'delivery_date' => $today,
                'delivery_location' => 'Senayan',
                'quantity' => 1,
                'unit_price' => 1000000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
            ]],
        ], $this->admin->id);

        $key1 = (string) Str::uuid();
        $payload1 = [
            'payment_date' => $today,
            'amount' => 200000,
            'method' => 'TRANSFER',
            'reference' => 'BCA-DP-01',
            'idempotency_key' => $key1,
            'return_to' => 'payments',
        ];

        // 1. First request saves on server (even if response dropped on client)
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), $payload1)
            ->assertRedirect(route('ui-payments.index'));

        $this->assertSame(1, Payment::query()->where('order_id', $order->id)->count());

        // 2. Identical retry with exact same idempotency key does NOT create duplicate row
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), $payload1)
            ->assertRedirect(route('ui-payments.index'));

        $this->assertSame(1, Payment::query()->where('order_id', $order->id)->count());

        // 3. Retry with same key but DIFFERENT payload is rejected on idempotency_key
        $this->actingAs($this->admin)
            ->from(route('ui-payments.index'))
            ->post(route('ui-orders.payments.store', $order), [
                ...$payload1,
                'amount' => 250000,
            ])
            ->assertSessionHasErrors('idempotency_key');

        $this->assertSame(1, Payment::query()->where('order_id', $order->id)->count());
        $this->assertSame(200000, (int) Payment::query()->where('order_id', $order->id)->where('status', 'POSTED')->sum('amount'));

        // 4. Inspect order detail shows updated balance (Rp800.000 outstanding)
        $this->actingAs($this->admin)
            ->get(route('ui-orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.received', 200000)
                ->where('order.outstanding', 800000)
                ->has('order.payments', 1)
            );

        // 5. After inspecting order, operator explicitly starts new payment with fresh key
        $key2 = (string) Str::uuid();
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), [
                'payment_date' => $today,
                'amount' => 300000,
                'method' => 'CASH',
                'idempotency_key' => $key2,
                'return_to' => 'order',
            ])
            ->assertRedirect(route('ui-orders.show', $order));

        $this->assertSame(2, Payment::query()->where('order_id', $order->id)->count());
        $this->assertSame(500000, (int) Payment::query()->where('order_id', $order->id)->where('status', 'POSTED')->sum('amount'));
    }

    public function test_reports_period_boundaries_for_30_45_and_123_days(): void
    {
        // 30-day preset => 30 daily rows (uncapped)
        $this->actingAs($this->admin)
            ->get(route('ui-reports.index', ['preset' => '30d']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps('details', fn (Assert $deferred) => $deferred
                    ->has('reportTrends.daily_trends', 30)
                )
            );

        // 45-day custom range (2026-09-01 to 2026-10-15) => 45 daily rows (uncapped)
        $this->actingAs($this->admin)
            ->get(route('ui-reports.index', [
                'preset' => 'custom',
                'from' => '2026-09-01',
                'to' => '2026-10-15',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps('details', fn (Assert $deferred) => $deferred
                    ->has('reportTrends.daily_trends', 45)
                )
            );

        // 123-day custom range (2026-07-01 to 2026-10-31) => 92 daily rows (capped), full period preserved
        $resp123 = $this->actingAs($this->admin)
            ->get(route('ui-reports.index', [
                'preset' => 'custom',
                'from' => '2026-07-01',
                'to' => '2026-10-31',
            ]))
            ->assertOk();
        $rep123 = $resp123->viewData('page')['props']['report'];
        $this->assertSame('2026-07-01', $rep123['period']['from']);
        $this->assertSame('2026-10-31', $rep123['period']['to']);
        $resp123->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('details', fn (Assert $deferred) => $deferred
                ->has('reportTrends.daily_trends', 92)
            )
        );
    }
}
