import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Info,
    Plus,
    Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { FormField, Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { FormCardSkeleton } from '@/components/ui/page-skeleton';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { invalidateNavigationCache, useUnsavedChangesGuard } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatDateWib, formatRupiah, getWibTodayIso } from '@/lib/format';
import type { AppPageProps } from '@/types';

type CategoryOption = {
    id: number;
    name: string;
};

type ExpensesCreateProps = {
    categories?: CategoryOption[];
    newExpenseKey?: string;
    todayIso?: string;
};

export default function ExpensesCreate({
    categories,
    newExpenseKey,
    todayIso,
}: ExpensesCreateProps) {
    const { csrf_token } = usePage<AppPageProps>().props;
    const hasCoreData = Boolean(categories && newExpenseKey);
    useInstantPageGuard(hasCoreData);
    const defaultDate = todayIso || getWibTodayIso();

    const [categoryList, setCategoryList] = useState<CategoryOption[]>(() =>
        categories ? [...categories].sort((a, b) => a.name.localeCompare(b.name, 'id')) : [],
    );

    useEffect(() => {
        if (categories) {
            setCategoryList([...categories].sort((a, b) => a.name.localeCompare(b.name, 'id')));
        }
    }, [categories]);

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
        idempotency_key: newExpenseKey ?? '',
    });

    useEffect(() => {
        if (newExpenseKey) {
            setData('idempotency_key', newExpenseKey);
        }
    }, [newExpenseKey]);

    const isDirty =
        hasCoreData &&
        !processing &&
        (data.expense_category_id !== '' ||
            data.expense_date !== defaultDate ||
            data.amount !== null ||
            data.description.trim() !== '');
    useUnsavedChangesGuard(isDirty);

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
            invalidateNavigationCache();
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

    if (!hasCoreData) {
        return (
            <>
                <Head title="Catat Pengeluaran" />
                <FormCardSkeleton fields={4} />
            </>
        );
    }

    return (
        <>
            <Head title="Catat Pengeluaran" />

            <div id="expense-form-top" className="pb-24 lg:pb-0">
                <div className="mb-6 border-b border-[#DED6C8] pb-4">
                    <Link
                        href="/ui-expenses"
                        component="Expenses/Index"
                        prefetch="hover"
                        cacheFor="10s"
                        cacheTags={['expenses']}
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#1D3B2A] hover:underline"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Kembali ke daftar pengeluaran
                    </Link>
                    <h1 className="atelier-h1 mt-2">
                        Catat Pengeluaran
                    </h1>
                </div>

                {/* Courier vs Customer Shipping Disclaimer */}
                <div className="mb-6 flex items-start gap-2.5 rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] p-4 text-sm text-[#1C211E]">
                    <Info className="mt-0.5 size-4 shrink-0 text-[#1D3B2A]" aria-hidden="true" />
                    <p>
                        Catat biaya kurir toko atau belanja bahan di sini. Ongkir tagihan pelanggan dicatat di formulir pesanan.
                    </p>
                </div>

                {quickSuccessMessage && (
                    <div
                        role="status"
                        className="mb-5 flex items-center gap-2 rounded-[8px] border border-[#B8D0C0] bg-[#EEF5F0] px-4 py-3 text-sm font-medium text-[#164B2A]"
                    >
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                        <span>{quickSuccessMessage}</span>
                    </div>
                )}

                {errorFieldLinks.length > 0 && (
                    <div
                        role="alert"
                        className="mb-5 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-sm text-[#8A2619]"
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
                    className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]"
                >
                    {/* Main Form */}
                    <Card className="space-y-5 p-5 sm:p-6">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label
                                    htmlFor="expense_category_id"
                                    className="text-sm font-semibold text-[#1C211E]"
                                >
                                    Kategori Pengeluaran <span className="text-[#9A3B22]">*</span>
                                </label>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={openQuickCategoryModal}
                                    className="min-w-[144px]"
                                >
                                    <Plus className="size-4" aria-hidden="true" />
                                    Kategori Baru
                                </Button>
                            </div>

                            {categoryList.length === 0 ? (
                                <div className="rounded-[8px] border border-[#DFC393] bg-[#FAF1E1] p-3.5 text-sm text-[#6E3D09]">
                                    Belum ada kategori aktif. Klik tombol <strong>Kategori Baru</strong> di atas untuk menambah kategori.
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
                                                : undefined
                                        }
                                        footerAction={
                                            <button
                                                type="button"
                                                onClick={openQuickCategoryModal}
                                                className="flex min-h-[44px] w-full items-center gap-1.5 rounded-[6px] px-2 text-sm font-bold text-[#1D3B2A] hover:bg-[#EFE9DE]"
                                            >
                                                <Plus className="size-4" aria-hidden="true" />
                                                Tambah kategori baru sekarang
                                            </button>
                                        }
                                    />
                                </>
                            )}

                            {mergedErrors.expense_category_id && (
                                <p
                                    id="expense_category_id-error"
                                    className="text-[13px] font-semibold text-[#8A2619]"
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
                                        mergedErrors.expense_date ? 'expense_date-error' : undefined
                                    }
                                    required
                                />
                            </FormField>

                            <FormField
                                id="expense_amount"
                                label="Nominal (Rp)"
                                required
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
                                        mergedErrors.amount ? 'expense_amount-error' : undefined
                                    }
                                    required
                                />
                            </FormField>
                        </div>

                        <FormField
                            id="description"
                            label="Keterangan pengeluaran"
                            required
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
                                    mergedErrors.description ? 'description-error' : undefined
                                }
                                required
                            />
                        </FormField>
                    </Card>

                    {/* Right Sticky Summary */}
                    <Card className="space-y-4 bg-[#EFE9DE]/80 p-5 sm:p-6 lg:sticky lg:top-20">
                        <h2 className="atelier-h2">
                            Ringkasan Catatan
                        </h2>

                        <dl className="space-y-2.5 border-y border-[#DED6C8] py-3 text-[15px]">
                            <div className="flex items-start justify-between gap-2">
                                <dt className="text-[#545852]">Kategori</dt>
                                <dd className="text-right font-semibold text-[#1C211E]">
                                    {selectedCategory ? selectedCategory.name : 'Belum dipilih'}
                                </dd>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <dt className="text-[#545852]">Tanggal</dt>
                                <dd className="text-right font-semibold text-[#1C211E] tabular-nums">
                                    {data.expense_date ? formatDateWib(data.expense_date) : '-'}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                                <dt className="text-[#545852]">Nominal</dt>
                                <dd className="text-right text-xl font-bold text-[#1D3B2A] tabular-nums">
                                    {data.amount ? formatRupiah(data.amount) : 'Rp0'}
                                </dd>
                            </div>
                        </dl>

                        <div className="flex flex-col gap-2.5 pt-1">
                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={processing || categoryList.length === 0}
                                className="w-full"
                            >
                                <Save className="size-4" aria-hidden="true" />
                                {processing ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                            </Button>
                            <Button asChild variant="secondary" className="w-full">
                                <Link
                                    href="/ui-expenses"
                                    component="Expenses/Index"
                                    prefetch="hover"
                                    cacheFor="10s"
                                    cacheTags={['expenses']}
                                >
                                    Batal
                                </Link>
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

                    <div className="flex flex-col-reverse gap-2 border-t border-[#DED6C8] pt-4 sm:flex-row sm:justify-end">
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
        </>
    );
}
