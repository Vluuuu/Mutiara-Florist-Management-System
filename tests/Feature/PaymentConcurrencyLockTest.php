<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

    private function isMariaDbTestingAvailable(): bool
    {
        try {
            DB::connection('mariadb_testing')->getPdo();

            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    public function test_true_parallel_concurrency_with_two_independent_processes_on_mariadb_testing(): void
    {
        if (! $this->isMariaDbTestingAvailable()) {
            $this->markTestSkipped('MariaDB testing connection [mariadb_testing] tidak tersedia.');
        }

        // Seed fresh isolated data in mariadb_testing
        $admin = User::on('mariadb_testing')->create([
            'name' => 'MariaDB Test Admin',
            'email' => 'admin_'.Str::random(8).'@mfms.test',
            'password' => bcrypt('password12345'),
        ]);

        $customer = Customer::on('mariadb_testing')->create([
            'name' => 'Client MariaDB Lock',
            'phone' => '0899887766',
        ]);

        $order = new Order();
        $order->setConnection('mariadb_testing');
        $order->forceFill([
            'order_number' => 'ORD-MDB-'.strtoupper(Str::random(6)),
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'order_date' => now()->toDateString(),
            'total_amount' => 1000000,
            'status' => 'NEW',
        ])->save();

        $item = new OrderItem();
        $item->setConnection('mariadb_testing');
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Papan Bunga Selamat',
            'recipient' => 'Kolega',
            'sender_name' => 'PT Sukses',
            'delivery_date' => now()->toDateString(),
            'delivery_location' => 'Hotel Indonesia',
            'quantity' => 1,
            'unit_price' => 1000000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'NEW',
        ])->save();

        $php = PHP_BINARY;
        $artisan = base_path('artisan');

        $key1 = (string) Str::uuid();
        $key2 = (string) Str::uuid();

        // Two independent processes executing against mariadb_testing
        $cmd1 = "\"{$php}\" \"{$artisan}\" mfms:test-payment-worker {$order->id} 600000 {$key1} --connection=mariadb_testing --admin_id={$admin->id}";
        $cmd2 = "\"{$php}\" \"{$artisan}\" mfms:test-payment-worker {$order->id} 600000 {$key2} --connection=mariadb_testing --admin_id={$admin->id}";

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        // Launch both processes in parallel
        $p1 = proc_open($cmd1, $descriptors, $pipes1);
        $p2 = proc_open($cmd2, $descriptors, $pipes2);

        $out1 = stream_get_contents($pipes1[1]);
        $out2 = stream_get_contents($pipes2[1]);
        fclose($pipes1[0]); fclose($pipes1[1]); fclose($pipes1[2]);
        fclose($pipes2[0]); fclose($pipes2[1]); fclose($pipes2[2]);

        $code1 = proc_close($p1);
        $code2 = proc_close($p2);

        $res1 = json_decode(trim($out1), true);
        $res2 = json_decode(trim($out2), true);

        // Exactly one process must succeed (code 0) and one must fail with validation error (code 2)
        $statuses = [
            $res1['status'] ?? 'UNKNOWN',
            $res2['status'] ?? 'UNKNOWN',
        ];
        sort($statuses);
        $this->assertSame(['SUCCESS', 'VALIDATION_ERROR'], $statuses, 'Harus tepat 1 proses sukses dan 1 proses ditolak');

        $errorMsg = ($res1['status'] === 'VALIDATION_ERROR') ? $res1['message'] : $res2['message'];
        $this->assertStringContainsString('melebihi sisa tagihan', $errorMsg);

        // Database verification in MariaDB testing: exactly 1 payment of 600.000 recorded.
        // Overpayment (1.200.000) was prevented by the InnoDB row-level lock.
        $payments = Payment::on('mariadb_testing')->where('order_id', $order->id)->where('status', 'POSTED')->get();
        $this->assertCount(1, $payments, 'Hanya 1 pembayaran yang boleh tersimpan di MariaDB');
        $this->assertSame(600000, (int) $payments->first()->amount);
        $this->assertSame(600000, (int) $payments->sum('amount'), 'Total pembayaran di database tidak boleh lebih dari 600.000');

        // Now test parallel idempotent submission race condition for remaining 400.000
        $sharedKey = (string) Str::uuid();
        $cmdA = "\"{$php}\" \"{$artisan}\" mfms:test-payment-worker {$order->id} 400000 {$sharedKey} --connection=mariadb_testing --admin_id={$admin->id}";
        $cmdB = "\"{$php}\" \"{$artisan}\" mfms:test-payment-worker {$order->id} 400000 {$sharedKey} --connection=mariadb_testing --admin_id={$admin->id}";

        $pA = proc_open($cmdA, $descriptors, $pipesA);
        $pB = proc_open($cmdB, $descriptors, $pipesB);

        $outA = stream_get_contents($pipesA[1]);
        $outB = stream_get_contents($pipesB[1]);
        fclose($pipesA[0]); fclose($pipesA[1]); fclose($pipesA[2]);
        fclose($pipesB[0]); fclose($pipesB[1]); fclose($pipesB[2]);

        proc_close($pA);
        proc_close($pB);

        $resA = json_decode(trim($outA), true);
        $resB = json_decode(trim($outB), true);

        $this->assertSame('SUCCESS', $resA['status']);
        $this->assertSame('SUCCESS', $resB['status']);
        $this->assertSame($resA['payment_id'], $resB['payment_id'], 'Kedua request paralel dengan idempotency key sama harus mengembalikan ID payment yang sama');

        // Order is now fully paid at 1.000.000
        $finalTotalPaid = (int) Payment::on('mariadb_testing')->where('order_id', $order->id)->where('status', 'POSTED')->sum('amount');
        $this->assertSame(1000000, $finalTotalPaid, 'Total harus pas lunas Rp1.000.000 tanpa kelebihan');
    }
}
