import { useEffect, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { Pagination } from '@/components/pagination';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataListSkeleton } from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
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
    useInstantPageGuard(Boolean(orders));
    const [search, setSearch] = useState(filters.q ?? '');
    const [isLoading, setIsLoading] = useState(false);

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

    useEffect(() => {
        const stopStart = router.on('start', (e) => {
            if (!e.detail.visit.prefetch) setIsLoading(true);
        });
        const stopFinish = router.on('finish', (e) => {
            if (!e.detail.visit.prefetch) setIsLoading(false);
        });
        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    const applyFilters = (qValue: string, nextStatus: StatusFilterKey, nextUnpaid: boolean) => {
        const params: Record<string, string> = {};
        if (qValue.trim()) params.q = qValue.trim();
        if (nextStatus !== '') params.status = nextStatus;
        if (nextUnpaid) params.payment = 'UNPAID';

        router.get('/ui-orders', params, {
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
                    <OrderCodeBadge orderNumber={ord.order_number} />
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
                        className="inline-flex min-h-[44px] items-center font-bold text-[#1D3B2A] hover:underline"
                    >
                        {ord.customer.name}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-[#545852]">
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
                    <p className="font-semibold text-[#1C211E]">
                        {ord.earliest_delivery_date ?? ord.order_date}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#545852]">Nota {ord.order_date}</p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Pengerjaan',
            render: (ord) => {
                const meta = getFulfillmentBadgeMeta(ord.status);
                return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
        },
        {
            key: 'payment_status',
            header: 'Pembayaran',
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
                        <p className="font-bold text-[#1C211E]">{formatRupiah(ord.total_amount)}</p>
                        {remaining > 0 && (
                            <p className="mt-0.5 text-[13px] font-semibold text-[#9A3B22]">
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
                <Button asChild variant="secondary" className="min-w-[96px]">
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

            <div className="mb-7 flex flex-col gap-3 border-b border-[#DED6C8] pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="atelier-h1">
                        Daftar Pesanan
                    </h1>
                </div>
                <div>
                    <Button asChild variant="primary" className="min-w-[160px]">
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
                </div>
            </div>

            {filterError && (
                <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-sm font-medium text-[#8A2619]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{filterError}</span>
                </div>
            )}

            <Card className="overflow-hidden">
                <div className="space-y-4 border-b border-[#DED6C8] bg-[#EFE9DE]/55 p-5 sm:p-6">
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
                                            ? 'border-[#1D3B2A] bg-[#1D3B2A] text-[#FFFDF9]'
                                            : 'border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
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
                                    ? 'border-[#1D3B2A] bg-[#1D3B2A] text-[#FFFDF9]'
                                    : 'border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
                            )}
                        >
                            Belum Lunas
                        </button>
                    </div>
                    <p className="text-[12px] text-[#545852] sm:hidden">
                        Geser daftar status ke kanan/kiri untuk filter lainnya
                    </p>

                    <form
                        onSubmit={handleSearchSubmit}
                        role="search"
                        className="pt-1"
                    >
                        <label
                            htmlFor="q"
                            className="mb-2 block text-sm font-semibold text-[#1C211E]"
                        >
                            Cari Nomor Nota atau Pelanggan
                        </label>
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Search
                                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#545852]"
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
                                        className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-[8px] text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]"
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
                        className="border-b border-[#DED6C8] bg-[#EFE9DE]/70 px-5 py-2.5 text-sm font-semibold text-[#545852]"
                    >
                        Memuat daftar pesanan terbaru...
                    </div>
                )}

                <div className="p-4 lg:p-0">
                    <ResponsiveDataList
                        items={orders.data}
                        columns={columns}
                        keyExtractor={(ord) => ord.id}
                        tableAriaLabel="Daftar pesanan Mutiara Florist"
                        renderMobileCard={(ord) => {
                            const fMeta = getFulfillmentBadgeMeta(ord.status);
                            const pMeta = getPaymentBadgeMeta(ord.payment_status);
                            const remaining = Math.max(ord.total_amount - ord.paid_amount, 0);

                            return (
                                <article className="atelier-sheet flex flex-col gap-3 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <OrderCodeBadge orderNumber={ord.order_number} />
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
                                            className="inline-flex min-h-[44px] items-center text-base font-bold text-[#1D3B2A] hover:underline"
                                        >
                                            {ord.customer.name}
                                        </Link>
                                        <p className="mt-0.5 text-sm text-[#545852] tabular-nums">
                                            {formatAmount(ord.items_count)} item
                                            {ord.first_flower ? ` (${ord.first_flower})` : ''}
                                            {' · Kirim '}
                                            {ord.earliest_delivery_date ?? ord.order_date}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 border-t border-[#DED6C8] pt-3">
                                        <div className="tabular-nums">
                                            <p className="text-lg font-bold text-[#1C211E]">
                                                {formatRupiah(ord.total_amount)}
                                            </p>
                                            {remaining > 0 && (
                                                <p className="text-[13px] font-semibold text-[#9A3B22]">
                                                    Sisa {formatRupiah(remaining)}
                                                </p>
                                            )}
                                        </div>
                                        <Button asChild variant="primary" className="min-w-[124px]">
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
                            <div className="px-6 py-14 text-center">
                                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] text-[#545852]">
                                    {isFiltered ? (
                                        <Search className="size-6" aria-hidden="true" />
                                    ) : (
                                        <ShoppingBag className="size-6" aria-hidden="true" />
                                    )}
                                </div>
                                <h2 className="atelier-h2">
                                    {isFiltered ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan'}
                                </h2>
                                <p className="mt-1.5 text-[15px] text-[#545852]">
                                    {isFiltered
                                        ? 'Ubah filter status atau kata kunci pencarian.'
                                        : 'Mulai dengan membuat pesanan dari pelanggan yang sudah tercatat.'}
                                </p>
                                <div className="mt-5">
                                    {isFiltered ? (
                                        <Button type="button" variant="secondary" onClick={handleReset} className="min-w-[144px]">
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
                                    )}
                                </div>
                            </div>
                        }
                    />
                </div>

                {orders.total > 0 && (
                    <div className="border-t border-[#DED6C8] bg-[#EFE9DE]/45 px-5 py-4">
                        <Pagination
                            links={orders.links}
                            from={orders.from}
                            to={orders.to}
                            total={orders.total}
                            itemLabel="pesanan"
                        />
                    </div>
                )}
            </Card>
        </>
    );
}
