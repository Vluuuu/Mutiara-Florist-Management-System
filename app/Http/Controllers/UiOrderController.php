<?php

namespace App\Http\Controllers;

use App\Http\Requests\OrderRequest;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UiOrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orders,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:NEW,PROCESSING,READY,COMPLETED'],
            'payment' => ['nullable', 'in:UNPAID'],
        ]);

        $search = trim((string) ($filters['q'] ?? ''));
        $status = $filters['status'] ?? '';
        $payment = $filters['payment'] ?? '';

        if ($payment === 'UNPAID') {
            $escapedSearch = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search);
            $pattern = '%'.$escapedSearch.'%';

            $paginator = Order::query()
                ->with(['customer:id,name'])
                ->withCount('items')
                ->withSum(['payments as paid_amount' => fn ($query) => $query->where('status', 'POSTED')], 'amount')
                ->when($search !== '', function ($query) use ($pattern): void {
                    $query->where(function ($query) use ($pattern): void {
                        $query->whereRaw("order_number LIKE ? ESCAPE '!'", [$pattern])
                            ->orWhereHas('customer', fn ($query) => $query->whereRaw("name LIKE ? ESCAPE '!'", [$pattern]));
                    });
                })
                ->when($status !== '', fn ($query) => $query->where('status', $status))
                ->whereRaw(
                    'total_amount > COALESCE((SELECT SUM(amount) FROM payments WHERE payments.order_id = orders.id AND payments.status = ?), 0)',
                    ['POSTED']
                )
                ->orderByDesc('order_date')
                ->orderByDesc('id')
                ->paginate(10)
                ->withQueryString();
        } else {
            $paginator = $this->orders->paginate($search, $status);
        }

        $paginator->getCollection()->loadMissing([
            'items' => fn ($query) => $query
                ->select(['id', 'order_id', 'flower_type', 'delivery_date'])
                ->orderBy('delivery_date')
                ->orderBy('id'),
        ]);

        $orders = $paginator->through(function (Order $order) {
            $paid = (int) ($order->paid_amount ?? 0);
            $total = (int) $order->total_amount;
            $paymentStatus = $paid === 0 ? 'UNPAID' : ($paid >= $total ? 'PAID' : 'PARTIAL');
            $paymentStatusLabel = $paid === 0 ? 'Belum bayar' : ($paid >= $total ? 'Lunas' : 'Sebagian');
            $firstItem = $order->items->first();

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'order_date' => $order->order_date?->format('d/m/Y'),
                'order_date_raw' => $order->order_date?->format('Y-m-d'),
                'earliest_delivery_date' => $firstItem?->delivery_date?->format('d/m/Y'),
                'earliest_delivery_date_raw' => $firstItem?->delivery_date?->format('Y-m-d'),
                'first_flower' => $firstItem?->flower_type,
                'customer' => [
                    'id' => $order->customer->id,
                    'name' => $order->customer->name,
                ],
                'status' => $order->status,
                'total_amount' => $total,
                'paid_amount' => $paid,
                'payment_status' => $paymentStatus,
                'payment_status_label' => $paymentStatusLabel,
                'items_count' => (int) $order->items_count,
            ];
        });

        return Inertia::render('Orders/Index', [
            'orders' => $orders,
            'filters' => [
                'q' => $search,
                'status' => $status,
                'payment' => $payment,
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        $customers = $this->activeCustomers();
        $requestedCustomerId = $request->integer('customer_id');
        $selectedCustomerId = null;

        if ($requestedCustomerId > 0 && collect($customers)->contains('id', $requestedCustomerId)) {
            $selectedCustomerId = $requestedCustomerId;
        }

        return Inertia::render('Orders/Create', [
            'customers' => $customers,
            'selectedCustomerId' => $selectedCustomerId,
            'todayIso' => now('Asia/Jakarta')->toDateString(),
        ]);
    }

    public function store(OrderRequest $request): RedirectResponse
    {
        $order = $this->orders->create(
            $request->validated(),
            (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('ui-orders.show', $order)
            ->with('success', 'Pesanan berhasil dibuat. Pembayaran belum dicatat.');
    }

    public function show(Order $order): Response
    {
        $orderData = $this->orders->getOrderDetail($order);

        return Inertia::render('Orders/Show', [
            'order' => $orderData,
            'todayIso' => now('Asia/Jakarta')->toDateString(),
        ]);
    }

    public function edit(Order $order): Response
    {
        $order->load(['items' => fn ($query) => $query->orderBy('id')]);
        $received = (int) $order->payments()->where('status', 'POSTED')->sum('amount');

        return Inertia::render('Orders/Edit', [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_id' => $order->customer_id,
                'order_date' => $order->order_date?->format('Y-m-d'),
                'notes' => $order->notes ?? '',
                'status' => $order->status,
                'total_amount' => (int) $order->total_amount,
                'received' => $received,
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'flower_type' => $item->flower_type,
                    'recipient' => $item->recipient,
                    'sender_name' => $item->sender_name,
                    'delivery_date' => $item->delivery_date?->format('Y-m-d'),
                    'delivery_location' => $item->delivery_location,
                    'quantity' => (int) $item->quantity,
                    'unit_price' => (int) $item->unit_price,
                    'shipping_mode' => $item->shipping_mode,
                    'shipping_fee' => (int) $item->shipping_fee,
                    'fulfillment_status' => $item->fulfillment_status,
                    'notes' => $item->notes ?? '',
                ])->all(),
            ],
            'customers' => $this->activeCustomers(),
            'todayIso' => now('Asia/Jakarta')->toDateString(),
        ]);
    }

    public function update(OrderRequest $request, Order $order): RedirectResponse
    {
        $updated = $this->orders->update(
            $order,
            $request->validated(),
            (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('ui-orders.show', $updated)
            ->with('success', 'Perubahan pesanan berhasil disimpan.');
    }

    /**
     * Advance fulfillment status of a single item directly from order detail.
     */
    public function updateItemStatus(Request $request, Order $order, OrderItem $item): RedirectResponse
    {
        if ($item->order_id !== $order->id) {
            abort(404, 'Item bunga tidak terhubung dengan pesanan ini.');
        }

        $validated = $request->validate([
            'target_status' => ['required', 'string', 'in:PROCESSING,READY,DELIVERED'],
            'return_to' => ['nullable', 'in:dashboard,order'],
        ]);

        $this->orders->updateItemFulfillment(
            $order,
            (int) $item->id,
            $validated['target_status'],
            (int) $request->user()->getAuthIdentifier()
        );

        $statusLabels = [
            'PROCESSING' => 'Diproses',
            'READY' => 'Siap kirim',
            'DELIVERED' => 'Terkirim',
        ];
        $label = $statusLabels[$validated['target_status']] ?? $validated['target_status'];
        $targetRoute = ($validated['return_to'] ?? 'order') === 'dashboard'
            ? route('dashboard')
            : route('ui-orders.show', $order);

        return redirect($targetRoute)
            ->with('success', "Status pengerjaan '{$item->flower_type}' berhasil dimajukan ke '{$label}'.");
    }

    private function activeCustomers(): array
    {
        return Customer::query()
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'name', 'phone'])
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
            ])
            ->all();
    }
}
