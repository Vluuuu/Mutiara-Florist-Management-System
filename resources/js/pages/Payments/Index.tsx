import { useState, type FormEvent } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock3,
    Filter,
    Receipt,
    Search,
    Wallet,
    X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/pagination';
import { formatAmount } from '@/lib/format';
import type { PaginatedData, ReceivableOrder } from '@/types';

type PaymentsIndexProps = {
    orders: PaginatedData<ReceivableOrder>;
    outstanding: number;
    filters: {
        q?: string;
    };
};

export default function PaymentsIndex({ orders, outstanding, filters }: PaymentsIndexProps) {
    const [search, setSearch] = useState(filters.q ?? '');
    const isFiltered = (filters.q ?? '').trim() !== '';

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get(
            '/ui-payments',
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
            '/ui-payments',
            {},
            {
                preserveState: false,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <AppLayout title="Piutang & Pembayaran">
            <Head title="Piutang & Pembayaran" />

            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Manajemen Kas Masuk
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-emerald-950">
                        Piutang & Pembayaran
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Pantau pesanan yang belum lunas. Pembayaran dicatat langsung pada rincian pesanan.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                </div>
            </div>

            {/* Stat Ringkasan Piutang */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-stone-500">Total Piutang Terbuka</p>
                            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-950">
                                Rp{formatAmount(outstanding)}
                            </p>
                        </div>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                            <Clock3 className="size-5" />
                        </span>
                    </div>
                    <p className="mt-3 text-xs text-stone-400">
                        Sisa tagihan kumulatif dari seluruh pesanan aktif
                    </p>
                </Card>

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-stone-500">Pesanan Belum Lunas</p>
                            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-950">
                                {orders.total} pesanan
                            </p>
                        </div>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                            <Receipt className="size-5" />
                        </span>
                    </div>
                    <p className="mt-3 text-xs text-stone-400">
                        Memerlukan DP atau pembayaran pelunasan
                    </p>
                </Card>
            </div>

            {/* Tabel Daftar Piutang */}
            <Card className="overflow-hidden">
                <form
                    onSubmit={handleSearch}
                    role="search"
                    className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end"
                >
                    <div className="min-w-[240px] flex-1">
                        <label
                            htmlFor="q"
                            className="mb-1.5 block text-xs font-semibold text-stone-600"
                        >
                            Cari nomor pesanan atau nama pelanggan
                        </label>
                        <div className="relative">
                            <input
                                id="q"
                                name="q"
                                type="search"
                                maxLength={100}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Contoh: MF-26 atau nama pelanggan..."
                                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 pr-9 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Hapus kata kunci"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900 bg-emerald-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900"
                        >
                            <Search className="size-4" />
                            Cari
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
                                <Search className="size-6" />
                            ) : (
                                <CheckCircle2 className="size-6 text-emerald-600" />
                            )}
                        </div>
                        <h2 className="text-base font-semibold text-stone-800">
                            {isFiltered
                                ? 'Tidak ada piutang yang cocok'
                                : 'Tidak ada piutang terbuka'}
                        </h2>
                        <p className="mt-2 text-sm text-stone-500">
                            {isFiltered
                                ? 'Coba kata kunci pencarian lain atau reset pencarian.'
                                : 'Luar biasa! Semua pesanan yang tercatat saat ini telah lunas.'}
                        </p>
                        {!isFiltered && (
                            <Link
                                href="/ui-orders"
                                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-900"
                            >
                                Buka daftar seluruh pesanan &rarr;
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                                    <tr>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Nomor pesanan
                                        </th>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Pelanggan
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Total tagihan
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Sudah dibayar
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Sisa piutang
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
                                                    {order.order_date}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-medium text-stone-800">
                                                {order.customer_name}
                                            </td>
                                            <td className="px-5 py-4 text-right text-stone-600">
                                                Rp{formatAmount(order.total_amount)}
                                            </td>
                                            <td className="px-5 py-4 text-right font-medium text-emerald-800">
                                                Rp{formatAmount(order.paid_amount)}
                                            </td>
                                            <td className="px-5 py-4 text-right font-bold text-emerald-950">
                                                Rp{formatAmount(order.outstanding)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <Link
                                                    href={`/ui-orders/${order.id}`}
                                                    className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
                                                >
                                                    <Wallet className="size-3.5" />
                                                    Lihat & Catat
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
