import { useMemo, useState, type ReactNode } from 'react';
import { Deferred, Link, router } from '@inertiajs/react';
import { ChevronRight, History, ReceiptText, ShoppingBag, Wallet } from 'lucide-react';
import { CashFlowChart } from '@/components/charts/cash-flow-chart';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
    DeferredSectionError,
    ReceivablesSkeleton,
    ReportChartSkeleton,
} from '@/components/ui/page-skeleton';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { formatRupiah, formatSignedRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardActivityItem, DashboardCashFlowPulse } from '@/types';

type PulseRange = '7d' | '30d';

type DashboardInsightsProps = {
    cashFlowPulse?: DashboardCashFlowPulse;
    recentActivity?: DashboardActivityItem[];
    deferredErrors: Record<string, string>;
    reportsHref: string;
};

function DeferredBox({
    dataKey,
    errorTitle,
    deferredError,
    skeleton,
    children,
}: {
    dataKey: string;
    errorTitle: string;
    deferredError?: string;
    skeleton: ReactNode;
    children: ReactNode;
}) {
    const reload = () => router.reload({ only: [dataKey] });
    return (
        <Deferred
            data={dataKey}
            fallback={
                <div className="bg-[var(--bg-surface)] p-5">
                    {deferredError ? (
                        <DeferredSectionError
                            title={errorTitle}
                            message={deferredError}
                            onRetry={reload}
                        />
                    ) : (
                        skeleton
                    )}
                </div>
            }
            rescue={({ reloading }) => (
                <div className="bg-[var(--bg-surface)] p-5">
                    <DeferredSectionError
                        title={errorTitle}
                        reloading={reloading}
                        onRetry={reload}
                    />
                </div>
            )}
        >
            {children}
        </Deferred>
    );
}

/**
 * Panel analitik sekunder Dashboard (Arus Kas 7h/30h + Aktivitas Bisnis Terbaru).
 * Dimuat lazy secara paralel dengan prop Inertia deferred 'insights' agar bundle eager
 * Instant Navigation V2 tetap ramping.
 */
