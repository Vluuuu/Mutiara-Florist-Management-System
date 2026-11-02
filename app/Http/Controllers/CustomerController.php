<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerRequest;
use App\Models\Customer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class CustomerController extends Controller
{
    public function index(Request $request): View
    {
        $input = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim((string) ($input['q'] ?? ''));

        $customers = Customer::query()
            ->withCount('orders')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhere('phone', 'like', '%'.$search.'%');
                });
            })
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString();

        return view('customers.index', compact('customers', 'search'));
    }

    public function create(): View
    {
        return view('customers.create', ['customer' => null]);
    }

    public function store(CustomerRequest $request): RedirectResponse
    {
        $customer = DB::transaction(function () use ($request): Customer {
            $customer = Customer::query()->create($request->validated());
            $this->audit($request, 'customer.created', $customer, ['fields' => ['name', 'phone', 'notes']]);

            return $customer;
        });

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
        DB::transaction(function () use ($request, $customer): void {
            $locked = Customer::query()->whereKey($customer->getKey())->lockForUpdate()->firstOrFail();
            $locked->fill($request->validated());

            $fields = array_keys($locked->getDirty());

            if ($fields !== []) {
                $locked->save();
                $this->audit($request, 'customer.updated', $locked, ['changed_fields' => $fields]);
            }
        });

        return redirect()->route('customers.show', $customer)
            ->with('success', 'Data pelanggan berhasil disimpan.');
    }

    public function destroy(Request $request, Customer $customer): RedirectResponse
    {
        $archived = DB::transaction(function () use ($request, $customer): bool {
            $locked = Customer::query()->whereKey($customer->getKey())->lockForUpdate()->firstOrFail();

            // Riwayat pesanan tidak boleh kehilangan pelanggan, termasuk order belum dibayar.
            if ($locked->orders()->exists()) {
                return false;
            }

            $locked->delete();
            $this->audit($request, 'customer.archived', $locked, ['reason' => 'no_orders']);

            return true;
        });

        if (! $archived) {
            return back()->withErrors([
                'customer' => 'Pelanggan yang memiliki pesanan tidak bisa diarsipkan.',
            ]);
        }

        return redirect()->route('customers.index')
            ->with('success', 'Pelanggan diarsipkan. Data tidak dihapus permanen.');
    }

    private function audit(Request $request, string $action, Customer $customer, array $summary): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $request->user()->getAuthIdentifier(),
            'action' => $action,
            'subject_type' => 'customer',
            'subject_id' => $customer->getKey(),
            'change_summary' => json_encode($summary, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
