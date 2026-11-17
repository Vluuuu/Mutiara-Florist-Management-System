<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Phase9Sprint2OperationsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private OrderService $orderService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Admin Operasional']);
        $this->orderService = app(OrderService::class);
    }

    public function test_dashboard_exposes_date_ordered_delivery_queue_and_open_receivables_without_altering_stats(): void
    {
        $cust = Customer::query()->create(['name' => 'Ibu Ratna Dewi', 'phone' => '081192204411']);
        $today = now('Asia/Jakarta')->toDateString();
        $yesterday = now('Asia/Jakarta')->subDay()->toDateString();
        $tomorrow = now('Asia/Jakarta')->addDay()->toDateString();

        // Order 1: Overdue + Today item, unpaid 850.000
        $order1 = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => $yesterday,
            'items' => [
                [
                    'flower_type' => 'Papan Bunga Terlambat',
                    'recipient' => 'Pak Hendra',
                    'sender_name' => 'PT Maju',
                    'delivery_date' => $yesterday,
                    'delivery_location' => 'Jl. Sudirman 10',
                    'quantity' => 1,
                    'unit_price' => 500000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                ],
                [
                    'flower_type' => 'Buket Mawar Hari Ini',
                    'recipient' => 'Ibu Maya',
                    'sender_name' => 'Keluarga Budi',
                    'delivery_date' => $today,
                    'delivery_location' => 'Menteng',
                    'quantity' => 1,
                    'unit_price' => 300000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 50000,
                ],
            ],
        ], $this->admin->id);

        // Order 2: Paid in full via POSTED payment, item delivered (should NOT appear in queue or receivables)
        $order2 = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => $today,
            'items' => [
                [
                    'flower_type' => 'Anggrek Selesai',
                    'recipient' => 'Ibu Sinta',
                    'sender_name' => 'Tim',
                    'delivery_date' => $tomorrow,
                    'delivery_location' => 'Kemang',
                    'quantity' => 1,
                    'unit_price' => 400000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                ],
            ],
        ], $this->admin->id);

        $item2 = $order2->items()->firstOrFail();
        $this->orderService->updateItemFulfillment($order2, $item2->id, 'PROCESSING', $this->admin->id);
        $this->orderService->updateItemFulfillment($order2, $item2->id, 'READY', $this->admin->id);
        $this->orderService->updateItemFulfillment($order2, $item2->id, 'DELIVERED', $this->admin->id);

        Payment::query()->forceCreate([
            'order_id' => $order2->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => $today,
            'amount' => 400000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);

        // Add voided payment to order1 to confirm VOIDED does NOT reduce receivables
        Payment::query()->forceCreate([
            'order_id' => $order1->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => $today,
            'amount' => 850000,
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'VOIDED',
            'void_reason' => 'Salah catat pada akun percobaan',
            'voided_at' => now(),
        ]);

        $stats = app(DashboardService::class)->stats();
        $this->assertSame(2, $stats['orders']);
        $this->assertSame(1250000, $stats['billed']);
        $this->assertSame(400000, $stats['received']);
        $this->assertSame(850000, $stats['outstanding']);

        $this->actingAs($this->admin)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('stats.billed', 1250000)
                ->where('stats.received', 400000)
                ->where('stats.outstanding', 850000)
                ->where('queueSummary.total_count', 2)
                ->where('queueSummary.overdue_count', 1)
                ->where('queueSummary.today_count', 1)
                ->has('deliveryQueue', 2)
                ->where('deliveryQueue.0.flower_type', 'Papan Bunga Terlambat')
                ->where('deliveryQueue.0.urgency', 'overdue')
                ->where('deliveryQueue.1.flower_type', 'Buket Mawar Hari Ini')
                ->where('deliveryQueue.1.urgency', 'today')
                ->has('receivables', 1)
                ->where('receivables.0.id', $order1->id)
                ->where('receivables.0.outstanding', 850000)
                ->where('receivables.0.payment_status', 'UNPAID')
                ->etc());

        // Legacy fallback dashboard keeps identical numbers
        $this->actingAs($this->admin)
            ->get('/legacy/dashboard')
            ->assertOk()
            ->assertSee('Rp1.250.000')
            ->assertSee('Rp400.000')
            ->assertSee('Rp850.000');
    }

    public function test_authenticated_json_quick_create_customer_validates_and_audits(): void
    {
        $this->postJson(route('ui-customers.store'), ['name' => 'Tamu'])
            ->assertUnauthorized();

        $this->actingAs($this->admin)
            ->postJson(route('ui-customers.store'), ['name' => '   '])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        $res = $this->actingAs($this->admin)
            ->postJson(route('ui-customers.store'), [
                'name' => '  Hotel Anggrek  ',
                'phone' => '0812-3344-5566',
                'notes' => 'Order cepat dari formulir pesanan',
            ])
            ->assertCreated()
            ->assertJsonPath('customer.name', 'Hotel Anggrek')
            ->assertJsonPath('customer.phone', '0812-3344-5566');

        $custId = $res->json('customer.id');
        $this->assertDatabaseHas('customers', ['id' => $custId, 'name' => 'Hotel Anggrek']);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'customer.created',
            'subject_id' => $custId,
        ]);
    }

    public function test_customer_show_exposes_order_history_and_create_order_honors_customer_id_without_autoselect(): void
    {
        $custA = Customer::query()->create(['name' => 'Alpha Pelanggan']);
        $custB = Customer::query()->create(['name' => 'Beta Pelanggan']);
        $archived = Customer::query()->create(['name' => 'Archived Pelanggan']);
        $archived->delete();

        $order = $this->orderService->create([
            'customer_id' => $custB->id,
            'order_date' => '2026-11-15',
            'items' => [
                [
                    'flower_type' => 'Standing Flower Anggrek',
                    'recipient' => 'Kantor B',
                    'sender_name' => 'PT Beta',
                    'delivery_date' => '2026-11-18',
                    'delivery_location' => 'Jl. Thamrin',
                    'quantity' => 2,
                    'unit_price' => 350000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 50000,
                ],
            ],
        ], $this->admin->id);

        // Customer Show includes real orders list
        $this->actingAs($this->admin)
            ->get(route('ui-customers.show', $custB))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Customers/Show')
                ->where('customer.orders_count', 1)
                ->has('orders', 1)
                ->where('orders.0.id', $order->id)
                ->where('orders.0.total_amount', 750000)
                ->where('orders.0.outstanding', 750000)
                ->where('orders.0.first_flower', 'Standing Flower Anggrek')
                ->etc());

        // Without ?customer_id=, Orders/Create MUST NOT auto-select first customer
        $this->actingAs($this->admin)
            ->get(route('ui-orders.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Create')
                ->where('selectedCustomerId', null)
                ->etc());

        // With valid active ?customer_id=, Orders/Create preselects it
        $this->actingAs($this->admin)
            ->get(route('ui-orders.create', ['customer_id' => $custB->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('selectedCustomerId', $custB->id)
                ->etc());

        // With archived ?customer_id=, Orders/Create leaves null
        $this->actingAs($this->admin)
            ->get(route('ui-orders.create', ['customer_id' => $archived->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('selectedCustomerId', null)
                ->etc());
    }

    public function test_orders_index_unpaid_filter_and_dashboard_return_to_workflow(): void
    {
        $cust = Customer::query()->create(['name' => 'CV Florist Nusantara']);
        $unpaidOrder = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => now('Asia/Jakarta')->toDateString(),
            'items' => [
                [
                    'flower_type' => 'Buket Lily',
                    'recipient' => 'BuAni',
                    'sender_name' => 'CV',
                    'delivery_date' => now('Asia/Jakarta')->toDateString(),
                    'delivery_location' => 'Jakarta',
                    'quantity' => 1,
                    'unit_price' => 300000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                ],
            ],
        ], $this->admin->id);

        $paidOrder = $this->orderService->create([
            'customer_id' => $cust->id,
            'order_date' => now('Asia/Jakarta')->toDateString(),
            'items' => [
                [
                    'flower_type' => 'Mawar Lunas',
                    'recipient' => 'BuBudi',
                    'sender_name' => 'CV',
                    'delivery_date' => now('Asia/Jakarta')->toDateString(),
                    'delivery_location' => 'Jakarta',
                    'quantity' => 1,
                    'unit_price' => 200000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                ],
            ],
        ], $this->admin->id);

        Payment::query()->forceCreate([
            'order_id' => $paidOrder->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => now('Asia/Jakarta')->toDateString(),
            'amount' => 200000,
            'method' => 'QRIS',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);

        // payment=UNPAID filter excludes paidOrder
        $this->actingAs($this->admin)
            ->get(route('ui-orders.index', ['payment' => 'UNPAID']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $unpaidOrder->id)
                ->where('filters.payment', 'UNPAID')
                ->etc());

        // return_to=dashboard on item fulfillment status stays on dashboard
        $item = $unpaidOrder->items()->firstOrFail();
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $unpaidOrder, 'item' => $item]), [
                'target_status' => 'PROCESSING',
                'return_to' => 'dashboard',
            ])
            ->assertRedirect(route('dashboard'))
            ->assertSessionHas('success');

        $this->assertSame('PROCESSING', $item->fresh()->fulfillment_status);

        // return_to=dashboard on payment store redirects back to dashboard
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $unpaidOrder), [
                'payment_date' => now('Asia/Jakarta')->toDateString(),
                'amount' => 150000,
                'method' => 'CASH',
                'idempotency_key' => (string) Str::uuid(),
                'return_to' => 'dashboard',
            ])
            ->assertRedirect(route('dashboard'))
            ->assertSessionHas('success');

        $this->assertSame(150000, (int) DB::table('payments')->where('order_id', $unpaidOrder->id)->where('status', 'POSTED')->sum('amount'));
    }
}
