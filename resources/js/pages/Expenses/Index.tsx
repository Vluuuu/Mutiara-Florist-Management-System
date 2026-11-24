import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    FolderCog,
    Plus,
    ReceiptText,
    Search,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { DataListSkeleton } from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { useScopedFilterLoading } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    ExpenseCategoryItem,
    ExpenseFilters,
    ExpenseItem,
    PaginatedData,
} from '@/types';

type ExpensesIndexProps = {
    expenses?: PaginatedData<ExpenseItem>;
    postedTotal?: number;
    categories?: ExpenseCategoryItem[];
    filters?: Partial<ExpenseFilters>;
};

export default function ExpensesIndex({
    expenses,
    postedTotal = 0,
    categories = [],
    filters = {},
}: ExpensesIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
    const isLoading = useScopedFilterLoading('/ui-expenses');
    useInstantPageGuard(Boolean(expenses));
    const [q, setQ] = useState(filters.q ?? '');
    const [categoryId, setCategoryId] = useState(
        filters.category_id ? String(filters.category_id) : '',
    );
    const [status, setStatus] = useState(filters.status ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const [voidTarget, setVoidTarget] = useState<ExpenseItem | null>(null);
    const voidLockRef = useRef(false);
    const {
        data: voidData,
        setData: setVoidData,
        post: postVoid,
        processing: voidProcessing,
        errors: voidErrors,
        reset: resetVoid,
        clearErrors: clearVoidErrors,
    } = useForm({
        void_reason: '',
    });

    useEffect(() => {
        setQ(filters.q ?? '');
        setCategoryId(filters.category_id ? String(filters.category_id) : '');
        setStatus(filters.status ?? '');
        setFrom(filters.from ?? '');
        setTo(filters.to ?? '');
    }, [filters.q, filters.category_id, filters.status, filters.from, filters.to]);

    const isFiltered = Boolean(
        filters.q || filters.category_id || filters.status || filters.from || filters.to,
    );

    const handleFilter = (e: FormEvent) => {
        e.preventDefault();
        const query: Record<string, string> = {};
        if (q.trim()) query.q = q.trim();
        if (categoryId) query.category_id = categoryId;
        if (status) query.status = status;
        if (from) query.from = from;
        if (to) query.to = to;

        router.get('/ui-expenses', query, {
            only: ['expenses', 'postedTotal', 'filters'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleReset = () => {
        setQ('');
        setCategoryId('');
        setStatus('');
        setFrom('');
        setTo('');
        router.get('/ui-expenses', {}, {
            only: ['expenses', 'postedTotal', 'filters'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const openVoidModal = (expense: ExpenseItem) => {
        resetVoid();
        clearVoidErrors();
        voidLockRef.current = false;
        setVoidTarget(expense);
    };

    const closeVoidModal = () => {
        if (voidProcessing) return;
        setVoidTarget(null);
        resetVoid();
        clearVoidErrors();
        voidLockRef.current = false;
    };

    const trimmedVoidReasonLength = voidData.void_reason.trim().length;

    const submitVoid = (e: FormEvent) => {
        e.preventDefault();
        if (!voidTarget || voidLockRef.current || voidProcessing || trimmedVoidReasonLength < 10) {
            return;
        }
        voidLockRef.current = true;
        postVoid(`/ui-expenses/${voidTarget.id}/void`, {
            preserveScroll: true,
            onSuccess: () => {
                setVoidTarget(null);
                resetVoid();
            },
            onFinish: () => {
                voidLockRef.current = false;
            },
        });
    };

    const filterError =
        errors?.to ?? errors?.from ?? errors?.q ?? errors?.category_id ?? errors?.status;

    const columns: DataColumn<ExpenseItem>[] = [
        {
            key: 'expense_date',
            header: 'Tanggal',
            cellClassName: 'whitespace-nowrap text-[var(--text-primary)] tabular-nums',
            render: (exp) => exp.expense_date,
        },
        {
            key: 'category',
            header: 'Kategori',
            cellClassName: 'font-semibold text-[var(--text-primary)]',
            render: (exp) => exp.category?.name ?? 'Kategori tidak tersedia',
        },
        {
            key: 'description',
            header: 'Keterangan',
            render: (exp) => (
                <div className="max-w-sm">
                    <p className="whitespace-pre-wrap break-words font-medium text-[var(--text-primary)]">
                        {exp.description}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                        Dicatat oleh {exp.recorded_by_user?.name ?? 'Operator'}
                    </p>
                    {exp.status === 'VOIDED' && exp.void_reason && (
                        <div className="mt-2 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2.5 text-[13px] text-[var(--text-primary)]">
                            <span className="font-bold">Alasan pembatalan:</span> {exp.void_reason}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'amount',
            header: 'Nominal',
            align: 'right',
            cellClassName: 'whitespace-nowrap tabular-nums',
            render: (exp) => (
                <span
                    className={cn(
                        'font-bold',
                        exp.status === 'VOIDED'
                            ? 'text-[var(--text-secondary)] line-through'
                            : 'text-[var(--expense-ink)]',
                    )}
                >
                    {formatRupiah(exp.amount)}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cellClassName: 'whitespace-nowrap',
            render: (exp) => {
                const isPosted = exp.status === 'POSTED';
                return (
                    <Badge tone={isPosted ? 'paid' : 'neutral'}>
                        {isPosted ? 'Tercatat' : 'Dibatalkan'}
                    </Badge>
                );
            },
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (exp) =>
                exp.status === 'POSTED' ? (
                    <Button
                        type="button"
                        variant="subtle"
                        size="sm"
                        className="border-[var(--status-danger-border)] text-[var(--danger-ink)] hover:bg-[var(--status-danger-bg)]"
                        onClick={() => openVoidModal(exp)}
                    >
                        Batalkan
                    </Button>
                ) : (
                    <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                        {exp.voided_at ?? 'Dibatalkan'}
                    </span>
                ),
        },
    ];

    if (!expenses) {
        return (
            <>
                <Head title="Pengeluaran" />
                <DataListSkeleton title="Pengeluaran Toko" rows={6} showFilters />
            </>
        );
    }

    return (
        <>
            <Head title="Pengeluaran" />

            <PageHeader
                title="Pengeluaran Toko"
                actions={
                    <>
                        <Button asChild variant="secondary" className="min-w-[164px]">
                            <Link
                                href="/ui-expense-categories"
                                component="ExpenseCategories/Index"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['expense-categories', 'expenses']}
                            >
                                <FolderCog className="size-4" aria-hidden="true" />
                                Kategori Biaya
                            </Link>
                        </Button>
                        <Button asChild variant="primary" className="min-w-[176px]">
                            <Link
                                href="/ui-expenses/create"
                                component="Expenses/Create"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['expense-categories', 'expenses']}
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                Catat Pengeluaran
                            </Link>
                        </Button>
                    </>
                }
            />

            {/* Ringkasan Pengeluaran (AUD-10: menggunakan warna semantik ochre #8F4B1E, bukan hijau kas masuk) */}
            <section
                aria-label="Ringkasan total pengeluaran"
                className="atelier-sheet mb-6 flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
            >
                <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--text-secondary)]">
                        Total Pengeluaran Sah {isFiltered ? '(Filter Aktif)' : ''}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-[var(--expense-ink)] tabular-nums sm:text-[26px]">
                        {formatRupiah(postedTotal)}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)] tabular-nums">
                        {formatAmount(expenses.total)} catatan biaya dalam tampilan ini (catatan dibatalkan dikecualikan dari total)
                    </p>
                </div>
                <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--expense-soft)] text-[var(--expense-ink)]"
                >
                    <ReceiptText className="size-5" />
                </span>
            </section>

            {filterError && (
                <AlertBanner tone="error" className="mb-5">
                    {filterError}
                </AlertBanner>
            )}

            <Card className="overflow-hidden">
                {/* Filters */}
                <form
                    onSubmit={handleFilter}
                    className="grid grid-cols-1 gap-3.5 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-6"
                >
                    <div className="sm:col-span-2">
                        <label
                            htmlFor="filter-q"
                            className="mb-1.5 block text-[13px] font-bold text-[var(--text-secondary)]"
                        >
                            Cari Keterangan
                        </label>
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--text-secondary)]"
                                aria-hidden="true"
                            />
                            <Input
                                id="filter-q"
                                type="search"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Misal: bensin kurir, pita..."
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="filter-category"
                            className="mb-1.5 block text-[13px] font-bold text-[var(--text-secondary)]"
                        >
                            Kategori
                        </label>
                        <Select
                            id="filter-category"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                        >
                            <option value="">Semua kategori</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </Select>
                    </div>

                    <div>
                        <label
                            htmlFor="filter-status"
                            className="mb-1.5 block text-[13px] font-bold text-[var(--text-secondary)]"
                        >
                            Status
                        </label>
                        <Select
                            id="filter-status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="">Semua status</option>
                            <option value="POSTED">Tercatat</option>
                            <option value="VOIDED">Dibatalkan</option>
                        </Select>
                    </div>

                    <div>
                        <label
                            htmlFor="filter-from"
                            className="mb-1.5 block text-[13px] font-bold text-[var(--text-secondary)]"
                        >
                            Dari Tanggal
                        </label>
                        <Input
                            id="filter-from"
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            invalid={Boolean(errors?.from)}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="filter-to"
                            className="mb-1.5 block text-[13px] font-bold text-[var(--text-secondary)]"
                        >
                            Sampai Tanggal
                        </label>
                        <Input
                            id="filter-to"
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            invalid={Boolean(errors?.to)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1 sm:col-span-2 lg:col-span-6">
                        <Button type="submit" variant="primary" disabled={isLoading} className="min-w-[152px]">
                            Terapkan Filter
                        </Button>
                        {isFiltered && (
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={isLoading}
                                onClick={handleReset}
                                className="min-w-[152px]"
                            >
                                Reset Filter
                            </Button>
                        )}
                    </div>
                </form>

                {isLoading && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-4 py-2 text-xs font-semibold text-[var(--brand-primary)]"
                    >
                        Memuat data pengeluaran...
                    </div>
                )}

                <div className="p-4 lg:p-0">
                    <ResponsiveDataList
                        items={expenses.data}
                        columns={columns}
                        keyExtractor={(exp) => exp.id}
                        tabletColumns={2}
                        tableAriaLabel="Daftar pengeluaran toko"
                        rowClassName={(exp) =>
                            exp.status === 'VOIDED' ? 'bg-[var(--bg-sunken)]/40' : undefined
                        }
                        emptyState={
                            <EmptyState
                                icon={ReceiptText}
                                title={
                                    isFiltered
                                        ? 'Tidak ada pengeluaran yang cocok'
                                        : 'Belum ada pengeluaran tercatat'
                                }
                                description={
                                    isFiltered
                                        ? 'Ubah rentang tanggal, kategori, atau kata kunci untuk melihat catatan lainnya.'
                                        : 'Catat pengeluaran operasional pertama Anda melalui tombol di bawah ini.'
                                }
                                action={
                                    isFiltered ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleReset}
                                        >
                                            Tampilkan Semua Pengeluaran
                                        </Button>
                                    ) : (
                                        <Button asChild variant="primary">
                                            <Link
                                                href="/ui-expenses/create"
                                                component="Expenses/Create"
                                                prefetch="hover"
                                                cacheFor="10s"
                                                cacheTags={['expense-categories', 'expenses']}
                                            >
                                                <Plus className="size-4" aria-hidden="true" />
                                                Catat Pengeluaran
                                            </Link>
                                        </Button>
                                    )
                                }
                            />
                        }
                        renderMobileCard={(exp) => {
                            const isPosted = exp.status === 'POSTED';
                            return (
                                <article className="atelier-sheet flex flex-col p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[13px] font-bold text-[var(--text-secondary)] tabular-nums">
                                            {exp.expense_date}
                                        </span>
                                        <Badge tone={isPosted ? 'paid' : 'neutral'}>
                                            {isPosted ? 'Tercatat' : 'Dibatalkan'}
                                        </Badge>
                                    </div>

                                    <div className="mt-2 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-bold text-[var(--brand-primary)]">
                                                {exp.category?.name ?? 'Kategori tidak tersedia'}
                                            </p>
                                            <p className="mt-0.5 break-words text-[15px] font-semibold text-[var(--text-primary)]">
                                                {exp.description}
                                            </p>
                                            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                                                Oleh {exp.recorded_by_user?.name ?? 'Operator'}
                                            </p>
                                        </div>
                                        <span
                                            className={cn(
                                                'shrink-0 text-base font-bold tabular-nums',
                                                isPosted
                                                    ? 'text-[var(--expense-ink)]'
                                                    : 'text-[var(--text-secondary)] line-through',
                                            )}
                                        >
                                            {formatRupiah(exp.amount)}
                                        </span>
                                    </div>

                                    {!isPosted && exp.void_reason && (
                                        <div className="mt-2.5 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3 text-[13px] text-[var(--text-primary)]">
                                            <span className="font-bold">Alasan pembatalan:</span>{' '}
                                            {exp.void_reason}
                                            {exp.voided_at ? ` (${exp.voided_at})` : ''}
                                        </div>
                                    )}

                                    {isPosted && (
                                        <div className="mt-auto pt-3">
                                            <div className="border-t border-[var(--border-hairline)] pt-3">
                                                <Button
                                                    type="button"
                                                    variant="subtle"
                                                    className="w-full border-[var(--status-danger-border)] text-[var(--danger-ink)] hover:bg-[var(--status-danger-bg)]"
                                                    onClick={() => openVoidModal(exp)}
                                                >
                                                    Batalkan Catatan
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        }}
                    />
                </div>

                {expenses.total > 0 && (
                    <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)]/45 px-4 py-3.5 sm:px-5">
                        <Pagination
                            links={expenses.links}
                            from={expenses.from}
                            to={expenses.to}
                            total={expenses.total}
                            itemLabel="pengeluaran"
                            only={['expenses', 'postedTotal', 'filters']}
                        />
                    </div>
                )}
            </Card>

            {/* Shared Accessible Void Modal */}
            <Modal
                open={Boolean(voidTarget)}
                onClose={closeVoidModal}
                isSubmitting={voidProcessing}
                title="Batalkan Catatan Pengeluaran"
                description={
                    voidTarget
                        ? `${voidTarget.category?.name ?? 'Kategori tidak tersedia'} · ${voidTarget.expense_date}`
                        : undefined
                }
            >
                {voidTarget && (
                    <form onSubmit={submitVoid} noValidate className="space-y-4">
                        <div className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3.5 text-sm">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[13px] font-bold text-[var(--text-secondary)]">
                                    Nominal dicatat
                                </span>
                                <span className="text-lg font-bold text-[var(--expense-ink)] tabular-nums">
                                    {formatRupiah(voidTarget.amount)}
                                </span>
                            </div>
                            <p className="mt-1.5 break-words text-[13px] text-[var(--text-primary)]">
                                {voidTarget.description}
                            </p>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-[8px] border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] p-3.5 text-[13px] font-medium text-[var(--status-warn-fg)]">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span>
                                Pembatalan hanya mencatat koreksi administratif dan tidak otomatis mengembalikan uang fisik.
                            </span>
                        </div>

                        <FormField
                            id="void_reason"
                            label="Alasan pembatalan"
                            required
                            hint={`Minimal 10 karakter (${trimmedVoidReasonLength}/10).`}
                            error={voidErrors.void_reason}
                        >
                            <Textarea
                                id="void_reason"
                                data-modal-initial="true"
                                rows={3}
                                minLength={10}
                                maxLength={1000}
                                required
                                value={voidData.void_reason}
                                onChange={(e) => setVoidData('void_reason', e.target.value)}
                                placeholder="Misal: Salah input nominal pembelian pita, seharusnya Rp50.000"
                                invalid={Boolean(voidErrors.void_reason)}
                                aria-describedby={voidErrors.void_reason ? 'void_reason-error' : 'void_reason-hint'}
                            />
                        </FormField>

                        <div className="flex flex-col-reverse gap-2.5 border-t border-[var(--border-hairline)] pt-4 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={voidProcessing}
                                onClick={closeVoidModal}
                                className="w-full sm:w-auto sm:min-w-[120px]"
                            >
                                Tutup
                            </Button>
                            <Button
                                type="submit"
                                variant="danger"
                                disabled={voidProcessing || trimmedVoidReasonLength < 10}
                                className="w-full sm:w-auto sm:min-w-[180px]"
                            >
                                {voidProcessing ? 'Membatalkan...' : 'Konfirmasi Pembatalan'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </>
    );
}
