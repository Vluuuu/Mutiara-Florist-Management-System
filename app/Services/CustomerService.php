<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class CustomerService
{
    /**
     * Cari dan paginasi data pelanggan (10 per halaman).
     * Karakter '!', '%', '_' dalam kata kunci pencarian diperlakukan sebagai literal.
     */
    public function paginate(?string $search = null, int $perPage = 10): LengthAwarePaginator
    {
        $search = trim((string) $search);
        // Treat %, _, and ! as literal customer input, not SQL LIKE wildcards.
        $escapedSearch = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search);
        $pattern = '%'.$escapedSearch.'%';

        return Customer::query()
            ->withCount('orders')
            ->when($search !== '', function ($query) use ($pattern): void {
                $likeOp = $query->getConnection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
                $query->where(function ($query) use ($pattern, $likeOp): void {
                    $query->whereRaw("name {$likeOp} ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("phone {$likeOp} ? ESCAPE '!'", [$pattern]);
                });
            })
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * Tambah pelanggan baru dalam transaksi database disertai pencatatan audit log.
     */
    public function create(array $data, User $actor): Customer
    {
        \App\Support\DemoRuntimeGuard::enforceDemoQuota(
            'customers',
            (int) config('demo.max_customers', 250),
            'name',
            'pelanggan'
        );

        return DB::transaction(function () use ($data, $actor): Customer {
            $customer = Customer::query()->create($data);
            $this->audit($actor, 'customer.created', $customer, ['fields' => ['name', 'phone', 'notes']]);

            return $customer;
        });
    }

    /**
     * Perbarui data pelanggan dalam transaksi database dengan lock baris dan audit log field yang berubah.
     */
    public function update(Customer $customer, array $data, User $actor): Customer
    {
        return DB::transaction(function () use ($customer, $data, $actor): Customer {
            $locked = Customer::query()->whereKey($customer->getKey())->lockForUpdate()->firstOrFail();
            $locked->fill($data);

            $fields = array_keys($locked->getDirty());

            if ($fields !== []) {
                $locked->save();
                $this->audit($actor, 'customer.updated', $locked, ['changed_fields' => $fields]);
            }

            return $locked;
        });
    }

    /**
     * Arsipkan pelanggan (soft delete) jika tidak memiliki riwayat pesanan.
     * Mengembalikan false jika pelanggan memiliki pesanan (tidak boleh diarsipkan).
     */
    public function archive(Customer $customer, User $actor): bool
    {
        return DB::transaction(function () use ($customer, $actor): bool {
            $locked = Customer::query()->whereKey($customer->getKey())->lockForUpdate()->firstOrFail();

            // Riwayat pesanan tidak boleh kehilangan pelanggan, termasuk order belum dibayar.
            if ($locked->orders()->exists()) {
                return false;
            }

            $locked->delete();
            $this->audit($actor, 'customer.archived', $locked, ['reason' => 'no_orders']);

            return true;
        });
    }

    private function audit(User $actor, string $action, Customer $customer, array $summary): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->getAuthIdentifier(),
            'action' => $action,
            'subject_type' => 'customer',
            'subject_id' => $customer->getKey(),
            'change_summary' => json_encode($summary, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
