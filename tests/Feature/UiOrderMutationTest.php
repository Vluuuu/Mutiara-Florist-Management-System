<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiOrderMutationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Admin Penguji']);
        $this->customer = Customer::query()->create([
            'name' => 'PT Toko Bunga Makmur',
            'phone' => '081234567890',
        ]);
    }

    public function test_admin_can_access_ui_order_create_page(): void
    {
        $this->actingAs($this->admin)
            ->get(route('ui-orders.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Create')
                ->has('customers', 1)
                ->where('customers.0.id', $this->customer->id)
            );
    }

    public function test_admin_can_create_order_with_multiple_items_and_shipping(): void
    {
        $payload = [
            'customer_id' => $this->customer->id,
            'order_date' => now()->toDateString(),
            'notes' => 'Pesanan express untuk grand opening',
            'items' => [
                [
                    'flower_type' => 'Standing Flower Lily Putih',
                    'recipient' => 'Bapak Hendra',
                    'sender_name' => 'Keluarga Besar Tan',
                    'delivery_date' => now()->addDays(2)->toDateString(),
                    'delivery_location' => 'Jl. Sudirman Kav 21 Jakarta',
                    'quantity' => 1,
                    'unit_price' => 750000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                    'notes' => 'Pita biru',
                ],
                [
                    'flower_type' => 'Bunga Meja Anggrek Bulan',
                    'recipient' => 'Ibu Maya',
                    'sender_name' => 'Direksi PT Alpha',
                    'delivery_date' => now()->addDays(2)->toDateString(),
                    'delivery_location' => 'Kuningan City Mall Lt 3',
                    'quantity' => 2,
                    'unit_price' => 300000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 50000,
                    'notes' => 'Vas keramik putih',
                ],
            ],
        ];

        // Total expected:
        // Item 1: 1 * 750000 + 0 = 750000
        // Item 2: 2 * 300000 + 50000 = 650000
        // Total = 1,400,000

        $response = $this->actingAs($this->admin)
            ->post(route('ui-orders.store'), $payload);

        $order = Order::query()->where('customer_id', $this->customer->id)->firstOrFail();
        $response->assertRedirect(route('ui-orders.show', $order));

        $this->assertSame(1400000, (int) $order->total_amount);
        $this->assertCount(2, $order->items);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'order.created',
            'subject_id' => $order->id,
        ]);
    }

    public function test_create_order_rejects_empty_items_or_more_than_twenty(): void
    {
        $this->actingAs($this->admin)
            ->post(route('ui-orders.store'), [
                'customer_id' => $this->customer->id,
                'order_date' => now()->toDateString(),
                'items' => [],
            ])
            ->assertSessionHasErrors('items');

        $manyItems = [];
        for ($i = 0; $i < 21; $i++) {
            $manyItems[] = [
                'flower_type' => "Bunga $i",
                'recipient' => 'Penerima',
                'sender_name' => 'Pengirim',
                'delivery_date' => now()->toDateString(),
                'delivery_location' => 'Lokasi',
                'quantity' => 1,
                'unit_price' => 50000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
            ];
        }

        $this->actingAs($this->admin)
            ->post(route('ui-orders.store'), [
                'customer_id' => $this->customer->id,
                'order_date' => now()->toDateString(),
                'items' => $manyItems,
            ])
            ->assertSessionHasErrors('items');
    }

    public function test_admin_can_edit_order_and_advance_fulfillment_status(): void
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-TEST-001',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'total_amount' => 500000,
            'status' => 'NEW',
        ])->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Bunga Papan Duka Cita',
            'recipient' => 'Keluarga Alm. Budi',
            'sender_name' => 'PT Maju Terus',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Rumah Duka Dharmais',
            'quantity' => 1,
            'unit_price' => 500000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        $this->actingAs($this->admin)
            ->get(route('ui-orders.edit', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Orders/Edit')
                ->where('order.id', $order->id)
            );

        // Advance fulfillment from NEW to PROCESSING (allowed)
        $payload = [
            'customer_id' => $this->customer->id,
            'order_date' => now()->toDateString(),
            'notes' => 'Diperbarui',
            'items' => [
                [
                    'id' => $item->id,
                    'flower_type' => 'Bunga Papan Duka Cita Eksklusif',
                    'recipient' => 'Keluarga Alm. Budi',
                    'sender_name' => 'PT Maju Terus',
                    'delivery_date' => now()->toDateString(),
                    'delivery_location' => 'Rumah Duka Dharmais',
                    'quantity' => 1,
                    'unit_price' => 550000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                    'fulfillment_status' => 'PROCESSING',
                ],
            ],
        ];

        $this->actingAs($this->admin)
            ->put(route('ui-orders.update', $order), $payload)
            ->assertRedirect(route('ui-orders.show', $order));

        $order->refresh();
        $this->assertSame(550000, (int) $order->total_amount);
        $this->assertSame('PROCESSING', $order->status);
        $this->assertSame('PROCESSING', $order->items->first()->fulfillment_status);
    }

    public function test_edit_order_rejects_skipping_fulfillment_steps(): void
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-TEST-002',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'total_amount' => 500000,
            'status' => 'NEW',
        ])->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Hand Bouquet Mawar',
            'recipient' => 'Ibu Rina',
            'sender_name' => 'Bapak Doni',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Menteng Jakarta Pusat',
            'quantity' => 1,
            'unit_price' => 500000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        // Attempt to skip from NEW straight to DELIVERED (invalid step)
        $payload = [
            'customer_id' => $this->customer->id,
            'order_date' => now()->toDateString(),
            'items' => [
                [
                    'id' => $item->id,
                    'flower_type' => 'Hand Bouquet Mawar',
                    'recipient' => 'Ibu Rina',
                    'sender_name' => 'Bapak Doni',
                    'delivery_date' => now()->toDateString(),
                    'delivery_location' => 'Menteng Jakarta Pusat',
                    'quantity' => 1,
                    'unit_price' => 500000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                    'fulfillment_status' => 'DELIVERED',
                ],
            ],
        ];

        $this->actingAs($this->admin)
            ->put(route('ui-orders.update', $order), $payload)
            ->assertSessionHasErrors('items');
    }

    public function test_financial_adjustment_after_payment_requires_reason_and_cannot_underpay_received(): void
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-TEST-003',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'total_amount' => 1000000,
            'status' => 'NEW',
        ])->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Bunga Papan Selamat',
            'recipient' => 'Toko Baru',
            'sender_name' => 'Mitra Bisnis',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Ruko ITC BSD',
            'quantity' => 2,
            'unit_price' => 500000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => now()->toDateString(),
            'amount' => 600000,
            'method' => 'BANK_TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ])->save();

        // Changing total from 1,000,000 to 800,000 without change_reason must fail
        $this->actingAs($this->admin)
            ->put(route('ui-orders.update', $order), [
                'customer_id' => $this->customer->id,
                'order_date' => now()->toDateString(),
                'items' => [
                    [
                        'id' => $item->id,
                        'flower_type' => 'Bunga Papan Selamat',
                        'recipient' => 'Toko Baru',
                        'sender_name' => 'Mitra Bisnis',
                        'delivery_date' => now()->toDateString(),
                        'delivery_location' => 'Ruko ITC BSD',
                        'quantity' => 2,
                        'unit_price' => 400000,
                        'shipping_mode' => 'INCLUDED',
                        'shipping_fee' => 0,
                        'fulfillment_status' => 'NEW',
                    ],
                ],
            ])
            ->assertSessionHasErrors('change_reason');

        // Lowering total below received amount (600,000) must fail even with change_reason
        $this->actingAs($this->admin)
            ->put(route('ui-orders.update', $order), [
                'customer_id' => $this->customer->id,
                'order_date' => now()->toDateString(),
                'change_reason' => 'Diskon khusus pimpinan',
                'items' => [
                    [
                        'id' => $item->id,
                        'flower_type' => 'Bunga Papan Selamat',
                        'recipient' => 'Toko Baru',
                        'sender_name' => 'Mitra Bisnis',
                        'delivery_date' => now()->toDateString(),
                        'delivery_location' => 'Ruko ITC BSD',
                        'quantity' => 1,
                        'unit_price' => 500000, // Total 500,000 < received 600,000
                        'shipping_mode' => 'INCLUDED',
                        'shipping_fee' => 0,
                        'fulfillment_status' => 'NEW',
                    ],
                ],
            ])
            ->assertSessionHasErrors('items');
    }

    public function test_admin_can_advance_item_fulfillment_status_monotonically(): void
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-TEST-FULFILL',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 1200000,
        ])->save();

        $item1 = new OrderItem();
        $item1->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Bunga Meja Anggrek',
            'recipient' => 'Dr. Rina',
            'sender_name' => 'Keluarga Pasien',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'RS Siloam',
            'quantity' => 1,
            'unit_price' => 600000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        $item2 = new OrderItem();
        $item2->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Standing Flower Lily',
            'recipient' => 'Ibu Maria',
            'sender_name' => 'Rekan Kantor',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Gedung Kesenian',
            'quantity' => 1,
            'unit_price' => 600000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        // 1. Advance item1: NEW -> PROCESSING
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item1]), [
                'target_status' => 'PROCESSING',
            ])
            ->assertRedirect(route('ui-orders.show', $order))
            ->assertSessionHas('success');

        $this->assertSame('PROCESSING', $item1->fresh()->fulfillment_status);
        $this->assertSame('NEW', $item2->fresh()->fulfillment_status);
        $this->assertSame('PROCESSING', $order->fresh()->status);
        $this->assertSame(1200000, (int) $order->fresh()->total_amount);

        // Verify audit log entry
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'order.item_fulfillment_updated',
            'subject_id' => $order->id,
        ]);

        // 2. Advance item2: NEW -> PROCESSING
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item2]), [
                'target_status' => 'PROCESSING',
            ])
            ->assertRedirect(route('ui-orders.show', $order));

        $this->assertSame('PROCESSING', $item2->fresh()->fulfillment_status);
        $this->assertSame('PROCESSING', $order->fresh()->status);

        // 3. Advance both to READY
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item1]), ['target_status' => 'READY']);
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item2]), ['target_status' => 'READY']);

        $this->assertSame('READY', $item1->fresh()->fulfillment_status);
        $this->assertSame('READY', $item2->fresh()->fulfillment_status);
        $this->assertSame('READY', $order->fresh()->status);

        // 4. Advance item1 to DELIVERED
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item1]), ['target_status' => 'DELIVERED']);
        $this->assertSame('DELIVERED', $item1->fresh()->fulfillment_status);
        $this->assertSame('PROCESSING', $order->fresh()->status); // Not all delivered yet

        // 5. Advance item2 to DELIVERED -> Order must become COMPLETED automatically!
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item2]), ['target_status' => 'DELIVERED']);
        $this->assertSame('DELIVERED', $item2->fresh()->fulfillment_status);
        $this->assertSame('COMPLETED', $order->fresh()->status);
        $this->assertSame(1200000, (int) $order->fresh()->total_amount);
    }

    public function test_advance_item_fulfillment_rejects_non_linear_progression(): void
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-TEST-SKIP',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 500000,
        ])->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Buket Mawar',
            'recipient' => 'Siti',
            'sender_name' => 'Budi',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Bekasi',
            'quantity' => 1,
            'unit_price' => 500000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        // Attempting to skip to READY directly from NEW must fail
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item]), [
                'target_status' => 'READY',
            ])
            ->assertSessionHasErrors('target_status');

        $this->assertSame('NEW', $item->fresh()->fulfillment_status);

        // Attempting to skip to DELIVERED directly from NEW must fail
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item]), [
                'target_status' => 'DELIVERED',
            ])
            ->assertSessionHasErrors('target_status');

        $this->assertSame('NEW', $item->fresh()->fulfillment_status);
    }

    public function test_advance_item_fulfillment_rejects_foreign_order_item(): void
    {
        $order1 = new Order();
        $order1->forceFill([
            'order_number' => 'ORD-111',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 100000,
        ])->save();

        $order2 = new Order();
        $order2->forceFill([
            'order_number' => 'ORD-222',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 200000,
        ])->save();

        $item2 = new OrderItem();
        $item2->forceFill([
            'order_id' => $order2->id,
            'flower_type' => 'Item Milik Order 2',
            'recipient' => 'Target',
            'sender_name' => 'Pengirim',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Tangerang',
            'quantity' => 1,
            'unit_price' => 200000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        // Attempting to update item2 via order1 route must return 404
        $this->actingAs($this->admin)
            ->post(route('ui-orders.items.status', ['order' => $order1, 'item' => $item2]), [
                'target_status' => 'PROCESSING',
            ])
            ->assertNotFound();
    }

    public function test_guest_cannot_advance_item_fulfillment(): void
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-GUEST',
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 100000,
        ])->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Buket Melati',
            'recipient' => 'Target',
            'sender_name' => 'Pengirim',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Bogor',
            'quantity' => 1,
            'unit_price' => 100000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        $this->post(route('ui-orders.items.status', ['order' => $order, 'item' => $item]), [
            'target_status' => 'PROCESSING',
        ])->assertRedirect(route('login'));
    }
}
