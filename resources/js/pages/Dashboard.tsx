import { useMemo, useRef, useState } from 'react';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, ChevronRight, Plus } from 'lucide-react';
import { DeliveryConfirmModal, type DeliveryConfirmTarget } from '@/components/delivery-confirm-modal';
import { LedgerSummaryStrip } from '@/components/ledger-summary-strip';
import { PaymentModal, type PaymentModalTarget } from '@/components/payment-modal';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
    DataListSkeleton,
    DeferredSectionError,
    ReceivablesSkeleton,
    SummaryStripSkeleton,
} from '@/components/ui/page-skeleton';
import { useNavigationState } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatRupiah, getWibTodayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    DashboardNav,
    DashboardQueueItem,
    DashboardQueueSummary,
    DashboardReceivableItem,
    DashboardStats,
    DashboardTodayStats,
    FulfillmentStatus,
} from '@/types';

type DashboardProps = {
    stats?: DashboardStats;
    todayStats?: DashboardTodayStats;
    deliveryQueue?: DashboardQueueItem[];
    queueSummary?: DashboardQueueSummary;
    receivables?: DashboardReceivableItem[];
    todayIso?: string;
    todayDisplay?: string;
    nav?: DashboardNav;
};

type QueueFilter = 'all' | 'overdue' | 'today' | 'ready';

type GroupedQueueOrder = {
    groupKey: string;
    orderId: number;
    orderNumber: string;
    customerName: string;
    urgency: 'overdue' | 'today' | 'upcoming';
    items: DashboardQueueItem[];
};

const NEXT_STEP_LABEL: Record<FulfillmentStatus, string> = {
    NEW: 'Mulai Proses',
    PROCESSING: 'Siap Kirim',
    READY: 'Tandai Terkirim',
    DELIVERED: 'Terkirim',
};

const URGENCY_SECTION_LABEL: Record<'overdue' | 'today' | 'upcoming', string> = {
    overdue: 'Perlu Perhatian (Terlambat)',
    today: 'Jadwal Kirim Hari Ini',
    upcoming: 'Jadwal Berikutnya',
};

function groupQueueItems(items: DashboardQueueItem[]): GroupedQueueOrder[] {
    const groups: GroupedQueueOrder[] = [];
    const byKey = new Map<string, GroupedQueueOrder>();

    for (const item of items) {
        const key = `${item.urgency}:${item.order_id}`;
        let grp = byKey.get(key);
        if (!grp) {
            grp = {
                groupKey: key,
                orderId: item.order_id,
                orderNumber: item.order_number,
                customerName: item.customer_name,
                urgency: item.urgency,
                items: [],
            };
            byKey.set(key, grp);
            groups.push(grp);
        }
        grp.items.push(item);
    }

    return groups;
}

