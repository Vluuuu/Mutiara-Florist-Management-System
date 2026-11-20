<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    /**
     * Piutang merupakan snapshot tagihan terbuka saat ini (total_amount > paid_amount).
     * Karakter '!', '%', '_' dalam kata kunci pencarian diperlakukan sebagai literal.
     */
    public function getReceivables(?string $search = null, int $perPage = 10): array
    {
        $search = trim((string) $search);
        $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';

        $posted = DB::table('payments')
            ->select('order_id')
            ->selectRaw('SUM(amount) AS paid_amount')
            ->where('status', 'POSTED')
            ->groupBy('order_id');

        $base = DB::table('orders')
            ->join('customers', 'orders.customer_id', '=', 'customers.id')
            ->leftJoinSub($posted, 'received', fn ($join) => $join->on('orders.id', '=', 'received.order_id'))
            ->whereRaw('orders.total_amount > COALESCE(received.paid_amount, 0)')
            ->when($search !== '', function ($query) use ($pattern): void {
                $likeOp = DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
                $query->where(function ($query) use ($pattern, $likeOp): void {
                    $query->whereRaw("orders.order_number {$likeOp} ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("customers.name {$likeOp} ? ESCAPE '!'", [$pattern]);
                });
            });

        $totals = (clone $base)
            ->selectRaw('COALESCE(SUM(orders.total_amount - COALESCE(received.paid_amount, 0)), 0) AS outstanding')
            ->first();
        $outstanding = (int) ($totals->outstanding ?? 0);

        $orders = $base
            ->select([
                'orders.id',
                'orders.order_number',
                'orders.order_date',
                'orders.total_amount',
                'orders.status',
                'customers.name AS customer_name',
            ])
            ->selectRaw('COALESCE(received.paid_amount, 0) AS paid_amount')
            ->orderByDesc('orders.order_date')
            ->orderByDesc('orders.id')
            ->paginate($perPage)
            ->withQueryString();

        return [
            'orders' => $orders,
            'outstanding' => $outstanding,
        ];
    }

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
                $same = (int) $existing->order_id === (int) $locked->id
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
