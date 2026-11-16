<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerRequest;
use App\Models\Customer;
use App\Services\CustomerService;
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

    public function store(CustomerRequest $request): RedirectResponse
    {
        $customer = $this->customers->create($request->validated(), $request->user());

        return redirect()->route('ui-customers.show', $customer)
            ->with('success', 'Pelanggan berhasil ditambahkan.');
    }

    public function show(Customer $customer): Response
    {
        $customer->loadCount('orders');

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
