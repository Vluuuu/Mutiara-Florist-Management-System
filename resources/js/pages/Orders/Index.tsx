import { useEffect, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search, ShoppingBag, X } from 'lucide-react';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { Pagination } from '@/components/pagination';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { DataListSkeleton } from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { useScopedFilterLoading } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppPageProps, OrderListItem, PaginatedData } from '@/types';

type OrdersIndexProps = {
    orders?: PaginatedData<OrderListItem>;
    filters?: {
        q?: string;
        status?: string;
        payment?: string;
    };
};

type StatusFilterKey = '' | 'NEW' | 'PROCESSING' | 'READY' | 'COMPLETED';

const STATUS_CHIPS: Array<{ key: StatusFilterKey; label: string }> = [
    { key: '', label: 'Semua Status' },
    { key: 'READY', label: 'Siap Kirim' },
    { key: 'PROCESSING', label: 'Diproses' },
    { key: 'NEW', label: 'Baru' },
    { key: 'COMPLETED', label: 'Selesai' },
];

export default function OrdersIndex({ orders, filters = {} }: OrdersIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
    const isLoading = useScopedFilterLoading('/ui-orders');
    useInstantPageGuard(Boolean(orders));
    const [search, setSearch] = useState(filters.q ?? '');

    const activeStatus: StatusFilterKey =
        filters.status === 'NEW' ||
        filters.status === 'PROCESSING' ||
        filters.status === 'READY' ||
        filters.status === 'COMPLETED'
            ? filters.status
            : '';
    const onlyUnpaid = filters.payment === 'UNPAID';
    const isFiltered =
        (filters.q ?? '').trim() !== '' || activeStatus !== '' || onlyUnpaid;

    useEffect(() => {
        setSearch(filters.q ?? '');
    }, [filters.q]);

    const applyFilters = (qValue: string, nextStatus: StatusFilterKey, nextUnpaid: boolean) => {
        const params: Record<string, string> = {};
        if (qValue.trim()) params.q = qValue.trim();
        if (nextStatus !== '') params.status = nextStatus;
        if (nextUnpaid) params.payment = 'UNPAID';

        router.get('/ui-orders', params, {
            only: ['orders', 'filters'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleSearchSubmit = (e: FormEvent) => {
        e.preventDefault();
        applyFilters(search, activeStatus, onlyUnpaid);
    };

    const handleReset = () => {
        setSearch('');
        router.get('/ui-orders', {}, {
            only: ['orders', 'filters'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columns: DataColumn<OrderListItem>[] = [
        {
            key: 'order_number',
            header: 'No. Pesanan',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => (
                <Link
                    href={`/ui-orders/${ord.id}`}
                    component="Orders/Show"
                    prefetch="hover"
                    cacheFor="10s"
                    cacheTags={['orders']}
                    className="inline-flex min-h-[44px] items-center hover:underline"
                >
                    <OrderCodeBadge orderNumber={ord.order_number} compact />
                </Link>
            ),
        },
        {
            key: 'customer',
            header: 'Pelanggan & Rangkaian',
            render: (ord) => (
                <div>
                    <Link
                        href={`/ui-customers/${ord.customer.id}`}
                        component="Customers/Show"
                        prefetch="hover"
                        cacheFor="10s"
                        cacheTags={['customers']}
                        className="inline-flex min-h-[44px] items-center font-bold text-[var(--brand-primary)] hover:underline"
                    >
                        {ord.customer.name}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                        {formatAmount(ord.items_count)} item
                        {ord.first_flower ? `: ${ord.first_flower}` : ''}
                    </p>
                </div>
            ),
        },
        {
            key: 'delivery',
            header: 'Tanggal Kirim',
            cellClassName: 'whitespace-nowrap tabular-nums',
            render: (ord) => (
                <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                        {ord.earliest_delivery_date ?? ord.order_date}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                        Nota {ord.order_date}
                    </p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Pengerjaan',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => {
                const meta = getFulfillmentBadgeMeta(ord.status);
                return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
        },
        {
            key: 'payment_status',
            header: 'Pembayaran',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => {
                const meta = getPaymentBadgeMeta(ord.payment_status);
                return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
        },
        {
            key: 'total_amount',
            header: 'Total Tagihan',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => {
                const remaining = Math.max(ord.total_amount - ord.paid_amount, 0);
                return (
                    <div className="tabular-nums">
                        <p className="font-bold text-[var(--text-primary)]">
                            {formatRupiah(ord.total_amount)}
                        </p>
                        {remaining > 0 && (
                            <p className="mt-0.5 text-[13px] font-semibold text-[var(--brand-urgent)]">
                                Sisa {formatRupiah(remaining)}
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => (
                <Button asChild variant="subtle" size="sm" className="min-w-[88px]">
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
            ),
        },
    ];

    const filterError = errors?.q ?? errors?.status ?? errors?.payment;

    if (!orders) {
        return (
            <>
                <Head title="Pesanan" />
                <DataListSkeleton title="Daftar Pesanan" rows={6} showFilters />
            </>
        );
    }

    return (
        <>
            <Head title="Pesanan" />

            {/* AUD-04: Aksi tunggal + Pesanan Baru sudah ada di topbar/bottom nav */}
            <PageHeader title="Daftar Pesanan" />

            {filterError && (
                <AlertBanner tone="error" className="mb-5">
                    {filterError}
                </AlertBanner>
            )}

            <Card className="overflow-hidden">
                <div className="space-y-4 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 p-5 sm:p-6">
                    <div
                        className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
                        role="group"
                        aria-label="Filter status pesanan"
                    >
                        {STATUS_CHIPS.map((chip) => {
                            const selected = activeStatus === chip.key;
                            return (
                                <button
                                    key={chip.key || 'ALL'}
                                    type="button"
                                    aria-pressed={selected}
                                    disabled={isLoading}
                                    onClick={() => applyFilters(search, chip.key, onlyUnpaid)}
                                    className={cn(
                                        'inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border px-4 py-2 text-sm font-semibold transition-colors',
                                        selected
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--bg-surface)]'
                                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]',
                                    )}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            aria-pressed={onlyUnpaid}
                            disabled={isLoading}
                            onClick={() => applyFilters(search, activeStatus, !onlyUnpaid)}
                            className={cn(
                                'inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border px-4 py-2 text-sm font-semibold transition-colors',
                                onlyUnpaid
                                    ? 'border-[var(--brand-urgent)] bg-[var(--brand-urgent)] text-[var(--bg-surface)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]',
                            )}
                        >
                            Belum Lunas
                        </button>
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] sm:hidden">
                        Geser daftar status ke kanan/kiri untuk filter lainnya
                    </p>

                    <form onSubmit={handleSearchSubmit} role="search" className="pt-1">
                        <label
                            htmlFor="q"
                            className="mb-2 block text-sm font-semibold text-[var(--text-primary)]"
                        >
                            Cari Nomor Nota atau Pelanggan
                        </label>
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Search
                                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)]"
                                    aria-hidden="true"
                                />
                                <Input
                                    id="q"
                                    name="q"
                                    type="search"
                                    maxLength={100}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari no. nota atau nama..."
                                    className={search ? 'h-11 pl-10 pr-12' : 'h-11 pl-10'}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch('');
                                            applyFilters('', activeStatus, onlyUnpaid);
                                        }}
                                        aria-label="Hapus kata kunci pesanan"
                                        className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-[8px] text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
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
                                    {isLoading ? 'Memuat...' : 'Cari'}
                                </Button>
                                {isFiltered && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleReset}
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
                        aria-busy="true"
                        className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/70 px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
                    >
                        Memuat daftar pesanan terbaru...
                    </div>
                )}

                <div className="p-4 lg:p-0">
                    <ResponsiveDataList
                        items={orders.data}
                        columns={columns}
                        keyExtractor={(ord) => ord.id}
                        tabletColumns={2}
                        tableAriaLabel="Daftar pesanan Mutiara Florist"
                        renderMobileCard={(ord) => {
                            const fMeta = getFulfillmentBadgeMeta(ord.status);
                            const pMeta = getPaymentBadgeMeta(ord.payment_status);
                            const remaining = Math.max(ord.total_amount - ord.paid_amount, 0);

                            return (
                                <article className="atelier-sheet flex flex-col gap-3 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <OrderCodeBadge orderNumber={ord.order_number} compact />
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Badge tone={fMeta.tone}>{fMeta.label}</Badge>
                                            <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <Link
                                            href={`/ui-customers/${ord.customer.id}`}
                                            component="Customers/Show"
                                            prefetch="hover"
                                            cacheFor="10s"
                                            cacheTags={['customers']}
                                            className="inline-flex min-h-[44px] items-center text-base font-bold text-[var(--brand-primary)] hover:underline"
                                        >
                                            {ord.customer.name}
                                        </Link>
                                        <p className="mt-0.5 text-sm text-[var(--text-secondary)] tabular-nums">
                                            {formatAmount(ord.items_count)} item
                                            {ord.first_flower ? ` (${ord.first_flower})` : ''}
                                            {' · Kirim '}
                                            {ord.earliest_delivery_date ?? ord.order_date}
                                        </p>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-3">
                                        <div className="tabular-nums">
                                            <p className="text-lg font-bold text-[var(--text-primary)]">
                                                {formatRupiah(ord.total_amount)}
                                            </p>
                                            {remaining > 0 && (
                                                <p className="text-[13px] font-semibold text-[var(--brand-urgent)]">
                                                    Sisa {formatRupiah(remaining)}
                                                </p>
                                            )}
                                        </div>
                                        <Button asChild variant="subtle" className="min-w-[116px]">
                                            <Link
                                                href={`/ui-orders/${ord.id}`}
                                                component="Orders/Show"
                                                prefetch="hover"
                                                cacheFor="10s"
                                                cacheTags={['orders']}
                                            >
                                                Buka Detail
                                            </Link>
                                        </Button>
                                    </div>
                                </article>
                            );
                        }}
                        emptyState={
                            <EmptyState
                                icon={isFiltered ? Search : ShoppingBag}
                                title={
                                    isFiltered
                                        ? 'Tidak ada pesanan yang cocok'
                                        : 'Belum ada pesanan'
                                }
                                description={
                                    isFiltered
                                        ? 'Ubah filter status atau kata kunci pencarian.'
                                        : 'Mulai dengan membuat pesanan dari pelanggan yang sudah tercatat.'
                                }
                                action={
                                    isFiltered ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleReset}
                                            className="min-w-[144px]"
                                        >
                                            Reset Filter
                                        </Button>
                                    ) : (
                                        <Button asChild variant="primary" className="min-w-[164px]">
                                            <Link
                                                href="/ui-orders/create"
                                                component="Orders/Create"
                                                prefetch="hover"
                                                cacheFor="10s"
                                                cacheTags={['customers', 'orders']}
                                            >
                                                <Plus className="size-4" aria-hidden="true" />
                                                Buat Pesanan
                                            </Link>
                                        </Button>
                                    )
                                }
                            />
                        }
                    />
                </div>

                {orders.total > 0 && (
                    <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)]/45 px-5 py-4">
                        <Pagination
                            links={orders.links}
                            from={orders.from}
                            to={orders.to}
                            total={orders.total}
                            itemLabel="pesanan"
                            only={['orders', 'filters']}
                        />
                    </div>
                )}
            </Card>
        </>
    );
}
