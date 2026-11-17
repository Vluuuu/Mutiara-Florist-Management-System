<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerRequest;
use App\Models\Customer;
use App\Models\Order;
use App\Services\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UiCustomerController extends Controller
{
    public function __construct(
        private readonly CustomerService $customers,
    ) {}

    public function index(Request $request): Response
    {
        $input = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim((string) ($input['q'] ?? ''));
        $customers = $this->customers->paginate($search);

        return Inertia::render('Customers/Index', [
            'customers' => $customers,
            'filters' => [
                'q' => $search,
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Customers/Create');
    }

    public function store(CustomerRequest $request): RedirectResponse|JsonResponse
    {
        $customer = $this->customers->create($request->validated(), $request->user());

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'message' => 'Pelanggan berhasil ditambahkan.',
                'customer' => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                ],
            ], 201);
        }

        return redirect()->route('ui-customers.show', $customer)
            ->with('success', 'Pelanggan berhasil ditambahkan.');
    }

    public function show(Customer $customer): Response
    {
        $customer->loadCount('orders');

        $orders = Order::query()
            ->where('customer_id', $customer->id)
            ->withCount('items')
            ->withSum(['payments as paid_amount' => fn ($query) => $query->where('status', 'POSTED')], 'amount')
            ->with([
                'items' => fn ($query) => $query
                    ->select(['id', 'order_id', 'flower_type', 'delivery_date'])
                    ->orderBy('delivery_date')
                    ->orderBy('id'),
            ])
            ->orderByDesc('order_date')
            ->orderByDesc('id')
            ->limit(25)
            ->get()
            ->map(function (Order $order): array {
                $total = (int) $order->total_amount;
                $paid = (int) ($order->paid_amount ?? 0);
                $outstanding = max($total - $paid, 0);
                $paymentStatus = $paid === 0 ? 'UNPAID' : ($paid >= $total ? 'PAID' : 'PARTIAL');
                $firstItem = $order->items->first();

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'order_date' => $order->order_date?->format('d/m/Y'),
                    'status' => $order->status,
                    'total_amount' => $total,
                    'paid_amount' => $paid,
                    'outstanding' => $outstanding,
                    'payment_status' => $paymentStatus,
                    'items_count' => (int) $order->items_count,
                    'first_flower' => $firstItem?->flower_type,
                    'earliest_delivery_date' => $firstItem?->delivery_date?->format('d/m/Y'),
                ];
            })
            ->values()
            ->all();

        return Inertia::render('Customers/Show', [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'notes' => $customer->notes,
                'orders_count' => (int) $customer->orders_count,
                'created_at' => $customer->created_at?->timezone('Asia/Jakarta')->format('d/m/Y H:i'),
                'created_at_raw' => $customer->created_at?->toIso8601String(),
            ],
            'orders' => $orders,
        ]);
    }

    public function edit(Customer $customer): Response
    {
        return Inertia::render('Customers/Edit', [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone ?? '',
                'notes' => $customer->notes ?? '',
            ],
        ]);
    }

    public function update(CustomerRequest $request, Customer $customer): RedirectResponse
    {
        $this->customers->update($customer, $request->validated(), $request->user());

        return redirect()->route('ui-customers.show', $customer)
            ->with('success', 'Data pelanggan berhasil disimpan.');
    }

    public function destroy(Request $request, Customer $customer): RedirectResponse
    {
        $archived = $this->customers->archive($customer, $request->user());

        if (! $archived) {
            return back()->withErrors([
                'customer' => 'Pelanggan yang memiliki pesanan tidak bisa diarsipkan.',
            ]);
        }

        return redirect()->route('ui-customers.index')
            ->with('success', 'Pelanggan diarsipkan. Data tidak dihapus permanen.');
    }
}
