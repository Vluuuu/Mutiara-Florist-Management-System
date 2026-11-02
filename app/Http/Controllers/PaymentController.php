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
    public function index(Request $request): View
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $search = trim((string) ($filters['q'] ?? ''));
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
                $query->where(function ($query) use ($pattern): void {
                    $query->whereRaw("orders.order_number LIKE ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("customers.name LIKE ? ESCAPE '!'", [$pattern]);
                });
            });

        $outstanding = (int) (clone $base)
            ->selectRaw('COALESCE(SUM(orders.total_amount - COALESCE(received.paid_amount, 0)), 0) AS outstanding')
            ->value('outstanding');

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
            ->paginate(10)
            ->withQueryString();

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
