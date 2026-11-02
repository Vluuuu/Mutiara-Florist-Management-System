<?php

namespace App\Http\Controllers;

use App\Http\Requests\OrderRequest;
use App\Models\Customer;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function index(Request $request): View
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:NEW,PROCESSING,READY,COMPLETED'],
        ]);

        $search = trim((string) ($filters['q'] ?? ''));
        $status = $filters['status'] ?? '';
        $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';

        $orders = Order::query()
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
            ->orderByDesc('order_date')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString();

        return view('orders.index', compact('orders', 'search', 'status'));
    }

    public function create(): View
    {
        return view('orders.create', [
            'order' => null,
            'customers' => $this->customers(),
        ]);
    }

    public function store(OrderRequest $request, OrderService $service): RedirectResponse
    {
        $order = $service->create($request->validated(), (int) $request->user()->getAuthIdentifier());

        return redirect()->route('orders.show', $order)
            ->with('success', 'Pesanan berhasil dibuat. Pembayaran belum dicatat.');
    }

    public function show(Order $order): View
    {
        $order->load([
            'customer',
            'items' => fn ($query) => $query->orderBy('id'),
            'payments' => fn ($query) => $query->with('recordedBy:id,name')->orderByDesc('id'),
        ]);
        $received = (int) $order->payments->where('status', 'POSTED')->sum('amount');
        $outstanding = max((int) $order->total_amount - $received, 0);
        $newPaymentKey = (string) Str::uuid();

        return view('orders.show', compact('order', 'received', 'outstanding', 'newPaymentKey'));
    }

    public function edit(Order $order): View
    {
        $order->load(['items' => fn ($query) => $query->orderBy('id')]);

        return view('orders.edit', [
            'order' => $order,
            'customers' => $this->customers(),
        ]);
    }

    public function update(OrderRequest $request, Order $order, OrderService $service): RedirectResponse
    {
        $updated = $service->update($order, $request->validated(), (int) $request->user()->getAuthIdentifier());

        return redirect()->route('orders.show', $updated)
            ->with('success', 'Perubahan pesanan berhasil disimpan.');
    }

    private function customers()
    {
        return Customer::query()->orderBy('name')->orderBy('id')->get(['id', 'name', 'phone']);
    }
}
