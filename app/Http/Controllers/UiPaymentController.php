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
            'history_status' => ['nullable', 'in:POSTED,VOIDED'],
        ]);
        $search = trim((string) ($filters['q'] ?? ''));
        $historyStatus = (string) ($filters['history_status'] ?? '');

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
            'paymentHistory' => Inertia::defer(
                function () use ($search, $historyStatus) {
                    $historyPaginator = Payment::query()
                        ->with([
                            'order:id,order_number,customer_id',
                            'order.customer:id,name',
                            'recordedBy:id,name',
                        ])
                        ->when($historyStatus !== '', fn ($query) => $query->where('status', $historyStatus))
                        ->when($search !== '', function ($query) use ($search) {
                            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
                            $likeOp = $query->getConnection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
                            $query->where(function ($sub) use ($pattern, $likeOp) {
                                $sub->whereRaw("payments.reference {$likeOp} ? ESCAPE '!'", [$pattern])
                                    ->orWhereHas('order', fn ($oq) => $oq
                                        ->whereRaw("orders.order_number {$likeOp} ? ESCAPE '!'", [$pattern])
                                        ->orWhereHas('customer', fn ($cq) => $cq->whereRaw("customers.name {$likeOp} ? ESCAPE '!'", [$pattern])));
                            });
                        })
                        ->orderByDesc('payment_date')
                        ->orderByDesc('id')
                        ->paginate(10, ['*'], 'history_page')
                        ->withQueryString();

                    return $historyPaginator->through(function (Payment $payment): array {
                        $methodLabel = match ($payment->method) {
                            'TRANSFER' => 'Transfer bank',
                            'CASH' => 'Tunai',
                            'QRIS' => 'QRIS',
                            default => 'Lainnya',
                        };

                        return [
                            'id' => $payment->id,
                            'order_id' => $payment->order_id,
                            'order_number' => $payment->order?->order_number ?? '-',
                            'customer_name' => $payment->order?->customer?->name ?? 'Pelanggan',
                            'payment_date' => $payment->payment_date?->format('d/m/Y') ?? '-',
                            'amount' => (int) $payment->amount,
                            'method' => $payment->method,
                            'method_label' => $methodLabel,
                            'reference' => $payment->reference,
                            'status' => $payment->status,
                            'void_reason' => $payment->void_reason,
                            'voided_at' => $payment->voided_at
                                ? $payment->voided_at->timezone('Asia/Jakarta')->format('d/m/Y H:i').' WIB'
                                : null,
                            'recorded_by' => $payment->recordedBy?->name ?? 'Operator',
                        ];
                    });
                },
                'history',
                true
            ),
            'todayIso' => now('Asia/Jakarta')->toDateString(),
            'filters' => [
                'q' => $search,
                'history_status' => $historyStatus,
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

        $targetRoute = match ($request->input('return_to')) {
            'dashboard' => route('dashboard'),
            'payments' => route('ui-payments.index'),
            default => route('ui-orders.show', $order),
        };

        return redirect($targetRoute)
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
