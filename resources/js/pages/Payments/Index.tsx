import { useEffect, useState, type FormEvent } from 'react';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    History,
    Search,
    Wallet,
    X,
} from 'lucide-react';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { Pagination } from '@/components/pagination';
import { PaymentModal, type PaymentModalTarget } from '@/components/payment-modal';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Badge, getFulfillmentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
    DataListSkeleton,
    DeferredSectionError,
    ReceivablesSkeleton,
} from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { useNavigationState, useScopedFilterLoading } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatRupiah, getWibTodayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    PaginatedData,
    PaymentHistoryItem,
    ReceivableOrder,
} from '@/types';

type HistoryStatusFilter = '' | 'POSTED' | 'VOIDED';

type PaymentsIndexProps = {
    orders?: PaginatedData<ReceivableOrder>;
    outstanding?: number;
    paymentHistory?: PaginatedData<PaymentHistoryItem>;
    todayIso?: string;
    filters?: {
        q?: string;
        history_status?: string;
    };
};

const HISTORY_CHIPS: Array<{ key: HistoryStatusFilter; label: string }> = [
    { key: '', label: 'Semua' },
    { key: 'POSTED', label: 'Tercatat' },
    { key: 'VOIDED', label: 'Dibatalkan' },
];

function getReceivableStatusMeta(order: ReceivableOrder): {
    label: string;
    tone: 'danger' | 'warn' | 'paid';
} {
    if (order.outstanding <= 0) {
        return { label: 'Lunas', tone: 'paid' };
    }
    if (order.paid_amount > 0) {
        return { label: 'Dibayar Sebagian', tone: 'warn' };
    }
    return { label: 'Belum Lunas', tone: 'danger' };
}

