import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { BarChart3, ChevronRight, ReceiptText, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
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

type TrendMode = 'cashflow' | 'orders';

// AUD-08: Verified WCAG 1.4.11 (>= 3.0:1) Calm Botanical Workspace V2 chart palette
const COLOR_CASH_IN = '#1B3B2B'; // Cypress (12.11:1 vs #FFFDF9)
const COLOR_CASH_OUT = '#C07624'; // Marigold (3.53:1 vs #FFFDF9, 3.43:1 vs #1B3B2B)
const COLOR_ORDERS = '#858980'; // Stone Slate (3.51:1 vs #FFFDF9, 3.45:1 vs #1B3B2B)
const COLOR_NET_LINE = '#193F66'; // Deep Slate Blue (10.63:1 vs #FFFDF9, >= 3.01:1 vs bars)
const COLOR_NET_NEG = '#9A3B22'; // Terracotta for negative net-flow marker (6.84:1 vs #FFFDF9)

const GRANULARITY_OPTIONS: Array<{ key: ReportGranularity; label: string }> = [
    { key: 'daily', label: 'Harian' },
    { key: 'weekly', label: 'Mingguan' },
    { key: 'monthly', label: 'Bulanan' },
    { key: 'yearly', label: 'Tahunan' },
];

function computeNiceCeil(rawMax: number): number {
    if (rawMax <= 0) return 200_000;
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const frac = rawMax / mag;
    if (frac <= 1) return mag;
    if (frac <= 2) return 2 * mag;
    if (frac <= 2.5) return Math.ceil(2.5 * mag);
    if (frac <= 5) return 5 * mag;
    return 10 * mag;
}

function formatAxisRupiah(value: number): string {
    const num = Math.trunc(Number(value) || 0);
    if (num === 0) return 'Rp0';
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) {
        const m = abs / 1_000_000_000;
        return `${sign}Rp${Number.isInteger(m) ? m : m.toFixed(1).replace('.', ',')} M`;
    }
    if (abs >= 1_000_000) {
        const jt = abs / 1_000_000;
        return `${sign}Rp${Number.isInteger(jt) ? jt : jt.toFixed(1).replace('.', ',')} jt`;
    }
    if (abs >= 1_000) {
        return `${sign}Rp${formatAmount(Math.round(abs / 1_000))} rb`;
    }
    return `${sign}Rp${abs}`;
}

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
    const [mode, setMode] = useState<TrendMode>('cashflow');
    const [showNetLine, setShowNetLine] = useState(true);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const periodRefs = useRef<Array<SVGGElement | null>>([]);

    const activePoints = useMemo(() => points.filter(hasActivity), [points]);
    const isSparse = points.length >= 6 && activePoints.length > 0 && activePoints.length <= 4;

    useEffect(() => {
        setActiveIndex(null);
        setTooltipOpen(false);
        setShowFullCalendar(false);
    }, [granularity, points.length]);

    const visiblePoints = useMemo(
        () => (isSparse && !showFullCalendar ? activePoints : points),
        [points, activePoints, isSparse, showFullCalendar],
    );

    const selectedIndex = useMemo(() => {
        if (visiblePoints.length === 0) return null;
        if (activeIndex !== null && activeIndex >= 0 && activeIndex < visiblePoints.length) {
            return activeIndex;
        }
        for (let i = visiblePoints.length - 1; i >= 0; i -= 1) {
            if (hasActivity(visiblePoints[i])) return i;
        }
        return visiblePoints.length - 1;
    }, [visiblePoints, activeIndex]);

    const selectedPoint = selectedIndex !== null ? visiblePoints[selectedIndex] : null;
    const netOverlayEnabled = mode === 'cashflow' && showNetLine && visiblePoints.length >= 2;

    const { yMax, yMin, yTicks } = useMemo(() => {
        const rawMax = visiblePoints.reduce((acc, p) => {
            if (mode === 'cashflow') {
                return Math.max(acc, p.cash_in, p.cash_out, netOverlayEnabled ? p.cash_diff : 0);
            }
            return Math.max(acc, p.billed, p.cash_in);
        }, 0);
        const rawMin = netOverlayEnabled
            ? visiblePoints.reduce((acc, p) => Math.min(acc, p.cash_diff), 0)
            : 0;

        const maxCeil = computeNiceCeil(rawMax);
        const minFloor = rawMin < 0 ? -computeNiceCeil(Math.abs(rawMin)) : 0;

        const ticks =
            minFloor < 0
                ? [minFloor, Math.round(minFloor / 2), 0, Math.round(maxCeil / 2), maxCeil]
                : [0, Math.round(maxCeil * 0.25), Math.round(maxCeil * 0.5), Math.round(maxCeil * 0.75), maxCeil];

        return { yMax: maxCeil, yMin: minFloor, yTicks: ticks };
    }, [visiblePoints, mode, netOverlayEnabled]);

    const svgW = 880;
    const svgH = 290;
    const padL = 74;
    const padR = 18;
    const padT = 20;
    const padB = 38;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;
    const ySpan = Math.max(yMax - yMin, 1);

    const toY = (val: number) => padT + ((yMax - val) / ySpan) * plotH;
    const yZero = toY(0);

    const labelStep = visiblePoints.length > 14 ? Math.ceil(visiblePoints.length / 10) : 1;
    const slotW = visiblePoints.length > 0 ? plotW / visiblePoints.length : plotW;
    const barW = Math.max(6, Math.min(26, Math.floor(slotW * 0.28)));
    const barGap = visiblePoints.length > 28 ? 2 : 5;

    const primaryMeta =
        mode === 'cashflow'
            ? { label: 'Kas Masuk (Sah)', color: COLOR_CASH_IN }
            : { label: 'Nilai Pesanan', color: COLOR_ORDERS };
    const secondaryMeta =
        mode === 'cashflow'
            ? { label: 'Kas Keluar (Sah)', color: COLOR_CASH_OUT }
            : { label: 'Kas Masuk (Sah)', color: COLOR_CASH_IN };

    const netPolyline = useMemo(() => {
        if (!netOverlayEnabled) return '';
        return visiblePoints
            .map((pt, idx) => {
                const cx = padL + idx * slotW + slotW / 2;
                const cy = toY(pt.cash_diff);
                return `${cx.toFixed(1)},${cy.toFixed(1)}`;
            })
            .join(' ');
    }, [netOverlayEnabled, visiblePoints, slotW, yMax, ySpan]);

    // Clamped floating tooltip horizontal anchor (never overflows container bounds)
    const tooltipAnchor = useMemo(() => {
        if (selectedIndex === null || visiblePoints.length === 0) return null;
        const pct = ((padL + selectedIndex * slotW + slotW / 2) / svgW) * 100;
        if (pct < 24) return { left: `${Math.max(2, pct)}%`, transform: 'translateX(0)' };
        if (pct > 76) return { left: `${Math.min(98, pct)}%`, transform: 'translateX(-100%)' };
        return { left: `${pct}%`, transform: 'translateX(-50%)' };
    }, [selectedIndex, visiblePoints.length, slotW]);

    return (
        <section aria-label="Grafik arus kas dan pesanan" className="atelier-sheet mb-6 overflow-hidden">
            {/* Sparkpixel-style Chart Header & Controls */}
            <div className="flex flex-col gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                <div>
                    <h2 className="atelier-h2">Tren Arus Kas &amp; Pesanan</h2>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                        {rangeLabel}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedTabs<ReportGranularity>
                        ariaLabel="Pengelompokan grafik"
                        value={granularity}
                        disabled={isLoading}
                        onChange={onGranularityChange}
                        options={GRANULARITY_OPTIONS}
                    />
                    <SegmentedTabs<TrendMode>
                        ariaLabel="Metrik grafik"
                        value={mode}
                        onChange={setMode}
                        options={[
                            { key: 'cashflow', label: 'Masuk vs Keluar' },
                            { key: 'orders', label: 'Pesanan vs Masuk' },
                        ]}
                    />
                    {mode === 'cashflow' && visiblePoints.length >= 2 && (
                        <button
                            type="button"
                            aria-pressed={showNetLine}
                            onClick={() => setShowNetLine((v) => !v)}
                            className={cn(
                                'inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border px-3.5 text-[13px] font-semibold transition-colors',
                                showNetLine
                                    ? 'border-[#193F66] bg-[#E8F0F7] text-[#193F66]'
                                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)]',
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className="inline-block w-3.5 border-t-2 border-dashed border-[#193F66]"
                            />
                            <span>Garis Selisih Kas</span>
                        </button>
                    )}
                </div>
            </div>

            {notice && (
                <div
                    role="status"
                    data-testid="daily-truncation-notice"
                    className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/60 px-5 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)] lg:px-6"
                >
                    {notice}
                </div>
            )}

            <div className="bg-[var(--bg-surface)] p-5 sm:p-6">
                {activePoints.length === 0 ? (
                    <EmptyState
                        icon={BarChart3}
                        headingLevel="h3"
                        title="Belum ada transaksi pesanan atau kas pada periode ini"
                        description="Pilih rentang tanggal lain atau preset Semua Waktu untuk melihat riwayat transaksi sebelumnya."
                        className="py-10"
                    />
                ) : (
                    <>
                        {/* Accessible Legend & Live Selected Readout Bar */}
                        <div className="mb-4 flex flex-col gap-2.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
                                <span className="inline-flex items-center gap-2">
                                    <span
                                        className="inline-block size-3 rounded-[2px]"
                                        style={{ backgroundColor: primaryMeta.color }}
                                        aria-hidden="true"
                                    />
                                    {primaryMeta.label}
                                </span>
                                <span className="inline-flex items-center gap-2">
                                    <span
                                        className="inline-block size-3 rounded-[2px]"
                                        style={{ backgroundColor: secondaryMeta.color }}
                                        aria-hidden="true"
                                    />
                                    {secondaryMeta.label}
                                </span>
                                {netOverlayEnabled && (
                                    <span className="inline-flex items-center gap-2 text-[#193F66]">
                                        <span
                                            aria-hidden="true"
                                            className="inline-block w-4 border-t-2 border-dashed border-[#193F66]"
                                        />
                                        Selisih Kas
                                    </span>
                                )}
                            </div>

                            {selectedPoint && (
                                <div
                                    aria-live="polite"
                                    aria-atomic="true"
                                    className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] tabular-nums"
                                >
                                    <span className="font-bold text-[var(--text-primary)]">
                                        {selectedPoint.full_label}
                                    </span>
                                    <span className="text-[var(--text-secondary)]">
                                        {formatAmount(selectedPoint.orders_count)} nota
                                    </span>
                                    {mode === 'cashflow' ? (
                                        <>
                                            <span className="whitespace-nowrap font-semibold text-[var(--status-paid-fg)]">
                                                Masuk {formatRupiah(selectedPoint.cash_in)}
                                            </span>
                                            <span className="whitespace-nowrap font-semibold text-[var(--expense-ink)]">
                                                Keluar {formatRupiah(selectedPoint.cash_out)}
                                            </span>
                                            <span
                                                className={cn(
                                                    'whitespace-nowrap font-bold',
                                                    selectedPoint.cash_diff < 0
                                                        ? 'text-[var(--brand-urgent)]'
                                                        : 'text-[#193F66]',
                                                )}
                                            >
                                                Selisih {formatSignedRupiah(selectedPoint.cash_diff)}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="whitespace-nowrap font-semibold text-[var(--text-secondary)]">
                                                Nota {formatRupiah(selectedPoint.billed)}
                                            </span>
                                            <span className="whitespace-nowrap font-semibold text-[var(--status-paid-fg)]">
                                                Masuk {formatRupiah(selectedPoint.cash_in)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {isSparse && (
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--text-secondary)]">
                                <span>
                                    {showFullCalendar
                                        ? `Menampilkan seluruh ${formatAmount(points.length)} slot kalender.`
                                        : `Menampilkan ${formatAmount(activePoints.length)} periode bertransaksi agar grafik ringkas terbaca.`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowFullCalendar((v) => !v)}
                                    className="inline-flex min-h-[44px] items-center font-semibold text-[var(--brand-primary)] hover:underline"
                                >
                                    {showFullCalendar ? 'Fokus Periode Aktif' : 'Tampilkan Rentang Penuh'}
                                </button>
                            </div>
                        )}

                        {/* Desktop / Tablet SVG Plot with Clamped Floating Tooltip (>= 640px) */}
                        <div
                            className="relative hidden w-full sm:block"
                            onMouseLeave={() => setTooltipOpen(false)}
                        >
                            {tooltipOpen && selectedPoint && tooltipAnchor && (
                                <div
                                    role="tooltip"
                                    data-testid="report-chart-tooltip"
                                    style={{
                                        left: tooltipAnchor.left,
                                        transform: tooltipAnchor.transform,
                                    }}
                                    className="atelier-elevated pointer-events-none absolute top-1 z-20 w-max max-w-[260px] border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-[12.5px] tabular-nums"
                                >
                                    <p className="font-bold text-[var(--text-primary)]">
                                        {selectedPoint.full_label}
                                    </p>
                                    <p className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
                                        {formatAmount(selectedPoint.orders_count)} pesanan tercatat
                                    </p>
                                    <dl className="mt-2 space-y-1 border-t border-[var(--border-hairline)] pt-1.5">
                                        {mode === 'orders' && (
                                            <div className="flex items-center justify-between gap-4">
                                                <dt className="text-[var(--text-secondary)]">Nilai Pesanan</dt>
                                                <dd className="font-bold text-[var(--text-primary)]">
                                                    {formatRupiah(selectedPoint.billed)}
                                                </dd>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-4">
                                            <dt className="text-[var(--text-secondary)]">Kas Masuk</dt>
                                            <dd className="font-bold text-[var(--status-paid-fg)]">
                                                {formatRupiah(selectedPoint.cash_in)}
                                            </dd>
                                        </div>
                                        {mode === 'cashflow' && (
                                            <>
                                                <div className="flex items-center justify-between gap-4">
                                                    <dt className="text-[var(--text-secondary)]">Kas Keluar</dt>
                                                    <dd className="font-bold text-[var(--expense-ink)]">
                                                        {formatRupiah(selectedPoint.cash_out)}
                                                    </dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 border-t border-[var(--border-hairline)] pt-1">
                                                    <dt className="font-semibold text-[var(--text-secondary)]">
                                                        Selisih Kas
                                                    </dt>
                                                    <dd
                                                        className={cn(
                                                            'font-bold',
                                                            selectedPoint.cash_diff < 0
                                                                ? 'text-[var(--brand-urgent)]'
                                                                : 'text-[#193F66]',
                                                        )}
                                                    >
                                                        {formatSignedRupiah(selectedPoint.cash_diff)}
                                                    </dd>
                                                </div>
                                            </>
                                        )}
                                    </dl>
                                </div>
                            )}

                            <div className="w-full overflow-x-auto">
                                <svg
                                    viewBox={`0 0 ${svgW} ${svgH}`}
                                    className="h-auto min-w-[540px] w-full select-none"
                                    role="img"
                                    aria-label={`Grafik ${primaryMeta.label} dan ${secondaryMeta.label} ${rangeLabel}`}
                                >
                                    {/* Horizontal Gridlines & Exact Rp0 Baseline */}
                                    {yTicks.map((tick) => {
                                        const y = toY(tick);
                                        const isZero = tick === 0;
                                        return (
                                            <g key={tick}>
                                                <line
                                                    x1={padL}
                                                    y1={y}
                                                    x2={svgW - padR}
                                                    y2={y}
                                                    stroke={isZero ? '#857F74' : '#E7E0D6'}
                                                    strokeWidth={isZero ? 1.4 : 1}
                                                    strokeDasharray={isZero ? undefined : '3 3'}
                                                />
                                                <text
                                                    x={padL - 10}
                                                    y={y + 4}
                                                    textAnchor="end"
                                                    fill={isZero ? '#1B211D' : '#525750'}
                                                    fontSize="11.5"
                                                    fontWeight={isZero ? '700' : '600'}
                                                    style={{ fontVariantNumeric: 'tabular-nums' }}
                                                >
                                                    {formatAxisRupiah(tick)}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Interactive Period Columns & Grouped Bars */}
                                    {visiblePoints.map((pt, idx) => {
                                        const slotX = padL + idx * slotW;
                                        const cx = slotX + slotW / 2;
                                        const v1 = mode === 'cashflow' ? pt.cash_in : pt.billed;
                                        const v2 = mode === 'cashflow' ? pt.cash_out : pt.cash_in;
                                        const top1 = toY(v1);
                                        const top2 = toY(v2);
                                        const h1 = v1 > 0 ? Math.max(3, yZero - top1) : 0;
                                        const h2 = v2 > 0 ? Math.max(3, yZero - top2) : 0;
                                        const pairW = barW * 2 + barGap;
                                        const b1X = cx - pairW / 2;
                                        const b2X = b1X + barW + barGap;
                                        const isSelected = selectedIndex === idx;
                                        const showXLabel =
                                            visiblePoints.length <= 12 ||
                                            idx % labelStep === 0 ||
                                            idx === visiblePoints.length - 1;
                                        const hlW = Math.min(Math.max(6, slotW - 4), pairW + 24);
                                        const hlX = cx - hlW / 2;

                                        const pointAria =
                                            mode === 'cashflow'
                                                ? `${pt.full_label}: ${formatAmount(pt.orders_count)} pesanan, Kas Masuk ${formatRupiah(pt.cash_in)}, Kas Keluar ${formatRupiah(pt.cash_out)}, Selisih Kas ${formatSignedRupiah(pt.cash_diff)}`
                                                : `${pt.full_label}: ${formatAmount(pt.orders_count)} pesanan, Nilai Pesanan ${formatRupiah(pt.billed)}, Kas Masuk ${formatRupiah(pt.cash_in)}`;

                                        return (
                                            <g
                                                key={pt.key}
                                                ref={(el) => {
                                                    periodRefs.current[idx] = el;
                                                }}
                                                tabIndex={0}
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
                                                        const next = Math.min(idx + 1, visiblePoints.length - 1);
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
                                                        const last = visiblePoints.length - 1;
                                                        setActiveIndex(last);
                                                        setTooltipOpen(true);
                                                        periodRefs.current[last]?.focus();
                                                    }
                                                }}
                                                className="cursor-pointer focus:outline-none"
                                            >
                                                {isSelected && (
                                                    <rect
                                                        x={hlX}
                                                        y={padT - 2}
                                                        width={hlW}
                                                        height={plotH + 4}
                                                        rx={6}
                                                        fill="#EFEAE0"
                                                        stroke={tooltipOpen ? '#1B3B2B' : 'none'}
                                                        strokeWidth={tooltipOpen ? 1.25 : 0}
                                                    />
                                                )}

                                                <rect
                                                    x={slotX}
                                                    y={padT}
                                                    width={slotW}
                                                    height={plotH + padB}
                                                    fill="transparent"
                                                />

                                                {h1 > 0 && (
                                                    <rect
                                                        x={b1X}
                                                        y={yZero - h1}
                                                        width={barW}
                                                        height={h1}
                                                        rx={2.5}
                                                        fill={primaryMeta.color}
                                                    />
                                                )}

                                                {h2 > 0 && (
                                                    <rect
                                                        x={b2X}
                                                        y={yZero - h2}
                                                        width={barW}
                                                        height={h2}
                                                        rx={2.5}
                                                        fill={secondaryMeta.color}
                                                    />
                                                )}

                                                {showXLabel && (
                                                    <text
                                                        x={cx}
                                                        y={svgH - 10}
                                                        textAnchor="middle"
                                                        fill={isSelected ? '#1B211D' : '#525750'}
                                                        fontSize="11.5"
                                                        fontWeight={isSelected ? '700' : '500'}
                                                        style={{ fontVariantNumeric: 'tabular-nums' }}
                                                    >
                                                        {pt.label}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}

                                    {/* Optional Straight-Segment Net Cash-Flow Overlay (Mathematically faithful, no smoothing) */}
                                    {netOverlayEnabled && (
                                        <g aria-hidden="true" className="pointer-events-none">
                                            <polyline
                                                fill="none"
                                                stroke="#FFFDF9"
                                                strokeWidth={4.5}
                                                strokeLinejoin="round"
                                                points={netPolyline}
                                            />
                                            <polyline
                                                fill="none"
                                                stroke={COLOR_NET_LINE}
                                                strokeWidth={2.25}
                                                strokeDasharray="5 3"
                                                strokeLinejoin="round"
                                                points={netPolyline}
                                            />
                                            {visiblePoints.map((pt, idx) => {
                                                const cx = padL + idx * slotW + slotW / 2;
                                                const cy = toY(pt.cash_diff);
                                                const isSel = selectedIndex === idx;
                                                const dotFill = pt.cash_diff < 0 ? COLOR_NET_NEG : COLOR_NET_LINE;
                                                return (
                                                    <circle
                                                        key={`net-${pt.key}`}
                                                        cx={cx}
                                                        cy={cy}
                                                        r={isSel ? 5 : 3.5}
                                                        fill={dotFill}
                                                        stroke="#FFFDF9"
                                                        strokeWidth={1.75}
                                                    />
                                                );
                                            })}
                                        </g>
                                    )}
                                </svg>
                            </div>
                        </div>

                        {/* Mobile Tap-Interactive Bar Layout (< 640px) */}
                        <div className="sm:hidden">
                            <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
                                <span>
                                    {visiblePoints.length > 6
                                        ? 'Geser & ketuk periode untuk detail'
                                        : 'Ketuk periode untuk detail angka'}
                                </span>
                                <span className="tabular-nums">Maks {formatAxisRupiah(yMax)}</span>
                            </div>
                            <div
                                className={cn(
                                    'flex items-end gap-2 pb-1',
                                    visiblePoints.length > 6 ? 'overflow-x-auto' : 'justify-between',
                                )}
                            >
                                {visiblePoints.map((pt, idx) => {
                                    const v1 = mode === 'cashflow' ? pt.cash_in : pt.billed;
                                    const v2 = mode === 'cashflow' ? pt.cash_out : pt.cash_in;
                                    const p1 = v1 > 0 ? Math.max(6, Math.round((v1 / Math.max(yMax, 1)) * 100)) : 0;
                                    const p2 = v2 > 0 ? Math.max(6, Math.round((v2 / Math.max(yMax, 1)) * 100)) : 0;
                                    const isSelected = selectedIndex === idx;

                                    return (
                                        <button
                                            key={pt.key}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => setActiveIndex(idx)}
                                            className={cn(
                                                'flex min-h-[144px] flex-col items-center justify-end rounded-[8px] border px-2 py-2 transition-colors',
                                                visiblePoints.length > 6
                                                    ? 'min-w-[54px] shrink-0'
                                                    : 'min-w-[44px] flex-1',
                                                isSelected
                                                    ? 'border-[var(--brand-primary)] bg-[var(--bg-sunken)]'
                                                    : 'border-transparent bg-[var(--bg-sunken)]/45',
                                            )}
                                        >
                                            <div className="flex h-[96px] items-end gap-1">
                                                <span
                                                    className="w-3 rounded-t-[2px]"
                                                    style={{ height: `${p1}%`, backgroundColor: primaryMeta.color }}
                                                    aria-hidden="true"
                                                />
                                                <span
                                                    className="w-3 rounded-t-[2px]"
                                                    style={{ height: `${p2}%`, backgroundColor: secondaryMeta.color }}
                                                    aria-hidden="true"
                                                />
                                            </div>
                                            <span
                                                className={cn(
                                                    'mt-2 whitespace-nowrap text-[12px] tabular-nums',
                                                    isSelected
                                                        ? 'font-bold text-[var(--text-primary)]'
                                                        : 'font-medium text-[var(--text-secondary)]',
                                                )}
                                            >
                                                {pt.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
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
