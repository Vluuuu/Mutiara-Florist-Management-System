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
}
