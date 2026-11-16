<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaymentRequest;
use App\Http\Requests\VoidPaymentRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class PaymentController extends Controller
{
    /**
     * Receivables are current snapshots, not historical revenue by date.
     * Only POSTED payments count toward cash/remaining balance.
     */
    public function index(Request $request, PaymentService $service): View
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $search = trim((string) ($filters['q'] ?? ''));

        $result = $service->getReceivables($search, 10);
        $orders = $result['orders'];
        $outstanding = $result['outstanding'];

        return view('payments.index', compact('orders', 'outstanding', 'search'));
    }

    public function store(StorePaymentRequest $request, Order $order, PaymentService $service): RedirectResponse
    {
        $payment = $service->record($order, $request->validated(), (int) $request->user()->getAuthIdentifier());

        return redirect()->route('orders.show', $order)
            ->with('success', 'Pembayaran Rp'.number_format($payment->amount, 0, ',', '.').' tercatat.');
    }

    public function void(VoidPaymentRequest $request, Order $order, Payment $payment, PaymentService $service): RedirectResponse
    {
        // Check ownership before side effects; never void another order's payment.
        abort_unless((int) $payment->order_id === (int) $order->id, 404);
        $service->void($order, $payment, $request->validated()['void_reason'], (int) $request->user()->getAuthIdentifier());

        return redirect()->route('orders.show', $order)
            ->with('success', 'Pencatatan pembayaran di-void. Ini bukan pengembalian uang.');
    }
}
