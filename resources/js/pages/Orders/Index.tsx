import { useState, type FormEvent } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock3,
    Filter,
    Package,
    Plus,
    Search,
    ShoppingBag,
    X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/pagination';
import { formatAmount } from '@/lib/format';
import type { OrderListItem, OrderStatus, PaginatedData, PaymentStatus } from '@/types';

type OrdersIndexProps = {
    orders: PaginatedData<OrderListItem>;
    filters: {
        q?: string;
        status?: string;
    };
};

function StatusBadge({ status }: { status: OrderStatus }) {
    switch (status) {
        case 'NEW':
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                    Baru
                </span>
            );
        case 'PROCESSING':
            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                    Diproses
                </span>
            );
        case 'READY':
            return (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                    Siap kirim
                </span>
            );
        case 'COMPLETED':
            return (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    Selesai
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                    {status}
                </span>
            );
    }
}

function PaymentBadge({ status, label }: { status: PaymentStatus; label: string }) {
    switch (status) {
        case 'PAID':
            return (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900">
                    {label}
                </span>
            );
        case 'PARTIAL':
            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                    {label}
                </span>
            );
        case 'UNPAID':
        default:
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                    {label}
                </span>
            );
    }
}

export default function OrdersIndex({ orders, filters }: OrdersIndexProps) {
    const [search, setSearch] = useState(filters.q ?? '');
    const [statusFilter, setStatusFilter] = useState(filters.status ?? '');
    const isFiltered = (filters.q ?? '').trim() !== '' || (filters.status ?? '').trim() !== '';

    const handleFilter = (e: FormEvent) => {
        e.preventDefault();
        router.get(
            '/ui-orders',
            {
                q: search,
                status: statusFilter,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const handleReset = () => {
        setSearch('');
        setStatusFilter('');
        router.get(
            '/ui-orders',
            {},
            {
                preserveState: false,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <AppLayout title="Pesanan">
            <Head title="Pesanan" />

            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Pencatatan bunga
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-emerald-950">
                        Pesanan
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Pantau pesanan, jadwal pengerjaan, dan tagihan tanpa menyamakan nilai pesanan dengan uang masuk.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/ui-orders/create"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#143326] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0E251B]"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        Buat pesanan
                    </Link>
                </div>
            </div>

            <Card className="overflow-hidden">
                <form
                    onSubmit={handleFilter}
                    role="search"
                    className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end"
                >
                    <div className="min-w-[210px] flex-1">
                        <label
                            htmlFor="q"
                            className="mb-1.5 block text-xs font-semibold text-stone-600"
                        >
                            Nomor pesanan atau pelanggan
                        </label>
                        <div className="relative">
                            <input
                                id="q"
                                name="q"
                                type="search"
                                maxLength={100}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari pesanan..."
                                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 pr-9 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Hapus kata kunci"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="w-full sm:w-48">
                        <label
                            htmlFor="status"
                            className="mb-1.5 block text-xs font-semibold text-stone-600"
                        >
                            Status pengerjaan
                        </label>
                        <select
                            id="status"
                            name="status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                        >
                            <option value="">Semua status</option>
                            <option value="NEW">Baru</option>
                            <option value="PROCESSING">Diproses</option>
                            <option value="READY">Siap kirim</option>
                            <option value="COMPLETED">Selesai</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900 bg-emerald-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900"
                        >
                            <Filter className="size-4" aria-hidden="true" />
                            Terapkan
                        </button>
                        {isFiltered && (
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

                {orders.data.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                            {isFiltered ? (
                                <Search className="size-6" aria-hidden="true" />
                            ) : (
                                <ShoppingBag className="size-6" aria-hidden="true" />
                            )}
                        </div>
                        <h2 className="text-base font-semibold text-stone-800">
                            {isFiltered ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan'}
                        </h2>
                        <p className="mt-2 text-sm text-stone-500">
                            {isFiltered
                                ? 'Coba ubah filter atau kata kunci pencarian.'
                                : 'Mulai dengan membuat pesanan dari pelanggan yang sudah tercatat.'}
                        </p>
                        {!isFiltered && (
                            <Link
                                href="/ui-orders/create"
                                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-900"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                + Buat pesanan
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px] text-left text-sm">
                                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                                    <tr>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Pesanan
                                        </th>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Pelanggan
                                        </th>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Pengerjaan
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Tagihan
                                        </th>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Pembayaran
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {orders.data.map((order) => (
                                        <tr key={order.id} className="hover:bg-stone-50/80">
                                            <td className="px-5 py-4">
                                                <span className="block font-semibold text-stone-900">
                                                    {order.order_number}
                                                </span>
                                                <span className="mt-1 block text-xs text-stone-500">
                                                    {order.order_date} · {order.items_count} bunga
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-stone-700">
                                                {order.customer.name}
                                            </td>
                                            <td className="px-5 py-4">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-5 py-4 text-right font-semibold text-emerald-950">
                                                Rp{formatAmount(order.total_amount)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <PaymentBadge
                                                    status={order.payment_status}
                                                    label={order.payment_status_label}
                                                />
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <Link
                                                    href={`/ui-orders/${order.id}`}
                                                    className="font-semibold text-emerald-800 hover:underline"
                                                >
                                                    Lihat
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-stone-200 px-5 py-4">
                            <Pagination
                                links={orders.links}
                                from={orders.from}
                                to={orders.to}
                                total={orders.total}
                                itemLabel="pesanan"
                            />
                        </div>
                    </>
                )}
            </Card>
        </AppLayout>
    );
}
