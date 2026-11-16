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

class UiPaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Admin Penguji']);
        $this->customer = Customer::query()->create([
            'name' => 'Pelanggan Setia Florist',
            'phone' => '081299988877',
        ]);
    }

    private function createSampleOrder(int $total = 1000000): Order
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-PAY-' . strtoupper(Str::random(6)),
            'customer_id' => $this->customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'total_amount' => $total,
            'status' => 'NEW',
        ]);
        $order->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Rangkaian Bunga Meja',
            'recipient' => 'Ibu Diana',
            'sender_name' => 'Bapak Surya',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Jakarta Selatan',
            'quantity' => 1,
            'unit_price' => $total,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ]);
        $item->save();

        return $order;
    }

    public function test_guest_cannot_access_ui_payments_or_record_payment(): void
    {
        $order = $this->createSampleOrder(500000);

        $this->get('/ui-payments')->assertRedirect(route('login'));
        $this->post("/ui-orders/{$order->id}/payments", [
            'amount' => 500000,
            'payment_date' => now()->toDateString(),
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertRedirect(route('login'));
    }

    public function test_admin_can_view_receivables_list(): void
    {
        $order1 = $this->createSampleOrder(1000000);
        $order2 = $this->createSampleOrder(500000);

        // Pay order 2 in full
        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order2->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => now()->toDateString(),
            'amount' => 500000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $payment->save();

        // Receivables index only displays unpaid/partially paid orders (order1)
        $this->actingAs($this->admin)
            ->get(route('ui-payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Index')
                ->where('outstanding', 1000000)
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $order1->id)
            );
    }

    public function test_admin_can_record_payment_successfully(): void
    {
        $order = $this->createSampleOrder(800000);
        $uuid = (string) Str::uuid();

        $response = $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), [
                'payment_date' => now()->toDateString(),
                'amount' => 400000,
                'method' => 'TRANSFER',
                'reference' => 'TRF-BCA-987654',
                'notes' => 'Pembayaran uang muka DP 50%',
                'idempotency_key' => $uuid,
            ]);

        $response->assertRedirect(route('ui-orders.show', $order));

        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'amount' => 400000,
            'method' => 'TRANSFER',
            'status' => 'POSTED',
            'idempotency_key' => $uuid,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.posted',
            'subject_id' => $order->id,
        ]);
    }

    public function test_duplicate_payment_with_same_idempotency_key_is_idempotent(): void
    {
        $order = $this->createSampleOrder(500000);
        $uuid = (string) Str::uuid();

        $payload = [
            'payment_date' => now()->toDateString(),
            'amount' => 250000,
            'method' => 'CASH',
            'idempotency_key' => $uuid,
        ];

        // First attempt
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), $payload)
            ->assertRedirect(route('ui-orders.show', $order));

        $this->assertSame(1, Payment::query()->where('order_id', $order->id)->count());

        // Exact retry with same idempotency key
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), $payload)
            ->assertRedirect(route('ui-orders.show', $order));

        // Still only 1 record
        $this->assertSame(1, Payment::query()->where('order_id', $order->id)->count());
    }

    public function test_payment_cannot_exceed_outstanding_balance(): void
    {
        $order = $this->createSampleOrder(500000);

        // Attempt to pay 600,000 on a 500,000 order
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.store', $order), [
                'payment_date' => now()->toDateString(),
                'amount' => 600000,
                'method' => 'CASH',
                'idempotency_key' => (string) Str::uuid(),
            ])
            ->assertSessionHasErrors('amount');

        $this->assertSame(0, Payment::query()->where('order_id', $order->id)->count());
    }

    public function test_admin_can_void_payment_with_valid_reason(): void
    {
        $order = $this->createSampleOrder(500000);

        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => now()->toDateString(),
            'amount' => 500000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $payment->save();

        $response = $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.void', [$order, $payment]), [
                'void_reason' => 'Salah input mutasi rekening pelanggan lain',
            ]);

        $response->assertRedirect(route('ui-orders.show', $order));

        $payment->refresh();
        $this->assertSame('VOIDED', $payment->status);
        $this->assertSame('Salah input mutasi rekening pelanggan lain', $payment->void_reason);
        $this->assertNotNull($payment->voided_at);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.voided',
            'subject_id' => $order->id,
        ]);
    }

    public function test_void_payment_requires_minimum_ten_character_reason(): void
    {
        $order = $this->createSampleOrder(500000);

        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => now()->toDateString(),
            'amount' => 500000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $payment->save();

        // Reason too short (< 10 chars)
        $this->actingAs($this->admin)
            ->post(route('ui-orders.payments.void', [$order, $payment]), [
                'void_reason' => 'Salah',
            ])
            ->assertSessionHasErrors('void_reason');

        $payment->refresh();
        $this->assertSame('POSTED', $payment->status);
    }
}
