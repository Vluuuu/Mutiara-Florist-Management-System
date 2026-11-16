<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PaymentConcurrencyLockTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Customer $customer;
    protected PaymentService $paymentService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();
        $this->customer = Customer::create(['name' => 'Concurrency Client', 'phone' => '0811223344']);
        $this->paymentService = new PaymentService();
    }

    private function createOrder(int $total = 1000000): Order
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-LOCK-'.strtoupper(Str::random(6)),
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
            'flower_type' => 'Standing Flower Wedding',
            'recipient' => 'Mempelai',
            'sender_name' => 'Keluarga',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Grand Ballroom',
            'quantity' => 1,
            'unit_price' => $total,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ]);
        $item->save();

        return $order;
    }

    public function test_concurrent_idempotent_requests_return_same_payment_without_double_charge(): void
    {
        $order = $this->createOrder(1000000);
        $idempotencyKey = (string) Str::uuid();

        $payload = [
            'payment_date' => now()->toDateString(),
            'amount' => 500000,
            'method' => 'TRANSFER',
            'reference' => 'TRF-123456',
            'notes' => 'DP pembayaran pertama',
            'idempotency_key' => $idempotencyKey,
        ];

        // First attempt
        $payment1 = $this->paymentService->record($order, $payload, $this->admin->id);

        // Second simultaneous/retry attempt with same idempotency key
        $payment2 = $this->paymentService->record($order, $payload, $this->admin->id);

        $this->assertSame($payment1->id, $payment2->id);
        $this->assertSame(1, Payment::query()->where('order_id', $order->id)->count());
        $this->assertSame(500000, (int) Payment::query()->where('order_id', $order->id)->sum('amount'));
    }

    public function test_second_payment_exceeding_locked_remaining_balance_is_rejected(): void
    {
        $order = $this->createOrder(1000000);

        // Payment 1: 600.000 (Remaining = 400.000)
        $this->paymentService->record($order, [
            'payment_date' => now()->toDateString(),
            'amount' => 600000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        // Payment 2 attempts to charge 500.000 (exceeds remaining 400.000)
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('melebihi sisa tagihan');

        $this->paymentService->record($order, [
            'payment_date' => now()->toDateString(),
            'amount' => 500000,
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);
    }

    public function test_payment_on_fully_paid_order_is_rejected(): void
    {
        $order = $this->createOrder(500000);

        // Pay in full
        $this->paymentService->record($order, [
            'payment_date' => now()->toDateString(),
            'amount' => 500000,
            'method' => 'QRIS',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);

        // Attempting another payment
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Pesanan ini sudah lunas');

        $this->paymentService->record($order, [
            'payment_date' => now()->toDateString(),
            'amount' => 50000,
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
        ], $this->admin->id);
    }
}
