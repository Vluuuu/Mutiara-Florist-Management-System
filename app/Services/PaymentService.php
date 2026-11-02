<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    /**
     * Lock the order row for ALL balance writers (also OrderService::update).
     * The unique idempotency key prevents duplicate inserts on retries.
     */
    public function record(Order $order, array $data, int $actorId): Payment
    {
        return DB::transaction(function () use ($order, $data, $actorId): Payment {
            $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

            $existing = Payment::query()
                ->where('idempotency_key', $data['idempotency_key'])
                ->first();

            if ($existing !== null) {
                // A retry of an already voided event must not turn it into a new receipt.
                $same = $existing->order_id === $locked->id
                    && $existing->status === 'POSTED'
                    && $existing->payment_date->format('Y-m-d') === $data['payment_date']
                    && (int) $existing->amount === (int) $data['amount']
                    && $existing->method === $data['method']
                    && $existing->reference === ($data['reference'] ?? null)
                    && $existing->notes === ($data['notes'] ?? null);

                if (! $same) {
                    throw ValidationException::withMessages([
                        'idempotency_key' => 'Identitas transaksi sudah digunakan dengan data berbeda. Muat ulang halaman.',
                    ]);
                }

                return $existing;
            }

            $paid = (int) $locked->payments()->where('status', 'POSTED')->sum('amount');
            $remaining = (int) $locked->total_amount - $paid;

            if ($remaining <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Pesanan ini sudah lunas. Tidak dapat mencatat pembayaran tambahan.',
                ]);
            }

            if ((int) $data['amount'] > $remaining) {
                throw ValidationException::withMessages([
                    'amount' => 'Pembayaran melebihi sisa tagihan Rp'.number_format($remaining, 0, ',', '.').'.',
                ]);
            }

            $payment = new Payment();
            $payment->forceFill([
                'order_id' => $locked->id,
                'recorded_by' => $actorId,
                'payment_date' => $data['payment_date'],
                'amount' => (int) $data['amount'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'idempotency_key' => $data['idempotency_key'],
                'status' => 'POSTED',
                'notes' => $data['notes'] ?? null,
            ])->save();

            $this->audit($actorId, 'payment.posted', $payment, [
                'amount' => (int) $payment->amount,
                'method' => $payment->method,
                'paid_after' => $paid + (int) $payment->amount,
                'outstanding_after' => $remaining - (int) $payment->amount,
            ]);

            return $payment;
        }, 3);
    }

    /**
     * Void is an accounting correction, NOT money returned to the customer.
     * The historical payment row remains intact.
     */
    public function void(Order $order, Payment $payment, string $reason, int $actorId): void
    {
        DB::transaction(function () use ($order, $payment, $reason, $actorId): void {
            $lockedOrder = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();
            $lockedPayment = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

            if ((int) $lockedPayment->order_id !== (int) $lockedOrder->id) {
                abort(404);
            }

            if ($lockedPayment->status !== 'POSTED') {
                throw ValidationException::withMessages([
                    'void_reason' => 'Pembayaran ini sudah dibatalkan pencatatannya.',
                ]);
            }

            $lockedPayment->forceFill([
                'status' => 'VOIDED',
                'void_reason' => $reason,
                'voided_at' => now(),
            ])->save();

            $paid = (int) $lockedOrder->payments()->where('status', 'POSTED')->sum('amount');

            $this->audit($actorId, 'payment.voided', $lockedPayment, [
                'amount' => (int) $lockedPayment->amount,
                'reason' => $reason,
                'paid_after' => $paid,
                'outstanding_after' => (int) $lockedOrder->total_amount - $paid,
            ]);
        }, 3);
    }

    private function audit(int $actorId, string $action, Payment $payment, array $summary): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $actorId,
            'action' => $action,
            'subject_type' => 'payment',
            'subject_id' => $payment->id,
            'change_summary' => json_encode([
                'order_id' => $payment->order_id,
                ...$summary,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
