<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    private const PROGRESS = ['NEW', 'PROCESSING', 'READY', 'DELIVERED'];

    public function create(array $data, int $actorId): Order
    {
        return DB::transaction(function () use ($data, $actorId): Order {
            $this->ensureActiveCustomer((int) $data['customer_id']);

            $total = $this->total($data['items']);

            $order = new Order();
            $order->forceFill([
                'order_number' => 'MF-'.now()->format('ymd').'-'.(string) Str::ulid(),
                'customer_id' => (int) $data['customer_id'],
                'created_by' => $actorId,
                'order_date' => $data['order_date'],
                'status' => 'NEW',
                'total_amount' => $total,
                'notes' => $data['notes'] ?? null,
            ])->save();

            foreach ($data['items'] as $item) {
                if (isset($item['id']) || ($item['fulfillment_status'] ?? 'NEW') !== 'NEW') {
                    throw ValidationException::withMessages(['items' => 'Item baru tidak boleh memiliki ID atau status lanjutan.']);
                }

                $this->saveItem($order, null, $item, 'NEW');
            }

            $this->audit($actorId, 'order.created', $order->id, [
                'total_after' => $total,
                'items_count' => count($data['items']),
            ]);

            return $order;
        }, 3);
    }

    public function update(Order $order, array $data, int $actorId): Order
    {
        return DB::transaction(function () use ($order, $data, $actorId): Order {
            // Payment writers must also lock the orders row to keep this invariant.
            $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();
            $this->ensureActiveCustomer((int) $data['customer_id']);

            $oldItems = $locked->items()->get()->keyBy('id');
            $submittedIds = [];
            $statuses = [];
            $added = 0;

            foreach ($data['items'] as $item) {
                $id = isset($item['id']) ? (int) $item['id'] : null;

                if ($id !== null && ! $oldItems->has($id)) {
                    throw ValidationException::withMessages(['items' => 'Ada ID item yang bukan milik pesanan ini.']);
                }

                $previous = $id === null ? null : $oldItems->get($id);
                $newStatus = $item['fulfillment_status'] ?? 'NEW';

                if ($id === null && $newStatus !== 'NEW') {
                    throw ValidationException::withMessages(['items' => 'Bunga baru harus dimulai dengan status Baru.']);
                }
                $previousStatus = $previous?->fulfillment_status ?? 'NEW';
                $step = array_search($newStatus, self::PROGRESS, true);
                $oldStep = array_search($previousStatus, self::PROGRESS, true);

                if ($step === false || $oldStep === false || $step < $oldStep || $step > $oldStep + 1) {
                    throw ValidationException::withMessages(['items' => 'Status item hanya bisa tetap atau maju satu tahap: Baru, Diproses, Siap, Terkirim.']);
                }

                if ($id !== null) {
                    $submittedIds[] = $id;
                } else {
                    $added++;
                }

                $statuses[] = $newStatus;
            }

            // A progressed delivery must not disappear through an edit form.
            $removed = $oldItems->filter(fn (OrderItem $item) => ! in_array($item->id, $submittedIds, true));
            if ($removed->contains(fn (OrderItem $item) => $item->fulfillment_status !== 'NEW')) {
                throw ValidationException::withMessages(['items' => 'Item yang sudah diproses tidak bisa dihapus dari pesanan.']);
            }

            $newTotal = $this->total($data['items']);
            $received = (int) $locked->payments()->where('status', 'POSTED')->sum('amount');

            if ($newTotal < $received) {
                throw ValidationException::withMessages([
                    'items' => 'Total baru tidak boleh lebih kecil daripada pembayaran yang sudah diterima (Rp'.number_format($received, 0, ',', '.').').',
                ]);
            }

            if ($received > 0 && (int) $locked->customer_id !== (int) $data['customer_id']) {
                throw ValidationException::withMessages(['customer_id' => 'Pelanggan tidak dapat diganti setelah pembayaran tercatat.']);
            }

            $totalBefore = (int) $locked->total_amount;
            $locked->forceFill([
                'customer_id' => (int) $data['customer_id'],
                'order_date' => $data['order_date'],
                'notes' => $data['notes'] ?? null,
                'total_amount' => $newTotal,
                'status' => $this->summaryStatus($statuses),
            ])->save();

            foreach ($data['items'] as $item) {
                $id = isset($item['id']) ? (int) $item['id'] : null;
                $this->saveItem($locked, $id === null ? null : $oldItems->get($id), $item, $item['fulfillment_status'] ?? 'NEW');
            }

            foreach ($removed as $item) {
                $item->delete();
            }

            $this->audit($actorId, 'order.updated', $locked->id, [
                'total_before' => $totalBefore,
                'total_after' => $newTotal,
                'items_count' => count($data['items']),
                'items_added' => $added,
                'items_removed' => $removed->count(),
                'status_after' => $locked->status,
            ]);

            return $locked;
        }, 3);
    }

    private function saveItem(Order $order, ?OrderItem $existing, array $data, string $status): void
    {
        $item = $existing ?? new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => $data['flower_type'],
            'recipient' => $data['recipient'],
            'sender_name' => $data['sender_name'],
            'delivery_date' => $data['delivery_date'],
            'delivery_location' => $data['delivery_location'],
            'quantity' => (int) $data['quantity'],
            'unit_price' => (int) $data['unit_price'],
            'shipping_mode' => $data['shipping_mode'],
            'shipping_fee' => (int) $data['shipping_fee'],
            'fulfillment_status' => $status,
            'notes' => $data['notes'] ?? null,
        ])->save();
    }

    private function total(array $items): int
    {
        $sum = 0;

        foreach ($items as $item) {
            // Request limits keep 20 * (10000 * 1e9 + 1e9) below PHP_INT_MAX.
            $sum += (int) $item['quantity'] * (int) $item['unit_price'];
            $sum += $item['shipping_mode'] === 'SEPARATE' ? (int) $item['shipping_fee'] : 0;
        }

        if ($sum <= 0) {
            throw ValidationException::withMessages(['items' => 'Total pesanan harus lebih dari Rp0.']);
        }

        return $sum;
    }

    private function summaryStatus(array $statuses): string
    {
        if (count(array_filter($statuses, fn ($status) => $status === 'DELIVERED')) === count($statuses)) {
            return 'COMPLETED';
        }

        if (count(array_filter($statuses, fn ($status) => $status === 'READY')) === count($statuses)) {
            return 'READY';
        }

        if (count(array_filter($statuses, fn ($status) => $status === 'NEW')) === count($statuses)) {
            return 'NEW';
        }

        return 'PROCESSING';
    }

    private function ensureActiveCustomer(int $customerId): void
    {
        if (Customer::query()->whereKey($customerId)->lockForUpdate()->first() === null) {
            throw ValidationException::withMessages(['customer_id' => 'Pelanggan tidak aktif atau tidak ditemukan.']);
        }
    }

    private function audit(int $actorId, string $action, int $orderId, array $summary): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $actorId,
            'action' => $action,
            'subject_type' => 'order',
            'subject_id' => $orderId,
            'change_summary' => json_encode($summary, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
