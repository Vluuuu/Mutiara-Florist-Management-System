import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ReceiptText,
    ShoppingBag,
    Wallet,
} from 'lucide-react';
import { PipelineBar } from '@/components/charts/pipeline-bar';
import { DeliveryConfirmModal, type DeliveryConfirmTarget } from '@/components/delivery-confirm-modal';
import { LedgerSummaryStrip } from '@/components/ledger-summary-strip';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { PaymentModal, type PaymentModalTarget } from '@/components/payment-modal';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import {
    DataListSkeleton,
    DeferredSectionError,
    ReceivablesSkeleton,
    ReportChartSkeleton,
    SummaryStripSkeleton,
} from '@/components/ui/page-skeleton';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

const DashboardInsights = lazy(() => import('@/components/dashboard-insights'));
import { useNavigationState } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatRupiah, formatSignedRupiah, getWibTodayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    DashboardActivityItem,
    DashboardCashFlowPulse,
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
    cashFlowPulse?: DashboardCashFlowPulse;
    recentActivity?: DashboardActivityItem[];
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

const URGENCY_LABEL: Record<'overdue' | 'today' | 'upcoming', string> = {
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
    cashFlowPulse,
    recentActivity = [],
    todayIso,
    todayDisplay,
    nav,
}: DashboardProps) {
    const { errors, nav: sharedNav } = usePage<AppPageProps>().props;
    const { isNavigating: isRefreshing, deferredErrors } = useNavigationState();
    const resolvedNav = nav ?? sharedNav;
    const paymentsHref = resolvedNav?.uiPayments ?? '/ui-payments';
    const ordersHref = resolvedNav?.uiOrders ?? '/ui-orders';
    const reportsHref = resolvedNav?.uiReports ?? '/ui-reports';

    useInstantPageGuard(Boolean(stats));

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
        deliveryQueue.filter((i) => i.urgency === 'overdue').length;
    const readyCount =
        todayStats?.deliveries_ready ??
        queueSummary?.ready_count ??
        deliveryQueue.filter((i) => i.fulfillment_status === 'READY').length;
    const todayDueCount =
        todayStats?.deliveries_pending_today ??
        queueSummary?.today_count ??
        deliveryQueue.filter((i) => i.urgency === 'today').length;
    const todayTotalDeliveries = todayStats?.deliveries_total_today ?? todayDueCount;
    const todayDeliveredCount = todayStats?.deliveries_delivered_today ?? 0;

    const todayCashIn = todayStats?.cash_in ?? 0;
    const todayCashOut = todayStats?.cash_out ?? 0;
    const todayCashDiff = todayStats?.cash_diff ?? todayCashIn - todayCashOut;

    const pipelineNew = todayStats?.pipeline_new ?? 0;
    const pipelineProcessing = todayStats?.pipeline_processing ?? 0;
    const pipelineReady = todayStats?.pipeline_ready ?? readyCount;
    const pipelineTotal = todayStats?.pipeline_total ?? pipelineNew + pipelineProcessing + pipelineReady;
    const totalActiveQueueCount = queueSummary?.total_count ?? deliveryQueue.length;

    const filteredQueue = useMemo(() => {
        if (queueFilter === 'overdue') return deliveryQueue.filter((i) => i.urgency === 'overdue');
        if (queueFilter === 'today') return deliveryQueue.filter((i) => i.urgency === 'today');
        if (queueFilter === 'ready') return deliveryQueue.filter((i) => i.fulfillment_status === 'READY');
        return deliveryQueue;
    }, [deliveryQueue, queueFilter]);

    const groupedByUrgency = useMemo(
        () =>
            (['overdue', 'today', 'upcoming'] as const)
                .map((urgency) => {
                    const band = filteredQueue.filter((i) => i.urgency === urgency);
                    return {
                        urgency,
                        label: URGENCY_LABEL[urgency],
                        itemCount: band.length,
                        groups: groupQueueItems(band),
                    };
                })
                .filter((s) => s.itemCount > 0),
        [filteredQueue],
    );

    const queueFilterOptions: Array<{ key: QueueFilter; label: string; count: number }> = [
        { key: 'all', label: 'Semua', count: deliveryQueue.length },
        { key: 'today', label: 'Hari Ini', count: deliveryQueue.filter((i) => i.urgency === 'today').length },
        { key: 'overdue', label: 'Terlambat', count: deliveryQueue.filter((i) => i.urgency === 'overdue').length },
        { key: 'ready', label: 'Siap Kirim', count: deliveryQueue.filter((i) => i.fulfillment_status === 'READY').length },
    ];

    const advanceStatus = (orderId: number, itemId: number, targetStatus: FulfillmentStatus) => {
        if (stepLockRef.current || submittingItemId !== null) return;
        stepLockRef.current = true;
        setSubmittingItemId(itemId);
        router.post(
            `/ui-orders/${orderId}/items/${itemId}/status`,
            { target_status: targetStatus, return_to: 'dashboard' },
            {
                preserveScroll: true,
                onSuccess: () => setDeliverTarget(null),
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
                <PageHeader title="Hari Ini" subtitle="Memuat ringkasan harian & antrean pengiriman..." />
                <div className="flex flex-col gap-5 sm:gap-7">
                    <SummaryStripSkeleton cards={4} />
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:items-start">
                        <DataListSkeleton rows={4} showFilters={false} />
                        <div className="atelier-sheet p-5">
                            <ReceivablesSkeleton />
                        </div>
                    </div>
                </div>
            </>
        );
    }

    const diffClass = (v: number) =>
        v < 0 ? 'text-[var(--brand-urgent)]' : v > 0 ? 'text-[var(--status-paid-fg)]' : 'text-[var(--text-primary)]';

    return (
        <>
            <Head title="Hari Ini" />

            <PageHeader
                title="Hari Ini"
                subtitle={
                    todayDisplay || isRefreshing
                        ? `${todayDisplay ?? ''}${isRefreshing ? ' · Memperbarui...' : ''}`
                        : undefined
                }
                actions={
                    <>
                        <Button asChild variant="subtle" className="flex-1 sm:flex-none">
                            <Link
                                href="/ui-expenses/create"
                                component="Expenses/Create"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['expense-categories', 'expenses']}
                            >
                                <ReceiptText className="size-4" aria-hidden="true" />
                                Catat Pengeluaran
                            </Link>
                        </Button>
                        {receivables.length > 0 ? (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setPaymentPickerOpen(true)}
                                className="flex-1 sm:min-w-[164px] sm:flex-none"
                            >
                                <Wallet className="size-4" aria-hidden="true" />
                                Catat Pembayaran
                            </Button>
                        ) : (
                            <Button asChild variant="secondary" className="flex-1 sm:flex-none">
                                <Link
                                    href={paymentsHref}
                                    component="Payments/Index"
                                    prefetch="hover"
                                    cacheFor="10s"
                                    cacheTags={['payments', 'orders']}
                                >
                                    <Wallet className="size-4" aria-hidden="true" />
                                    Piutang &amp; Bayar
                                </Link>
                            </Button>
                        )}
                    </>
                }
            />

            {queueError && (
                <AlertBanner tone="error" className="mb-6">
                    {queueError}
                </AlertBanner>
            )}

            <div className="flex flex-col gap-6">
                {/* A. Primary KPI Strip */}
                <LedgerSummaryStrip
                    ariaLabel="Ringkasan kas dan operasional hari ini"
                    mobileColumns={2}
                    columns={4}
                    items={[
                        {
                            label: 'Kas Masuk Hari Ini',
                            value: formatRupiah(todayCashIn),
                            icon: Wallet,
                            tone: todayCashIn > 0 ? 'paid' : 'default',
                            hint: `${formatAmount(todayStats?.cash_in_count ?? 0)} pembayaran sah (WIB)`,
                        },
                        {
                            label: 'Kas Keluar Hari Ini',
                            value: formatRupiah(todayCashOut),
                            icon: ReceiptText,
                            tone: todayCashOut > 0 ? 'expense' : 'default',
                            hint: (
                                <span>
                                    Selisih kas{' '}
                                    <strong className={cn('font-bold', diffClass(todayCashDiff))}>
                                        {formatSignedRupiah(todayCashDiff)}
                                    </strong>
                                </span>
                            ),
                        },
                        {
                            label: 'Piutang Berjalan',
                            value: formatRupiah(stats.outstanding),
                            icon: ShoppingBag,
                            tone: stats.outstanding > 0 ? 'urgent' : 'default',
                            hint: `${formatAmount(todayStats?.open_receivables_count ?? receivables.length)} nota belum lunas`,
                        },
                        {
                            label: 'Kiriman & Pesanan Hari Ini',
                            value: `${formatAmount(todayTotalDeliveries)} kiriman`,
                            icon: CalendarDays,
                            tone: overdueCount > 0 ? 'urgent' : 'default',
                            hint: (
                                <span>
                                    {formatAmount(todayStats?.orders_count ?? 0)} nota (
                                    {formatRupiah(todayStats?.orders_billed ?? 0)})
                                    {overdueCount > 0 ? (
                                        <>
                                            {' · '}
                                            <strong className="font-bold text-[var(--brand-urgent)]">
                                                {formatAmount(overdueCount)} terlambat
                                            </strong>
                                        </>
                                    ) : todayDeliveredCount > 0 ? (
                                        ` · ${formatAmount(todayDeliveredCount)} terkirim`
                                    ) : null}
                                </span>
                            ),
                        },
                    ]}
                />

                {/* B, C, D. Primary Operational Workspace */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:items-start">
                    <section aria-labelledby="dash-agenda-title" className="atelier-sheet overflow-hidden">
                        <div className="space-y-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div>
                                    <h2 id="dash-agenda-title" className="atelier-h2">
                                        Pekerjaan &amp; Pengiriman
                                    </h2>
                                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                                        {formatAmount(readyCount)} siap kirim
                                        {overdueCount > 0 && (
                                            <>
                                                {' · '}
                                                <strong className="font-semibold text-[var(--brand-urgent)]">
                                                    {formatAmount(overdueCount)} terlambat
                                                </strong>
                                            </>
                                        )}
                                    </p>
                                </div>
                                <Link
                                    href={ordersHref}
                                    component="Orders/Index"
                                    prefetch="hover"
                                    cacheFor="10s"
                                    cacheTags={['orders']}
                                    className="inline-flex min-h-[44px] items-center gap-1 px-1 text-[13px] font-semibold text-[var(--brand-primary)] hover:underline"
                                >
                                    <span>Semua Pesanan</span>
                                    <ChevronRight className="size-4" aria-hidden="true" />
                                </Link>
                            </div>

                            {deliveryQueue.length > 0 && (
                                <SegmentedTabs<QueueFilter>
                                    ariaLabel="Filter antrean pengiriman"
                                    roleMode="tablist"
                                    variant="track"
                                    value={queueFilter}
                                    onChange={setQueueFilter}
                                    options={queueFilterOptions}
                                />
                            )}
                        </div>

                        {deliveryQueue.length === 0 ? (
                            <EmptyState
                                icon={CheckCircle2}
                                iconTone="paid"
                                headingLevel="h3"
                                title="Tidak ada antrean rangkaian aktif"
                                description="Semua kiriman terjadwal sudah selesai atau belum ada pesanan masuk."
                            />
                        ) : filteredQueue.length === 0 ? (
                            <EmptyState
                                headingLevel="h3"
                                title="Tidak ada item pada filter ini"
                                description="Pilih filter Semua untuk melihat seluruh rangkaian yang sedang berjalan."
                                action={
                                    <Button type="button" variant="secondary" onClick={() => setQueueFilter('all')}>
                                        Lihat Semua Antrean
                                    </Button>
                                }
                            />
                        ) : (
                            <div className="divide-y divide-[var(--border-hairline)]">
                                {groupedByUrgency.map((section) => (
                                    <div key={section.urgency}>
                                        <div
                                            className={cn(
                                                'flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-2.5 text-[13px] font-bold',
                                                section.urgency === 'overdue'
                                                    ? 'bg-[var(--brand-urgent-soft)] text-[var(--danger-ink)]'
                                                    : 'bg-[var(--bg-sunken)]/60 text-[var(--text-secondary)]',
                                            )}
                                        >
                                            <span>{section.label}</span>
                                            <span className="tabular-nums">{formatAmount(section.itemCount)} item</span>
                                        </div>

                                        <div className="divide-y divide-[var(--border-hairline)]">
                                            {section.groups.map((grp) => (
                                                <div
                                                    key={grp.groupKey}
                                                    className={cn(
                                                        'bg-[var(--bg-surface)] px-5 py-4',
                                                        grp.urgency === 'overdue' && 'border-l-[3px] border-l-[var(--brand-urgent)]',
                                                    )}
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                                                            <span className="text-[15px] font-bold text-[var(--text-primary)]">
                                                                {grp.customerName}
                                                            </span>
                                                            <OrderCodeBadge orderNumber={grp.orderNumber} compact />
                                                        </div>
                                                        <Link
                                                            href={`/ui-orders/${grp.orderId}`}
                                                            component="Orders/Show"
                                                            prefetch="hover"
                                                            cacheFor="10s"
                                                            cacheTags={['orders']}
                                                            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 px-1 text-[13px] font-semibold text-[var(--brand-primary)] hover:underline"
                                                        >
                                                            <span>Detail Nota</span>
                                                            <ChevronRight className="size-4" aria-hidden="true" />
                                                        </Link>
                                                    </div>

                                                    <div
                                                        className={cn(
                                                            'space-y-3',
                                                            grp.items.length > 1 && 'border-l border-[var(--border-hairline)] pl-3.5',
                                                        )}
                                                    >
                                                        {grp.items.map((item) => {
                                                            const sMeta = getFulfillmentBadgeMeta(item.fulfillment_status);
                                                            const nextLabel = item.next_status
                                                                ? NEXT_STEP_LABEL[item.fulfillment_status]
                                                                : null;
                                                            return (
                                                                <div
                                                                    key={item.item_id}
                                                                    className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-center"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                                                                                {item.flower_type}
                                                                                {item.quantity > 1
                                                                                    ? ` (${formatAmount(item.quantity)})`
                                                                                    : ''}
                                                                            </p>
                                                                            <Badge tone={sMeta.tone}>{sMeta.label}</Badge>
                                                                        </div>
                                                                        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                                                                            Kirim{' '}
                                                                            <span className="font-medium text-[var(--text-primary)] tabular-nums">
                                                                                {item.delivery_date}
                                                                            </span>
                                                                            {' · '}Penerima{' '}
                                                                            <span className="font-medium text-[var(--text-primary)]">
                                                                                {item.recipient}
                                                                            </span>
                                                                            {' · '}
                                                                            {item.delivery_location}
                                                                        </p>
                                                                    </div>

                                                                    {item.next_status && nextLabel && (
                                                                        <Button
                                                                            type="button"
                                                                            variant={
                                                                                item.fulfillment_status === 'READY'
                                                                                    ? 'primary'
                                                                                    : 'subtle'
                                                                            }
                                                                            disabled={submittingItemId !== null}
                                                                            onClick={() => handleQueueAction(item)}
                                                                            className="w-full shrink-0 sm:w-auto sm:min-w-[140px]"
                                                                        >
                                                                            {submittingItemId === item.item_id
                                                                                ? 'Menyimpan...'
                                                                                : nextLabel}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {totalActiveQueueCount > deliveryQueue.length && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-sunken)]/45 px-5 py-3 text-[13px] text-[var(--text-secondary)]">
                                        <span className="tabular-nums">
                                            Menampilkan {formatAmount(deliveryQueue.length)} dari{' '}
                                            {formatAmount(totalActiveQueueCount)} rangkaian aktif teratas
                                        </span>
                                        <Link
                                            href={ordersHref}
                                            component="Orders/Index"
                                            prefetch="hover"
                                            cacheFor="10s"
                                            cacheTags={['orders']}
                                            className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline"
                                        >
                                            Lihat semua di Pesanan
                                            <ChevronRight className="size-4" aria-hidden="true" />
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <div className="space-y-6">
                        {/* D. Active Fulfillment Pipeline */}
                        <section aria-labelledby="dash-pipeline-title" className="atelier-sheet p-5">
                            <div className="mb-3 flex items-baseline justify-between gap-2">
                                <h2 id="dash-pipeline-title" className="atelier-h2">
                                    Status Pengerjaan Aktif
                                </h2>
                                <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                                    Semua pesanan aktif
                                </span>
                            </div>
                            <PipelineBar
                                total={pipelineTotal}
                                segments={[
                                    { key: 'NEW', label: 'Baru', count: pipelineNew, barColor: '#6A716A', dotColor: '#6A716A', textColor: '#1B211D' },
                                    { key: 'PROCESSING', label: 'Diproses', count: pipelineProcessing, barColor: '#C07624', dotColor: '#C07624', textColor: '#8F4B1E' },
                                    { key: 'READY', label: 'Siap Kirim', count: pipelineReady, barColor: '#193F66', dotColor: '#193F66', textColor: '#193F66' },
                                ]}
                            />
                        </section>

                        {/* C. Piutang Terbuka (AUD-06 Closed) */}
                        <aside aria-labelledby="dash-piutang-title" className="atelier-sheet overflow-hidden">
                            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-3.5">
                                <h2 id="dash-piutang-title" className="atelier-h2">
                                    Piutang Terbuka
                                </h2>
                                <Link
                                    href={paymentsHref}
                                    component="Payments/Index"
                                    prefetch="hover"
                                    cacheFor="10s"
                                    cacheTags={['payments', 'orders']}
                                    className="inline-flex min-h-[44px] items-center gap-1 px-1 text-[13px] font-semibold text-[var(--brand-primary)] hover:underline"
                                >
                                    <span>Lihat Semua</span>
                                    <ChevronRight className="size-4" aria-hidden="true" />
                                </Link>
                            </div>

                            <Deferred
                                data="receivables"
                                fallback={
                                    <div className="bg-[var(--bg-surface)] p-5">
                                        {deferredErrors.receivables ? (
                                            <DeferredSectionError
                                                title="Daftar piutang gagal dimuat"
                                                message={deferredErrors.receivables}
                                                onRetry={() => router.reload({ only: ['receivables'] })}
                                            />
                                        ) : (
                                            <ReceivablesSkeleton />
                                        )}
                                    </div>
                                }
                                rescue={({ reloading }) => (
                                    <div className="bg-[var(--bg-surface)] p-5">
                                        <DeferredSectionError
                                            title="Daftar piutang gagal dimuat"
                                            reloading={reloading}
                                            onRetry={() => router.reload({ only: ['receivables'] })}
                                        />
                                    </div>
                                )}
                            >
                                {displayedReceivables.length === 0 ? (
                                    <EmptyState
                                        icon={CheckCircle2}
                                        iconTone="paid"
                                        headingLevel="h3"
                                        title="Semua tagihan sudah lunas"
                                        description="Tidak ada nota dengan sisa piutang terbuka saat ini."
                                        className="py-8"
                                    />
                                ) : (
                                    <div className="divide-y divide-[var(--border-hairline)]">
                                        {displayedReceivables.map((rec) => {
                                            const pMeta = getPaymentBadgeMeta(rec.payment_status);
                                            return (
                                                <div
                                                    key={rec.id}
                                                    className="flex flex-col gap-2.5 bg-[var(--bg-surface)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <Link
                                                                href={`/ui-orders/${rec.id}`}
                                                                component="Orders/Show"
                                                                prefetch="hover"
                                                                cacheFor="10s"
                                                                cacheTags={['orders']}
                                                                className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-primary)] hover:underline"
                                                            >
                                                                {rec.customer_name}
                                                            </Link>
                                                            <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-[var(--text-secondary)] tabular-nums">
                                                            <OrderCodeBadge orderNumber={rec.order_number} compact />
                                                            <span>Nota {rec.order_date}</span>
                                                        </div>
                                                        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)] tabular-nums">
                                                            Sisa{' '}
                                                            <strong className="font-bold text-[var(--brand-urgent)]">
                                                                {formatRupiah(rec.outstanding)}
                                                            </strong>
                                                        </p>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="subtle"
                                                        size="sm"
                                                        aria-label={`Catat bayar untuk ${rec.customer_name} nota ${rec.order_number}`}
                                                        onClick={() =>
                                                            setPaymentTarget({
                                                                id: rec.id,
                                                                order_number: rec.order_number,
                                                                customer_name: rec.customer_name,
                                                                outstanding: rec.outstanding,
                                                            })
                                                        }
                                                        className="w-full shrink-0 sm:w-auto sm:min-w-[104px]"
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
                </div>

                {/* E & F. Secondary Business Intelligence (Lazy chunk + Deferred 'insights') */}
                <Suspense
                    fallback={
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
                            <ReportChartSkeleton />
                            <div className="atelier-sheet p-5">
                                <ReceivablesSkeleton />
                            </div>
                        </div>
                    }
                >
                    <DashboardInsights
                        cashFlowPulse={cashFlowPulse}
                        recentActivity={recentActivity}
                        deferredErrors={deferredErrors}
                        reportsHref={reportsHref}
                    />
                </Suspense>

                {/* Ringkasan Kumulatif Collapsible */}
                <details className="group rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/55">
                    <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-[13.5px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <span className="tabular-nums">
                            Ringkasan Kumulatif Sejak Awal Pencatatan ({formatAmount(stats.orders)} pesanan)
                        </span>
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--brand-primary)]">
                            <span className="group-open:hidden">Lihat rincian</span>
                            <span className="hidden group-open:inline">Sembunyikan</span>
                            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                        </span>
                    </summary>
                    <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-hairline)] px-5 py-4 text-[13.5px] tabular-nums sm:grid-cols-4">
                        {[
                            { label: 'Total Nilai Nota', val: formatRupiah(stats.billed), cls: 'text-[var(--text-primary)]' },
                            { label: 'Total Kas Masuk', val: formatRupiah(stats.received), cls: 'text-[var(--status-paid-fg)]' },
                            { label: 'Total Pengeluaran', val: formatRupiah(stats.expenses), cls: 'text-[var(--expense-ink)]' },
                            { label: 'Selisih Kas Kumulatif', val: formatSignedRupiah(stats.cash_flow), cls: diffClass(stats.cash_flow) },
                        ].map((c) => (
                            <div key={c.label}>
                                <span className="block text-[var(--text-secondary)]">{c.label}</span>
                                <strong className={cn('mt-0.5 block text-base font-bold', c.cls)}>{c.val}</strong>
                            </div>
                        ))}
                    </div>
                </details>
            </div>

            <DeliveryConfirmModal
                open={deliverTarget !== null}
                target={deliverTarget}
                isSubmitting={submittingItemId !== null}
                onClose={() => setDeliverTarget(null)}
                onConfirm={() => {
                    if (deliverTarget) advanceStatus(deliverTarget.orderId, deliverTarget.itemId, deliverTarget.nextStatus);
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
                description="Pilih satu nota spesifik yang dibayar pelanggan agar pencatatan tetap akurat."
            >
                <div className="space-y-2.5">
                    {receivables.map((rec) => {
                        const pMeta = getPaymentBadgeMeta(rec.payment_status);
                        return (
                            <button
                                key={rec.id}
                                type="button"
                                onClick={() => {
                                    setPaymentPickerOpen(false);
                                    setPaymentTarget({
                                        id: rec.id,
                                        order_number: rec.order_number,
                                        customer_name: rec.customer_name,
                                        outstanding: rec.outstanding,
                                    });
                                }}
                                className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--bg-sunken)]/60"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="text-[15px] font-bold text-[var(--text-primary)]">{rec.customer_name}</p>
                                        <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-[var(--text-secondary)] tabular-nums">
                                        <OrderCodeBadge orderNumber={rec.order_number} compact />
                                        <span>Nota {rec.order_date}</span>
                                    </div>
                                </div>
                                <span className="shrink-0 text-[15px] font-bold text-[var(--brand-urgent)] tabular-nums">
                                    {formatRupiah(rec.outstanding)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </Modal>
        </>
    );
}
