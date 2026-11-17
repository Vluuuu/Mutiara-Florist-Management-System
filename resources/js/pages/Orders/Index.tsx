import { useEffect, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, Plus, Search, ShoppingBag, X } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { Pagination } from '@/components/pagination';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { formatAmount, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppPageProps, OrderListItem, PaginatedData } from '@/types';

type OrdersIndexProps = {
    orders: PaginatedData<OrderListItem>;
    filters: {
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

export default function OrdersIndex({ orders, filters }: OrdersIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
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
        const stopStart = router.on('start', () => setIsLoading(true));
        const stopFinish = router.on('finish', () => setIsLoading(false));
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
                        className="inline-flex min-h-[44px] items-center font-bold text-[#143326] hover:underline"
                    >
                        {ord.customer.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-[#525B54]">
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
                    <p className="font-semibold text-[#1E2420]">
                        {ord.earliest_delivery_date ?? ord.order_date}
                    </p>
                    <p className="mt-0.5 text-xs text-[#525B54]">Nota {ord.order_date}</p>
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
                return <Badge tone={meta.tone}>{ord.payment_status_label || meta.label}</Badge>;
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
                        <p className="font-bold text-[#1E2420]">{formatRupiah(ord.total_amount)}</p>
                        {remaining > 0 && (
                            <p className="mt-0.5 text-xs font-semibold text-[#8C3B4A]">
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
                <Button asChild variant="secondary" size="sm">
                    <Link href={`/ui-orders/${ord.id}`}>Detail</Link>
                </Button>
            ),
        },
    ];

    const filterError = errors?.q ?? errors?.status ?? errors?.payment;

    return (
        <AppLayout title="Pesanan">
            <Head title="Pesanan" />

            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Daftar Pesanan
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Cari berdasarkan nomor nota atau nama pelanggan, lalu kelola pengiriman dan pembayaran.
                    </p>
                </div>
                <div>
                    <Button asChild variant="primary">
                        <Link href="/ui-orders/create">
                            <Plus className="size-4" aria-hidden="true" />
                            Buat Pesanan
                        </Link>
                    </Button>
                </div>
            </div>

            {filterError && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2.5 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3.5 text-sm font-medium text-[#991B1B]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{filterError}</span>
                </div>
            )}

            <Card className="overflow-hidden border-[#E3DED4]">
                <div className="space-y-3 border-b border-[#E3DED4] bg-[#FAF8F4]/60 p-4">
                    <div
                        className="flex flex-wrap gap-2"
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
                                        'inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-xs font-bold transition-colors',
                                        selected
                                            ? 'border-[#143326] bg-[#143326] text-white'
                                            : 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#F1EDE6]',
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
                                'inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-xs font-bold transition-colors',
                                onlyUnpaid
                                    ? 'border-[#8C3B4A] bg-[#8C3B4A] text-white'
                                    : 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#FDF2F4]',
                            )}
                        >
                            Belum Lunas
                        </button>
                    </div>

                    <form
                        onSubmit={handleSearchSubmit}
                        role="search"
                        className="flex flex-col gap-2.5 sm:flex-row sm:items-end"
                    >
                        <div className="min-w-0 flex-1 sm:max-w-md">
                            <label
                                htmlFor="q"
                                className="mb-1.5 block text-sm font-semibold text-[#1E2420]"
                            >
                                Cari nomor nota atau nama pelanggan
                            </label>
                            <div className="relative flex items-center">
                                <Input
                                    id="q"
                                    name="q"
                                    type="search"
                                    maxLength={100}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Ketik kode MF-... atau nama pemesan..."
                                    className={search ? 'pr-12' : undefined}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch('');
                                            applyFilters('', activeStatus, onlyUnpaid);
                                        }}
                                        aria-label="Hapus kata kunci pesanan"
                                        className="absolute right-0 inline-flex size-11 items-center justify-center rounded text-[#525B54] hover:bg-[#F1EDE6] hover:text-[#1E2420]"
                                    >
                                        <X className="size-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" variant="primary" disabled={isLoading}>
                                <Search className="size-4" aria-hidden="true" />
                                {isLoading ? 'Memuat...' : 'Cari'}
                            </Button>
                            {isFiltered && (
                                <Button type="button" variant="secondary" onClick={handleReset}>
                                    Reset Filter
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {isLoading && (
                    <div
                        aria-busy="true"
                        className="border-b border-[#E3DED4] bg-[#F1EDE6]/60 px-4 py-2 text-xs font-semibold text-[#525B54]"
                    >
                        Memuat daftar pesanan terbaru...
                    </div>
                )}

                <div className="p-3 lg:p-0">
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
                                <article className="flex flex-col gap-3 rounded-lg border border-[#E3DED4] bg-white p-3.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <OrderCodeBadge orderNumber={ord.order_number} />
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Badge tone={fMeta.tone}>{fMeta.label}</Badge>
                                            <Badge tone={pMeta.tone}>
                                                {ord.payment_status_label || pMeta.label}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <Link
                                            href={`/ui-customers/${ord.customer.id}`}
                                            className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-[#143326] hover:underline"
                                        >
                                            {ord.customer.name}
                                        </Link>
                                        <p className="mt-0.5 text-[13px] text-[#525B54] tabular-nums">
                                            {formatAmount(ord.items_count)} item
                                            {ord.first_flower ? ` (${ord.first_flower})` : ''}
                                            {' | Kirim '}
                                            {ord.earliest_delivery_date ?? ord.order_date}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 border-t border-[#E3DED4] pt-2.5">
                                        <div className="tabular-nums">
                                            <p className="text-base font-bold text-[#1E2420]">
                                                {formatRupiah(ord.total_amount)}
                                            </p>
                                            {remaining > 0 && (
                                                <p className="text-xs font-semibold text-[#8C3B4A]">
                                                    Sisa {formatRupiah(remaining)}
                                                </p>
                                            )}
                                        </div>
                                        <Button asChild variant="primary" size="sm">
                                            <Link href={`/ui-orders/${ord.id}`}>Buka Detail</Link>
                                        </Button>
                                    </div>
                                </article>
                            );
                        }}
                        emptyState={
                            <div className="px-6 py-14 text-center">
                                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#F1EDE6] text-[#525B54]">
                                    {isFiltered ? (
                                        <Search className="size-6" aria-hidden="true" />
                                    ) : (
                                        <ShoppingBag className="size-6" aria-hidden="true" />
                                    )}
                                </div>
                                <h2 className="text-base font-bold text-[#1E2420]">
                                    {isFiltered ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan'}
                                </h2>
                                <p className="mt-1.5 text-sm text-[#525B54]">
                                    {isFiltered
                                        ? 'Ubah filter status atau kata kunci pencarian.'
                                        : 'Mulai dengan membuat pesanan dari pelanggan yang sudah tercatat.'}
                                </p>
                                <div className="mt-5">
                                    {isFiltered ? (
                                        <Button type="button" variant="secondary" onClick={handleReset}>
                                            Reset Filter
                                        </Button>
                                    ) : (
                                        <Button asChild variant="primary">
                                            <Link href="/ui-orders/create">
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

                {orders.last_page > 1 && (
                    <div className="border-t border-[#E3DED4] bg-[#FAF8F4]/50 px-4 py-3.5">
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
        </AppLayout>
    );
}
