<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerRequest;
use App\Models\Customer;
use App\Services\CustomerService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CustomerController extends Controller
{
    public function __construct(
        private readonly CustomerService $customers,
    ) {}

    public function index(Request $request): View
    {
        $input = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim((string) ($input['q'] ?? ''));
        $customers = $this->customers->paginate($search);

        return view('customers.index', compact('customers', 'search'));
    }

    public function create(): View
    {
        return view('customers.create', ['customer' => null]);
    }

    public function store(CustomerRequest $request): RedirectResponse
    {
        $customer = $this->customers->create($request->validated(), $request->user());

        return redirect()->route('customers.show', $customer)
            ->with('success', 'Pelanggan berhasil ditambahkan.');
    }

    public function show(Customer $customer): View
    {
        $customer->loadCount('orders');

        return view('customers.show', compact('customer'));
    }

    public function edit(Customer $customer): View
    {
        return view('customers.edit', compact('customer'));
    }

    public function update(CustomerRequest $request, Customer $customer): RedirectResponse
    {
        $this->customers->update($customer, $request->validated(), $request->user());

        return redirect()->route('customers.show', $customer)
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

        return redirect()->route('customers.index')
            ->with('success', 'Pelanggan diarsipkan. Data tidak dihapus permanen.');
    }
}
