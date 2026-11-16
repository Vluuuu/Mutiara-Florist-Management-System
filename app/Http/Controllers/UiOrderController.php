<?php

namespace App\Http\Controllers;

use App\Http\Requests\OrderRequest;
use App\Models\Customer;
use App\Models\Order;
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
        ]);

        $search = trim((string) ($filters['q'] ?? ''));
        $status = $filters['status'] ?? '';

        $paginator = $this->orders->paginate($search, $status);

        $orders = $paginator->through(function (Order $order) {
            $paid = (int) ($order->paid_amount ?? 0);
            $total = (int) $order->total_amount;
            $paymentStatus = $paid === 0 ? 'UNPAID' : ($paid >= $total ? 'PAID' : 'PARTIAL');
            $paymentStatusLabel = $paid === 0 ? 'Belum bayar' : ($paid >= $total ? 'Lunas' : 'Sebagian');

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'order_date' => $order->order_date?->format('d/m/Y'),
                'order_date_raw' => $order->order_date?->format('Y-m-d'),
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
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Orders/Create', [
            'customers' => $this->activeCustomers(),
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