export default function Dashboard({
    stats,
    todayStats,
    deliveryQueue = [],
    queueSummary,
    receivables = [],
    todayIso,
    todayDisplay,
    nav,
}: DashboardProps) {
    const { errors, nav: sharedNav } = usePage<AppPageProps>().props;
    const { isNavigating: isRefreshing, deferredErrors } = useNavigationState();
    const resolvedNav = nav ?? sharedNav;
    const createOrderHref = resolvedNav?.uiOrdersCreate ?? '/ui-orders/create';
    const paymentsHref = resolvedNav?.uiPayments ?? '/ui-payments';

    const hasCoreData = Boolean(stats);
    useInstantPageGuard(hasCoreData);

    const fallbackTodayIso = todayIso ?? getWibTodayIso();

    const [submittingItemId, setSubmittingItemId] = useState<number | null>(null);
    const stepLockRef = useRef(false);
    const [deliverTarget, setDeliverTarget] = useState<DeliveryConfirmTarget | null>(null);
    const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState<PaymentModalTarget | null>(null);
    const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');

    const overdueCount =
        todayStats?.deliveries_overdue ??
        queueSummary?.overdue_count ??
        deliveryQueue.filter((item) => item.urgency === 'overdue').length;

    const readyCount =
        todayStats?.deliveries_ready ??
        queueSummary?.ready_count ??
        deliveryQueue.filter((item) => item.fulfillment_status === 'READY').length;

    const todayDueCount =
        todayStats?.deliveries_pending_today ??
        queueSummary?.today_count ??
        deliveryQueue.filter((item) => item.urgency === 'today').length;

    const todayTotalDeliveries = todayStats?.deliveries_total_today ?? todayDueCount;
    const todayDeliveredCount = todayStats?.deliveries_delivered_today ?? 0;

    const filteredQueue = useMemo(() => {
        if (queueFilter === 'overdue') {
            return deliveryQueue.filter((item) => item.urgency === 'overdue');
        }
        if (queueFilter === 'today') {
            return deliveryQueue.filter((item) => item.urgency === 'today');
        }
        if (queueFilter === 'ready') {
            return deliveryQueue.filter((item) => item.fulfillment_status === 'READY');
        }
        return deliveryQueue;
    }, [deliveryQueue, queueFilter]);

    const groupedByUrgency = useMemo(() => {
        const order: Array<'overdue' | 'today' | 'upcoming'> = ['overdue', 'today', 'upcoming'];
        return order
            .map((urgency) => {
                const bandItems = filteredQueue.filter((item) => item.urgency === urgency);
                return {
                    urgency,
                    label: URGENCY_SECTION_LABEL[urgency],
                    itemCount: bandItems.length,
                    groups: groupQueueItems(bandItems),
                };
            })
            .filter((section) => section.itemCount > 0);
    }, [filteredQueue]);

    const queueFilterOptions: Array<{ key: QueueFilter; label: string; count: number }> = [
        { key: 'all', label: 'Semua', count: deliveryQueue.length },
        {
            key: 'today',
            label: 'Hari Ini',
            count: deliveryQueue.filter((item) => item.urgency === 'today').length,
        },
        {
            key: 'overdue',
            label: 'Terlambat',
            count: deliveryQueue.filter((item) => item.urgency === 'overdue').length,
        },
        {
            key: 'ready',
            label: 'Siap Kirim',
            count: deliveryQueue.filter((item) => item.fulfillment_status === 'READY').length,
        },
    ];

    const advanceStatus = (orderId: number, itemId: number, targetStatus: FulfillmentStatus) => {
        if (stepLockRef.current || submittingItemId !== null) return;
        stepLockRef.current = true;
        setSubmittingItemId(itemId);

        router.post(
            `/ui-orders/${orderId}/items/${itemId}/status`,
            {
                target_status: targetStatus,
                return_to: 'dashboard',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setDeliverTarget(null);
                },
                onFinish: () => {
                    stepLockRef.current = false;
                    setSubmittingItemId(null);
                },
            },
        );
    };

    const handleQueueAction = (item: DashboardQueueItem) => {
        if (!item.next_status || stepLockRef.current) return;

        if (item.next_status === 'DELIVERED') {
            setDeliverTarget({
                orderId: item.order_id,
                itemId: item.item_id,
                orderNumber: item.order_number,
                flowerType: item.flower_type,
                recipient: item.recipient,
                deliveryLocation: item.delivery_location,
                currentStatus: item.fulfillment_status,
                nextStatus: 'DELIVERED',
            });
            return;
        }

        advanceStatus(item.order_id, item.item_id, item.next_status);
    };

    const queueError = errors?.target_status ?? errors?.item;
    const displayedReceivables = receivables.slice(0, 6);

    if (!stats) {
        return (
            <>
                <Head title="Hari Ini" />
                <header className="mb-5 flex flex-col gap-3 border-b border-[#DED6C8] pb-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
                    <div>
                        <h1 className="atelier-h1">Hari Ini</h1>
                        <p className="mt-0.5 text-[14px] text-[#545852] sm:mt-1 sm:text-[15px]">
                            Memuat ringkasan harian &amp; antrean pengiriman...
                        </p>
                    </div>
                    <Button
                        asChild
                        variant="primary"
                        className="w-full sm:w-auto sm:min-w-[164px]"
                    >
                        <Link
                            href={createOrderHref}
                            component="Orders/Create"
                            prefetch="hover"
                            cacheFor="10s"
                            cacheTags={['customers', 'orders']}
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            Buat Pesanan
                        </Link>
                    </Button>
                </header>

                <div className="flex flex-col gap-5 sm:gap-7">
                    <SummaryStripSkeleton cards={4} />
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] lg:items-start">
                        <DataListSkeleton rows={4} showFilters={false} />
                        <div className="atelier-sheet p-5">
                            <ReceivablesSkeleton />
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Hari Ini" />

            {/* A. Header Sederhana */}
            <header className="mb-5 flex flex-col gap-3 border-b border-[#DED6C8] pb-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
                <div>
                    <h1 className="atelier-h1">Hari Ini</h1>
                    {(todayDisplay || isRefreshing) && (
                        <p className="mt-0.5 text-[14px] text-[#545852] sm:mt-1 sm:text-[15px]">
                            {todayDisplay ?? ''}
                            {isRefreshing ? ' · Memperbarui...' : ''}
                        </p>
                    )}
                </div>

                <div className="flex w-full items-center gap-2.5 sm:w-auto sm:flex-wrap">
                    {receivables.length > 0 && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPaymentPickerOpen(true)}
                            className="flex-1 sm:min-w-[164px] sm:flex-none"
                        >
                            Catat Pembayaran
                        </Button>
                    )}
                    <Button
                        asChild
                        variant="primary"
                        className="flex-1 sm:min-w-[164px] sm:flex-none"
                    >
                        <Link
                            href={createOrderHref}
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
            </header>

            {queueError && (
                <div
                    role="alert"
                    className="mb-6 flex items-start gap-2.5 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-sm font-medium text-[#8A2619]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{queueError}</span>
                </div>
            )}

            <div className="flex flex-col gap-5 sm:gap-7">
                {/* B. Ringkasan Utama (2x2 ringkas di mobile, 4 kolom di desktop) */}
                <LedgerSummaryStrip
                    ariaLabel="Ringkasan operasional hari ini"
                    mobileColumns={2}
                    items={[
                        {
                            label: 'Pesanan Masuk Hari Ini',
                            value: `${formatAmount(todayStats?.orders_count ?? 0)} pesanan`,
                            hint: `Nilai ${formatRupiah(todayStats?.orders_billed ?? 0)}`,
                        },
                        {
                            label: 'Kiriman Hari Ini',
                            value: `${formatAmount(todayTotalDeliveries)} rangkaian`,
                            hint:
                                overdueCount > 0 ? (
                                    <span>
                                        <strong className="font-semibold text-[#9A3B22]">
                                            {formatAmount(overdueCount)} terlambat
                                        </strong>
                                        {' · '}
                                        {formatAmount(todayDueCount)} masih antre
                                    </span>
                                ) : (
                                    `${formatAmount(todayDueCount)} antre · ${formatAmount(todayDeliveredCount)} terkirim`
                                ),
                        },
                        {
                            label: 'Uang Diterima Hari Ini',
                            value: formatRupiah(todayStats?.cash_in ?? 0),
                            hint:
                                (todayStats?.cash_out ?? 0) > 0
                                    ? `Biaya hari ini ${formatRupiah(todayStats?.cash_out ?? 0)}`
                                    : `${formatAmount(todayStats?.cash_in_count ?? 0)} pembayaran sah`,
                        },
                        {
                            label: 'Piutang Belum Lunas',
                            value: formatRupiah(stats.outstanding),
                            hint: `${formatAmount(todayStats?.open_receivables_count ?? receivables.length)} pesanan terbuka`,
                        },
                    ]}
                />

                {/* Workspace Grid: Antrean Pekerjaan & Piutang Ringkas */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] lg:items-start">
                    {/* C. Pekerjaan yang Perlu Ditangani */}
                    <section
                        aria-labelledby="dash-agenda-title"
                        className="atelier-sheet overflow-hidden"
                    >
                        <div className="border-b border-[#DED6C8] bg-[#FFFDF9] px-5 pt-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
                                <h2 id="dash-agenda-title" className="atelier-h2">
                                    Pekerjaan &amp; Pengiriman
                                </h2>
                                <span className="text-[13px] text-[#545852] tabular-nums">
                                    {formatAmount(readyCount)} siap kirim
                                    {overdueCount > 0 ? (
                                        <>
                                            {' · '}
                                            <strong className="font-semibold text-[#9A3B22]">
                                                {formatAmount(overdueCount)} terlambat
                                            </strong>
                                        </>
                                    ) : null}
                                </span>
                            </div>

                            {deliveryQueue.length > 0 && (
                                <div
                                    className="-mb-px flex flex-nowrap gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible"
                                    role="tablist"
                                    aria-label="Filter antrean pengiriman"
                                >
                                    {queueFilterOptions.map((opt) => {
                                        const active = queueFilter === opt.key;
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                role="tab"
                                                aria-selected={active}
                                                onClick={() => setQueueFilter(opt.key)}
                                                className={cn(
                                                    'inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors tabular-nums sm:px-3.5',
                                                    active
                                                        ? 'border-[#1D3B2A] text-[#1D3B2A]'
                                                        : 'border-transparent text-[#545852] hover:text-[#1C211E]',
                                                )}
                                            >
                                                {opt.label} ({formatAmount(opt.count)})
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {deliveryQueue.length === 0 ? (
                            <div className="bg-[#FFFDF9] px-5 py-12 text-center">
                                <CheckCircle2
                                    className="mx-auto mb-2.5 size-6 text-[#164B2A]"
                                    aria-hidden="true"
                                />
                                <p className="text-[15px] font-bold text-[#1C211E]">
                                    Tidak ada antrean rangkaian aktif
                                </p>
                                <p className="mt-1 text-sm text-[#545852]">
                                    Semua kiriman terjadwal sudah selesai atau belum ada pesanan masuk.
                                </p>
                            </div>
                        ) : filteredQueue.length === 0 ? (
                            <div className="bg-[#FFFDF9] px-5 py-10 text-center">
                                <p className="text-[15px] font-semibold text-[#1C211E]">
                                    Tidak ada item pada kategori ini.
                                </p>
                                <div className="mt-3">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setQueueFilter('all')}
                                    >
                                        Lihat Semua Antrean
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-[#DED6C8]">
                                {groupedByUrgency.map((section) => (
                                    <div key={section.urgency}>
                                        <div
                                            className={cn(
                                                'flex items-center justify-between border-b border-[#DED6C8] px-5 py-2.5 text-[13px] font-bold',
                                                section.urgency === 'overdue'
                                                    ? 'bg-[#FCF0EC]/65 text-[#8A2619]'
                                                    : 'bg-[#F7F3EC] text-[#545852]',
                                            )}
                                        >
                                            <span>{section.label}</span>
                                            <span className="tabular-nums">
                                                {formatAmount(section.itemCount)} item
                                            </span>
                                        </div>

                                        <div className="divide-y divide-[#DED6C8]">
                                            {section.groups.map((grp) => {
                                                const isOverdueGroup = grp.urgency === 'overdue';
                                                return (
                                                    <div
                                                        key={grp.groupKey}
                                                        className={cn(
                                                            'bg-[#FFFDF9] px-5 py-4',
                                                            isOverdueGroup &&
                                                                'border-l-[3px] border-l-[#9A3B22]',
                                                        )}
                                                    >
                                                        {/* Group Order Header */}
                                                        <div className="flex items-start justify-between gap-2 pb-2.5">
                                                            <div className="min-w-0 flex-1 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2.5">
                                                                <span className="block text-[15px] font-bold text-[#1C211E] sm:inline">
                                                                    {grp.customerName}
                                                                </span>
                                                                <span className="block font-mono text-[13px] font-medium text-[#545852] sm:inline">
                                                                    {grp.orderNumber}
                                                                </span>
                                                            </div>
                                                            <Link
                                                                href={`/ui-orders/${grp.orderId}`}
                                                                component="Orders/Show"
                                                                prefetch="hover"
                                                                cacheFor="10s"
                                                                cacheTags={['orders']}
                                                                className="inline-flex min-h-[44px] shrink-0 items-center gap-1 px-1 text-[13px] font-semibold text-[#1D3B2A] hover:underline"
                                                            >
                                                                <span>Detail Nota</span>
                                                                <ChevronRight
                                                                    className="size-4"
                                                                    aria-hidden="true"
                                                                />
                                                            </Link>
                                                        </div>

                                                        {/* Grouped Bouquet Items (actions remain per item) */}
                                                        <div
                                                            className={cn(
                                                                'space-y-3',
                                                                grp.items.length > 1 &&
                                                                    'border-l border-[#DED6C8] pl-3.5',
                                                            )}
                                                        >
                                                            {grp.items.map((item) => {
                                                                const statusMeta = getFulfillmentBadgeMeta(
                                                                    item.fulfillment_status,
                                                                );
                                                                const isBusy =
                                                                    submittingItemId === item.item_id;
                                                                const nextLabel = item.next_status
                                                                    ? NEXT_STEP_LABEL[
                                                                          item.fulfillment_status
                                                                      ]
                                                                    : null;

                                                                return (
                                                                    <div
                                                                        key={item.item_id}
                                                                        className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-center"
                                                                    >
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="text-[15px] font-semibold text-[#1C211E]">
                                                                                    {item.flower_type}
                                                                                    {item.quantity > 1
                                                                                        ? ` (${formatAmount(item.quantity)})`
                                                                                        : ''}
                                                                                </p>
                                                                                <Badge
                                                                                    tone={
                                                                                        statusMeta.tone
                                                                                    }
                                                                                >
                                                                                    {statusMeta.label}
                                                                                </Badge>
                                                                            </div>
                                                                            <p className="mt-0.5 text-[13px] text-[#545852]">
                                                                                Kirim{' '}
                                                                                <span className="font-medium text-[#1C211E] tabular-nums">
                                                                                    {item.delivery_date}
                                                                                </span>
                                                                                {' · '}
                                                                                Penerima{' '}
                                                                                <span className="font-medium text-[#1C211E]">
                                                                                    {item.recipient}
                                                                                </span>
                                                                                {' · '}
                                                                                {item.delivery_location}
                                                                            </p>
                                                                        </div>

                                                                        {item.next_status &&
                                                                            nextLabel && (
                                                                                <Button
                                                                                    type="button"
                                                                                    variant={
                                                                                        item.fulfillment_status ===
                                                                                        'READY'
                                                                                            ? 'primary'
                                                                                            : 'secondary'
                                                                                    }
                                                                                    disabled={
                                                                                        submittingItemId !==
                                                                                        null
                                                                                    }
                                                                                    onClick={() =>
                                                                                        handleQueueAction(
                                                                                            item,
                                                                                        )
                                                                                    }
                                                                                    className="w-full shrink-0 sm:w-auto sm:min-w-[144px]"
                                                                                >
                                                                                    {isBusy
                                                                                        ? 'Menyimpan...'
                                                                                        : nextLabel}
                                                                                </Button>
                                                                            )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* D. Piutang Ringkas & Langsung Ditindaklanjuti */}
                    <aside
                        aria-labelledby="dash-piutang-title"
                        className="atelier-sheet overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-2 border-b border-[#DED6C8] bg-[#FFFDF9] px-5 py-4">
                            <h2 id="dash-piutang-title" className="atelier-h2">
                                Piutang Terbuka
                            </h2>
                            <Link
                                href={paymentsHref}
                                component="Payments/Index"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['payments', 'orders']}
                                className="inline-flex min-h-[44px] items-center gap-1 px-1 text-[13px] font-semibold text-[#1D3B2A] hover:underline"
                            >
                                <span>Lihat Semua</span>
                                <ChevronRight className="size-4" aria-hidden="true" />
                            </Link>
                        </div>

                        <Deferred
                            data="receivables"
                            fallback={
                                <div className="bg-[#FFFDF9] p-4 sm:p-5">
                                    {deferredErrors.receivables ? (
                                        <DeferredSectionError
                                            title="Daftar piutang belum termuat"
                                            message={deferredErrors.receivables}
                                            onRetry={() => router.reload({ only: ['receivables'] })}
                                        />
                                    ) : (
                                        <ReceivablesSkeleton />
                                    )}
                                </div>
                            }
                            rescue={({ reloading }) => (
                                <div className="bg-[#FFFDF9] p-4 sm:p-5">
                                    <DeferredSectionError
                                        title="Daftar piutang gagal dimuat"
                                        reloading={reloading}
                                        onRetry={() => router.reload({ only: ['receivables'] })}
                                    />
                                </div>
                            )}
                        >
                            {displayedReceivables.length === 0 ? (
                                <div className="bg-[#FFFDF9] px-5 py-10 text-center">
                                    <p className="text-[15px] font-semibold text-[#1C211E]">
                                        Semua tagihan sudah lunas
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[#DED6C8]">
                                    {displayedReceivables.map((rec) => {
                                        const pMeta = getPaymentBadgeMeta(rec.payment_status);
                                        return (
                                            <div
                                                key={rec.id}
                                                className="flex items-center justify-between gap-3 bg-[#FFFDF9] px-5 py-3.5"
                                            >
                                                <Link
                                                    href={`/ui-orders/${rec.id}`}
                                                    component="Orders/Show"
                                                    prefetch="hover"
                                                    cacheFor="10s"
                                                    cacheTags={['orders']}
                                                    className="group flex min-h-[44px] min-w-0 flex-1 flex-col justify-center"
                                                >
                                                    <span className="text-[15px] font-bold text-[#1C211E] group-hover:underline">
                                                        {rec.customer_name}
                                                    </span>
                                                    <span className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                                                        Sisa{' '}
                                                        <strong className="font-bold text-[#9A3B22]">
                                                            {formatRupiah(rec.outstanding)}
                                                        </strong>
                                                        {' · '}
                                                        <span>{pMeta.label}</span>
                                                    </span>
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() =>
                                                        setPaymentTarget({
                                                            id: rec.id,
                                                            order_number: rec.order_number,
                                                            customer_name: rec.customer_name,
                                                            outstanding: rec.outstanding,
                                                        })
                                                    }
                                                    className="min-w-[112px] shrink-0"
                                                >
                                                    Catat Bayar
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Deferred>
                    </aside>
                </div>

                {/* E. Ringkasan Kumulatif (Tenang, Prioritas Visual Rendah) */}
                <section
                    aria-label="Ringkasan akumulasi keseluruhan toko"
                    className="rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE]/55 px-5 py-4"
                >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <h2 className="text-[13px] font-bold text-[#545852]">
                            Ringkasan Kumulatif Sejak Awal Pencatatan ({formatAmount(stats.orders)} pesanan)
                        </h2>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] tabular-nums sm:grid-cols-4">
                            <div>
                                <span className="block text-[#545852]">Total Nilai Nota</span>
                                <strong className="font-bold text-[#1C211E]">
                                    {formatRupiah(stats.billed)}
                                </strong>
                            </div>
                            <div>
                                <span className="block text-[#545852]">Total Kas Masuk</span>
                                <strong className="font-bold text-[#1C211E]">
                                    {formatRupiah(stats.received)}
                                </strong>
                            </div>
                            <div>
                                <span className="block text-[#545852]">Total Pengeluaran</span>
                                <strong className="font-bold text-[#1C211E]">
                                    {formatRupiah(stats.expenses)}
                                </strong>
                            </div>
                            <div>
                                <span className="block text-[#545852]">Selisih Kas</span>
                                <strong className="font-bold text-[#1C211E]">
                                    {formatRupiah(stats.cash_flow)}
                                </strong>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <DeliveryConfirmModal
                open={deliverTarget !== null}
                target={deliverTarget}
                isSubmitting={submittingItemId !== null}
                onClose={() => setDeliverTarget(null)}
                onConfirm={() => {
                    if (deliverTarget) {
                        advanceStatus(
                            deliverTarget.orderId,
                            deliverTarget.itemId,
                            deliverTarget.nextStatus,
                        );
                    }
                }}
            />

            <PaymentModal
                open={paymentTarget !== null}
                order={paymentTarget}
                todayIso={fallbackTodayIso}
                returnTo="dashboard"
                onClose={() => setPaymentTarget(null)}
            />

            <Modal
                open={paymentPickerOpen}
                onClose={() => setPaymentPickerOpen(false)}
                title="Pilih Nota untuk Pembayaran"
                description="Pilih pesanan belum lunas yang ingin dicatat pembayarannya."
                footer={
                    <>
                        <Button asChild variant="secondary">
                            <Link
                                href={paymentsHref}
                                component="Payments/Index"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['payments', 'orders']}
                            >
                                Lihat Semua Piutang
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPaymentPickerOpen(false)}
                        >
                            Tutup
                        </Button>
                    </>
                }
            >
                <div className="space-y-2.5">
                    {receivables.map((rec) => {
                        const pMeta = getPaymentBadgeMeta(rec.payment_status);
                        return (
                            <div
                                key={rec.id}
                                className="flex flex-col justify-between gap-3 rounded-[8px] border border-[#DED6C8] bg-[#F7F3EC] p-3.5 sm:flex-row sm:items-center"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-[13px] font-semibold text-[#545852]">
                                            {rec.order_number}
                                        </span>
                                        <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                    </div>
                                    <p className="mt-1 text-[15px] font-bold text-[#1C211E]">
                                        {rec.customer_name}
                                    </p>
                                    <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                                        Total {formatRupiah(rec.total_amount)} · Sisa{' '}
                                        <strong className="text-[#9A3B22]">
                                            {formatRupiah(rec.outstanding)}
                                        </strong>
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="shrink-0 sm:min-w-[120px]"
                                    onClick={() => {
                                        setPaymentPickerOpen(false);
                                        setPaymentTarget({
                                            id: rec.id,
                                            order_number: rec.order_number,
                                            customer_name: rec.customer_name,
                                            outstanding: rec.outstanding,
                                        });
                                    }}
                                >
                                    Pilih Nota
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </>
    );
}
