<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class Phase14CFinancialChartTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Customer $customer;

    private ExpenseCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::create(2026, 11, 25, 10, 0, 0, 'Asia/Jakarta'));

        $this->admin = User::factory()->create();
        $this->customer = Customer::forceCreate([
            'name' => 'PT Melati Nusantara',
            'phone' => '081200001111',
        ]);
        $this->category = ExpenseCategory::forceCreate([
            'name' => 'Bahan Bunga Segar',
            'is_active' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_chart_series_counts_order_invoices_not_flower_items_and_reconciles_all_granularities(): void
    {
        // Order 1 has 2 item rows with total flower quantity = 8, yet it is 1 order invoice.
        $order1 = Order::forceCreate([
            'order_number' => 'MF-2026-14C-001',
            'customer_id' => $this->customer->id,
            'order_date' => '2026-11-10',
            'status' => 'NEW',
            'total_amount' => 2_500_000,
            'created_by' => $this->admin->id,
        ]);
        OrderItem::forceCreate([
            'order_id' => $order1->id,
            'flower_type' => 'Papan Bunga Besar',
            'recipient' => 'Penerima A',
            'sender_name' => 'Pengirim A',
            'delivery_date' => '2026-11-11',
            'delivery_location' => 'Jakarta Selatan',
            'quantity' => 3,
            'unit_price' => 500_000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ]);
        OrderItem::forceCreate([
            'order_id' => $order1->id,
            'flower_type' => 'Buket Mawar',
            'recipient' => 'Penerima B',
            'sender_name' => 'Pengirim B',
            'delivery_date' => '2026-11-11',
            'delivery_location' => 'Jakarta Pusat',
            'quantity' => 5,
            'unit_price' => 200_000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ]);

        // Order 2 on a later week
        $order2 = Order::forceCreate([
            'order_number' => 'MF-2026-14C-002',
            'customer_id' => $this->customer->id,
            'order_date' => '2026-11-24',
            'status' => 'COMPLETED',
            'total_amount' => 1_800_000,
            'created_by' => $this->admin->id,
        ]);
        OrderItem::forceCreate([
            'order_id' => $order2->id,
            'flower_type' => 'Standing Flower',
            'recipient' => 'Penerima C',
            'sender_name' => 'Pengirim C',
            'delivery_date' => '2026-11-24',
            'delivery_location' => 'Depok',
            'quantity' => 4,
            'unit_price' => 450_000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'DELIVERED',
        ]);

        // POSTED payment (+1,200,000) and VOIDED payment (must be ignored)
        Payment::forceCreate([
            'order_id' => $order1->id,
            'payment_date' => '2026-11-10',
            'amount' => 1_200_000,
            'method' => 'TRANSFER',
            'status' => 'POSTED',
            'recorded_by' => $this->admin->id,
            'idempotency_key' => (string) Str::uuid(),
        ]);
        Payment::forceCreate([
            'order_id' => $order1->id,
            'payment_date' => '2026-11-10',
            'amount' => 500_000,
            'method' => 'CASH',
            'status' => 'VOIDED',
            'void_reason' => 'Koreksi salah input nominal pembayaran',
            'voided_at' => now(),
            'recorded_by' => $this->admin->id,
            'idempotency_key' => (string) Str::uuid(),
        ]);

        // Expense greater than cash_in on Nov 10 -> negative net cash flow (-650,000)
        Expense::forceCreate([
            'expense_category_id' => $this->category->id,
            'expense_date' => '2026-11-10',
            'amount' => 1_850_000,
            'description' => 'Belanja bunga segar mingguan',
            'status' => 'POSTED',
            'recorded_by' => $this->admin->id,
            'idempotency_key' => (string) Str::uuid(),
        ]);
        // VOIDED expense must be excluded
        Expense::forceCreate([
            'expense_category_id' => $this->category->id,
            'expense_date' => '2026-11-10',
            'amount' => 999_000,
            'description' => 'Pengeluaran batal uji',
            'status' => 'VOIDED',
            'void_reason' => 'Dibatalkan karena duplikat pencatatan',
            'voided_at' => now(),
            'recorded_by' => $this->admin->id,
            'idempotency_key' => (string) Str::uuid(),
        ]);

        // Positive net cash flow on Nov 24 (+1,800,000)
        Payment::forceCreate([
            'order_id' => $order2->id,
            'payment_date' => '2026-11-24',
            'amount' => 1_800_000,
            'method' => 'QRIS',
            'status' => 'POSTED',
            'recorded_by' => $this->admin->id,
            'idempotency_key' => (string) Str::uuid(),
        ]);

        /** @var ReportService $service */
        $service = app(ReportService::class);

        foreach (['daily', 'weekly', 'monthly', 'yearly'] as $granularity) {
            $report = $service->getFinancialReport('30d', null, null, $granularity);
            $summary = $report['summary'];
            $points = $report['chart_series']['points'];

            $this->assertSame(2, $summary['orders_count'], "Granularity {$granularity} must count 2 invoices, not 12 items");
            $this->assertSame(3_000_000, $summary['cash_in']);
            $this->assertSame(1_850_000, $summary['cash_out']);
            $this->assertSame(1_150_000, $summary['cash_diff']);

            $this->assertSame($summary['orders_count'], array_sum(array_column($points, 'orders_count')));
            $this->assertSame($summary['cash_in'], array_sum(array_column($points, 'cash_in')));
            $this->assertSame($summary['cash_out'], array_sum(array_column($points, 'cash_out')));
            $this->assertSame($summary['cash_diff'], array_sum(array_column($points, 'cash_diff')));

            foreach ($points as $pt) {
                $this->assertSame($pt['cash_in'] - $pt['cash_out'], $pt['cash_diff']);
            }
        }

        // Verify negative point and partial indicators exist on weekly granularity
        $weekly = $service->getFinancialReport('30d', null, null, 'weekly')['chart_series']['points'];
        $hasNegative = collect($weekly)->contains(fn ($pt) => $pt['cash_diff'] === -650_000);
        $hasPartial = collect($weekly)->contains(fn ($pt) => str_contains($pt['full_label'], '(parsial)'));
        $this->assertTrue($hasNegative, 'Weekly chart series must preserve negative net cash flow point');
        $this->assertTrue($hasPartial, 'Weekly chart series must preserve partial-period indicator');
    }

    public function test_empty_single_period_and_large_value_datasets_and_excel_export_remain_accurate(): void
    {
        /** @var ReportService $service */
        $service = app(ReportService::class);

        // 1. Empty period
        $empty = $service->getFinancialReport('custom', '2025-01-01', '2025-01-07', 'daily');
        $this->assertSame(0, $empty['summary']['orders_count']);
        $this->assertSame(0, $empty['summary']['cash_in']);
        $this->assertSame(0, $empty['summary']['cash_out']);
        $this->assertCount(7, $empty['chart_series']['points']);

        // 2. Single-period large BIGINT value on today (2026-11-25)
        $bigOrder = Order::forceCreate([
            'order_number' => 'MF-2026-14C-BIG',
            'customer_id' => $this->customer->id,
            'order_date' => '2026-11-25',
            'status' => 'NEW',
            'total_amount' => 2_500_000_000,
            'created_by' => $this->admin->id,
        ]);
        Payment::forceCreate([
            'order_id' => $bigOrder->id,
            'payment_date' => '2026-11-25',
            'amount' => 2_500_000_000,
            'method' => 'TRANSFER',
            'status' => 'POSTED',
            'recorded_by' => $this->admin->id,
            'idempotency_key' => (string) Str::uuid(),
        ]);

        $today = $service->getFinancialReport('today', null, null, 'daily');
        $this->assertCount(1, $today['chart_series']['points']);
        $this->assertSame(1, $today['chart_series']['points'][0]['orders_count']);
        $this->assertSame(2_500_000_000, $today['chart_series']['points'][0]['cash_in']);
        $this->assertSame(2_500_000_000, $today['chart_series']['points'][0]['cash_diff']);

        // 3. Report page route and Excel export route remain fully operational
        $this->actingAs($this->admin)
            ->get('/ui-reports?preset=today&granularity=daily')
            ->assertOk();

        $exportResponse = $this->actingAs($this->admin)
            ->get('/ui-reports/export?preset=today');
        $exportResponse->assertOk();
        $this->assertStringContainsString(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            (string) $exportResponse->headers->get('content-type')
        );
    }
}
