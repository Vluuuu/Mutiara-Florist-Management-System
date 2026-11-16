import { type FormEvent } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, ReceiptText, ShieldAlert } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import type { ExpenseCategoryItem } from '@/types';

type ExpensesCreateProps = {
    categories: ExpenseCategoryItem[];
    newExpenseKey: string;
};

export default function ExpensesCreate({
    categories,
    newExpenseKey,
}: ExpensesCreateProps) {
    const today = new Date().toISOString().split('T')[0];

    const { data, setData, post, processing, errors } = useForm({
        expense_category_id: categories.length > 0 ? String(categories[0].id) : '',
        expense_date: today,
        amount: '',
        description: '',
        idempotency_key: newExpenseKey,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post('/ui-expenses');
    };

    return (
        <AppLayout title="Catat Pengeluaran">
            <Head title="Catat Pengeluaran" />

            <div className="mb-6">
                <Link
                    href="/ui-expenses"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950"
                >
                    <ArrowLeft className="size-4" />
                    Kembali ke pengeluaran
                </Link>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">
                    Catat pengeluaran
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                    Catat hanya biaya yang benar-benar sudah dibayar oleh florist.
                </p>
            </div>

            <div className="max-w-2xl">
                {categories.length === 0 ? (
                    <Card className="border-amber-200 bg-amber-50 p-6 text-amber-900">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="size-5 shrink-0 text-amber-600" />
                            <div>
                                <h3 className="font-semibold text-amber-900">Belum ada kategori biaya aktif</h3>
                                <p className="mt-1 text-sm text-amber-800">
                                    Anda memerlukan minimal 1 kategori pengeluaran aktif untuk mencatat pengeluaran.
                                </p>
                                <div className="mt-4">
                                    <Link
                                        href="/ui-expense-categories"
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-900"
                                    >
                                        Buat atau aktifkan kategori
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Card className="p-6 sm:p-8">
                        {Object.keys(errors).length > 0 && (
                            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                                <p className="font-semibold">Pengeluaran belum dapat disimpan:</p>
                                <ul className="mt-1 list-inside list-disc text-xs space-y-0.5">
                                    {Object.values(errors).map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <input type="hidden" name="idempotency_key" value={data.idempotency_key} />

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label
                                        htmlFor="expense_category_id"
                                        className="text-sm font-semibold text-stone-800"
                                    >
                                        Kategori biaya <span className="text-red-500">*</span>
                                    </label>
                                    <Link
                                        href="/ui-expense-categories"
                                        className="text-xs text-emerald-800 hover:underline"
                                    >
                                        Kelola kategori
                                    </Link>
                                </div>
                                <select
                                    id="expense_category_id"
                                    value={data.expense_category_id}
                                    onChange={(e) => setData('expense_category_id', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                >
                                    <option value="">Pilih kategori</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.expense_category_id && (
                                    <p className="mt-1 text-xs text-red-600">{errors.expense_category_id}</p>
                                )}
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="expense_date"
                                        className="mb-1.5 block text-sm font-semibold text-stone-800"
                                    >
                                        Tanggal dibayar <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="expense_date"
                                        type="date"
                                        required
                                        value={data.expense_date}
                                        onChange={(e) => setData('expense_date', e.target.value)}
                                        className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                    />
                                    {errors.expense_date && (
                                        <p className="mt-1 text-xs text-red-600">{errors.expense_date}</p>
                                    )}
                                </div>

                                <div>
                                    <label
                                        htmlFor="amount"
                                        className="mb-1.5 block text-sm font-semibold text-stone-800"
                                    >
                                        Nominal pengeluaran (Rp) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="amount"
                                        type="number"
                                        min="1"
                                        step="1"
                                        required
                                        placeholder="Contoh: 75000"
                                        value={data.amount}
                                        onChange={(e) => setData('amount', e.target.value)}
                                        className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                    />
                                    {errors.amount && (
                                        <p className="mt-1 text-xs text-red-600">{errors.amount}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="description"
                                    className="mb-1.5 block text-sm font-semibold text-stone-800"
                                >
                                    Keterangan pengeluaran <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="description"
                                    rows={4}
                                    minLength={3}
                                    maxLength={2000}
                                    required
                                    placeholder="Contoh: Pembelian pita satin merah dan kertas wrapping florist"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                />
                                <p className="mt-1.5 text-xs text-stone-500">
                                    Ongkir yang dibayar ke kurir merupakan biaya operasional aktual. Jangan otomatis menyamakan nominalnya dengan ongkir yang ditagih ke pelanggan.
                                </p>
                                {errors.description && (
                                    <p className="mt-1 text-xs text-red-600">{errors.description}</p>
                                )}
                            </div>

                            <div className="rounded-lg bg-stone-50 p-3.5 text-xs text-stone-600">
                                <p className="font-semibold text-stone-700">Catatan integritas transaksi:</p>
                                <p className="mt-1">
                                    Pengeluaran yang salah input tidak dapat dihapus. Koreksinya melalui void dengan alasan, kemudian catat ulang jika diperlukan.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 border-t border-stone-100 pt-5">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900 disabled:opacity-50"
                                >
                                    <Check className="size-4" />
                                    {processing ? 'Menyimpan...' : 'Simpan pengeluaran'}
                                </button>
                                <Link
                                    href="/ui-expenses"
                                    className="rounded-lg border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
                                >
                                    Batal
                                </Link>
                            </div>
                        </form>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
