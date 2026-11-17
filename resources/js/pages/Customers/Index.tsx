import { useState, type FormEvent } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Plus, Search, User, Users, X } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/pagination';
import { formatAmount } from '@/lib/format';
import type { CustomerItem, PaginatedData } from '@/types';

type CustomersIndexProps = {
    customers: PaginatedData<CustomerItem>;
    filters: {
        q?: string;
    };
};

export default function CustomersIndex({ customers, filters }: CustomersIndexProps) {
    const [search, setSearch] = useState(filters.q ?? '');
    const isSearching = (filters.q ?? '').trim() !== '';

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get(
            '/ui-customers',
            { q: search },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const handleReset = () => {
        setSearch('');
        router.get(
            '/ui-customers',
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <AppLayout title="Pelanggan">
            <Head title="Pelanggan" />

            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Direktori
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-emerald-950">
                        Pelanggan
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Cari dan kelola data pemesan bunga.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/ui-customers/create"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#143326] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0E251B]"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        Tambah pelanggan
                    </Link>
                </div>
            </div>

            <Card className="overflow-hidden">
                <form
                    onSubmit={handleSearch}
                    role="search"
                    className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end"
                >
                    <div className="w-full sm:max-w-md">
                        <label
                            htmlFor="q"
                            className="mb-1.5 block text-xs font-semibold text-stone-600"
                        >
                            Cari nama atau nomor telepon
                        </label>
                        <div className="relative">
                            <input
                                id="q"
                                name="q"
                                type="search"
                                maxLength={100}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Contoh: Bu Ani atau 0812..."
                                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 pr-9 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    aria-label="Hapus kata kunci"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900 bg-emerald-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900"
                        >
                            <Search className="size-4" aria-hidden="true" />
                            Cari
                        </button>
                        {isSearching && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </form>

                {customers.data.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                            {isSearching ? (
                                <Search className="size-6" aria-hidden="true" />
                            ) : (
                                <Users className="size-6" aria-hidden="true" />
                            )}
                        </div>
                        <h2 className="text-base font-semibold text-stone-800">
                            {isSearching ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
                        </h2>
                        <p className="mt-2 text-sm text-stone-500">
                            {isSearching
                                ? 'Coba kata kunci lain atau reset pencarian.'
                                : 'Tambahkan pelanggan pertama untuk mulai mencatat pesanan.'}
                        </p>
                        {!isSearching && (
                            <Link
                                href="/ui-customers/create"
                                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-900"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                Tambah pelanggan
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px] text-left text-sm">
                                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                                    <tr>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Nama pelanggan
                                        </th>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Telepon
                                        </th>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Pesanan
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {customers.data.map((customer) => (
                                        <tr key={customer.id} className="hover:bg-stone-50/80">
                                            <td className="px-5 py-4 font-medium text-stone-900">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-900">
                                                        <User className="size-3.5" aria-hidden="true" />
                                                    </span>
                                                    <span className="break-words">{customer.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-stone-600">
                                                {customer.phone || '—'}
                                            </td>
                                            <td className="px-5 py-4 text-stone-600">
                                                {formatAmount(customer.orders_count)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <Link
                                                    href={`/ui-customers/${customer.id}`}
                                                    className="font-medium text-emerald-800 hover:underline"
                                                >
                                                    Lihat
                                                </Link>
                                                <Link
                                                    href={`/ui-customers/${customer.id}/edit`}
                                                    className="ml-4 font-medium text-stone-600 hover:underline"
                                                >
                                                    Edit
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-stone-200 px-5 py-4">
                            <Pagination
                                links={customers.links}
                                from={customers.from}
                                to={customers.to}
                                total={customers.total}
                                itemLabel="pelanggan"
                            />
                        </div>
                    </>
                )}
            </Card>
        </AppLayout>
    );
}
