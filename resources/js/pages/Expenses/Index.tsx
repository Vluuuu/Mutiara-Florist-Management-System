import { useState, type FormEvent } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Filter,
    Plus,
    ReceiptText,
    Search,
    Tags,
    X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/pagination';
import { formatAmount } from '@/lib/format';
import type { ExpenseCategoryItem, ExpenseFilters, ExpenseItem, PaginatedData } from '@/types';

type ExpensesIndexProps = {
    expenses: PaginatedData<ExpenseItem>;
    postedTotal: number;
    categories: ExpenseCategoryItem[];
    filters: ExpenseFilters;
};

export default function ExpensesIndex({
    expenses,
    postedTotal,
    categories,
    filters,
}: ExpensesIndexProps) {
    const [search, setSearch] = useState(filters.q ?? '');
    const [categoryId, setCategoryId] = useState<string>(
        filters.category_id ? String(filters.category_id) : '',
    );
    const [status, setStatus] = useState<string>(filters.status ?? '');
    const [from, setFrom] = useState<string>(filters.from ?? '');
    const [to, setTo] = useState<string>(filters.to ?? '');

    const [voidTarget, setVoidTarget] = useState<ExpenseItem | null>(null);

    const isFiltered =
        (filters.q ?? '').trim() !== '' ||
        Boolean(filters.category_id) ||
        Boolean(filters.status) ||
        Boolean(filters.from) ||
        Boolean(filters.to);

    const handleFilterSubmit = (e: FormEvent) => {
        e.preventDefault();
        const params: Record<string, string> = {};
        if (search.trim()) params.q = search.trim();
        if (categoryId) params.category_id = categoryId;
        if (status) params.status = status;
        if (from) params.from = from;
        if (to) params.to = to;

        router.get('/ui-expenses', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleReset = () => {
        setSearch('');
        setCategoryId('');
        setStatus('');
        setFrom('');
        setTo('');
        router.get('/ui-expenses', {}, {
            preserveState: false,
            preserveScroll: true,
            replace: true,
        });
    };

    // Void form
    const {
        data: voidData,
        setData: setVoidData,
        post: postVoid,
        processing: voidProcessing,
        errors: voidErrors,
        reset: resetVoid,
    } = useForm({
        void_reason: '',
    });

    const openVoidModal = (expense: ExpenseItem) => {
        setVoidTarget(expense);
        resetVoid();
    };

    const closeVoidModal = () => {
        setVoidTarget(null);
        resetVoid();
    };

    const submitVoid = (e: FormEvent) => {
        e.preventDefault();
        if (!voidTarget) return;

        postVoid(`/ui-expenses/${voidTarget.id}/void`, {
            preserveScroll: true,
            onSuccess: () => {
                closeVoidModal();
            },
        });
    };

    return (
        <AppLayout title="Pengeluaran">
            <Head title="Pengeluaran" />

            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Keuangan usaha
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-emerald-950">
                        Pengeluaran
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Catat uang yang benar-benar keluar untuk operasional florist. Nilai pesanan tidak berubah.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/ui-expense-categories"
                        className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-xs hover:bg-stone-50"
                    >
                        <Tags className="size-4 text-stone-500" />
                        Kategori biaya
                    </Link>
                    <Link
                        href="/ui-expenses/create"
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900"
                    >
                        <Plus className="size-4" />
                        Catat pengeluaran
                    </Link>
                </div>
            </div>

            {/* Total Metric Card */}
            <Card className="mb-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-stone-500">
                            Total pengeluaran POSTED{isFiltered ? ' sesuai filter' : ''}
                        </p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-950">
                            {formatAmount(postedTotal)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                            VOIDED tidak dihitung. Jumlah ini adalah kas keluar tercatat, bukan perhitungan laba bersih.
                        </p>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                        <ReceiptText className="size-6" />
                    </div>
                </div>
            </Card>

            {/* Filters & Table */}
            <Card className="overflow-hidden">
                <form
                    onSubmit={handleFilterSubmit}
                    className="grid gap-3 border-b border-stone-200 bg-stone-50/50 p-4 sm:grid-cols-2 xl:grid-cols-6"
                >
                    <div className="sm:col-span-2">
                        <label htmlFor="q" className="mb-1 block text-xs font-semibold text-stone-600">
                            Cari keterangan
                        </label>
                        <div className="relative">
                            <input
                                id="q"
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Contoh: ongkir kurir"
                                className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                            />
                            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400" />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="category_id" className="mb-1 block text-xs font-semibold text-stone-600">
                            Kategori
                        </label>
                        <select
                            id="category_id"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                        >
                            <option value="">Semua kategori</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="status" className="mb-1 block text-xs font-semibold text-stone-600">
                            Status
                        </label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                        >
                            <option value="">Semua status</option>
                            <option value="POSTED">Tercatat</option>
                            <option value="VOIDED">VOIDED</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="from" className="mb-1 block text-xs font-semibold text-stone-600">
                            Tanggal dari
                        </label>
                        <input
                            id="from"
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                        />
                    </div>

                    <div>
                        <label htmlFor="to" className="mb-1 block text-xs font-semibold text-stone-600">
                            Sampai
                        </label>
                        <input
                            id="to"
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-6">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                        >
                            <Filter className="size-4" />
                            Terapkan filter
                        </button>
                        {isFiltered && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
                            >
                                <X className="size-4" />
                                Reset filter
                            </button>
                        )}
                    </div>
                </form>

                {expenses.data.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                            <ReceiptText className="size-6" />
                        </div>
                        <h2 className="font-semibold text-stone-800">
                            Tidak ada pengeluaran yang ditemukan
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                            {isFiltered
                                ? 'Ubah kriteria pencarian atau klik reset filter.'
                                : 'Mulai catat pengeluaran operasional florist.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500">
                                <tr>
                                    <th className="px-5 py-3">Tanggal</th>
                                    <th className="px-5 py-3">Kategori</th>
                                    <th className="px-5 py-3">Keterangan</th>
                                    <th className="px-5 py-3 text-right">Nominal</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {expenses.data.map((expense) => {
                                    const isPosted = expense.status === 'POSTED';
                                    return (
                                        <tr key={expense.id} className="align-top hover:bg-stone-50">
                                            <td className="whitespace-nowrap px-5 py-4 text-stone-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="size-3.5 text-stone-400" />
                                                    {expense.expense_date}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 font-medium text-stone-800">
                                                {expense.category?.name ?? 'Kategori tidak tersedia'}
                                            </td>
                                            <td className="max-w-xs px-5 py-4">
                                                <p className="whitespace-pre-wrap break-words text-stone-800">
                                                    {expense.description}
                                                </p>
                                                <p className="mt-1 text-xs text-stone-400">
                                                    Dicatat oleh {expense.recorded_by_user?.name ?? 'Operator'}
                                                </p>
                                                {expense.status === 'VOIDED' && expense.void_reason && (
                                                    <div className="mt-2 rounded-lg bg-stone-100 p-2 text-xs text-stone-600">
                                                        <span className="font-semibold">Alasan void:</span> {expense.void_reason}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-emerald-950">
                                                {formatAmount(expense.amount)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                        isPosted
                                                            ? 'bg-emerald-50 text-emerald-900'
                                                            : 'bg-stone-100 text-stone-600'
                                                    }`}
                                                >
                                                    {isPosted ? (
                                                        <>
                                                            <CheckCircle2 className="size-3 text-emerald-600" />
                                                            Tercatat
                                                        </>
                                                    ) : (
                                                        'VOIDED'
                                                    )}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-right">
                                                {isPosted ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openVoidModal(expense)}
                                                        className="text-xs font-semibold text-red-700 hover:text-red-900 hover:underline"
                                                    >
                                                        Koreksi catatan
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-stone-400">
                                                        {expense.voided_at ?? 'Dibatalkan'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="border-t border-stone-200 px-5 py-4">
                    <Pagination
                        links={expenses.links}
                        from={expenses.from}
                        to={expenses.to}
                        total={expenses.total}
                        itemLabel="pengeluaran"
                    />
                </div>
            </Card>

            {/* Void Modal */}
            {voidTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="size-5 text-red-600" />
                                <h3 className="font-semibold text-stone-900">Koreksi Pengeluaran (Void)</h3>
                            </div>
                            <button
                                type="button"
                                onClick={closeVoidModal}
                                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={submitVoid} className="mt-4 space-y-4">
                            <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
                                <p>
                                    <span className="font-semibold">Kategori:</span> {voidTarget.category?.name}
                                </p>
                                <p>
                                    <span className="font-semibold">Nominal:</span> {formatAmount(voidTarget.amount)}
                                </p>
                                <p>
                                    <span className="font-semibold">Keterangan:</span> {voidTarget.description}
                                </p>
                            </div>

                            <p className="text-xs text-stone-500">
                                Void hanya mencatat koreksi administratif. Riwayat pencatatan tetap disimpan dan tidak ada uang yang otomatis dikembalikan.
                            </p>

                            <div>
                                <label
                                    htmlFor="void_reason"
                                    className="mb-1 block text-xs font-semibold text-stone-700"
                                >
                                    Alasan koreksi * (minimal 10 karakter)
                                </label>
                                <textarea
                                    id="void_reason"
                                    rows={3}
                                    minLength={10}
                                    maxLength={1000}
                                    required
                                    value={voidData.void_reason}
                                    onChange={(e) => setVoidData('void_reason', e.target.value)}
                                    placeholder="Contoh: Salah input nominal pengeluaran, harusnya Rp50.000"
                                    className="w-full rounded-lg border border-stone-300 p-2.5 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                />
                                {voidErrors.void_reason && (
                                    <p className="mt-1 text-xs text-red-600">{voidErrors.void_reason}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                                <button
                                    type="button"
                                    onClick={closeVoidModal}
                                    className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={voidProcessing || voidData.void_reason.trim().length < 10}
                                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                    {voidProcessing ? 'Memproses...' : 'Void pencatatan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