export default function PaymentsIndex({
    orders,
    outstanding = 0,
    paymentHistory,
    todayIso,
    filters = {},
}: PaymentsIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
    const { deferredErrors } = useNavigationState();
    const isFilterLoading = useScopedFilterLoading('/ui-payments');
    useInstantPageGuard(Boolean(orders));
    const [search, setSearch] = useState(filters.q || '');
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const isLoading = isFilterLoading || isHistoryLoading;
    const [payTarget, setPayTarget] = useState<PaymentModalTarget | null>(null);

    const effectiveTodayIso = todayIso || getWibTodayIso();
    const activeHistoryStatus: HistoryStatusFilter =
        filters.history_status === 'POSTED' || filters.history_status === 'VOIDED'
            ? filters.history_status
            : '';

    useEffect(() => {
        setSearch(filters.q || '');
    }, [filters.q]);

    const visitPayments = (
        nextQ: string,
        nextHistoryStatus: HistoryStatusFilter,
        historyOnly = false,
    ) => {
        const params: Record<string, string> = {};
        if (nextQ.trim()) {
            params.q = nextQ.trim();
        }
        if (nextHistoryStatus !== '') {
            params.history_status = nextHistoryStatus;
        }

        if (historyOnly) {
            router.get('/ui-payments', params, {
                only: ['paymentHistory', 'filters'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setIsHistoryLoading(true),
                onFinish: () => setIsHistoryLoading(false),
            });
            return;
        }

        router.get('/ui-payments', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        visitPayments(search, activeHistoryStatus);
    };

    const handleClearSearch = () => {
        setSearch('');
        visitPayments('', activeHistoryStatus);
    };

    const openPaymentModal = (ord: ReceivableOrder) => {
        setPayTarget({
            id: ord.id,
            order_number: ord.order_number,
            customer_name: ord.customer_name,
            outstanding: ord.outstanding,
        });
    };

    const receivableColumns: DataColumn<ReceivableOrder>[] = [
        {
            key: 'order_number',
            header: 'No. Pesanan',
            headerClassName: 'px-3 whitespace-nowrap',
            cellClassName: 'px-3 whitespace-nowrap',
            render: (ord) => (
                <Link
                    href={`/ui-orders/${ord.id}`}
                    component="Orders/Show"
                    prefetch="hover"
                    cacheFor="10s"
                    cacheTags={['orders']}
                    className="inline-flex min-h-[44px] flex-col justify-center gap-0.5 hover:underline"
                >
                    <OrderCodeBadge orderNumber={ord.order_number} compact />
                    <span className="text-[13px] font-normal text-[var(--text-secondary)] tabular-nums">
                        Nota {ord.order_date}
                    </span>
                </Link>
            ),
        },
        {
            key: 'customer',
            header: 'Pelanggan',
            headerClassName: 'px-3 whitespace-nowrap',
            cellClassName: 'px-3',
            render: (ord) => (
                <span className="font-bold text-[var(--text-primary)]">{ord.customer_name}</span>
            ),
        },
        {
            key: 'fulfillment_status',
            header: 'Pengerjaan',
            headerClassName: 'px-3 whitespace-nowrap',
            cellClassName: 'px-3 whitespace-nowrap',
            render: (ord) => {
                const fulfill = getFulfillmentBadgeMeta(ord.status);
                return <Badge tone={fulfill.tone}>{fulfill.label}</Badge>;
            },
        },
        {
            key: 'payment_status',
            header: 'Pembayaran',
            headerClassName: 'px-3 whitespace-nowrap',
            cellClassName: 'px-3 whitespace-nowrap',
            render: (ord) => {
                const payMeta = getReceivableStatusMeta(ord);
                return <Badge tone={payMeta.tone}>{payMeta.label}</Badge>;
            },
        },
        {
            key: 'total_amount',
            header: 'Tagihan',
            align: 'right',
            headerClassName: 'px-3 whitespace-nowrap',
            cellClassName: 'px-3 whitespace-nowrap tabular-nums',
            render: (ord) => (
                <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                        {formatRupiah(ord.total_amount)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                        Masuk {formatRupiah(ord.paid_amount)}
                    </p>
                </div>
            ),
        },
        {
            key: 'outstanding',
            header: 'Sisa Tagihan',
            align: 'right',
            headerClassName: 'px-3 whitespace-nowrap',
            cellClassName: 'px-3 whitespace-nowrap font-bold text-[var(--brand-urgent)] tabular-nums',
            render: (ord) => formatRupiah(ord.outstanding),
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            headerClassName: 'px-3 whitespace-nowrap',
            cellClassName: 'px-3 whitespace-nowrap',
            render: (ord) => (
                <div className="inline-flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openPaymentModal(ord)}
                        className="min-w-[104px]"
                    >
                        Catat Bayar
                    </Button>
                    <Button asChild variant="subtle" size="sm" className="min-w-[76px]">
                        <Link
                            href={`/ui-orders/${ord.id}`}
                            component="Orders/Show"
                            prefetch="hover"
                            cacheFor="10s"
                            cacheTags={['orders']}
                        >
                            Detail
                        </Link>
                    </Button>
                </div>
            ),
        },
    ];

    const historyColumns: DataColumn<PaymentHistoryItem>[] = [
        {
            key: 'date',
            header: 'Tanggal',
            cellClassName: 'whitespace-nowrap',
            render: (item) => (
                <div className="tabular-nums">
                    <p className="font-semibold text-[var(--text-primary)]">{item.payment_date}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                        Oleh {item.recorded_by}
                    </p>
                </div>
            ),
        },
        {
            key: 'order',
            header: 'Pesanan & Pelanggan',
            render: (item) => (
                <div>
                    <Link
                        href={`/ui-orders/${item.order_id}`}
                        component="Orders/Show"
                        prefetch="hover"
                        cacheFor="10s"
                        cacheTags={['orders']}
                        className="inline-flex min-h-[44px] items-center whitespace-nowrap hover:underline"
                    >
                        <OrderCodeBadge orderNumber={item.order_number} compact />
                    </Link>
                    <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                        {item.customer_name}
                    </p>
                </div>
            ),
        },
        {
            key: 'method',
            header: 'Metode / Referensi',
            render: (item) => (
                <div>
                    <p className="font-medium text-[var(--text-primary)]">{item.method_label}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                        {item.reference ? item.reference : 'Tanpa nomor referensi'}
                    </p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status Catatan',
            render: (item) => {
                const isPosted = item.status === 'POSTED';
                return (
                    <div>
                        <Badge tone={isPosted ? 'paid' : 'neutral'}>
                            {isPosted ? 'Tercatat' : 'Dibatalkan'}
                        </Badge>
                        {!isPosted && item.void_reason && (
                            <p className="mt-1.5 max-w-xs text-[13px] text-[var(--text-secondary)]">
                                Alasan: {item.void_reason}
                                {item.voided_at ? ` (${item.voided_at})` : ''}
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'amount',
            header: 'Nominal',
            align: 'right',
            cellClassName: 'whitespace-nowrap tabular-nums',
            render: (item) => (
                <span
                    className={cn(
                        'font-bold',
                        item.status === 'VOIDED'
                            ? 'text-[var(--text-secondary)] line-through'
                            : 'text-[var(--text-primary)]',
                    )}
                >
                    {formatRupiah(item.amount)}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (item) => (
                <Button asChild variant="subtle" size="sm" className="min-w-[100px]">
                    <Link
                        href={`/ui-orders/${item.order_id}`}
                        component="Orders/Show"
                        prefetch="hover"
                        cacheFor="10s"
                        cacheTags={['orders']}
                    >
                        Lihat Nota
                    </Link>
                </Button>
            ),
        },
    ];

    const filterError = errors?.q ?? errors?.history_status ?? errors?.payment;

    if (!orders) {
        return (
            <>
                <Head title="Piutang & Pembayaran" />
                <DataListSkeleton title="Piutang & Pembayaran" rows={6} showFilters />
            </>
        );
    }

    return (
        <>
            <Head title="Piutang & Pembayaran" />

            <PageHeader
                title="Piutang & Pembayaran"
                actions={
                    <div className="atelier-sheet flex items-center justify-between gap-4 px-5 py-3.5 sm:min-w-[276px]">
                        <div>
                            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
                                Total Piutang Aktif
                            </p>
                            <p
                                className={cn(
                                    'mt-1 text-2xl font-bold tracking-[-0.02em] tabular-nums',
                                    outstanding > 0
                                        ? 'text-[var(--brand-urgent)]'
                                        : 'text-[var(--text-primary)]',
                                )}
                            >
                                {formatRupiah(outstanding)}
                            </p>
                            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                                {formatAmount(orders.total)} pesanan belum lunas
                            </p>
                        </div>
                        <span
                            aria-hidden="true"
                            className={cn(
                                'inline-flex size-9 shrink-0 items-center justify-center rounded-[9px]',
                                outstanding > 0
                                    ? 'bg-[var(--brand-urgent-soft)] text-[var(--brand-urgent)]'
                                    : 'bg-[var(--bg-sunken)] text-[var(--text-secondary)]',
                            )}
                        >
                            <Wallet className="size-4" />
                        </span>
                    </div>
                }
            />

            {filterError && (
                <AlertBanner tone="error" className="mb-5">
                    {filterError}
                </AlertBanner>
            )}

            {/* Primary Section: Receivables */}
            <Card className="mb-7 overflow-hidden">
                <div className="space-y-4 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 p-5 sm:p-6">
                    <h2 className="atelier-h2">Tagihan Belum Lunas</h2>

                    <form onSubmit={handleSearch} role="search">
                        <label
                            htmlFor="payments-search-q"
                            className="mb-2 block text-sm font-semibold text-[var(--text-primary)]"
                        >
                            Cari Nomor Nota atau Pelanggan
                        </label>
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--text-secondary)]"
                                    aria-hidden="true"
                                />
                                <Input
                                    id="payments-search-q"
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari no. nota atau nama..."
                                    className={search ? 'h-11 pl-10 pr-12' : 'h-11 pl-10'}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={handleClearSearch}
                                        aria-label="Hapus kata kunci pencarian"
                                        className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-[8px] text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
                                    >
                                        <X className="size-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2.5">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={isLoading}
                                    className="h-11 min-w-[116px] flex-1 sm:flex-none"
                                >
                                    {isLoading ? 'Mencari...' : 'Cari'}
                                </Button>
                                {Boolean(filters.q) && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleClearSearch}
                                        className="h-11 min-w-[116px] flex-1 sm:flex-none"
                                    >
                                        Reset
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {isLoading && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                        Memuat daftar piutang dan riwayat pembayaran...
                    </div>
                )}

                <div className="p-4 lg:p-0">
                    <ResponsiveDataList
                        items={orders.data}
                        columns={receivableColumns}
                        keyExtractor={(ord) => ord.id}
                        tabletColumns={2}
                        tableAriaLabel="Daftar tagihan belum lunas"
                        emptyState={
                            <EmptyState
                                icon={CheckCircle2}
                                iconTone="paid"
                                headingLevel="h3"
                                title={
                                    filters.q
                                        ? 'Tagihan tidak ditemukan'
                                        : 'Semua tagihan sudah lunas'
                                }
                                description={
                                    filters.q
                                        ? `Tidak ada tagihan terbuka untuk "${filters.q}".`
                                        : 'Belum ada pesanan dengan sisa piutang berjalan saat ini.'
                                }
                                action={
                                    filters.q ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleClearSearch}
                                            className="min-w-[164px]"
                                        >
                                            Tampilkan Semua Tagihan
                                        </Button>
                                    ) : undefined
                                }
                            />
                        }
                        renderMobileCard={(ord) => {
                            const payMeta = getReceivableStatusMeta(ord);
                            const fulfill = getFulfillmentBadgeMeta(ord.status);
                            return (
                                <article className="atelier-sheet flex flex-col gap-3 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <Link
                                                href={`/ui-orders/${ord.id}`}
                                                component="Orders/Show"
                                                prefetch="hover"
                                                cacheFor="10s"
                                                cacheTags={['orders']}
                                                className="inline-flex min-h-[44px] items-center text-base font-bold text-[var(--text-primary)] hover:underline"
                                            >
                                                {ord.customer_name}
                                            </Link>
                                            {/* AUD-05: Gunakan OrderCodeBadge compact yang konsisten dengan desktop */}
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                                                <OrderCodeBadge orderNumber={ord.order_number} compact />
                                                <span>· Nota {ord.order_date}</span>
                                            </div>
                                        </div>
                                        <Badge tone={payMeta.tone} className="mt-1 shrink-0">
                                            {payMeta.label}
                                        </Badge>
                                    </div>

                                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
                                        <div className="tabular-nums">
                                            <span className="block text-[12px] font-semibold text-[var(--text-secondary)]">
                                                Sisa Tagihan · {fulfill.label}
                                            </span>
                                            <strong className="text-lg font-bold text-[var(--brand-urgent)]">
                                                {formatRupiah(ord.outstanding)}
                                            </strong>
                                            <p className="text-[13px] text-[var(--text-secondary)]">
                                                Total {formatRupiah(ord.total_amount)} · Masuk{' '}
                                                {formatRupiah(ord.paid_amount)}
                                            </p>
                                        </div>

                                        <div className="flex w-full items-center gap-2 pt-1 sm:w-auto">
                                            <Button
                                                type="button"
                                                variant="primary"
                                                onClick={() => openPaymentModal(ord)}
                                                className="flex-1 sm:min-w-[128px] sm:flex-none"
                                            >
                                                Catat Bayar
                                            </Button>
                                            <Button asChild variant="subtle" className="min-w-[80px]">
                                                <Link
                                                    href={`/ui-orders/${ord.id}`}
                                                    component="Orders/Show"
                                                    prefetch="hover"
                                                    cacheFor="10s"
                                                    cacheTags={['orders']}
                                                >
                                                    Detail
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            );
                        }}
                    />
                </div>

                {orders.total > 0 && (
                    <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)]/45 px-5 py-4">
                        <Pagination
                            links={orders.links}
                            from={orders.from}
                            to={orders.to}
                            total={orders.total}
                            itemLabel="tagihan belum lunas"
                            only={['orders', 'outstanding', 'filters']}
                        />
                    </div>
                )}
            </Card>

            {/* Secondary Section: Read-Only Payment History (Deferred) */}
            <Deferred
                data="paymentHistory"
                fallback={
                    <Card className="overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 p-5 lg:p-6">
                            <History className="size-4 text-[var(--brand-primary)]" aria-hidden="true" />
                            <h2 className="atelier-h2">Riwayat Pembayaran Terakhir</h2>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-5">
                            {deferredErrors.paymentHistory ? (
                                <DeferredSectionError
                                    title="Riwayat pembayaran belum termuat"
                                    message={deferredErrors.paymentHistory}
                                    onRetry={() => router.reload({ only: ['paymentHistory'] })}
                                />
                            ) : (
                                <ReceivablesSkeleton />
                            )}
                        </div>
                    </Card>
                }
                rescue={({ reloading }) => (
                    <Card className="overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 p-5 lg:p-6">
                            <History className="size-4 text-[var(--brand-primary)]" aria-hidden="true" />
                            <h2 className="atelier-h2">Riwayat Pembayaran Terakhir</h2>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-5">
                            <DeferredSectionError
                                title="Riwayat pembayaran gagal dimuat"
                                reloading={reloading}
                                onRetry={() => router.reload({ only: ['paymentHistory'] })}
                            />
                        </div>
                    </Card>
                )}
            >
                {paymentHistory && (
                    <Card className="overflow-hidden">
                        <div className="flex flex-col gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
                            <div className="flex items-center gap-2">
                                <History className="size-4 text-[var(--brand-primary)]" aria-hidden="true" />
                                <h2 className="atelier-h2">Riwayat Pembayaran Terakhir</h2>
                            </div>

                            <SegmentedTabs<HistoryStatusFilter>
                                ariaLabel="Filter status riwayat pembayaran"
                                value={activeHistoryStatus}
                                disabled={isLoading}
                                onChange={(next) => visitPayments(search, next, true)}
                                options={HISTORY_CHIPS}
                            />
                        </div>

                        <div className="p-4 lg:p-0">
                            <ResponsiveDataList
                                items={paymentHistory.data}
                                columns={historyColumns}
                                keyExtractor={(item) => item.id}
                                tabletColumns={2}
                                tableAriaLabel="Riwayat transaksi pembayaran"
                                rowClassName={(item) =>
                                    item.status === 'VOIDED' ? 'bg-[var(--bg-sunken)]/40' : undefined
                                }
                                emptyState={
                                    <EmptyState
                                        icon={History}
                                        headingLevel="h3"
                                        title="Belum ada riwayat pembayaran"
                                        description="Belum ada transaksi pembayaran pada filter yang dipilih."
                                    />
                                }
                                renderMobileCard={(item) => {
                                    const isPosted = item.status === 'POSTED';
                                    return (
                                        <article className="atelier-sheet flex flex-col p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <Link
                                                    href={`/ui-orders/${item.order_id}`}
                                                    component="Orders/Show"
                                                    prefetch="hover"
                                                    cacheFor="10s"
                                                    cacheTags={['orders']}
                                                    className="inline-flex min-h-[44px] items-center hover:underline"
                                                >
                                                    <OrderCodeBadge orderNumber={item.order_number} compact />
                                                </Link>
                                                <Badge tone={isPosted ? 'paid' : 'neutral'}>
                                                    {isPosted ? 'Tercatat' : 'Dibatalkan'}
                                                </Badge>
                                            </div>

                                            <div className="mt-1 flex items-baseline justify-between gap-2">
                                                <p className="text-base font-bold text-[var(--text-primary)]">
                                                    {item.customer_name}
                                                </p>
                                                <span
                                                    className={cn(
                                                        'text-base font-bold tabular-nums',
                                                        isPosted
                                                            ? 'text-[var(--text-primary)]'
                                                            : 'text-[var(--text-secondary)] line-through',
                                                    )}
                                                >
                                                    {formatRupiah(item.amount)}
                                                </span>
                                            </div>

                                            <p className="mt-1 text-[13px] text-[var(--text-secondary)] tabular-nums">
                                                {item.payment_date} · {item.method_label}
                                                {item.reference ? ` · Ref: ${item.reference}` : ''}
                                            </p>
                                            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                                                Dicatat oleh {item.recorded_by}
                                            </p>

                                            {!isPosted && item.void_reason && (
                                                <div className="mt-2.5 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3 text-[13px] text-[var(--text-primary)]">
                                                    <span className="font-bold">Alasan pembatalan:</span>{' '}
                                                    {item.void_reason}
                                                    {item.voided_at ? ` (${item.voided_at})` : ''}
                                                </div>
                                            )}

                                            <div className="mt-auto pt-3">
                                                <Button asChild variant="subtle" className="w-full">
                                                    <Link
                                                        href={`/ui-orders/${item.order_id}`}
                                                        component="Orders/Show"
                                                        prefetch="hover"
                                                        cacheFor="10s"
                                                        cacheTags={['orders']}
                                                    >
                                                        Lihat Detail Pesanan
                                                    </Link>
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                }}
                            />
                        </div>

                        {paymentHistory.total > 0 && (
                            <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)]/45 px-5 py-4">
                                <Pagination
                                    links={paymentHistory.links}
                                    from={paymentHistory.from}
                                    to={paymentHistory.to}
                                    total={paymentHistory.total}
                                    itemLabel="riwayat pembayaran"
                                    only={['paymentHistory', 'filters']}
                                />
                            </div>
                        )}
                    </Card>
                )}
            </Deferred>

            <PaymentModal
                open={Boolean(payTarget)}
                order={payTarget}
                todayIso={effectiveTodayIso}
                returnTo="payments"
                onClose={() => setPayTarget(null)}
            />
        </>
    );
}
