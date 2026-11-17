import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Info,
    Plus,
    Save,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { FormField, Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatDateWib, formatRupiah, getWibTodayIso } from '@/lib/format';
import type { AppPageProps } from '@/types';

type CategoryOption = {
    id: number;
    name: string;
};

type ExpensesCreateProps = {
    categories: CategoryOption[];
    newExpenseKey: string;
    todayIso?: string;
};

export default function ExpensesCreate({
    categories,
    newExpenseKey,
    todayIso,
}: ExpensesCreateProps) {
    const { csrf_token } = usePage<AppPageProps>().props;
    const defaultDate = todayIso || getWibTodayIso();

    const [categoryList, setCategoryList] = useState<CategoryOption[]>(() =>
        [...categories].sort((a, b) => a.name.localeCompare(b.name, 'id')),
    );

    const submitLockRef = useRef(false);
    const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

    const { data, setData, post, processing, errors, clearErrors } = useForm<{
        expense_category_id: string;
        expense_date: string;
        amount: number | null;
        description: string;
        idempotency_key: string;
    }>({
        expense_category_id: '',
        expense_date: defaultDate,
        amount: null,
        description: '',
        idempotency_key: newExpenseKey,
    });

    // Quick-create category modal state (keeps main expense form intact)
    const [quickModalOpen, setQuickModalOpen] = useState(false);
    const [quickName, setQuickName] = useState('');
    const [quickError, setQuickError] = useState<string | null>(null);
    const [isSavingQuickCategory, setIsSavingQuickCategory] = useState(false);
    const [quickSuccessMessage, setQuickSuccessMessage] = useState<string | null>(null);

    const categoryOptions = useMemo(
        () =>
            categoryList.map((cat) => ({
                value: String(cat.id),
                label: cat.name,
            })),
        [categoryList],
    );

    const selectedCategory = useMemo(
        () => categoryList.find((cat) => String(cat.id) === String(data.expense_category_id)),
        [categoryList, data.expense_category_id],
    );

    const mergedErrors = useMemo(() => {
        const result: Record<string, string> = {};
        const serverRecord = (errors ?? {}) as Record<string, string>;
        for (const [key, val] of Object.entries(serverRecord)) {
            if (val) result[key] = val;
        }
        for (const [key, val] of Object.entries(clientErrors)) {
            if (val) result[key] = val;
        }
        return result;
    }, [clientErrors, errors]);

    const errorFieldLinks: Array<{ key: string; anchor: string; label: string; message: string }> = [
        { key: 'expense_category_id', anchor: '#expense_category_id', label: 'Kategori pengeluaran', message: mergedErrors.expense_category_id ?? '' },
        { key: 'expense_date', anchor: '#expense_date', label: 'Tanggal pengeluaran', message: mergedErrors.expense_date ?? '' },
        { key: 'amount', anchor: '#expense_amount', label: 'Nominal', message: mergedErrors.amount ?? '' },
        { key: 'description', anchor: '#description', label: 'Keterangan', message: mergedErrors.description ?? '' },
        { key: 'idempotency_key', anchor: '#expense-form-top', label: 'Kunci pengiriman', message: mergedErrors.idempotency_key ?? '' },
    ].filter((item) => item.message !== '');

    const clearFieldError = (field: 'expense_category_id' | 'expense_date' | 'amount' | 'description') => {
        clearErrors(field);
        setClientErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current || processing) return;

        const nextClientErrors: Record<string, string> = {};
        if (!data.expense_category_id) {
            nextClientErrors.expense_category_id = 'Pilih kategori pengeluaran terlebih dahulu.';
        }
        if (!data.expense_date) {
            nextClientErrors.expense_date = 'Tanggal pengeluaran wajib diisi.';
        }
        if (data.amount === null || data.amount <= 0) {
            nextClientErrors.amount = 'Nominal pengeluaran wajib lebih dari Rp0.';
        }
        if (data.description.trim().length < 3) {
            nextClientErrors.description = 'Keterangan pengeluaran minimal 3 karakter.';
        }

        if (Object.keys(nextClientErrors).length > 0) {
            setClientErrors(nextClientErrors);
            return;
        }

        setClientErrors({});
        submitLockRef.current = true;

        post('/ui-expenses', {
            preserveScroll: true,
            onFinish: () => {
                submitLockRef.current = false;
            },
        });
    };

    const openQuickCategoryModal = () => {
        setQuickName('');
        setQuickError(null);
        setQuickModalOpen(true);
    };

    const handleQuickCategorySubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSavingQuickCategory) return;

        const trimmed = quickName.trim();
        if (trimmed.length < 2) {
            setQuickError('Nama kategori minimal 2 karakter.');
            return;
        }

        setIsSavingQuickCategory(true);
        setQuickError(null);

        const metaToken =
            typeof document !== 'undefined'
                ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
                : undefined;
        const token = csrf_token || metaToken;

        try {
            const response = await fetch('/ui-expense-categories', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({ name: trimmed }),
            });

            const body = (await response.json().catch(() => ({}))) as {
                category?: CategoryOption;
                message?: string;
                errors?: Record<string, string[]>;
            };

            if (response.status === 422 && body.errors?.name?.length) {
                setQuickError(body.errors.name[0]);
                return;
            }

            if (!response.ok || !body.category) {
                setQuickError(body.message ?? 'Gagal menambahkan kategori baru. Silakan coba lagi.');
                return;
            }

            const created = body.category;
            setCategoryList((prev) =>
                [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'id')),
            );
            setData('expense_category_id', String(created.id));
            clearFieldError('expense_category_id');
            setQuickSuccessMessage(`Kategori "${created.name}" berhasil ditambahkan dan langsung dipilih.`);
            setQuickModalOpen(false);
        } catch {
            setQuickError('Koneksi terputus saat menyimpan kategori baru.');
        } finally {
            setIsSavingQuickCategory(false);
        }
    };

    return (
        <AppLayout title="Catat Pengeluaran">
            <Head title="Catat Pengeluaran" />

            <div id="expense-form-top" className="pb-24 lg:pb-0">
                <div className="mb-5">
                    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
                        <Link href="/ui-expenses">
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            Kembali ke daftar pengeluaran
                        </Link>
                    </Button>
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Catat Pengeluaran
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Simpan belanja bahan bunga, perlengkapan toko, atau biaya kurir operasional.
                    </p>
                </div>

                {/* Courier vs Customer Shipping Disclaimer */}
                <div className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-[#E3DED4] bg-[#F1EDE6] p-3.5 text-sm text-[#1E2420]">
                    <Info className="mt-0.5 size-4 shrink-0 text-[#143326]" aria-hidden="true" />
                    <p>
                        <strong className="font-bold">Catatan Pembukuan:</strong> Catat biaya kurir yang dibayar toko atau belanja operasional di sini. Ongkos kirim yang ditagihkan ke pelanggan dicatat di formulir pesanan agar tidak terhitung ganda.
                    </p>
                </div>

                {quickSuccessMessage && (
                    <div
                        role="status"
                        className="mb-4 flex items-center gap-2 rounded-md border border-[#166534]/30 bg-[#DCFCE7] px-3.5 py-2.5 text-sm font-medium text-[#166534]"
                    >
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                        <span>{quickSuccessMessage}</span>
                    </div>
                )}

                {errorFieldLinks.length > 0 && (
                    <div
                        role="alert"
                        className="mb-5 rounded-[10px] border border-[#991B1B]/40 bg-[#FEE2E2] p-4 text-sm text-[#991B1B]"
                    >
                        <div className="flex items-start gap-2.5">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <div>
                                <p className="font-bold">Periksa kembali data pengeluaran sebelum menyimpan:</p>
                                <ul className="mt-1.5 list-inside list-disc space-y-1">
                                    {errorFieldLinks.map((item) => (
                                        <li key={item.key}>
                                            <a href={item.anchor} className="font-semibold underline hover:no-underline">
                                                {item.label}:
                                            </a>{' '}
                                            {item.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,1fr)]"
                >
                    {/* Main Form */}
                    <Card className="space-y-5 border-[#E3DED4] p-4 sm:p-6">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label
                                    htmlFor="expense_category_id"
                                    className="text-sm font-semibold text-[#1E2420]"
                                >
                                    Kategori Pengeluaran <span className="text-[#991B1B]">*</span>
                                </label>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={openQuickCategoryModal}
                                >
                                    <Plus className="size-4" aria-hidden="true" />
                                    Kategori Baru
                                </Button>
                            </div>

                            {categoryList.length === 0 ? (
                                <div className="rounded-md border border-[#92400E]/30 bg-[#FEF3C7] p-3 text-sm text-[#92400E]">
                                    Belum ada kategori aktif. Klik tombol <strong>+ Kategori Baru</strong> di atas atau buka menu Kategori Biaya untuk menambah kategori.
                                </div>
                            ) : (
                                <>
                                    <SearchableSelect
                                        id="expense_category_id"
                                        options={categoryOptions}
                                        value={data.expense_category_id}
                                        onChange={(val) => {
                                            setData('expense_category_id', val ? String(val) : '');
                                            clearFieldError('expense_category_id');
                                        }}
                                        placeholder="Pilih kategori pengeluaran..."
                                        emptyText="Kategori tidak ditemukan."
                                        invalid={Boolean(mergedErrors.expense_category_id)}
                                        describedBy={
                                            mergedErrors.expense_category_id
                                                ? 'expense_category_id-error'
                                                : 'expense_category_id-hint'
                                        }
                                        footerAction={
                                            <button
                                                type="button"
                                                onClick={openQuickCategoryModal}
                                                className="flex min-h-[44px] w-full items-center gap-1.5 rounded-md px-2 text-xs font-bold text-[#143326] hover:bg-[#E6EFEA]"
                                            >
                                                <Plus className="size-4" aria-hidden="true" />
                                                Tambah kategori baru sekarang
                                            </button>
                                        }
                                    />
                                    <p id="expense_category_id-hint" className="text-xs text-[#525B54]">
                                        Pilih kategori yang sesuai agar rekap biaya bulanan tetap akurat.
                                    </p>
                                </>
                            )}

                            {mergedErrors.expense_category_id && (
                                <p
                                    id="expense_category_id-error"
                                    className="text-xs font-medium text-[#991B1B]"
                                >
                                    {mergedErrors.expense_category_id}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <FormField
                                id="expense_date"
                                label="Tanggal pengeluaran"
                                required
                                hint="Tanggal default mengikuti waktu WIB (Asia/Jakarta)."
                                error={mergedErrors.expense_date}
                            >
                                <Input
                                    id="expense_date"
                                    type="date"
                                    value={data.expense_date}
                                    onChange={(e) => {
                                        setData('expense_date', e.target.value);
                                        clearFieldError('expense_date');
                                    }}
                                    invalid={Boolean(mergedErrors.expense_date)}
                                    aria-describedby={
                                        mergedErrors.expense_date ? 'expense_date-error' : 'expense_date-hint'
                                    }
                                    required
                                />
                            </FormField>

                            <FormField
                                id="expense_amount"
                                label="Nominal (Rp)"
                                required
                                hint="Masukkan bilangan bulat tanpa tanda koma atau desimal."
                                error={mergedErrors.amount}
                            >
                                <CurrencyInput
                                    id="expense_amount"
                                    value={data.amount}
                                    onChange={(val) => {
                                        setData('amount', val);
                                        clearFieldError('amount');
                                    }}
                                    placeholder="Contoh: 150.000"
                                    invalid={Boolean(mergedErrors.amount)}
                                    describedBy={
                                        mergedErrors.amount ? 'expense_amount-error' : 'expense_amount-hint'
                                    }
                                    required
                                />
                            </FormField>
                        </div>

                        <FormField
                            id="description"
                            label="Keterangan pengeluaran"
                            required
                            hint="Sebutkan barang atau tujuan belanja secara jelas (minimal 3 karakter)."
                            error={mergedErrors.description}
                        >
                            <Textarea
                                id="description"
                                rows={3}
                                minLength={3}
                                maxLength={1000}
                                value={data.description}
                                onChange={(e) => {
                                    setData('description', e.target.value);
                                    clearFieldError('description');
                                }}
                                placeholder="Misal: Beli mawar merah segar 2 ikat di Rawa Belong dan pita satin"
                                invalid={Boolean(mergedErrors.description)}
                                aria-describedby={
                                    mergedErrors.description ? 'description-error' : 'description-hint'
                                }
                                required
                            />
                        </FormField>
                    </Card>

                    {/* Right Sticky Summary */}
                    <Card className="space-y-4 border-[#E3DED4] bg-[#FAF8F4] p-4 sm:p-5 lg:sticky lg:top-6">
                        <h2 className="text-base font-bold text-[#1E2420]">
                            Ringkasan Catatan
                        </h2>

                        <dl className="space-y-2.5 border-y border-[#E3DED4] py-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                                <dt className="text-[#525B54]">Kategori</dt>
                                <dd className="text-right font-semibold text-[#1E2420]">
                                    {selectedCategory ? selectedCategory.name : 'Belum dipilih'}
                                </dd>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <dt className="text-[#525B54]">Tanggal</dt>
                                <dd className="text-right font-semibold text-[#1E2420] tabular-nums">
                                    {data.expense_date ? formatDateWib(data.expense_date) : '-'}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                                <dt className="text-[#525B54]">Nominal</dt>
                                <dd className="text-right text-lg font-bold text-[#143326] tabular-nums">
                                    {data.amount ? formatRupiah(data.amount) : 'Rp0'}
                                </dd>
                            </div>
                        </dl>

                        <p className="text-xs text-[#525B54]">
                            Setelah disimpan, catatan berstatus Tercatat. Jika salah input, koreksi dilakukan melalui tombol Batalkan dengan alasan wajib.
                        </p>

                        <div className="flex flex-col gap-2 pt-1">
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={processing || categoryList.length === 0}
                                className="w-full"
                            >
                                <Save className="size-4" aria-hidden="true" />
                                {processing ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                            </Button>
                            <Button asChild variant="secondary" className="w-full">
                                <Link href="/ui-expenses">Batal</Link>
                            </Button>
                        </div>
                    </Card>
                </form>
            </div>

            {/* Quick-Create Expense Category Modal */}
            <Modal
                open={quickModalOpen}
                onClose={() => !isSavingQuickCategory && setQuickModalOpen(false)}
                isSubmitting={isSavingQuickCategory}
                title="Tambah Kategori Pengeluaran"
                description="Kategori baru langsung aktif dan dipilih pada form pengeluaran ini tanpa menghapus isian Anda."
            >
                <form onSubmit={handleQuickCategorySubmit} noValidate className="space-y-4">
                    <FormField
                        id="quick-category-name"
                        label="Nama kategori baru"
                        required
                        hint="Contoh: Bunga Segar, Perlengkapan Pita, Bensin Kurir."
                        error={quickError ?? undefined}
                    >
                        <Input
                            id="quick-category-name"
                            data-modal-initial="true"
                            type="text"
                            minLength={2}
                            maxLength={100}
                            required
                            value={quickName}
                            onChange={(e) => {
                                setQuickName(e.target.value);
                                setQuickError(null);
                            }}
                            placeholder="Masukkan nama kategori..."
                            invalid={Boolean(quickError)}
                            aria-describedby={quickError ? 'quick-category-name-error' : 'quick-category-name-hint'}
                        />
                    </FormField>

                    <div className="flex flex-col-reverse gap-2 border-t border-[#E3DED4] pt-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={isSavingQuickCategory}
                            onClick={() => setQuickModalOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSavingQuickCategory || quickName.trim().length < 2}
                        >
                            {isSavingQuickCategory ? 'Menyimpan...' : 'Simpan Kategori'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
