<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\OrderService;
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

    public function show(Order $order): Response
    {
        $orderData = $this->orders->getOrderDetail($order);

        return Inertia::render('Orders/Show', [
            'order' => $orderData,
        ]);
    }
}
