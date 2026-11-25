import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { BarChart3, ChevronRight, ReceiptText, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import {
    computeLinearScale,
    computeXAxisLabelIndices,
    formatAxisInteger,
    formatAxisRupiah,
    isPartialPeriodLabel,
} from '@/lib/chart-scale';
import { formatAmount, formatRupiah, formatSignedRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    ExpenseBreakdownItem,
    FulfillmentBreakdown,
    PaymentBreakdown,
    PaymentMethodBreakdownItem,
    ReportChartPoint,
    ReportGranularity,
} from '@/types';

type TrendTab = 'cashflow' | 'orders' | 'net';

// Verified WCAG AA / 1.4.11 (>= 3.0:1) Calm Botanical Workspace V2 chart palette
const COLOR_CASH_IN = '#1B3B2B'; // Botanical green (12.11:1 vs #FFFDF9)
const COLOR_CASH_OUT = '#C07624'; // Amber (3.53:1 vs #FFFDF9, 3.43:1 vs #1B3B2B)
const COLOR_ORDERS = '#2D5340'; // Botanical pine (8.53:1 vs #FFFDF9)
const COLOR_NET_LINE = '#193F66'; // Navy (10.63:1 vs #FFFDF9)
const COLOR_NET_NEG = '#9A3B22'; // Terracotta negative marker (6.84:1 vs #FFFDF9)
const COLOR_GRID = '#E7E0D6';
const COLOR_ZERO_BASELINE = '#6B665C'; // 5.62:1 vs #FFFDF9

const TREND_TAB_OPTIONS: Array<{ key: TrendTab; label: string }> = [
    { key: 'cashflow', label: 'Arus Kas' },
    { key: 'orders', label: 'Pesanan' },
    { key: 'net', label: 'Selisih Kas' },
];

const GRANULARITY_OPTIONS: Array<{ key: ReportGranularity; label: string }> = [
    { key: 'daily', label: 'Harian' },
    { key: 'weekly', label: 'Mingguan' },
    { key: 'monthly', label: 'Bulanan' },
    { key: 'yearly', label: 'Tahunan' },
];

function formatShareLabel(amount: number, total: number, serverExact?: number): string {
    if (total <= 0 || amount <= 0) return '0%';
    const exact = serverExact ?? (amount / total) * 100;
    if (exact > 0 && exact < 1) {
        return `${exact.toFixed(1).replace('.', ',')}%`;
    }
    return `${Math.round(exact)}%`;
}

function hasActivity(p: ReportChartPoint): boolean {
    return p.orders_count > 0 || p.billed > 0 || p.cash_in > 0 || p.cash_out > 0;
}

type FinancialTrendChartProps = {
    points: ReportChartPoint[];
    granularity: ReportGranularity;
    rangeLabel: string;
    notice?: string | null;
    isLoading?: boolean;
    onGranularityChange: (g: ReportGranularity) => void;
};

export function FinancialTrendChart({
    points,
    granularity,
    rangeLabel,
    notice = null,
    isLoading = false,
    onGranularityChange,
}: FinancialTrendChartProps) {
    const [activeTab, setActiveTab] = useState<TrendTab>('cashflow');
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [containerWidth, setContainerWidth] = useState<number>(860);
    const plotContainerRef = useRef<HTMLDivElement | null>(null);
    const periodRefs = useRef<Array<SVGGElement | null>>([]);

    const hasAnyActivity = useMemo(() => points.some(hasActivity), [points]);
    const hasPartialPeriods = useMemo(
        () => points.some((pt) => isPartialPeriodLabel(pt.full_label)),
        [points],
    );

    useEffect(() => {
        setActiveIndex(null);
        setTooltipOpen(false);
    }, [granularity, points.length]);

    useEffect(() => {
        const el = plotContainerRef.current;
        if (!el) return;

        const updateWidth = () => {
            const nextWidth = Math.floor(el.getBoundingClientRect().width);
            if (nextWidth > 0) {
                setContainerWidth(nextWidth);
            }
        };

        updateWidth();

        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(updateWidth);
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasAnyActivity]);

    const selectedIndex = useMemo(() => {
        if (points.length === 0) return null;
        if (activeIndex !== null && activeIndex >= 0 && activeIndex < points.length) {
            return activeIndex;
        }
        for (let i = points.length - 1; i >= 0; i -= 1) {
            if (hasActivity(points[i])) return i;
        }
        return points.length - 1;
    }, [points, activeIndex]);

    const selectedPoint = selectedIndex !== null ? points[selectedIndex] : null;
    const selectedIsPartial = selectedPoint ? isPartialPeriodLabel(selectedPoint.full_label) : false;

    const scale = useMemo(() => {
        if (activeTab === 'cashflow') {
            const vals = points.flatMap((pt) => [pt.cash_in, pt.cash_out]);
            return computeLinearScale(vals, {
                integerOnly: false,
                defaultMax: 100_000,
                targetIntervals: 4,
                maxIntervals: 5,
            });
        }
        if (activeTab === 'orders') {
            const vals = points.map((pt) => pt.orders_count);
            return computeLinearScale(vals, {
                integerOnly: true,
                defaultMax: 4,
                targetIntervals: 4,
                maxIntervals: 5,
            });
        }
        const vals = points.map((pt) => pt.cash_diff);
        return computeLinearScale(vals, {
            integerOnly: false,
            defaultMax: 100_000,
            targetIntervals: 4,
            maxIntervals: 6,
        });
    }, [points, activeTab]);

    const isCompact = containerWidth < 520;
    const minSlotPx = isCompact ? 32 : 28;
    const svgW = Math.max(containerWidth, points.length > 14 ? points.length * minSlotPx + 96 : containerWidth);
    const svgH = isCompact ? 248 : 280;
    const padL = isCompact ? 64 : 80;
    const padR = 16;
    const padT = 16;
    const padB = 34;
    const plotW = Math.max(120, svgW - padL - padR);
    const plotH = svgH - padT - padB;
    const ySpan = Math.max(scale.yMax - scale.yMin, 1);

    const toY = (val: number) => padT + ((scale.yMax - val) / ySpan) * plotH;
    const yZero = toY(0);

    const slotW = points.length > 0 ? plotW / points.length : plotW;
    const maxVisibleXLabels = Math.max(2, Math.floor(plotW / (isCompact ? 58 : 74)));
    const visibleXLabelIndices = useMemo(
        () => computeXAxisLabelIndices(points.length, maxVisibleXLabels),
        [points.length, maxVisibleXLabels],
    );

    // Bar sizing for grouped ('cashflow') and single-series ('orders') tabs
    const groupedBarGap = slotW > 56 ? 6 : slotW > 30 ? 4 : 2;
    const groupedBarW = Math.max(5, Math.min(28, Math.floor((slotW * 0.62 - groupedBarGap) / 2)));
    const singleBarW = Math.max(8, Math.min(40, Math.floor(slotW * 0.44)));

    // Polyline coordinates for Selisih Kas (straight segments, no curve distortion)
    const netLinePoints = useMemo(() => {
        if (activeTab !== 'net' || points.length < 2) return '';
        return points
            .map((pt, idx) => {
                const cx = padL + idx * slotW + slotW / 2;
                const cy = toY(pt.cash_diff);
                return `${cx.toFixed(1)},${cy.toFixed(1)}`;
            })
            .join(' ');
    }, [activeTab, points, padL, slotW, scale.yMax, ySpan, plotH]);

    const tooltipAnchor = useMemo(() => {
        if (selectedIndex === null || points.length === 0) return null;
        const cx = padL + selectedIndex * slotW + slotW / 2;
        const pct = Math.max(0, Math.min(100, (cx / svgW) * 100));
        if (pct < 26) return { left: `${Math.max(2, pct)}%`, transform: 'translateX(0)' };
        if (pct > 74) return { left: `${Math.min(98, pct)}%`, transform: 'translateX(-100%)' };
        return { left: `${pct}%`, transform: 'translateX(-50%)' };
    }, [selectedIndex, points.length, padL, slotW, svgW]);

    const chartAriaLabel = useMemo(() => {
        if (activeTab === 'cashflow') {
            return `Grafik batang berkelompok Arus Kas (Kas Masuk dan Kas Keluar Sah) ${rangeLabel}`;
        }
        if (activeTab === 'orders') {
            return `Grafik batang Jumlah Nota Pesanan ${rangeLabel}`;
        }
        return `Grafik garis Selisih Kas ${rangeLabel}`;
    }, [activeTab, rangeLabel]);

    return (
        <section
            aria-label="Grafik tren keuangan"
            data-testid="financial-trend-card"
            className="atelier-sheet mb-6 overflow-hidden"
        >
            {/* Header, Segmented Metric Tabs & Granularity Switcher */}
            <div className="flex flex-col gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4 lg:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="atelier-h2">Tren Keuangan</h2>
                        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                            {rangeLabel}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                        <SegmentedTabs<TrendTab>
                            ariaLabel="Jenis grafik tren keuangan"
                            roleMode="tablist"
                            idPrefix="financial-trend"
                            value={activeTab}
                            onChange={(nextTab) => {
                                setActiveTab(nextTab);
                                setTooltipOpen(false);
                            }}
                            options={TREND_TAB_OPTIONS}
                            className="w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
                        />
                        <SegmentedTabs<ReportGranularity>
                            ariaLabel="Pengelompokan periode grafik"
                            value={granularity}
                            disabled={isLoading}
                            onChange={onGranularityChange}
                            options={GRANULARITY_OPTIONS}
                            className="w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
                        />
                    </div>
                </div>
            </div>

            {notice && (
                <div
                    role="status"
                    data-testid="daily-truncation-notice"
                    className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/55 px-5 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)] lg:px-6"
                >
                    {notice}
                </div>
            )}

            <div className="bg-[var(--bg-surface)] px-5 py-4 sm:px-6 sm:py-5">
                {/* 1. Separate Legend Strip (consistent height across all three tabs) */}
                <div
                    data-testid="trend-chart-legend"
                    className="mb-3 flex min-h-[28px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12.5px]"
                >
                    {activeTab === 'cashflow' && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-semibold text-[var(--text-primary)]">
                            <span className="inline-flex items-center gap-2">
                                <span
                                    className="inline-block size-2.5 rounded-[2px]"
                                    style={{ backgroundColor: COLOR_CASH_IN }}
                                    aria-hidden="true"
                                />
                                Kas Masuk (Sah)
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <span
                                    className="inline-block size-2.5 rounded-[2px]"
                                    style={{ backgroundColor: COLOR_CASH_OUT }}
                                    aria-hidden="true"
                                />
                                Kas Keluar (Sah)
                            </span>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-semibold text-[var(--text-primary)]">
                            <span className="inline-flex items-center gap-2">
                                <span
                                    className="inline-block size-2.5 rounded-[2px]"
                                    style={{ backgroundColor: COLOR_ORDERS }}
                                    aria-hidden="true"
                                />
                                Jumlah Nota Pesanan
                            </span>
                            <span className="font-normal text-[var(--text-secondary)]">
                                Dihitung per nota pesanan yang dibuat pada periode
                            </span>
                        </div>
                    )}

                    {activeTab === 'net' && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-[var(--text-primary)]">
                            <span className="inline-flex items-center gap-2 text-[#193F66]">
                                <span
                                    aria-hidden="true"
                                    className="inline-flex items-center"
                                >
                                    <span className="inline-block h-[2px] w-4 bg-[#193F66]" />
                                    <span className="-ml-2.5 inline-block size-2 rounded-full bg-[#193F66]" />
                                </span>
                                Selisih Kas (Positif atau Nol)
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[#9A3B22]">
                                <span
                                    aria-hidden="true"
                                    className="inline-block size-2 rounded-full bg-[#9A3B22]"
                                />
                                Negatif
                            </span>
                            <span className="font-normal text-[var(--text-secondary)]">
                                Kas masuk dikurangi kas keluar (bukan laba bersih)
                            </span>
                        </div>
                    )}
                </div>

                {/* 2. Separate Selected-Period Summary Strip (stable min-height across all tabs) */}
                <div
                    data-testid="trend-chart-summary"
                    aria-live="polite"
                    aria-atomic="true"
                    className="mb-4 flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-[var(--border-hairline)] bg-[var(--bg-sunken)]/35 px-3.5 py-2 text-[13px] tabular-nums"
                >
                    {selectedPoint && hasAnyActivity ? (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-[var(--text-primary)]">
                                    {selectedPoint.full_label}
                                </span>
                                {selectedIsPartial && !selectedPoint.full_label.includes('(parsial)') && (
                                    <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">
                                        (parsial)
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                {activeTab === 'cashflow' && (
                                    <>
                                        <span className="whitespace-nowrap font-semibold text-[var(--status-paid-fg)]">
                                            Kas Masuk {formatRupiah(selectedPoint.cash_in)}
                                        </span>
                                        <span className="whitespace-nowrap font-semibold text-[var(--expense-ink)]">
                                            Kas Keluar {formatRupiah(selectedPoint.cash_out)}
                                        </span>
                                    </>
                                )}

                                {activeTab === 'orders' && (
                                    <span className="whitespace-nowrap font-bold text-[var(--brand-primary)]">
                                        {formatAmount(selectedPoint.orders_count)} nota pesanan
                                    </span>
                                )}

                                {activeTab === 'net' && (
                                    <>
                                        <span
                                            className={cn(
                                                'whitespace-nowrap font-bold',
                                                selectedPoint.cash_diff < 0
                                                    ? 'text-[#9A3B22]'
                                                    : 'text-[#193F66]',
                                            )}
                                        >
                                            Selisih Kas {formatSignedRupiah(selectedPoint.cash_diff)}
                                        </span>
                                        <span className="hidden whitespace-nowrap text-[12px] text-[var(--text-secondary)] sm:inline">
                                            Masuk {formatRupiah(selectedPoint.cash_in)} · Keluar{' '}
                                            {formatRupiah(selectedPoint.cash_out)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className="text-[var(--text-secondary)]">
                            Belum ada transaksi tercatat pada periode yang dipilih.
                        </span>
                    )}
                </div>

                {/* 3. Separate Chart Plotting Area (fixed height for zero layout shift across tabs) */}
                <div
                    role="tabpanel"
                    id={`financial-trend-panel-${activeTab}`}
                    aria-labelledby={`financial-trend-tab-${activeTab}`}
                    data-testid="trend-chart-plot"
                    className="relative"
                    onMouseLeave={() => setTooltipOpen(false)}
                >
                    {!hasAnyActivity || points.length === 0 ? (
                        <div className="flex h-[248px] items-center justify-center sm:h-[280px]">
                            <EmptyState
                                icon={BarChart3}
                                headingLevel="h3"
                                title="Belum ada transaksi pesanan atau kas pada periode ini"
                                description="Pilih rentang tanggal lain atau preset Semua Waktu untuk melihat riwayat transaksi sebelumnya."
                                className="py-6"
                            />
                        </div>
                    ) : (
                        <>
                            {tooltipOpen && selectedPoint && tooltipAnchor && (
                                <div
                                    role="tooltip"
                                    data-testid="report-chart-tooltip"
                                    style={{
                                        left: tooltipAnchor.left,
                                        transform: tooltipAnchor.transform,
                                    }}
                                    className="atelier-elevated pointer-events-none absolute top-1 z-20 w-max max-w-[250px] border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] tabular-nums"
                                >
                                    <p className="font-bold text-[var(--text-primary)]">
                                        {selectedPoint.full_label}
                                    </p>
                                    {selectedIsPartial && !selectedPoint.full_label.includes('(parsial)') && (
                                        <p className="text-[11px] text-[var(--text-secondary)]">
                                            Periode parsial
                                        </p>
                                    )}
                                    <dl className="mt-1.5 space-y-1 border-t border-[var(--border-hairline)] pt-1.5">
                                        {activeTab === 'cashflow' && (
                                            <>
                                                <div className="flex items-center justify-between gap-4">
                                                    <dt className="text-[var(--text-secondary)]">
                                                        Kas Masuk (Sah)
                                                    </dt>
                                                    <dd className="font-bold text-[var(--status-paid-fg)]">
                                                        {formatRupiah(selectedPoint.cash_in)}
                                                    </dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <dt className="text-[var(--text-secondary)]">
                                                        Kas Keluar (Sah)
                                                    </dt>
                                                    <dd className="font-bold text-[var(--expense-ink)]">
                                                        {formatRupiah(selectedPoint.cash_out)}
                                                    </dd>
                                                </div>
                                            </>
                                        )}

                                        {activeTab === 'orders' && (
                                            <div className="flex items-center justify-between gap-4">
                                                <dt className="text-[var(--text-secondary)]">
                                                    Jumlah Nota
                                                </dt>
                                                <dd className="font-bold text-[var(--brand-primary)]">
                                                    {formatAmount(selectedPoint.orders_count)} nota
                                                </dd>
                                            </div>
                                        )}

                                        {activeTab === 'net' && (
                                            <>
                                                <div className="flex items-center justify-between gap-4">
                                                    <dt className="font-semibold text-[var(--text-secondary)]">
                                                        Selisih Kas
                                                    </dt>
                                                    <dd
                                                        className={cn(
                                                            'font-bold',
                                                            selectedPoint.cash_diff < 0
                                                                ? 'text-[#9A3B22]'
                                                                : 'text-[#193F66]',
                                                        )}
                                                    >
                                                        {formatSignedRupiah(selectedPoint.cash_diff)}
                                                    </dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 border-t border-[var(--border-hairline)] pt-1 text-[11.5px]">
                                                    <dt className="text-[var(--text-secondary)]">
                                                        Kas Masuk
                                                    </dt>
                                                    <dd className="font-semibold text-[var(--status-paid-fg)]">
                                                        {formatRupiah(selectedPoint.cash_in)}
                                                    </dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 text-[11.5px]">
                                                    <dt className="text-[var(--text-secondary)]">
                                                        Kas Keluar
                                                    </dt>
                                                    <dd className="font-semibold text-[var(--expense-ink)]">
                                                        {formatRupiah(selectedPoint.cash_out)}
                                                    </dd>
                                                </div>
                                            </>
                                        )}
                                    </dl>
                                </div>
                            )}

                            <div
                                ref={plotContainerRef}
                                className="h-[248px] w-full overflow-x-auto sm:h-[280px]"
                            >
                                <svg
                                    width={svgW}
                                    height={svgH}
                                    viewBox={`0 0 ${svgW} ${svgH}`}
                                    className="block select-none"
                                    role="img"
                                    aria-label={chartAriaLabel}
                                    data-testid={`trend-svg-${activeTab}`}
                                >
                                    {/* Subtle negative zone tint on Selisih Kas when negative values exist */}
                                    {activeTab === 'net' && scale.yMin < 0 && (
                                        <rect
                                            x={padL}
                                            y={yZero}
                                            width={plotW}
                                            height={Math.max(0, padT + plotH - yZero)}
                                            fill="#9A3B22"
                                            fillOpacity={0.045}
                                        />
                                    )}

                                    {/* Horizontal Gridlines & Exact Zero Baseline */}
                                    {scale.ticks.map((tick) => {
                                        const y = toY(tick);
                                        const isZero = tick === 0;
                                        const labelText =
                                            activeTab === 'orders'
                                                ? formatAxisInteger(tick)
                                                : formatAxisRupiah(tick);
                                        return (
                                            <g key={`y-${tick}`} data-testid="chart-y-tick">
                                                <line
                                                    x1={padL}
                                                    y1={y}
                                                    x2={svgW - padR}
                                                    y2={y}
                                                    stroke={isZero ? COLOR_ZERO_BASELINE : COLOR_GRID}
                                                    strokeWidth={isZero ? 1.5 : 1}
                                                    strokeDasharray={isZero ? undefined : '3 3'}
                                                    data-zero-baseline={isZero ? 'true' : undefined}
                                                />
                                                <text
                                                    x={padL - 10}
                                                    y={y + 4}
                                                    textAnchor="end"
                                                    fill={
                                                        tick < 0
                                                            ? COLOR_NET_NEG
                                                            : isZero
                                                              ? '#1B211D'
                                                              : '#525750'
                                                    }
                                                    fontSize={isCompact ? '11' : '11.5'}
                                                    fontWeight={isZero ? '700' : '500'}
                                                    style={{ fontVariantNumeric: 'tabular-nums' }}
                                                >
                                                    {labelText}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Interactive Period Hit Columns, Bars & X-Axis Labels */}
                                    {points.map((pt, idx) => {
                                        const slotX = padL + idx * slotW;
                                        const cx = slotX + slotW / 2;
                                        const isSelected = selectedIndex === idx;
                                        const isPartial = isPartialPeriodLabel(pt.full_label);
                                        const showXLabel = visibleXLabelIndices.has(idx);

                                        // Arus Kas grouped bar geometry
                                        const cashInTop = toY(pt.cash_in);
                                        const cashOutTop = toY(pt.cash_out);
                                        const cashInH = pt.cash_in > 0 ? Math.max(2, yZero - cashInTop) : 0;
                                        const cashOutH = pt.cash_out > 0 ? Math.max(2, yZero - cashOutTop) : 0;
                                        const pairW = groupedBarW * 2 + groupedBarGap;
                                        const barInX = cx - pairW / 2;
                                        const barOutX = barInX + groupedBarW + groupedBarGap;

                                        // Pesanan single-series bar geometry
                                        const orderTop = toY(pt.orders_count);
                                        const orderH = pt.orders_count > 0 ? Math.max(2, yZero - orderTop) : 0;
                                        const orderBarX = cx - singleBarW / 2;

                                        const targetVisualW =
                                            activeTab === 'cashflow' ? pairW + 14 : singleBarW + 14;
                                        const hlW = Math.max(12, Math.min(slotW - 6, targetVisualW));
                                        const hlX = cx - hlW / 2;

                                        const pointAria =
                                            activeTab === 'cashflow'
                                                ? `${pt.full_label}: Kas Masuk ${formatRupiah(pt.cash_in)}, Kas Keluar ${formatRupiah(pt.cash_out)}`
                                                : activeTab === 'orders'
                                                  ? `${pt.full_label}: ${formatAmount(pt.orders_count)} nota pesanan`
                                                  : `${pt.full_label}: Selisih Kas ${formatSignedRupiah(pt.cash_diff)}`;

                                        return (
                                            <g
                                                key={pt.key}
                                                ref={(el) => {
                                                    periodRefs.current[idx] = el;
                                                }}
                                                tabIndex={isSelected ? 0 : -1}
                                                role="button"
                                                aria-pressed={isSelected}
                                                aria-label={pointAria}
                                                onMouseEnter={() => {
                                                    setActiveIndex(idx);
                                                    setTooltipOpen(true);
                                                }}
                                                onFocus={() => {
                                                    setActiveIndex(idx);
                                                    setTooltipOpen(true);
                                                }}
                                                onBlur={() => setTooltipOpen(false)}
                                                onClick={() => {
                                                    setActiveIndex(idx);
                                                    setTooltipOpen(true);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setTooltipOpen(false);
                                                    } else if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setActiveIndex(idx);
                                                        setTooltipOpen(true);
                                                    } else if (e.key === 'ArrowRight') {
                                                        e.preventDefault();
                                                        const next = Math.min(idx + 1, points.length - 1);
                                                        setActiveIndex(next);
                                                        setTooltipOpen(true);
                                                        periodRefs.current[next]?.focus();
                                                    } else if (e.key === 'ArrowLeft') {
                                                        e.preventDefault();
                                                        const prev = Math.max(idx - 1, 0);
                                                        setActiveIndex(prev);
                                                        setTooltipOpen(true);
                                                        periodRefs.current[prev]?.focus();
                                                    } else if (e.key === 'Home') {
                                                        e.preventDefault();
                                                        setActiveIndex(0);
                                                        setTooltipOpen(true);
                                                        periodRefs.current[0]?.focus();
                                                    } else if (e.key === 'End') {
                                                        e.preventDefault();
                                                        const last = points.length - 1;
                                                        setActiveIndex(last);
                                                        setTooltipOpen(true);
                                                        periodRefs.current[last]?.focus();
                                                    }
                                                }}
                                                className="cursor-pointer focus:outline-none [&:focus-visible_.chart-focus-band]:stroke-[#1B3B2B] [&:focus-visible_.chart-focus-band]:stroke-[1.25]"
                                            >
                                                {/* Subtle calm hover/selected indicator (hairline rule for line chart, soft column wash for bars) */}
                                                {isSelected &&
                                                    (activeTab === 'net' ? (
                                                        <line
                                                            className="chart-focus-band"
                                                            x1={cx}
                                                            y1={padT}
                                                            x2={cx}
                                                            y2={padT + plotH}
                                                            stroke="#B8B0A3"
                                                            strokeWidth={1.25}
                                                            strokeDasharray="3 3"
                                                        />
                                                    ) : (
                                                        <rect
                                                            className="chart-focus-band"
                                                            x={hlX}
                                                            y={padT}
                                                            width={hlW}
                                                            height={plotH}
                                                            rx={4}
                                                            fill="#EFEAE0"
                                                            fillOpacity={0.42}
                                                        />
                                                    ))}

                                                {/* Full-height transparent hit area for pointer & touch */}
                                                <rect
                                                    x={slotX}
                                                    y={padT}
                                                    width={slotW}
                                                    height={plotH + padB}
                                                    fill="transparent"
                                                />

                                                {/* Tab 1: Arus Kas grouped bars */}
                                                {activeTab === 'cashflow' && (
                                                    <>
                                                        {cashInH > 0 && (
                                                            <rect
                                                                x={barInX}
                                                                y={yZero - cashInH}
                                                                width={groupedBarW}
                                                                height={cashInH}
                                                                rx={2}
                                                                fill={COLOR_CASH_IN}
                                                            />
                                                        )}
                                                        {cashOutH > 0 && (
                                                            <rect
                                                                x={barOutX}
                                                                y={yZero - cashOutH}
                                                                width={groupedBarW}
                                                                height={cashOutH}
                                                                rx={2}
                                                                fill={COLOR_CASH_OUT}
                                                            />
                                                        )}
                                                    </>
                                                )}

                                                {/* Tab 2: Pesanan single-series bar */}
                                                {activeTab === 'orders' && orderH > 0 && (
                                                    <rect
                                                        x={orderBarX}
                                                        y={yZero - orderH}
                                                        width={singleBarW}
                                                        height={orderH}
                                                        rx={2.5}
                                                        fill={COLOR_ORDERS}
                                                    />
                                                )}

                                                {/* X-axis period tick label */}
                                                {showXLabel && (
                                                    <text
                                                        x={cx}
                                                        y={svgH - 10}
                                                        textAnchor="middle"
                                                        fill={isSelected ? '#1B211D' : '#525750'}
                                                        fontSize={isCompact ? '11' : '11.5'}
                                                        fontWeight={isSelected ? '700' : '500'}
                                                        style={{ fontVariantNumeric: 'tabular-nums' }}
                                                    >
                                                        {isPartial ? `${pt.label}*` : pt.label}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}

                                    {/* Tab 3: Selisih Kas single-series thin solid navy line & small points */}
                                    {activeTab === 'net' && (
                                        <g aria-hidden="true" className="pointer-events-none">
                                            {points.length >= 2 && (
                                                <polyline
                                                    fill="none"
                                                    stroke={COLOR_NET_LINE}
                                                    strokeWidth={2}
                                                    strokeLinejoin="round"
                                                    strokeLinecap="round"
                                                    points={netLinePoints}
                                                />
                                            )}

                                            {points.map((pt, idx) => {
                                                const cx = padL + idx * slotW + slotW / 2;
                                                const cy = toY(pt.cash_diff);
                                                const isSel = selectedIndex === idx;
                                                const isNeg = pt.cash_diff < 0;
                                                const pointColor = isNeg ? COLOR_NET_NEG : COLOR_NET_LINE;

                                                return (
                                                    <g key={`net-pt-${pt.key}`}>
                                                        {/* Stem to zero baseline for single-period or negative points */}
                                                        {(points.length === 1 || isNeg) && pt.cash_diff !== 0 && (
                                                            <line
                                                                x1={cx}
                                                                y1={yZero}
                                                                x2={cx}
                                                                y2={cy}
                                                                stroke={pointColor}
                                                                strokeWidth={1.25}
                                                                strokeDasharray={isNeg ? '2 2' : undefined}
                                                                strokeOpacity={0.65}
                                                            />
                                                        )}
                                                        <circle
                                                            cx={cx}
                                                            cy={cy}
                                                            r={isSel ? 5 : 3.5}
                                                            fill={pointColor}
                                                            stroke="#FFFDF9"
                                                            strokeWidth={1.75}
                                                            data-negative={isNeg ? 'true' : 'false'}
                                                        />
                                                    </g>
                                                );
                                            })}
                                        </g>
                                    )}
                                </svg>
                            </div>
                        </>
                    )}
                </div>

                {/* Partial-period footnote (identical across all 3 tabs for stable card height) */}
                {hasPartialPeriods && (
                    <p
                        data-testid="partial-period-footnote"
                        className="mt-2 text-[12px] text-[var(--text-secondary)]"
                    >
                        * Periode parsial: hanya mencakup sebagian rentang kalender dalam periode laporan.
                    </p>
                )}
            </div>
        </section>
    );
}

type StatusRow = { label: string; count: number; color: string };

function DistributionBlock({
    title,
    total,
    rows,
    href,
    hrefComponent,
    hrefLabel,
}: {
    title: string;
    total: number;
    rows: StatusRow[];
    href: string;
    hrefComponent: string;
    hrefLabel: string;
}) {
    return (
        <div className="bg-[var(--bg-surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <h2 className="atelier-h2">{title}</h2>
                    <p className="mt-0.5 text-[13px] font-semibold text-[var(--text-secondary)] tabular-nums">
                        {formatAmount(total)} pesanan pada periode ini
                    </p>
                </div>
                <Link
                    href={href}
                    component={hrefComponent}
                    prefetch="hover"
                    cacheFor="10s"
                    className="inline-flex min-h-[44px] items-center gap-1 px-1 text-[13px] font-semibold text-[var(--brand-primary)] hover:underline"
                >
                    <span>{hrefLabel}</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
            </div>

            <div
                className="mt-3 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--bg-sunken)]"
                aria-hidden="true"
            >
                {total > 0 &&
                    rows.map((row) => {
                        if (row.count <= 0) return null;
                        return (
                            <div
                                key={row.label}
                                style={{ width: `${(row.count / total) * 100}%`, backgroundColor: row.color }}
                                className="h-full first:rounded-l-full last:rounded-r-full"
                            />
                        );
                    })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm tabular-nums sm:grid-cols-2">
                {rows.map((row) => {
                    const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                    return (
                        <div key={row.label} className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-[var(--text-primary)]">
                                <span
                                    className="inline-block size-2.5 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: row.color }}
                                    aria-hidden="true"
                                />
                                {row.label}
                            </span>
                            <span className="font-semibold text-[var(--text-primary)]">
                                {formatAmount(row.count)}{' '}
                                <span className="font-normal text-[var(--text-secondary)]">({pct}%)</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Payment Method Breakdown (Phase 13D Section 3.F):
 * POSTED payments only, reconciling 100% with summary.cash_in.
 */
export function PaymentMethodCard({
    items,
    totalCashIn,
}: {
    items: PaymentMethodBreakdownItem[];
    totalCashIn: number;
}) {
    const hasPayments = totalCashIn > 0 && items.some((i) => i.count > 0);

    return (
        <section aria-label="Penerimaan kas per metode pembayaran" className="atelier-sheet p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-hairline)] pb-3.5">
                <div>
                    <h2 className="atelier-h2">Metode Pembayaran</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                        Pembayaran sah pada periode terpilih
                    </p>
                </div>
                <span className="text-sm font-bold text-[var(--status-paid-fg)] tabular-nums">
                    Total {formatRupiah(totalCashIn)}
                </span>
            </div>

            {!hasPayments ? (
                <EmptyState
                    icon={Wallet}
                    headingLevel="h3"
                    title="Belum ada pembayaran masuk"
                    description="Pembayaran sah melalui Transfer Bank, Tunai, QRIS, atau lainnya akan terdistribusi otomatis di sini."
                    className="py-8"
                />
            ) : (
                <div className="mt-4 space-y-3.5">
                    {items.map((item) => {
                        const truePct = totalCashIn > 0 ? (item.amount / totalCashIn) * 100 : 0;
                        const barWidth =
                            item.amount > 0 ? Math.min(100, Math.max(truePct, 1.5)) : 0;
                        const shareLabel = formatShareLabel(item.amount, totalCashIn, item.percent_exact);

                        return (
                            <div key={item.method} className="space-y-1.5">
                                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
                                    <span className="font-semibold text-[var(--text-primary)]">
                                        {item.label}{' '}
                                        <span className="font-normal text-[var(--text-secondary)]">
                                            ({formatAmount(item.count)}x)
                                        </span>
                                    </span>
                                    <span className="font-bold text-[var(--text-primary)]">
                                        {formatRupiah(item.amount)}{' '}
                                        <span className="font-normal text-[var(--text-secondary)]">
                                            ({shareLabel})
                                        </span>
                                    </span>
                                </div>
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                                    <div
                                        data-testid={`payment-method-bar-${item.method}`}
                                        className="h-full rounded-full bg-[#1B3B2B]"
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

/**
 * AUD-07 FIXED: True-proportion expense bars (`category_amount / total_cash_out * 100`),
 * never normalized to the max category.
 */
export function ExpenseCategoryCard({
    items,
    totalCashOut,
}: {
    items: ExpenseBreakdownItem[];
    totalCashOut: number;
}) {
    return (
        <section aria-label="Pengeluaran per kategori biaya" className="atelier-sheet p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-hairline)] pb-3.5">
                <div>
                    <h2 className="atelier-h2">Pengeluaran per Kategori</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                        Proporsi terhadap total kas keluar sah
                    </p>
                </div>
                <span className="text-sm font-bold text-[var(--expense-ink)] tabular-nums">
                    Total {formatRupiah(totalCashOut)}
                </span>
            </div>

            {items.length === 0 || totalCashOut <= 0 ? (
                <EmptyState
                    icon={ReceiptText}
                    headingLevel="h3"
                    title="Belum ada pengeluaran tercatat sah"
                    description="Pengeluaran sah yang dicatat pada periode ini akan tampil berdasarkan kategori biayanya."
                    className="py-8"
                />
            ) : (
                <div className="mt-4 space-y-3.5">
                    {items.map((item) => {
                        const truePct = totalCashOut > 0 ? (item.amount / totalCashOut) * 100 : 0;
                        const barWidth =
                            item.amount > 0 ? Math.min(100, Math.max(truePct, 1.5)) : 0;
                        const shareLabel = formatShareLabel(item.amount, totalCashOut, item.percent_exact);

                        return (
                            <div key={item.category} className="space-y-1.5">
                                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
                                    <span className="font-semibold text-[var(--text-primary)]">
                                        {item.category}{' '}
                                        <span className="font-normal text-[var(--text-secondary)]">
                                            ({formatAmount(item.count)}x)
                                        </span>
                                    </span>
                                    <span className="font-bold text-[var(--text-primary)]">
                                        {formatRupiah(item.amount)}{' '}
                                        <span className="font-normal text-[var(--text-secondary)]">
                                            ({shareLabel})
                                        </span>
                                    </span>
                                </div>
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                                    <div
                                        data-testid="expense-category-bar"
                                        data-true-pct={truePct.toFixed(2)}
                                        className="h-full rounded-full bg-[#C07624]"
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export function ReportBreakdownsGrid({
    totalOrders,
    totalCashIn,
    totalCashOut,
    fulfillment,
    payment,
    paymentMethods,
    expenses,
}: {
    totalOrders: number;
    totalCashIn: number;
    totalCashOut: number;
    fulfillment: FulfillmentBreakdown;
    payment: PaymentBreakdown;
    paymentMethods: PaymentMethodBreakdownItem[];
    expenses: ExpenseBreakdownItem[];
}) {
    const fulfillmentRows: StatusRow[] = [
        { label: 'Baru', count: fulfillment.NEW, color: '#6A716A' },
        { label: 'Diproses', count: fulfillment.PROCESSING, color: '#C07624' },
        { label: 'Siap Kirim', count: fulfillment.READY, color: '#193F66' },
        { label: 'Selesai', count: fulfillment.COMPLETED, color: '#1B3B2B' },
    ];

    const paymentRows: StatusRow[] = [
        { label: 'Lunas', count: payment.PAID, color: '#1B3B2B' },
        { label: 'Dibayar Sebagian', count: payment.PARTIAL, color: '#C07624' },
        { label: 'Belum Lunas', count: payment.UNPAID, color: '#9A3B22' },
    ];

    return (
        <div className="mb-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
                <PaymentMethodCard items={paymentMethods} totalCashIn={totalCashIn} />
                <ExpenseCategoryCard items={expenses} totalCashOut={totalCashOut} />
            </div>

            <section
                aria-label="Ringkasan status pengerjaan dan pembayaran pesanan"
                className="atelier-sheet overflow-hidden"
            >
                <div className="grid grid-cols-1 divide-y divide-[var(--border-hairline)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                    <DistributionBlock
                        title="Status Pengerjaan Pesanan"
                        total={totalOrders}
                        rows={fulfillmentRows}
                        href="/ui-orders"
                        hrefComponent="Orders/Index"
                        hrefLabel="Buka Pesanan"
                    />
                    <DistributionBlock
                        title="Status Pembayaran Pesanan"
                        total={totalOrders}
                        rows={paymentRows}
                        href="/ui-payments"
                        hrefComponent="Payments/Index"
                        hrefLabel="Buka Piutang"
                    />
                </div>
            </section>
        </div>
    );
}
