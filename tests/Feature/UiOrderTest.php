<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiOrderTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private OrderService $orderService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Admin Penguji']);
        $this->orderService = app(OrderService::class);
    }

    private function createOrder(Customer $customer, array $items = [], ?string $status = 'NEW'): Order
    {
        if (empty($items)) {
            $items = [
                [
                    'flower_type' => 'Papan Bunga Premium',
                    'recipient' => 'Keluarga Budi',
                    'sender_name' => 'PT Harapan Indah',
                    'delivery_date' => '2026-11-20',
                    'delivery_location' => 'Jl. Mawar No. 12, Jakarta',
                    'quantity' => 1,
                    'unit_price' => 850000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                    'notes' => 'Tulis ucapan Selamat & Sukses',
                ],
            ];
        }

        $order = $this->orderService->create([
            'customer_id' => $customer->id,
            'order_date' => '2026-11-15',
            'notes' => 'Pesanan acara peresmian kantor',
            'items' => $items,
        ], $this->admin->id);

        if ($status !== 'NEW') {
            $order->forceFill(['status' => $status])->save();
        }

        return $order;
    }

    public function test_guests_cannot_access_ui_order_pages(): void
    {
        $customer = Customer::query()->create(['name' => 'Pelanggan Uji']);
        $order = $this->createOrder($customer);

        $this->get('/ui-orders')->assertRedirect(route('login'));
        $this->get("/ui-orders/{$order->id}")->assertRedirect(route('login'));
    }

    public function test_admin_can_view_orders_list_with_inertia(): void
    {
        $customer = Customer::query()->create(['name' => 'Ibu Ratna']);
        $order = $this->createOrder($customer);

        $this->actingAs($this->admin)
            ->get(route('ui-orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Index')
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $order->id)
                ->where('orders.data.0.order_number', $order->order_number)
                ->where('orders.data.0.customer.name', 'Ibu Ratna')
                ->where('orders.data.0.total_amount', 850000)
                ->where('orders.data.0.paid_amount', 0)
                ->where('orders.data.0.payment_status', 'UNPAID')
                ->where('orders.data.0.payment_status_label', 'Belum bayar')
                ->where('orders.data.0.items_count', 1)
                ->where('nav.uiOrders', route('ui-orders.index'))
                ->where('nav.orders', route('orders.index'))
                ->etc());
    }

    public function test_search_filters_orders_by_number_and_customer_name_with_literal_wildcards(): void
    {
        $custA = Customer::query()->create(['name' => '100% Organik_Florist']);
        $custB = Customer::query()->create(['name' => 'CV Indah Mekar']);

        $orderA = $this->createOrder($custA);
        $orderB = $this->createOrder($custB);

        // Search % literally
        $this->actingAs($this->admin)
            ->get(route('ui-orders.index', ['q' => '%']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $orderA->id)
                ->etc());

        // Search by unique order number segment (random suffix of ULID)
        $uniqueSegment = substr($orderB->order_number, -8);
        $this->actingAs($this->admin)
            ->get(route('ui-orders.index', ['q' => $uniqueSegment]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $orderB->id)
                ->etc());

        // Search by customer name
        $this->actingAs($this->admin)
            ->get(route('ui-orders.index', ['q' => 'Mekar']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $orderB->id)
                ->etc());
    }

    public function test_filter_by_status(): void
    {
        $customer = Customer::query()->create(['name' => 'Pak Hendra']);
        $newOrder = $this->createOrder($customer, [], 'NEW');
        $readyOrder = $this->createOrder($customer, [], 'READY');
        $compOrder = $this->createOrder($customer, [], 'COMPLETED');

        $this->actingAs($this->admin)
            ->get(route('ui-orders.index', ['status' => 'READY']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $readyOrder->id)
                ->where('filters.status', 'READY')
                ->etc());

        $this->actingAs($this->admin)
            ->get(route('ui-orders.index', ['status' => 'COMPLETED']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $compOrder->id)
                ->where('filters.status', 'COMPLETED')
                ->etc());
    }

    public function test_pagination_limits_to_ten_orders_per_page(): void
    {
        $customer = Customer::query()->create(['name' => 'Pelanggan Massal']);

        for ($i = 1; $i <= 15; $i++) {
            $this->createOrder($customer);
        }

        $this->actingAs($this->admin)
            ->get(route('ui-orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Index')
                ->has('orders.data', 10)
                ->where('orders.total', 15)
                ->where('orders.current_page', 1)
                ->where('orders.last_page', 2)
                ->etc());

        $this->actingAs($this->admin)
            ->get(route('ui-orders.index', ['page' => 2]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Index')
                ->has('orders.data', 5)
                ->where('orders.current_page', 2)
                ->etc());
    }

    public function test_order_detail_view_shows_complete_item_and_shipping_breakdown(): void
    {
        $customer = Customer::query()->create(['name' => 'Dr. Gunawan', 'phone' => '08123456789']);

        // Order with 2 items: 1 INCLUDED shipping, 1 SEPARATE shipping (Rp50.000)
        $items = [
            [
                'flower_type' => 'Bunga Meja',
                'recipient' => 'RS Siloam Kamar 301',
                'sender_name' => 'Keluarga Besar',
                'delivery_date' => '2026-11-22',
                'delivery_location' => 'Semanggi, Jakarta',
                'quantity' => 2,
                'unit_price' => 300000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
                'notes' => 'Vas keramik putih',
            ],
            [
                'flower_type' => 'Standing Flower',
                'recipient' => 'Grand Ballroom Hotel Mulia',
                'sender_name' => 'Ikatan Alumni',
                'delivery_date' => '2026-11-23',
                'delivery_location' => 'Senayan, Jakarta',
                'quantity' => 1,
                'unit_price' => 750000,
                'shipping_mode' => 'SEPARATE',
                'shipping_fee' => 50000,
                'notes' => 'Pita ungu perak',
            ],
        ];

        // Total: (2 * 300.000) + (1 * 750.000) + 50.000 = 600.000 + 750.000 + 50.000 = 1.400.000
        $order = $this->createOrder($customer, $items);

        $this->actingAs($this->admin)
            ->get(route('ui-orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Show')
                ->where('order.id', $order->id)
                ->where('order.order_number', $order->order_number)
                ->where('order.customer.name', 'Dr. Gunawan')
                ->where('order.customer.phone', '08123456789')
                ->where('order.total_amount', 1400000)
                ->where('order.flower_total', 1350000)
                ->where('order.shipping_total', 50000)
                ->where('order.received', 0)
                ->where('order.outstanding', 1400000)
                ->where('order.payment_status', 'UNPAID')
                ->where('order.payment_status_label', 'Belum bayar')
                ->has('order.items', 2)
                ->where('order.items.0.flower_type', 'Bunga Meja')
                ->where('order.items.0.quantity', 2)
                ->where('order.items.0.unit_price', 300000)
                ->where('order.items.0.subtotal', 600000)
                ->where('order.items.0.shipping_mode', 'INCLUDED')
                ->where('order.items.0.effective_shipping_fee', 0)
                ->where('order.items.1.flower_type', 'Standing Flower')
                ->where('order.items.1.quantity', 1)
                ->where('order.items.1.unit_price', 750000)
                ->where('order.items.1.subtotal', 750000)
                ->where('order.items.1.shipping_mode', 'SEPARATE')
                ->where('order.items.1.effective_shipping_fee', 50000)
                ->etc());
    }

    public function test_payment_calculations_and_voided_payments_are_excluded(): void
    {
        $customer = Customer::query()->create(['name' => 'PT Maju Bersama']);
        $order = $this->createOrder($customer); // total 850.000

        // 1. Partial payment (DP 350.000 POSTED)
        $payment1 = Payment::query()->forceCreate([
            'order_id' => $order->id,
            'idempotency_key' => (string) Str::uuid(),
            'amount' => 350000,
            'payment_date' => '2026-11-16',
            'method' => 'TRANSFER',
            'reference' => 'TRF-123456',
            'notes' => 'DP pesanan',
            'status' => 'POSTED',
            'recorded_by' => $this->admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->get(route('ui-orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.received', 350000)
                ->where('order.outstanding', 500000)
                ->where('order.payment_status', 'PARTIAL')
                ->where('order.payment_status_label', 'Sebagian')
                ->has('order.payments', 1)
                ->where('order.payments.0.status', 'POSTED')
                ->where('order.payments.0.amount', 350000)
                ->etc());

        // 2. Add a VOIDED payment (e.g. entered 1.000.000 by mistake, then voided)
        $paymentVoided = Payment::query()->forceCreate([
            'order_id' => $order->id,
            'idempotency_key' => (string) Str::uuid(),
            'amount' => 1000000,
            'payment_date' => '2026-11-16',
            'method' => 'CASH',
            'status' => 'VOIDED',
            'void_reason' => 'Salah input nominal kasir',
            'voided_at' => now(),
            'recorded_by' => $this->admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Received must STILL be 350.000 and outstanding 500.000 (VOIDED is excluded)
        $this->actingAs($this->admin)
            ->get(route('ui-orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.received', 350000)
                ->where('order.outstanding', 500000)
                ->where('order.payment_status', 'PARTIAL')
                ->has('order.payments', 2)
                ->etc());

        // 3. Add settlement payment (500.000 POSTED)
        $payment2 = Payment::query()->forceCreate([
            'order_id' => $order->id,
            'idempotency_key' => (string) Str::uuid(),
            'amount' => 500000,
            'payment_date' => '2026-11-17',
            'method' => 'QRIS',
            'reference' => 'NMD-98765',
            'status' => 'POSTED',
            'recorded_by' => $this->admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Now fully paid: received = 850.000, outstanding = 0, payment_status = PAID
        $this->actingAs($this->admin)
            ->get(route('ui-orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.received', 850000)
                ->where('order.outstanding', 0)
                ->where('order.payment_status', 'PAID')
                ->where('order.payment_status_label', 'Lunas')
                ->has('order.payments', 3)
                ->etc());
    }

    public function test_outstanding_never_becomes_negative_on_overpayment(): void
    {
        $customer = Customer::query()->create(['name' => 'Pelanggan Khusus']);
        $order = $this->createOrder($customer); // total 850.000

        Payment::query()->forceCreate([
            'order_id' => $order->id,
            'idempotency_key' => (string) Str::uuid(),
            'amount' => 900000, // overpayment edge case
            'payment_date' => '2026-11-17',
            'method' => 'TRANSFER',
            'status' => 'POSTED',
            'recorded_by' => $this->admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->get(route('ui-orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.received', 900000)
                ->where('order.outstanding', 0)
                ->where('order.payment_status', 'PAID')
                ->etc());
    }

    public function test_empty_state_is_rendered_when_no_orders_exist(): void
    {
        $this->actingAs($this->admin)
            ->get(route('ui-orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Index')
                ->has('orders.data', 0)
                ->where('orders.total', 0)
                ->etc());
    }

    public function test_order_detail_handles_order_with_notes_and_empty_payments(): void
    {
        $customer = Customer::query()->create(['name' => 'Bpk Surya']);
        $order = $this->createOrder($customer);

        $this->actingAs($this->admin)
            ->get(route('ui-orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Show')
                ->where('order.notes', 'Pesanan acara peresmian kantor')
                ->where('order.received', 0)
                ->where('order.outstanding', 850000)
                ->where('order.payment_status', 'UNPAID')
                ->has('order.payments', 0)
                ->etc());
    }
}
