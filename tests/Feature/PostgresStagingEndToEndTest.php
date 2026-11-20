<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use App\Services\BackupService;
use App\Services\CustomerService;
use App\Services\DashboardService;
use App\Services\ExpenseService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PostgresStagingEndToEndTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected CustomerService $customerService;
    protected OrderService $orderService;
    protected PaymentService $paymentService;
    protected ExpenseService $expenseService;
    protected DashboardService $dashboardService;
    protected ReportService $reportService;
    protected BackupService $backupService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customerService = app(CustomerService::class);
        $this->orderService = app(OrderService::class);
        $this->paymentService = app(PaymentService::class);
        $this->expenseService = app(ExpenseService::class);
        $this->dashboardService = app(DashboardService::class);
        $this->reportService = app(ReportService::class);
        $this->backupService = new BackupService(storage_path('framework/testing/backups_staging_'.Str::random(8)));

        $this->admin = User::query()->create([
            'name' => 'Staging Operator',
            'email' => 'operator_staging_'.Str::random(6).'@mutiaraflorist.id',
            'password' => Hash::make('OperatorPassword2026!'),
        ]);
    }

    public function test_complete_business_lifecycle_on_postgresql_staging(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        // -------------------------------------------------------------
        // 1. Customer CRUD & Audit
        // -------------------------------------------------------------
        $customer = $this->customerService->create([
            'name' => 'Ibu Haryati Florist VIP',
            'phone' => '081298765432',
            'notes' => 'Pelanggan langganan korporat',
        ], $this->admin);

        $this->assertGreaterThan(0, $customer->id);
        $this->assertSame('Ibu Haryati Florist VIP', $customer->name);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'customer.created',
            'subject_type' => 'customer',
            'subject_id' => $customer->id,
        ]);

        // -------------------------------------------------------------
        // 2. Multi-Item Order with Mixed Shipping & Server-Calculated Totals
        // -------------------------------------------------------------
        // Item 1: Rp 500.000 (INCLUDED shipping)
        // Item 2: Rp 300.000 + Rp 50.000 (SEPARATE shipping) = Rp 350.000
        // Expected total: Rp 850.000
        $order = $this->orderService->create([
            'customer_id' => $customer->id,
            'order_date' => $today,
            'notes' => 'Pesanan rangkaian bunga segar untuk ulang tahun kantor',
            'items' => [
                [
                    'flower_type' => 'Standing Flower Lily',
                    'recipient' => 'PT Megah Abadi',
                    'sender_name' => 'Keluarga Besar Haryati',
                    'delivery_date' => $today,
                    'delivery_location' => 'Gedung Artha Lt. 12',
                    'quantity' => 1,
                    'unit_price' => 500000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                    'notes' => 'Pita merah marun',
                ],
                [
                    'flower_type' => 'Table Bouquet Mawar',
                    'recipient' => 'Direksi Utama',
                    'sender_name' => 'Keluarga Besar Haryati',
                    'delivery_date' => $today,
                    'delivery_location' => 'Gedung Artha Lt. 15',
                    'quantity' => 1,
                    'unit_price' => 300000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 50000,
                    'notes' => 'Mawar peach',
                ],
            ],
        ], $this->admin->id);

        $this->assertSame(850000, (int) $order->total_amount);
        $this->assertSame('NEW', $order->status);
        $this->assertCount(2, $order->items);

        // -------------------------------------------------------------
        // 3. Monotonic Fulfillment Status Progression
        // -------------------------------------------------------------
        $items = $order->items()->orderBy('id')->get();
        $item1 = $items[0];
        $item2 = $items[1];

        // Advance Item 1: NEW -> PROCESSING -> READY
        $this->orderService->updateItemFulfillment($order, $item1->id, 'PROCESSING', $this->admin->id);
        $this->orderService->updateItemFulfillment($order, $item1->id, 'READY', $this->admin->id);
        $item1->refresh();
        $this->assertSame('READY', $item1->fulfillment_status);

        // Order status is derived: Item 1 READY, Item 2 NEW -> Order is PROCESSING
        $order->refresh();
        $this->assertSame('PROCESSING', $order->status);

        // Advance Item 2 to READY
        $this->orderService->updateItemFulfillment($order, $item2->id, 'PROCESSING', $this->admin->id);
        $this->orderService->updateItemFulfillment($order, $item2->id, 'READY', $this->admin->id);
        $order->refresh();
        $this->assertSame('READY', $order->status);

        // Advance both to DELIVERED -> Order becomes COMPLETED
        $this->orderService->updateItemFulfillment($order, $item1->id, 'DELIVERED', $this->admin->id);
        $this->orderService->updateItemFulfillment($order, $item2->id, 'DELIVERED', $this->admin->id);
        $order->refresh();
        $this->assertSame('COMPLETED', $order->status);

        // -------------------------------------------------------------
        // 4. Financial Invariants: Down Payment & Idempotency
        // -------------------------------------------------------------
        $dpKey = (string) Str::uuid();
        $dpPayload = [
            'payment_date' => $today,
            'amount' => 400000,
            'method' => 'TRANSFER',
            'reference' => 'TRF-DP-001',
            'notes' => 'Uang muka pesanan',
            'idempotency_key' => $dpKey,
        ];

        // First DP submit
        $payment1 = $this->paymentService->record($order, $dpPayload, $this->admin->id);
        $this->assertSame(400000, (int) $payment1->amount);
        $this->assertSame('POSTED', $payment1->status);

        // Idempotent duplicate submit with exact same key returns same payment row without double-counting
        $retryPayment1 = $this->paymentService->record($order, $dpPayload, $this->admin->id);
        $this->assertSame($payment1->id, $retryPayment1->id);
        $this->assertSame(1, Payment::query()->where('order_id', $order->id)->count());

        // Receivables snapshot: 850.000 - 400.000 = 450.000
        $receivables = $this->paymentService->getReceivables();
        $this->assertSame(450000, $receivables['outstanding']);

        // -------------------------------------------------------------
        // 5. Installment & Overpayment Protection
        // -------------------------------------------------------------
        // Overpayment attempt (Rp 500.000 > outstanding Rp 450.000) must throw validation exception
        $overpayKey = (string) Str::uuid();
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $this->paymentService->record($order, [
            'payment_date' => $today,
            'amount' => 500000,
            'method' => 'CASH',
            'idempotency_key' => $overpayKey,
        ], $this->admin->id);
    }

    public function test_payment_settlement_and_void_lifecycle_on_postgresql_staging(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        $customer = $this->customerService->create(['name' => 'Bpk. Hendra Gunawan'], $this->admin);
        $order = $this->orderService->create([
            'customer_id' => $customer->id,
            'order_date' => $today,
            'items' => [
                [
                    'flower_type' => 'Buket Anggrek Bulan',
                    'recipient' => 'Kantor Cabang',
                    'sender_name' => 'Bpk. Hendra',
                    'delivery_date' => $today,
                    'delivery_location' => 'Sudirman Central',
                    'quantity' => 1,
                    'unit_price' => 600000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                ],
            ],
        ], $this->admin->id);

        // Record full payment
        $payKey = (string) Str::uuid();
        $payment = $this->paymentService->record($order, [
            'payment_date' => $today,
            'amount' => 600000,
            'method' => 'TRANSFER',
            'reference' => 'TRF-LUNAS-001',
            'idempotency_key' => $payKey,
        ], $this->admin->id);

        $this->assertSame(600000, (int) $payment->amount);
        $this->assertSame('POSTED', $payment->status);

        // Outstanding is now 0
        $receivables = $this->paymentService->getReceivables();
        $this->assertSame(0, $receivables['outstanding']);

        // Void payment with audit log
        $this->paymentService->void($order, $payment, 'Salah nomor rekening tujuan transfer', $this->admin->id);
        $payment->refresh();
        $this->assertSame('VOIDED', $payment->status);
        $this->assertSame('Salah nomor rekening tujuan transfer', $payment->void_reason);

        // Receivables restored to 600.000
        $receivablesAfterVoid = $this->paymentService->getReceivables();
        $this->assertSame(600000, $receivablesAfterVoid['outstanding']);

        // Audit log confirms void
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.voided',
            'subject_type' => 'payment',
            'subject_id' => $payment->id,
        ]);
    }

    public function test_expenses_and_financial_reporting_on_postgresql_staging(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        // 1. Expense Category & Expense Record
        $category = new ExpenseCategory();
        $category->name = 'Operasional Toko & Kurir';
        $category->is_active = true;
        $category->save();

        $expenseKey = (string) Str::uuid();
        $expense = $this->expenseService->record([
            'expense_category_id' => $category->id,
            'expense_date' => $today,
            'amount' => 150000,
            'description' => 'Bensin motor kurir pengiriman bunga VIP',
            'idempotency_key' => $expenseKey,
        ], $this->admin->id);

        $this->assertSame(150000, (int) $expense->amount);
        $this->assertSame('POSTED', $expense->status);

        // 2. Financial Report Metrics Calculation
        $report = $this->reportService->getFinancialReport('today');
        $this->assertSame(150000, $report['summary']['cash_out']);
        $this->assertArrayHasKey('expense_breakdown', $report);

        // 3. SimpleXlsxExporter Generation
        $exportPath = $this->reportService->exportExcel('today');
        $this->assertFileExists($exportPath);
        $this->assertGreaterThan(0, filesize($exportPath));

        // Cleanup generated xlsx
        @unlink($exportPath);
    }
}
