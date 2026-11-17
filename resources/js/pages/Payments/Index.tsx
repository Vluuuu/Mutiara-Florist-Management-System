import { useEffect, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    CheckCircle2,
    History,
    Search,
    Wallet,
    X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { Pagination } from '@/components/pagination';
import { PaymentModal, type PaymentModalTarget } from '@/components/payment-modal';
import { Badge, getFulfillmentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
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
    orders: PaginatedData<ReceivableOrder>;
    outstanding: number;
    paymentHistory?: PaginatedData<PaymentHistoryItem>;
    todayIso?: string;
    filters: {
        q: string;
        history_status?: string;
    };
};

const HISTORY_CHIPS: Array<{ key: HistoryStatusFilter; label: string }> = [
    { key: '', label: 'Semua' },
    { key: 'POSTED', label: 'Hanya Tercatat' },
    { key: 'VOIDED', label: 'Hanya Dibatalkan' },
];

function getReceivableStatusMeta(order: ReceivableOrder): {
    label: string;
    tone: 'danger' | 'warn' | 'paid';
} {
    if (order.outstanding <= 0) {
        return { label: 'Lunas', tone: 'paid' };
    }
    if (order.paid_amount > 0) {
        return { label: 'Sebagian', tone: 'warn' };
    }
    return { label: 'Belum bayar', tone: 'danger' };
}

export default function PaymentsIndex({
    orders,
    outstanding,
    paymentHistory,
    todayIso,
    filters,
}: PaymentsIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
    const [search, setSearch] = useState(filters.q || '');
    const [isLoading, setIsLoading] = useState(false);
    const [payTarget, setPayTarget] = useState<PaymentModalTarget | null>(null);

    const effectiveTodayIso = todayIso || getWibTodayIso();
    const activeHistoryStatus: HistoryStatusFilter =
        filters.history_status === 'POSTED' || filters.history_status === 'VOIDED'
            ? filters.history_status
            : '';

    useEffect(() => {
        setSearch(filters.q || '');
    }, [filters.q]);

    useEffect(() => {
        const stopStart = router.on('start', () => setIsLoading(true));
        const stopFinish = router.on('finish', () => setIsLoading(false));
        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    const visitPayments = (nextQ: string, nextHistoryStatus: HistoryStatusFilter) => {
        const params: Record<string, string> = {};
        if (nextQ.trim()) {
            params.q = nextQ.trim();
        }
        if (nextHistoryStatus !== '') {
            params.history_status = nextHistoryStatus;
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
            cellClassName: 'whitespace-nowrap',
            render: (ord) => (
                <div>
                    <Link
                        href={`/ui-orders/${ord.id}`}
                        className="inline-flex min-h-[44px] items-center hover:underline"
                    >
                        <OrderCodeBadge orderNumber={ord.order_number} />
                    </Link>
                    <p className="text-xs text-[#525B54] tabular-nums">Nota {ord.order_date}</p>
                </div>
            ),
        },
        {
            key: 'customer',
            header: 'Pelanggan',
            render: (ord) => {
                const fulfill = getFulfillmentBadgeMeta(ord.status);
                return (
                    <div>
                        <p className="font-bold text-[#1E2420]">{ord.customer_name}</p>
                        <div className="mt-1">
                            <Badge tone={fulfill.tone}>{fulfill.label}</Badge>
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'payment_status',
            header: 'Pembayaran',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => {
                const payMeta = getReceivableStatusMeta(ord);
                return <Badge tone={payMeta.tone}>{payMeta.label}</Badge>;
            },
        },
        {
            key: 'total_amount',
            header: 'Total Tagihan',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-medium text-[#1E2420] tabular-nums',
            render: (ord) => formatRupiah(ord.total_amount),
        },
        {
            key: 'paid_amount',
            header: 'Sudah Dibayar',
            align: 'right',
            cellClassName: 'whitespace-nowrap text-[#525B54] tabular-nums',
            render: (ord) => formatRupiah(ord.paid_amount),
        },
        {
            key: 'outstanding',
            header: 'Sisa Tagihan',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-bold text-[#8C3B4A] tabular-nums',
            render: (ord) => formatRupiah(ord.outstanding),
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => (
                <div className="inline-flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => openPaymentModal(ord)}
                    >
                        Catat Bayar
                    </Button>
                    <Button asChild variant="secondary" size="sm">
                        <Link href={`/ui-orders/${ord.id}`}>Detail</Link>
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
                    <p className="font-semibold text-[#1E2420]">{item.payment_date}</p>
                    <p className="mt-0.5 text-xs text-[#525B54]">Oleh {item.recorded_by}</p>
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
                        className="inline-flex min-h-[44px] items-center hover:underline"
                    >
                        <OrderCodeBadge orderNumber={item.order_number} compact />
                    </Link>
                    <p className="text-sm font-medium text-[#1E2420]">{item.customer_name}</p>
                </div>
            ),
        },
        {
            key: 'method',
            header: 'Metode / Referensi',
            render: (item) => (
                <div>
                    <p className="font-medium text-[#1E2420]">{item.method_label}</p>
                    <p className="mt-0.5 text-xs text-[#525B54]">
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
                            <p className="mt-1.5 max-w-xs text-xs text-[#525B54]">
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
                            ? 'text-[#525B54] line-through'
                            : 'text-[#1E2420]',
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
                <Button asChild variant="secondary" size="sm">
                    <Link href={`/ui-orders/${item.order_id}`}>Lihat Nota</Link>
                </Button>
            ),
        },
    ];

    const filterError = errors?.q ?? errors?.history_status ?? errors?.payment;

    return (
        <AppLayout title="Piutang & Pembayaran">
            <Head title="Piutang & Pembayaran" />

            {/* Header */}
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Piutang & Pembayaran
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Fokus pada tagihan belum lunas untuk pencatatan DP, cicilan, atau pelunasan. Catatan bayar disimpan permanen.
                    </p>
                </div>

                <div className="rounded-[10px] border border-[#8C3B4A]/30 bg-[#FDF2F4] px-4 py-3 sm:min-w-[260px]">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#8C3B4A]">
                            Total Piutang Aktif
                        </span>
                        <Wallet className="size-4 text-[#8C3B4A]" aria-hidden="true" />
                    </div>
                    <p className="mt-1 text-xl font-bold text-[#8C3B4A] tabular-nums">
                        {formatRupiah(outstanding)}
                    </p>
                    <p className="mt-0.5 text-xs text-[#525B54] tabular-nums">
                        {formatAmount(orders.total)} pesanan belum lunas saat ini
                    </p>
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

            {/* Primary Section: Receivables */}
            <Card className="mb-6 overflow-hidden border-[#E3DED4]">
                <div className="flex flex-col gap-3 border-b border-[#E3DED4] bg-[#FAF8F4]/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                        <h2 className="text-base font-bold text-[#1E2420]">
                            Tagihan Belum Lunas
                        </h2>
                        <p className="mt-0.5 text-xs text-[#525B54]">
                            Daftar pesanan yang masih memiliki sisa tagihan terbuka.
                        </p>
                    </div>

                    <form onSubmit={handleSearch} className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
                        <div className="relative min-w-0 flex-1 sm:w-72">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#525B54]"
                                aria-hidden="true"
                            />
                            <Input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nomor nota atau pelanggan..."
                                aria-label="Cari piutang berdasarkan nota atau pelanggan"
                                className="pl-9 pr-9"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    aria-label="Hapus kata kunci pencarian"
                                    className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-[#525B54] hover:text-[#1E2420]"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        <Button type="submit" variant="primary" disabled={isLoading}>
                            Cari
                        </Button>
                    </form>
                </div>

                {isLoading && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="border-b border-[#E3DED4] bg-[#F1EDE6] px-4 py-2 text-xs font-semibold text-[#143326]"
                    >
                        Memuat daftar piutang dan riwayat pembayaran...
                    </div>
                )}

                <div className="p-4 sm:p-0">
                    <ResponsiveDataList
                        items={orders.data}
                        columns={receivableColumns}
                        keyExtractor={(ord) => ord.id}
                        tableAriaLabel="Daftar tagihan belum lunas"
                        emptyState={
                            <div className="px-6 py-12 text-center">
                                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#166534]">
                                    <CheckCircle2 className="size-6" aria-hidden="true" />
                                </div>
                                <h3 className="text-base font-bold text-[#1E2420]">
                                    {filters.q
                                        ? 'Tagihan tidak ditemukan'
                                        : 'Semua tagihan sudah lunas'}
                                </h3>
                                <p className="mx-auto mt-1 max-w-md text-sm text-[#525B54]">
                                    {filters.q
                                        ? `Tidak ada tagihan terbuka untuk "${filters.q}". Periksa ejaan atau hapus filter.`
                                        : 'Belum ada pesanan dengan sisa piutang berjalan saat ini.'}
                                </p>
                                {filters.q && (
                                    <div className="mt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleClearSearch}
                                        >
                                            Tampilkan Semua Tagihan
                                        </Button>
                                    </div>
                                )}
                            </div>
                        }
                        renderMobileCard={(ord) => {
                            const payMeta = getReceivableStatusMeta(ord);
                            const fulfill = getFulfillmentBadgeMeta(ord.status);
                            return (
                                <div className="rounded-[10px] border border-[#E3DED4] bg-white p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <Link
                                            href={`/ui-orders/${ord.id}`}
                                            className="inline-flex min-h-[44px] items-center hover:underline"
                                        >
                                            <OrderCodeBadge orderNumber={ord.order_number} compact />
                                        </Link>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Badge tone={fulfill.tone}>{fulfill.label}</Badge>
                                            <Badge tone={payMeta.tone}>{payMeta.label}</Badge>
                                        </div>
                                    </div>

                                    <p className="mt-1 text-base font-bold text-[#1E2420]">
                                        {ord.customer_name}
                                    </p>
                                    <p className="text-xs text-[#525B54] tabular-nums">
                                        Tanggal nota: {ord.order_date}
                                    </p>

                                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border border-[#E3DED4] bg-[#FBF9F6] p-2.5 text-xs tabular-nums">
                                        <div>
                                            <span className="block text-[#525B54]">Total</span>
                                            <strong className="font-semibold text-[#1E2420]">
                                                {formatRupiah(ord.total_amount)}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[#525B54]">Terbayar</span>
                                            <strong className="font-semibold text-[#166534]">
                                                {formatRupiah(ord.paid_amount)}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[#525B54]">Sisa</span>
                                            <strong className="font-bold text-[#8C3B4A]">
                                                {formatRupiah(ord.outstanding)}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={() => openPaymentModal(ord)}
                                        >
                                            Catat Bayar
                                        </Button>
                                        <Button asChild variant="secondary" size="sm">
                                            <Link href={`/ui-orders/${ord.id}`}>Detail</Link>
                                        </Button>
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>

                <Pagination
                    links={orders.links}
                    from={orders.from}
                    to={orders.to}
                    total={orders.total}
                    itemLabel="tagihan belum lunas"
                />
            </Card>

            {/* Secondary Section: Read-Only Payment History */}
            {paymentHistory && (
                <Card className="overflow-hidden border-[#E3DED4]">
                    <div className="flex flex-col gap-3 border-b border-[#E3DED4] bg-[#FAF8F4]/70 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <History className="size-4 text-[#143326]" aria-hidden="true" />
                                <h2 className="text-base font-bold text-[#1E2420]">
                                    Riwayat Pembayaran Terakhir
                                </h2>
                            </div>
                            <p className="mt-0.5 text-xs text-[#525B54]">
                                Arsip transaksi masuk yang pernah dicatat. Pembatalan tidak menghapus catatan melainkan mengubah statusnya menjadi Dibatalkan beserta alasan resmi.
                            </p>
                        </div>

                        <div
                            className="flex flex-wrap gap-2 lg:shrink-0"
                            role="group"
                            aria-label="Filter status riwayat pembayaran"
                        >
                            {HISTORY_CHIPS.map((chip) => {
                                const selected = activeHistoryStatus === chip.key;
                                return (
                                    <button
                                        key={chip.key || 'ALL'}
                                        type="button"
                                        aria-pressed={selected}
                                        disabled={isLoading}
                                        onClick={() => visitPayments(search, chip.key)}
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
                        </div>
                    </div>

                    <div className="p-4 sm:p-0">
                        <ResponsiveDataList
                            items={paymentHistory.data}
                            columns={historyColumns}
                            keyExtractor={(item) => item.id}
                            tableAriaLabel="Riwayat transaksi pembayaran"
                            rowClassName={(item) =>
                                item.status === 'VOIDED' ? 'bg-[#FBF9F6]/70' : undefined
                            }
                            emptyState={
                                <div className="px-6 py-10 text-center text-sm text-[#525B54]">
                                    Belum ada riwayat pembayaran pada filter yang dipilih.
                                </div>
                            }
                            renderMobileCard={(item) => {
                                const isPosted = item.status === 'POSTED';
                                return (
                                    <div className="rounded-[10px] border border-[#E3DED4] bg-white p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <Link
                                                href={`/ui-orders/${item.order_id}`}
                                                className="inline-flex min-h-[44px] items-center hover:underline"
                                            >
                                                <OrderCodeBadge orderNumber={item.order_number} compact />
                                            </Link>
                                            <Badge tone={isPosted ? 'paid' : 'neutral'}>
                                                {isPosted ? 'Tercatat' : 'Dibatalkan'}
                                            </Badge>
                                        </div>

                                        <div className="mt-1 flex items-baseline justify-between gap-2">
                                            <p className="font-bold text-[#1E2420]">
                                                {item.customer_name}
                                            </p>
                                            <span
                                                className={cn(
                                                    'text-base font-bold tabular-nums',
                                                    isPosted
                                                        ? 'text-[#1E2420]'
                                                        : 'text-[#525B54] line-through',
                                                )}
                                            >
                                                {formatRupiah(item.amount)}
                                            </span>
                                        </div>

                                        <p className="mt-1 text-xs text-[#525B54] tabular-nums">
                                            {item.payment_date} · {item.method_label}
                                            {item.reference ? ` · Ref: ${item.reference}` : ''}
                                        </p>
                                        <p className="mt-0.5 text-xs text-[#525B54]">
                                            Dicatat oleh {item.recorded_by}
                                        </p>

                                        {!isPosted && item.void_reason && (
                                            <div className="mt-2 rounded-md border border-[#E3DED4] bg-[#F1EDE6] p-2.5 text-xs text-[#1E2420]">
                                                <span className="font-bold">Alasan pembatalan:</span>{' '}
                                                {item.void_reason}
                                                {item.voided_at ? ` (${item.voided_at})` : ''}
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            <Button asChild variant="secondary" size="sm" className="w-full">
                                                <Link href={`/ui-orders/${item.order_id}`}>
                                                    Lihat Detail Pesanan
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    </div>

                    <Pagination
                        links={paymentHistory.links}
                        from={paymentHistory.from}
                        to={paymentHistory.to}
                        total={paymentHistory.total}
                        itemLabel="riwayat pembayaran"
                    />
                </Card>
            )}

            <PaymentModal
                open={Boolean(payTarget)}
                order={payTarget}
                todayIso={effectiveTodayIso}
                returnTo="payments"
                onClose={() => setPayTarget(null)}
            />
        </AppLayout>
    );
}
