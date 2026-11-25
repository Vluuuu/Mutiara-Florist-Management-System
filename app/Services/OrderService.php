<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    private const PROGRESS = ['NEW', 'PROCESSING', 'READY', 'DELIVERED'];

    /**
     * Cari dan paginasi data pesanan (10 per halaman secara default).
     * Karakter '!', '%', '_' dalam kata kunci pencarian diperlakukan sebagai literal.
     */
    public function paginate(?string $search = null, ?string $status = null, int $perPage = 10): LengthAwarePaginator
    {
        $search = trim((string) $search);
        $status = trim((string) $status);
        $escapedSearch = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search);
        $pattern = '%'.$escapedSearch.'%';

        return Order::query()
            ->with(['customer:id,name'])
            ->withCount('items')
            ->withSum(['payments as paid_amount' => fn ($query) => $query->where('status', 'POSTED')], 'amount')
            ->when($search !== '', function ($query) use ($pattern): void {
                $likeOp = $query->getConnection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
                $query->where(function ($query) use ($pattern, $likeOp): void {
                    $query->whereRaw("order_number {$likeOp} ? ESCAPE '!'", [$pattern])
                        ->orWhereHas('customer', fn ($query) => $query->whereRaw("name {$likeOp} ? ESCAPE '!'", [$pattern]));
                });
            })
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->orderByDesc('order_date')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * Siapkan representasi detail pesanan yang lengkap untuk tampilan,
     * termasuk rincian bunga, ongkir, rekapitulasi keuangan, dan riwayat pembayaran.
     */
    public function getOrderDetail(Order $order): array
    {
        $order->load([
            'customer:id,name,phone',
            'items' => fn ($query) => $query->orderBy('id'),
            'payments' => fn ($query) => $query->with('recordedBy:id,name')->orderByDesc('id'),
        ]);

        $received = (int) $order->payments->where('status', 'POSTED')->sum('amount');
        $outstanding = max((int) $order->total_amount - $received, 0);
        $flowerTotal = (int) $order->items->sum(fn ($item) => (int) $item->quantity * (int) $item->unit_price);
        $shippingTotal = (int) $order->items->sum(fn ($item) => $item->shipping_mode === 'SEPARATE' ? (int) $item->shipping_fee : 0);

        $paymentStatus = $received === 0 ? 'UNPAID' : ($received >= (int) $order->total_amount ? 'PAID' : 'PARTIAL');
        $paymentStatusLabel = $received === 0 ? 'Belum bayar' : ($received >= (int) $order->total_amount ? 'Lunas' : 'Sebagian');

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'order_date' => $order->order_date?->format('d/m/Y'),
            'order_date_raw' => $order->order_date?->format('Y-m-d'),
            'status' => $order->status,
            'notes' => $order->notes,
            'total_amount' => (int) $order->total_amount,
            'received' => $received,
            'outstanding' => $outstanding,
            'flower_total' => $flowerTotal,
            'shipping_total' => $shippingTotal,
            'payment_status' => $paymentStatus,
            'payment_status_label' => $paymentStatusLabel,
            'customer' => [
                'id' => $order->customer->id,
                'name' => $order->customer->name,
                'phone' => $order->customer->phone,
            ],
            'items' => $order->items->map(fn ($item, $index) => [
                'id' => $item->id,
                'item_number' => $index + 1,
                'flower_type' => $item->flower_type,
                'recipient' => $item->recipient,
                'sender_name' => $item->sender_name,
                'delivery_date' => $item->delivery_date?->format('d/m/Y'),
                'delivery_date_raw' => $item->delivery_date?->format('Y-m-d'),
                'delivery_location' => $item->delivery_location,
                'quantity' => (int) $item->quantity,
                'unit_price' => (int) $item->unit_price,
                'subtotal' => (int) $item->quantity * (int) $item->unit_price,
                'shipping_mode' => $item->shipping_mode,
                'shipping_fee' => (int) $item->shipping_fee,
                'effective_shipping_fee' => $item->shipping_mode === 'SEPARATE' ? (int) $item->shipping_fee : 0,
                'fulfillment_status' => $item->fulfillment_status,
                'notes' => $item->notes,
            ])->values()->all(),
            'payments' => $order->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'amount' => (int) $payment->amount,
                'payment_date' => $payment->payment_date?->format('d/m/Y'),
                'payment_date_raw' => $payment->payment_date?->format('Y-m-d'),
                'method' => $payment->method,
                'method_label' => match ($payment->method) {
                    'CASH' => 'Tunai',
                    'TRANSFER' => 'Transfer bank',
                    'QRIS' => 'QRIS',
                    default => 'Lainnya',
                },
                'status' => $payment->status,
                'reference' => $payment->reference,
                'notes' => $payment->notes,
                'recorded_by' => $payment->recordedBy?->name ?? 'Operator',
                'void_reason' => $payment->void_reason,
                'voided_at' => $payment->voided_at?->timezone('Asia/Jakarta')->format('d/m/Y H:i'),
            ])->values()->all(),
        ];
    }

    public function create(array $data, int $actorId): Order
    {
        \App\Support\DemoRuntimeGuard::enforceDemoQuota(
            'orders',
            (int) config('demo.max_orders', 250),
            'customer_id',
            'pesanan'
        );

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

            // A paid order requires a reason for any repricing, item addition or removal.
            $financialChanged = $added > 0 || $removed->isNotEmpty();
            foreach ($data['items'] as $item) {
                $id = isset($item['id']) ? (int) $item['id'] : null;
                $previous = $id === null ? null : $oldItems->get($id);
                if ($previous && (
                    (int) $previous->quantity !== (int) $item['quantity']
                    || (int) $previous->unit_price !== (int) $item['unit_price']
                    || $previous->shipping_mode !== $item['shipping_mode']
                    || (int) $previous->shipping_fee !== (int) $item['shipping_fee']
                )) {
                    $financialChanged = true;
                }
            }

            if ($received > 0 && $financialChanged && trim((string) ($data['change_reason'] ?? '')) === '') {
                throw ValidationException::withMessages(['change_reason' => 'Alasan perubahan harga wajib diisi karena sudah ada pembayaran.']);
            }

            // Audit the type of item changes without duplicating private recipient/contact details.
            $itemChanges = [];
            foreach ($data['items'] as $item) {
                $id = isset($item['id']) ? (int) $item['id'] : null;
                if ($id === null) {
                    continue;
                }

                $previous = $oldItems->get($id);
                $changedFields = [];

                foreach ([
                    'flower_type', 'recipient', 'sender_name', 'delivery_date',
                    'delivery_location', 'quantity', 'unit_price', 'shipping_mode',
                    'shipping_fee', 'fulfillment_status', 'notes',
                ] as $field) {
                    $before = $field === 'delivery_date'
                        ? $previous->delivery_date->format('Y-m-d')
                        : $previous->{$field};

                    if ((string) ($before ?? '') !== (string) ($item[$field] ?? ($field === 'fulfillment_status' ? 'NEW' : ''))) {
                        $changedFields[] = $field;
                    }
                }

                if ($changedFields !== []) {
                    $itemChanges[] = [
                        'id' => $id,
                        'fields' => $changedFields,
                        'status_before' => $previous->fulfillment_status,
                        'status_after' => $item['fulfillment_status'] ?? 'NEW',
                    ];
                }
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
                'removed_ids' => $removed->keys()->values()->all(),
                'changed_items' => $itemChanges,
                'status_after' => $locked->status,
                'change_reason' => $data['change_reason'] ?? null,
            ]);

            return $locked;
        }, 3);
    }

    /**
     * Advances fulfillment status of a single order item monotonically by one step.
     */
    public function updateItemFulfillment(Order $order, int $itemId, string $targetStatus, int $actorId): Order
    {
        return DB::transaction(function () use ($order, $itemId, $targetStatus, $actorId): Order {
            $lockedOrder = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();
            $item = $lockedOrder->items()->whereKey($itemId)->lockForUpdate()->first();

            if ($item === null) {
                throw ValidationException::withMessages(['item' => 'Item pesanan tidak ditemukan pada pesanan ini.']);
            }

            $currentStatus = $item->fulfillment_status;
            $step = array_search($targetStatus, self::PROGRESS, true);
            $currentStep = array_search($currentStatus, self::PROGRESS, true);

            if ($step === false || $currentStep === false || $step !== $currentStep + 1) {
                throw ValidationException::withMessages(['target_status' => 'Status item hanya bisa maju satu tahap: Baru, Diproses, Siap, Terkirim.']);
            }

            $item->forceFill([
                'fulfillment_status' => $targetStatus,
            ])->save();

            $statuses = $lockedOrder->items()->pluck('fulfillment_status')->all();
            $newOrderStatus = $this->summaryStatus($statuses);
            $orderStatusBefore = $lockedOrder->status;

            $lockedOrder->forceFill([
                'status' => $newOrderStatus,
            ])->save();

            $this->audit($actorId, 'order.item_fulfillment_updated', $lockedOrder->id, [
                'order_item_id' => $itemId,
                'flower_type' => $item->flower_type,
                'status_before' => $currentStatus,
                'status_after' => $targetStatus,
                'order_status_before' => $orderStatusBefore,
                'order_status_after' => $newOrderStatus,
            ]);

            return $lockedOrder;
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
