<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaymentRequest;
use App\Http\Requests\VoidPaymentRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UiPaymentController extends Controller
{
    public function __construct(
        private readonly PaymentService $payments,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $search = trim((string) ($filters['q'] ?? ''));

        $result = $this->payments->getReceivables($search, 10);
        $paginator = $result['orders'];
        $outstanding = $result['outstanding'];

        $orders = $paginator->through(function ($order) {
            $total = (int) $order->total_amount;
            $paid = (int) $order->paid_amount;
            $remaining = max($total - $paid, 0);

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'order_date' => date('d/m/Y', strtotime($order->order_date)),
                'total_amount' => $total,
                'paid_amount' => $paid,
                'outstanding' => $remaining,
                'status' => $order->status,
                'customer_name' => $order->customer_name,
            ];
        });

        return Inertia::render('Payments/Index', [
            'orders' => $orders,
            'outstanding' => $outstanding,
            'filters' => [
                'q' => $search,
            ],
        ]);
    }

    public function store(StorePaymentRequest $request, Order $order): RedirectResponse
    {
        $payment = $this->payments->record(
            $order,
            $request->validated(),
            (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('ui-orders.show', $order)
            ->with('success', 'Pembayaran Rp'.number_format($payment->amount, 0, ',', '.').' berhasil dicatat.');
    }

    public function void(VoidPaymentRequest $request, Order $order, Payment $payment): RedirectResponse
    {
        abort_unless((int) $payment->order_id === (int) $order->id, 404);

        $this->payments->void(
            $order,
            $payment,
            $request->validated()['void_reason'],
            (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('ui-orders.show', $order)
            ->with('success', 'Pencatatan pembayaran di-void. Ini bukan pengembalian uang.');
    }
}
