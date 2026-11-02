<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class PaymentManagementTest extends TestCase
{
    use RefreshDatabase;

    private function order(User $user, int $amount = 800000, string $status = 'NEW'): Order
    {
        $customer = Customer::query()->create(['name' => 'Pelanggan '.Str::random(7)]);

        $id = DB::table('orders')->insertGetId([
            'order_number' => 'TEST-PAY-'.(string) Str::ulid(),
            'customer_id' => $customer->id,
            'created_by' => $user->id,
            'order_date' => '2026-11-02',
            'status' => $status,
            'total_amount' => $amount,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Order::query()->findOrFail($id);
    }

    private function input(int $amount = 200000, ?string $key = null): array
    {
        return [
            'payment_date' => '2026-11-02',
            'amount' => $amount,
            'method' => 'TRANSFER',
            'reference' => 'REF-CONTOH',
            'notes' => 'Uang sudah diterima',
            'idempotency_key' => $key ?? (string) Str::uuid(),
        ];
    }

    private function pay(Order $order, array $data): Payment
    {
        $this->post(route('orders.payments.store', $order), $data)
            ->assertRedirect(route('orders.show', $order));

        return Payment::query()->orderByDesc('id')->firstOrFail();
    }

    public function test_guest_cannot_view_receivables_or_change_payments(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);

        $this->get(route('payments.index'))->assertRedirect(route('login'));
        $this->post(route('orders.payments.store', $order), $this->input())
            ->assertRedirect(route('login'));
        $this->post(route('orders.payments.void', [$order, 123]), [
            'void_reason' => 'Catatan tidak benar',
        ])->assertRedirect(route('login'));

        $this->assertDatabaseCount('payments', 0);
        $this->assertFalse(Route::has('payments.destroy'));
    }

    public function test_dp_and_later_full_payment_update_outstanding_and_dashboard(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);

        $first = $this->pay($order, $this->input());
        $this->assertSame(200000, (int) $first->amount);
        $this->assertSame('POSTED', $first->status);

        $this->get(route('payments.index'))
            ->assertOk()
            ->assertSee('Rp600.000')
            ->assertSee($order->order_number);

        $this->get(route('orders.show', $order))
            ->assertOk()
            ->assertSee('Sebagian')
            ->assertSee('Rp600.000');

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertSee('Rp200.000')
            ->assertSee('Rp600.000');

        $this->pay($order, $this->input(600000));

        $this->assertSame(800000, (int) $order->payments()->where('status', 'POSTED')->sum('amount'));
        $this->assertDatabaseCount('payments', 2);
        $this->get(route('orders.show', $order))->assertOk()->assertSee('Lunas');
        $this->get(route('payments.index'))->assertOk()->assertDontSee($order->order_number);
        $this->get(route('dashboard'))->assertOk()->assertSee('Rp800.000');
    }

    public function test_full_payment_at_once_is_allowed_without_a_dp(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);

        $this->pay($order, $this->input(800000));
        $this->assertDatabaseCount('payments', 1);
        $this->get(route('orders.show', $order))->assertOk()->assertSee('Lunas');
    }

    public function test_paid_later_after_delivery_does_not_change_fulfillment_status(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user, 800000, 'COMPLETED');
        $this->actingAs($user);

        $this->pay($order, $this->input(800000));

        $this->assertSame('COMPLETED', $order->fresh()->status);
        $this->get(route('orders.show', $order))->assertOk()->assertSee('Lunas');
    }

    public function test_overpayment_and_negative_amount_are_rejected_without_insert(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);

        $this->post(route('orders.payments.store', $order), $this->input(800001))
            ->assertSessionHasErrors('amount');
        $this->post(route('orders.payments.store', $order), $this->input(-2))
            ->assertSessionHasErrors('amount');

        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_payment_on_already_paid_order_is_rejected(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);

        $this->pay($order, $this->input(800000));
        $this->post(route('orders.payments.store', $order), $this->input(1))
            ->assertSessionHasErrors('amount');

        $this->assertDatabaseCount('payments', 1);
    }

    public function test_same_idempotency_key_and_same_payload_returns_same_payment_without_duplicate(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);
        $data = $this->input(200000);

        $first = $this->pay($order, $data);
        $this->pay($order, $data);

        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertSame(200000, (int) $order->payments()->where('status', 'POSTED')->sum('amount'));
        $this->assertSame($data['idempotency_key'], $first->idempotency_key);
    }

    public function test_same_key_different_data_is_rejected(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);
        $data = $this->input(200000);

        $this->pay($order, $data);
        $changed = $data;
        $changed['amount'] = 300000;
        $this->post(route('orders.payments.store', $order), $changed)
            ->assertSessionHasErrors('idempotency_key');

        $this->assertDatabaseCount('payments', 1);
    }

    public function test_same_key_on_different_order_is_rejected(): void
    {
        $user = User::factory()->create();
        $one = $this->order($user);
        $two = $this->order($user);
        $this->actingAs($user);
        $data = $this->input();

        $this->pay($one, $data);
        $this->post(route('orders.payments.store', $two), $data)
            ->assertSessionHasErrors('idempotency_key');

        $this->assertDatabaseCount('payments', 1);
        $this->assertSame(0, (int) $two->payments()->where('status', 'POSTED')->sum('amount'));
    }

    public function test_distinct_keys_record_two_valid_installments(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);

        $this->pay($order, $this->input(250000));
        $this->pay($order, $this->input(350000));

        $this->assertDatabaseCount('payments', 2);
        $this->get(route('orders.show', $order))->assertOk()->assertSee('Rp200.000');
    }

    public function test_void_requires_reason_and_keeps_original_payment_row(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);
        $payment = $this->pay($order, $this->input(200000));

        $this->post(route('orders.payments.void', [$order, $payment]), [
            'void_reason' => 'singkat',
        ])->assertSessionHasErrors('void_reason');

        $this->assertSame('POSTED', $payment->fresh()->status);

        $this->post(route('orders.payments.void', [$order, $payment]), [
            'void_reason' => 'Nominal salah input, akan dicatat ulang',
        ])->assertRedirect(route('orders.show', $order));

        $this->assertSame('VOIDED', $payment->fresh()->status);
        $this->assertNotNull($payment->fresh()->voided_at);
        $this->assertSame(200000, (int) $payment->fresh()->amount);
        $this->assertSame(0, (int) $order->payments()->where('status', 'POSTED')->sum('amount'));
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.voided',
            'subject_id' => $payment->id,
            'actor_user_id' => $user->id,
        ]);
        $this->get(route('orders.show', $order))->assertOk()->assertSee('VOIDED');
    }

    public function test_void_cannot_be_repeated_and_same_key_cannot_revive_void_payment(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);
        $data = $this->input(200000);
        $payment = $this->pay($order, $data);

        $this->post(route('orders.payments.void', [$order, $payment]), [
            'void_reason' => 'Nominal perlu dikoreksi sekarang',
        ])->assertRedirect();

        $this->post(route('orders.payments.void', [$order, $payment]), [
            'void_reason' => 'Pembayaran sebelumnya sudah salah',
        ])->assertSessionHasErrors('void_reason');

        $this->post(route('orders.payments.store', $order), $data)
            ->assertSessionHasErrors('idempotency_key');

        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_void_of_payment_on_another_order_returns_404(): void
    {
        $user = User::factory()->create();
        $one = $this->order($user);
        $two = $this->order($user);
        $this->actingAs($user);
        $payment = $this->pay($one, $this->input());

        $this->post(route('orders.payments.void', [$two, $payment]), [
            'void_reason' => 'Contoh pembayaran yang salah sekali',
        ])->assertNotFound();

        $this->assertSame('POSTED', $payment->fresh()->status);
    }

    public function test_void_then_corrected_payment_restores_correct_cash(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);

        $payment = $this->pay($order, $this->input(300000));
        $this->post(route('orders.payments.void', [$order, $payment]), [
            'void_reason' => 'Salah nominal pada pencatatan pertama',
        ])->assertRedirect();

        $this->pay($order, $this->input(250000));

        $this->assertDatabaseCount('payments', 2);
        $this->assertSame(250000, (int) $order->payments()->where('status', 'POSTED')->sum('amount'));
        $this->get(route('payments.index'))->assertOk()->assertSee('Rp550.000');
        $this->get(route('dashboard'))->assertOk()->assertSee('Rp250.000');
    }

    public function test_receivables_search_filters_orders_but_not_paid_orders(): void
    {
        $user = User::factory()->create();
        $first = $this->order($user, 700000);
        $second = $this->order($user, 400000);
        $this->actingAs($user);
        $this->pay($second, $this->input(400000));

        $this->get(route('payments.index', ['q' => $first->order_number]))
            ->assertOk()
            ->assertSee($first->order_number)
            ->assertSee('Rp700.000')
            ->assertDontSee($second->order_number);

        $this->get(route('payments.index', ['q' => $second->order_number]))
            ->assertOk()
            ->assertDontSee($second->order_number);
    }

    public function test_validation_rejects_bad_method_and_missing_key(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $this->actingAs($user);

        $data = $this->input();
        $data['method'] = 'CRYPTO';
        unset($data['idempotency_key']);

        $this->post(route('orders.payments.store', $order), $data)
            ->assertSessionHasErrors(['method', 'idempotency_key']);

        $this->assertDatabaseCount('payments', 0);
    }
}