export default function DashboardInsights({
    cashFlowPulse,
    recentActivity = [],
    deferredErrors,
    reportsHref,
}: DashboardInsightsProps) {
    const [pulseRange, setPulseRange] = useState<PulseRange>('7d');

    const activePulse = cashFlowPulse
        ? pulseRange === '7d'
            ? cashFlowPulse.period_7d
            : cashFlowPulse.period_30d
        : null;

    const pulsePoints = useMemo(
        () =>
            activePulse
                ? activePulse.points.map((p) => ({
                      key: p.date,
                      label: p.label,
                      fullLabel: p.full_label,
                      cashIn: p.cash_in,
                      cashOut: p.cash_out,
                      cashDiff: p.cash_diff,
                  }))
                : [],
        [activePulse],
    );

    const diffClass = (v: number) =>
        v < 0
            ? 'text-[var(--brand-urgent)]'
            : v > 0
              ? 'text-[var(--status-paid-fg)]'
              : 'text-[var(--text-primary)]';

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] lg:items-start">
            {/* E. Cash Flow Pulse (7d/30d in-memory toggle, zero extra HTTP requests) */}
            <section aria-labelledby="dash-cashflow-title" className="atelier-sheet overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 id="dash-cashflow-title" className="atelier-h2">
                                Arus Kas Harian
                            </h2>
                            <Link
                                href={reportsHref}
                                component="Reports/Index"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['reports', 'orders', 'payments', 'expenses']}
                                className="inline-flex min-h-[44px] items-center gap-0.5 px-1 text-[13px] font-semibold text-[var(--brand-primary)] hover:underline"
                            >
                                <span>Buka Laporan</span>
                                <ChevronRight className="size-4" aria-hidden="true" />
                            </Link>
                        </div>
                        <p className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                            {activePulse ? activePulse.label : 'Memuat periode WIB...'}
                        </p>
                    </div>

                    <SegmentedTabs<PulseRange>
                        ariaLabel="Pilih rentang arus kas"
                        value={pulseRange}
                        onChange={setPulseRange}
                        options={[
                            { key: '7d', label: '7 Hari' },
                            { key: '30d', label: '30 Hari' },
                        ]}
                    />
                </div>

                <DeferredBox
                    dataKey="cashFlowPulse"
                    errorTitle="Grafik arus kas gagal dimuat"
                    deferredError={deferredErrors.cashFlowPulse}
                    skeleton={<ReportChartSkeleton />}
                >
                    {activePulse && (
                        <div className="space-y-4 p-5">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {[
                                    {
                                        label: 'Total Kas Masuk',
                                        val: formatRupiah(activePulse.cash_in),
                                        cls: 'text-[var(--status-paid-fg)]',
                                    },
                                    {
                                        label: 'Total Kas Keluar',
                                        val: formatRupiah(activePulse.cash_out),
                                        cls: 'text-[var(--expense-ink)]',
                                    },
                                    {
                                        label: 'Selisih Kas Periode',
                                        val: formatSignedRupiah(activePulse.cash_diff),
                                        cls: diffClass(activePulse.cash_diff),
                                    },
                                ].map((m) => (
                                    <div
                                        key={m.label}
                                        className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/40 px-3.5 py-2.5"
                                    >
                                        <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                                            {m.label}
                                        </p>
                                        <p className={cn('mt-0.5 text-lg font-bold tabular-nums', m.cls)}>
                                            {m.val}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <CashFlowChart
                                points={pulsePoints}
                                hasActivity={activePulse.has_activity}
                                ariaLabel={`Grafik arus kas harian ${pulseRange === '7d' ? '7 hari' : '30 hari'} terakhir (${activePulse.label})`}
                            />
                        </div>
                    )}
                </DeferredBox>
            </section>

            {/* F. Recent Business Activity (<= 6 real POSTED events, not full audit log) */}
            <section aria-labelledby="dash-activity-title" className="atelier-sheet overflow-hidden">
                <div className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4">
                    <h2 id="dash-activity-title" className="atelier-h2">
                        Aktivitas Bisnis Terbaru
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                        Hingga 6 transaksi sah terbaru (bukan log audit penuh)
                    </p>
                </div>

                <DeferredBox
                    dataKey="recentActivity"
                    errorTitle="Aktivitas terbaru gagal dimuat"
                    deferredError={deferredErrors.recentActivity}
                    skeleton={<ReceivablesSkeleton />}
                >
                    {recentActivity.length === 0 ? (
                        <EmptyState
                            icon={History}
                            headingLevel="h3"
                            title="Belum ada aktivitas tercatat"
                            description="Pesanan baru, pembayaran sah, dan pengeluaran sah akan tampil di sini."
                            className="py-10"
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--border-hairline)]">
                            {recentActivity.map((ev) => {
                                const isPay = ev.type === 'payment';
                                const isExp = ev.type === 'expense';
                                const Icon = isPay ? Wallet : isExp ? ReceiptText : ShoppingBag;
                                return (
                                    <li key={ev.key}>
                                        <Link
                                            href={ev.href}
                                            component={ev.component}
                                            prefetch="hover"
                                            cacheFor="10s"
                                            className="flex min-h-[56px] items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-sunken)]/45"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[8px]',
                                                    isPay
                                                        ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                                                        : isExp
                                                          ? 'bg-[var(--expense-soft)] text-[var(--expense-ink)]'
                                                          : 'bg-[var(--bg-sunken)] text-[var(--text-secondary)]',
                                                )}
                                            >
                                                <Icon className="size-4" />
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                                                        {ev.title}
                                                    </p>
                                                    <span
                                                        className={cn(
                                                            'shrink-0 text-sm font-bold tabular-nums',
                                                            isPay
                                                                ? 'text-[var(--status-paid-fg)]'
                                                                : isExp
                                                                  ? 'text-[var(--expense-ink)]'
                                                                  : 'text-[var(--text-primary)]',
                                                        )}
                                                    >
                                                        {isPay
                                                            ? `+${formatRupiah(ev.amount)}`
                                                            : isExp
                                                              ? `-${formatRupiah(ev.amount)}`
                                                              : formatRupiah(ev.amount)}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-[var(--text-secondary)]">
                                                    <span className="font-semibold text-[var(--text-primary)]">
                                                        {ev.label}
                                                    </span>
                                                    {ev.order_number && (
                                                        <>
                                                            <span>·</span>
                                                            <OrderCodeBadge
                                                                orderNumber={ev.order_number}
                                                                compact
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)] tabular-nums">
                                                    {ev.subtitle} · {ev.occurred_at}
                                                </p>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </DeferredBox>
            </section>
        </div>
    );
}
