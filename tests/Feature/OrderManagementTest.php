<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderManagementTest extends TestCase
{
    use RefreshDatabase;

    private function payload(int $customerId): array
    {
        return [
            'customer_id' => $customerId,
            'order_date' => '2026-11-02',
            'notes' => 'Contoh dua pengiriman',
            'items' => [
                [
                    'flower_type' => 'Papan ucapan',
                    'recipient' => 'Penerima A',
                    'sender_name' => 'Pengirim A',
                    'delivery_date' => '2026-11-05',
                    'delivery_location' => 'Lokasi A',
                    'quantity' => 1,
                    'unit_price' => 800000,
                    'shipping_mode' => 'INCLUDED',
                    'shipping_fee' => 0,
                    'notes' => null,
                ],
                [
                    'flower_type' => 'Buket',
                    'recipient' => 'Penerima B',
                    'sender_name' => 'Pengirim B',
                    'delivery_date' => '2026-11-07',
                    'delivery_location' => 'Lokasi B',
                    'quantity' => 2,
                    'unit_price' => 250000,
                    'shipping_mode' => 'SEPARATE',
                    'shipping_fee' => 75000,
                    'notes' => 'Kirim sore',
                ],
            ],
        ];
    }

    private function createOrder(User $user, Customer $customer): Order
    {
        $this->actingAs($user)->post(route('orders.store'), $this->payload($customer->id))
            ->assertRedirect();

        return Order::query()->with('items')->orderByDesc('id')->firstOrFail();
    }

    private function editPayload(Order $order): array
    {
        return [
            'customer_id' => $order->customer_id,
            'order_date' => $order->order_date->format('Y-m-d'),
            'notes' => $order->notes,
            'items' => $order->items->sortBy('id')->values()->map(fn ($item) => [
                'id' => $item->id,
                'flower_type' => $item->flower_type,
                'recipient' => $item->recipient,
                'sender_name' => $item->sender_name,
                'delivery_date' => $item->delivery_date->format('Y-m-d'),
                'delivery_location' => $item->delivery_location,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'shipping_mode' => $item->shipping_mode,
                'shipping_fee' => $item->shipping_fee,
                'fulfillment_status' => $item->fulfillment_status,
                'notes' => $item->notes,
            ])->all(),
        ];
    }

    public function test_guests_cannot_manage_orders_and_no_delete_route_exists(): void
    {
        $customer = Customer::query()->create(['name' => 'Contoh']);

        $this->get(route('orders.index'))->assertRedirect(route('login'));
        $this->get(route('orders.create'))->assertRedirect(route('login'));
        $this->post(route('orders.store'), $this->payload($customer->id))->assertRedirect(route('login'));
        $this->assertDatabaseCount('orders', 0);
        $this->assertFalse(\Illuminate\Support\Facades\Route::has('orders.destroy'));
    }

    public function test_two_deliveries_calculate_separate_shipping_only_once_per_item(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Ibu Contoh']);

        $order = $this->createOrder($user, $customer);

        $this->assertSame(1375000, (int) $order->total_amount);
        $this->assertSame('NEW', $order->status);
        $this->assertSame(2, $order->items->count());
        $this->assertNotSame($order->items[0]->delivery_date->toDateString(), $order->items[1]->delivery_date->toDateString());
        $this->assertSame('Lokasi A', $order->items[0]->delivery_location);
        $this->assertSame('Lokasi B', $order->items[1]->delivery_location);
        $this->assertSame('Pengirim B', $order->items[1]->sender_name);
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'order.created',
            'subject_id' => $order->id,
            'actor_user_id' => $user->id,
        ]);

        $this->get(route('orders.show', $order))->assertOk()->assertSee('1.375.000')->assertSee('Belum dibayar');
    }

    public function test_invalid_second_item_rolls_back_entire_order(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $data = $this->payload($customer->id);
        $data['items'][1]['quantity'] = 0;

        $this->actingAs($user)->post(route('orders.store'), $data)
            ->assertSessionHasErrors('items.1.quantity');

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_shipping_mode_must_match_fee(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $data = $this->payload($customer->id);
        $data['items'][0]['shipping_fee'] = 10000;
        $data['items'][1]['shipping_fee'] = 0;

        $this->actingAs($user)->post(route('orders.store'), $data)
            ->assertSessionHasErrors(['items.0.shipping_fee', 'items.1.shipping_fee']);

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_price_limits_and_positive_total_are_enforced(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $data = $this->payload($customer->id);
        $data['items'][0]['unit_price'] = 0;
        $data['items'][1]['unit_price'] = 0;
        $data['items'][1]['shipping_mode'] = 'INCLUDED';
        $data['items'][1]['shipping_fee'] = 0;

        $this->actingAs($user)->post(route('orders.store'), $data)
            ->assertSessionHasErrors('items');

        $data['items'][0]['unit_price'] = 1000000001;
        $this->post(route('orders.store'), $data)->assertSessionHasErrors('items.0.unit_price');
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_customer_must_be_active(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Arsip']);
        $customer->delete();

        $this->actingAs($user)->post(route('orders.store'), $this->payload($customer->id))
            ->assertSessionHasErrors('customer_id');

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_order_edit_preserves_existing_item_ids_and_recalculates(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $order = $this->createOrder($user, $customer);
        $originalIds = $order->items->pluck('id')->all();
        $data = $this->editPayload($order);

        $data['items'][1]['delivery_location'] = 'Lokasi C';
        $data['items'][1]['unit_price'] = 300000;

        $this->put(route('orders.update', $order), $data)->assertRedirect(route('orders.show', $order));

        $order->refresh()->load('items');
        $this->assertSame(1475000, (int) $order->total_amount);
        $this->assertEqualsCanonicalizing($originalIds, $order->items->pluck('id')->all());
        $this->assertSame('Lokasi C', $order->items->firstWhere('id', $originalIds[1])->delivery_location);
        $this->assertDatabaseHas('audit_logs', ['action' => 'order.updated', 'subject_id' => $order->id]);
    }

    public function test_edit_cannot_reduce_total_below_posted_payments(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $order = $this->createOrder($user, $customer);

        DB::table('payments')->insert([
            'order_id' => $order->id,
            'recorded_by' => $user->id,
            'payment_date' => '2026-11-02',
            'amount' => 900000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $data = $this->editPayload($order);
        $data['items'][0]['unit_price'] = 100000;
        $data['items'][1]['unit_price'] = 100000;

        $this->put(route('orders.update', $order), $data)->assertSessionHasErrors('items');
        $this->assertSame(1375000, (int) $order->fresh()->total_amount);
        $this->assertDatabaseCount('order_items', 2);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'order.updated', 'subject_id' => $order->id]);
    }

    public function test_paid_order_cannot_be_transferred_to_another_customer(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $other = Customer::query()->create(['name' => 'Orang lain']);
        $order = $this->createOrder($user, $customer);
        DB::table('payments')->insert([
            'order_id' => $order->id, 'recorded_by' => $user->id,
            'payment_date' => '2026-11-02', 'amount' => 10000, 'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(), 'status' => 'POSTED',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $data = $this->editPayload($order);
        $data['customer_id'] = $other->id;
        $this->put(route('orders.update', $order), $data)->assertSessionHasErrors('customer_id');
        $this->assertSame($customer->id, $order->fresh()->customer_id);
    }

    public function test_item_cannot_be_reassigned_from_another_order(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $order1 = $this->createOrder($user, $customer);
        $order2 = $this->createOrder($user, $customer);
        $data = $this->editPayload($order1);
        $data['items'][0]['id'] = $order2->items[0]->id;

        $this->put(route('orders.update', $order1), $data)->assertSessionHasErrors('items');
        $this->assertSame(2, $order1->fresh()->items()->count());
    }

    public function test_progresses_status_one_step_at_a_time_and_completed_requires_all_delivered(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $order = $this->createOrder($user, $customer);
        $data = $this->editPayload($order);

        $data['items'][0]['fulfillment_status'] = 'DELIVERED';
        $this->put(route('orders.update', $order), $data)->assertSessionHasErrors('items');

        foreach (['PROCESSING', 'READY', 'DELIVERED'] as $next) {
            $order->refresh()->load('items');
            $data = $this->editPayload($order);
            $data['items'][0]['fulfillment_status'] = $next;
            $this->put(route('orders.update', $order), $data)->assertRedirect();
            $this->assertSame('PROCESSING', $order->fresh()->status);
        }

        foreach (['PROCESSING', 'READY', 'DELIVERED'] as $next) {
            $order->refresh()->load('items');
            $data = $this->editPayload($order);
            $data['items'][1]['fulfillment_status'] = $next;
            $this->put(route('orders.update', $order), $data)->assertRedirect();
        }

        $this->assertSame('COMPLETED', $order->fresh()->status);
    }

    public function test_processed_item_cannot_be_removed_but_unprocessed_item_can(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $order = $this->createOrder($user, $customer);
        $data = $this->editPayload($order);

        $data['items'][0]['fulfillment_status'] = 'PROCESSING';
        $this->put(route('orders.update', $order), $data)->assertRedirect();

        $order->refresh()->load('items');
        $data = $this->editPayload($order);
        unset($data['items'][0]);
        $data['items'] = array_values($data['items']);
        $this->put(route('orders.update', $order), $data)->assertSessionHasErrors('items');
        $this->assertSame(2, $order->fresh()->items()->count());

        $order->refresh()->load('items');
        $data = $this->editPayload($order);
        unset($data['items'][1]);
        $data['items'] = array_values($data['items']);
        $this->put(route('orders.update', $order), $data)->assertRedirect();
        $this->assertSame(1, $order->fresh()->items()->count());
    }

    public function test_list_can_filter_by_customer_name_and_status(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Ibu Melati']);
        $order = $this->createOrder($user, $customer);

        $this->get(route('orders.index', ['q' => 'Melati', 'status' => 'NEW']))
            ->assertOk()->assertSee($order->order_number)->assertSee('Ibu Melati');

        $this->get(route('orders.index', ['q' => 'Melati', 'status' => 'COMPLETED']))
            ->assertOk()->assertDontSee($order->order_number);
    }

    public function test_new_item_cannot_start_at_advanced_fulfillment_status(): void
    {
        $user = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Contoh']);
        $order = $this->createOrder($user, $customer);
        $data = $this->editPayload($order);
        $new = $data['items'][0];
        unset($new['id']);
        $new['fulfillment_status'] = 'DELIVERED';
        $data['items'][] = $new;

        $this->put(route('orders.update', $order), $data)->assertSessionHasErrors('items');
        $this->assertSame(2, $order->fresh()->items()->count());
    }
}
