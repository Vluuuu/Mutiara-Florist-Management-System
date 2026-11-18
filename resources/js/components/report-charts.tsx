import { useEffect, useMemo, useState } from 'react';
import { formatAmount, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    ExpenseBreakdownItem,
    FulfillmentBreakdown,
    PaymentBreakdown,
    ReportChartPoint,
    ReportGranularity,
} from '@/types';

type TrendMode = 'cashflow' | 'orders';

type FinancialTrendChartProps = {
    points: ReportChartPoint[];
    granularity: ReportGranularity;
    rangeLabel: string;
    notice?: string | null;
    isLoading?: boolean;
    onGranularityChange: (g: ReportGranularity) => void;
};

const GRANULARITY_OPTIONS: Array<{ key: ReportGranularity; label: string }> = [
    { key: 'daily', label: 'Harian' },
    { key: 'weekly', label: 'Mingguan' },
    { key: 'monthly', label: 'Bulanan' },
    { key: 'yearly', label: 'Tahunan' },
];

// Konsisten dengan docs/DESIGN.md (Calm Botanical Workspace)
const COLOR_ORDERS = '#545852';
const COLOR_CASH_IN = '#1D3B2A';
const COLOR_CASH_OUT = '#8F4B1E';

function computeNiceCeil(rawMax: number): number {
    if (rawMax <= 0) return 400_000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const fraction = rawMax / magnitude;
    let niceFraction = 10;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 4) niceFraction = 4;
    else if (fraction <= 6) niceFraction = 6;
    else if (fraction <= 8) niceFraction = 8;

    return niceFraction * magnitude;
}

function formatAxisRupiah(value: number): string {
    if (value === 0) return 'Rp0';
    if (value >= 1_000_000_000) {
        const m = value / 1_000_000_000;
        return `Rp${Number.isInteger(m) ? m : m.toFixed(1).replace('.', ',')} M`;
    }
    if (value >= 1_000_000) {
        const jt = value / 1_000_000;
        return `Rp${Number.isInteger(jt) ? jt : jt.toFixed(1).replace('.', ',')} jt`;
    }
    if (value >= 1_000) {
        return `Rp${Math.round(value / 1_000)} rb`;
    }
    return `Rp${value}`;
}

function hasActivity(p: ReportChartPoint): boolean {
    return p.orders_count > 0 || p.billed > 0 || p.cash_in > 0 || p.cash_out > 0;
}

export function FinancialTrendChart({
    points,
    granularity,
    rangeLabel,
    notice = null,
    isLoading = false,
    onGranularityChange,
}: FinancialTrendChartProps) {
    const [mode, setMode] = useState<TrendMode>('cashflow');
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [showFullCalendar, setShowFullCalendar] = useState(false);

    const activePoints = useMemo(() => points.filter(hasActivity), [points]);
    const isSparse = points.length >= 6 && activePoints.length > 0 && activePoints.length <= 4;

    useEffect(() => {
        setActiveIndex(null);
        setShowFullCalendar(false);
    }, [granularity, points.length]);

    const visiblePoints = useMemo(() => {
        if (isSparse && !showFullCalendar) {
            return activePoints;
        }
        return points;
    }, [points, activePoints, isSparse, showFullCalendar]);

    const selectedIndex = useMemo(() => {
        if (visiblePoints.length === 0) return null;
        if (activeIndex !== null && activeIndex >= 0 && activeIndex < visiblePoints.length) {
            return activeIndex;
        }
        for (let i = visiblePoints.length - 1; i >= 0; i--) {
            if (hasActivity(visiblePoints[i])) return i;
        }
        return visiblePoints.length - 1;
    }, [visiblePoints, activeIndex]);

    const selectedPoint = selectedIndex !== null ? visiblePoints[selectedIndex] : null;

    const chartMax = useMemo(() => {
        const rawMax = visiblePoints.reduce((acc, p) => {
            if (mode === 'cashflow') {
                return Math.max(acc, p.cash_in, p.cash_out);
            }
            return Math.max(acc, p.billed, p.cash_in);
        }, 0);
        return computeNiceCeil(rawMax);
    }, [visiblePoints, mode]);

    const svgWidth = 880;
    const svgHeight = 276;
    const padLeft = 72;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 40;
    const plotW = svgWidth - padLeft - padRight;
    const plotH = svgHeight - padTop - padBottom;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
        value: Math.round(chartMax * ratio),
        y: padTop + plotH - plotH * ratio,
    }));

    const labelStep = visiblePoints.length > 14 ? Math.ceil(visiblePoints.length / 10) : 1;
    const slotW = visiblePoints.length > 0 ? plotW / visiblePoints.length : plotW;
    const barW = Math.max(8, Math.min(28, Math.floor(slotW * 0.28)));
    const barGap = visiblePoints.length > 35 ? 2 : 5;

    const primaryMeta =
        mode === 'cashflow'
            ? { label: 'Kas Masuk (Sah)', color: COLOR_CASH_IN }
            : { label: 'Nilai Pesanan', color: COLOR_ORDERS };
    const secondaryMeta =
        mode === 'cashflow'
            ? { label: 'Kas Keluar (Sah)', color: COLOR_CASH_OUT }
            : { label: 'Kas Masuk (Sah)', color: COLOR_CASH_IN };

    return (
        <section
            aria-label="Grafik arus kas dan pesanan"
            className="atelier-sheet mb-7 overflow-hidden"
        >
            <div className="flex flex-col gap-3 border-b border-[#DED6C8] bg-[#FFFDF9] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                <div>
                    <h2 className="atelier-h2">Arus Kas &amp; Pesanan</h2>
                    <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">{rangeLabel}</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
                    <div
                        className="grid grid-cols-4 rounded-[8px] border border-[#DED6C8] bg-[#F7F3EC] p-0.5 sm:inline-flex"
                        role="group"
                        aria-label="Pengelompokan grafik"
                    >
                        {GRANULARITY_OPTIONS.map((opt) => {
                            const active = granularity === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    aria-pressed={active}
                                    disabled={isLoading}
                                    onClick={() => onGranularityChange(opt.key)}
                                    className={cn(
                                        'inline-flex min-h-[44px] items-center justify-center rounded-[6px] px-2 py-1.5 text-[13px] font-semibold transition-colors sm:px-3',
                                        active
                                            ? 'bg-[#FFFDF9] text-[#1D3B2A] shadow-xs'
                                            : 'text-[#545852] hover:text-[#1C211E]',
                                    )}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        className="grid grid-cols-2 rounded-[8px] border border-[#DED6C8] bg-[#F7F3EC] p-0.5 sm:inline-flex"
                        role="group"
                        aria-label="Metrik grafik"
                    >
                        <button
                            type="button"
                            aria-pressed={mode === 'cashflow'}
                            onClick={() => setMode('cashflow')}
                            className={cn(
                                'inline-flex min-h-[44px] items-center justify-center rounded-[6px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                                mode === 'cashflow'
                                    ? 'bg-[#FFFDF9] text-[#1C211E] shadow-xs'
                                    : 'text-[#545852] hover:text-[#1C211E]',
                            )}
                        >
                            Masuk vs Keluar
                        </button>
                        <button
                            type="button"
                            aria-pressed={mode === 'orders'}
                            onClick={() => setMode('orders')}
                            className={cn(
                                'inline-flex min-h-[44px] items-center justify-center rounded-[6px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                                mode === 'orders'
                                    ? 'bg-[#FFFDF9] text-[#1C211E] shadow-xs'
                                    : 'text-[#545852] hover:text-[#1C211E]',
                            )}
                        >
                            Pesanan vs Masuk
                        </button>
                    </div>
                </div>
            </div>

            {notice && (
                <div
                    role="status"
                    data-testid="daily-truncation-notice"
                    className="border-b border-[#DED6C8] bg-[#EFE9DE]/55 px-4 py-2.5 text-[12px] leading-relaxed text-[#545852] sm:px-5 lg:px-6"
                >
                    {notice}
                </div>
            )}

            <div className="bg-[#FFFDF9] p-5 sm:p-6">
                {activePoints.length === 0 ? (
                    <div className="rounded-[8px] border border-dashed border-[#DED6C8] bg-[#F7F3EC]/55 px-6 py-12 text-center">
                        <p className="text-[15px] font-semibold text-[#1C211E]">
                            Belum ada transaksi pesanan atau kas pada periode ini.
                        </p>
                        <p className="mt-1 text-[13px] text-[#545852]">
                            Pilih rentang tanggal lain atau pengelompokan Tahunan untuk melihat riwayat sebelumnya.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Legend & Selected Point Summary Strip */}
                        <div className="mb-4 flex flex-col gap-2.5 rounded-[8px] border border-[#DED6C8] bg-[#F7F3EC]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] font-semibold text-[#1C211E]">
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
                            </div>

                            {selectedPoint && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] tabular-nums">
                                    <span className="font-bold text-[#1C211E]">
                                        {selectedPoint.full_label}
                                    </span>
                                    <span className="text-[#545852]">
                                        {formatAmount(selectedPoint.orders_count)} pesanan
                                    </span>
                                    {mode === 'cashflow' ? (
                                        <>
                                            <span className="font-semibold text-[#1D3B2A]">
                                                Masuk {formatRupiah(selectedPoint.cash_in)}
                                            </span>
                                            <span className="font-semibold text-[#8F4B1E]">
                                                Keluar {formatRupiah(selectedPoint.cash_out)}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-semibold text-[#545852]">
                                                Nota {formatRupiah(selectedPoint.billed)}
                                            </span>
                                            <span className="font-semibold text-[#1D3B2A]">
                                                Masuk {formatRupiah(selectedPoint.cash_in)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {isSparse && (
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#545852]">
                                <span>
                                    {showFullCalendar
                                        ? `Menampilkan seluruh ${formatAmount(points.length)} slot kalender.`
                                        : `Menampilkan ${formatAmount(activePoints.length)} periode bertransaksi agar grafik ringkas terbaca.`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowFullCalendar((v) => !v)}
                                    className="inline-flex min-h-[44px] items-center font-semibold text-[#1D3B2A] hover:underline"
                                >
                                    {showFullCalendar ? 'Fokus Periode Aktif' : 'Tampilkan Rentang Penuh'}
                                </button>
                            </div>
                        )}

                        {/* Desktop SVG Chart (>= 640px) - Preserved */}
                        <div className="hidden w-full overflow-x-auto sm:block">
                            <svg
                                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                className="h-auto min-w-[540px] w-full select-none"
                                role="img"
                                aria-label={`Grafik ${primaryMeta.label} dan ${secondaryMeta.label} ${rangeLabel}`}
                            >
                                {yTicks.map((tick) => (
                                    <g key={tick.value}>
                                        <line
                                            x1={padLeft}
                                            y1={tick.y}
                                            x2={svgWidth - padRight}
                                            y2={tick.y}
                                            stroke={tick.value === 0 ? '#7D776C' : '#E7E0D3'}
                                            strokeWidth={tick.value === 0 ? 1.25 : 1}
                                            strokeDasharray={tick.value === 0 ? undefined : '3 3'}
                                        />
                                        <text
                                            x={padLeft - 10}
                                            y={tick.y + 4}
                                            textAnchor="end"
                                            fill="#545852"
                                            fontSize="12"
                                            fontWeight="600"
                                            style={{ fontVariantNumeric: 'tabular-nums' }}
                                        >
                                            {formatAxisRupiah(tick.value)}
                                        </text>
                                    </g>
                                ))}

                                {visiblePoints.map((pt, idx) => {
                                    const slotX = padLeft + idx * slotW;
                                    const centerX = slotX + slotW / 2;
                                    const v1 = mode === 'cashflow' ? pt.cash_in : pt.billed;
                                    const v2 = mode === 'cashflow' ? pt.cash_out : pt.cash_in;
                                    const h1 = Math.max(v1 > 0 ? 4 : 0, Math.round((v1 / chartMax) * plotH));
                                    const h2 = Math.max(v2 > 0 ? 4 : 0, Math.round((v2 / chartMax) * plotH));
                                    const totalPairW = barW * 2 + barGap;
                                    const b1X = centerX - totalPairW / 2;
                                    const b2X = b1X + barW + barGap;
                                    const isSelected = selectedIndex === idx;
                                    const showXLabel =
                                        visiblePoints.length <= 12 ||
                                        idx % labelStep === 0 ||
                                        idx === visiblePoints.length - 1;
                                    const hlW = Math.min(Math.max(4, slotW - 4), totalPairW + 24);
                                    const hlX = centerX - hlW / 2;

                                    return (
                                        <g
                                            key={pt.key}
                                            onMouseEnter={() => setActiveIndex(idx)}
                                            onClick={() => setActiveIndex(idx)}
                                            className="cursor-pointer"
                                        >
                                            {isSelected && (
                                                <rect
                                                    x={hlX}
                                                    y={padTop}
                                                    width={hlW}
                                                    height={plotH}
                                                    rx={4}
                                                    fill="#EFE9DE"
                                                    opacity={0.75}
                                                />
                                            )}

                                            <rect
                                                x={slotX}
                                                y={padTop}
                                                width={slotW}
                                                height={plotH + padBottom}
                                                fill="transparent"
                                            />

                                            {h1 > 0 && (
                                                <rect
                                                    x={b1X}
                                                    y={padTop + plotH - h1}
                                                    width={barW}
                                                    height={h1}
                                                    rx={2}
                                                    fill={primaryMeta.color}
                                                />
                                            )}

                                            {h2 > 0 && (
                                                <rect
                                                    x={b2X}
                                                    y={padTop + plotH - h2}
                                                    width={barW}
                                                    height={h2}
                                                    rx={2}
                                                    fill={secondaryMeta.color}
                                                />
                                            )}

                                            {showXLabel && (
                                                <text
                                                    x={centerX}
                                                    y={svgHeight - 12}
                                                    textAnchor="middle"
                                                    fill={isSelected ? '#1C211E' : '#545852'}
                                                    fontSize="12"
                                                    fontWeight={isSelected ? '700' : '600'}
                                                    style={{ fontVariantNumeric: 'tabular-nums' }}
                                                >
                                                    {pt.label}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        {/* Mobile Tap-Interactive Bar Layout (< 640px) */}
                        <div className="sm:hidden">
                            <div className="mb-2 flex items-center justify-between text-[12px] text-[#545852]">
                                <span>
                                    {visiblePoints.length > 6
                                        ? 'Geser & ketuk periode untuk detail'
                                        : 'Ketuk periode untuk detail angka'}
                                </span>
                                <span className="tabular-nums">Maks {formatAxisRupiah(chartMax)}</span>
                            </div>
                            <div
                                className={cn(
                                    'flex items-end gap-2 pb-1',
                                    visiblePoints.length > 6
                                        ? 'overflow-x-auto'
                                        : 'justify-between',
                                )}
                            >
                                {visiblePoints.map((pt, idx) => {
                                    const v1 = mode === 'cashflow' ? pt.cash_in : pt.billed;
                                    const v2 = mode === 'cashflow' ? pt.cash_out : pt.cash_in;
                                    const p1 = v1 > 0 ? Math.max(6, Math.round((v1 / chartMax) * 100)) : 0;
                                    const p2 = v2 > 0 ? Math.max(6, Math.round((v2 / chartMax) * 100)) : 0;
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
                                                    ? 'border-[#1D3B2A] bg-[#EFE9DE]'
                                                    : 'border-transparent bg-[#F7F3EC]/60',
                                            )}
                                        >
                                            <div className="flex h-[96px] items-end gap-1">
                                                <span
                                                    className="w-3 rounded-t-[2px]"
                                                    style={{
                                                        height: `${p1}%`,
                                                        backgroundColor: primaryMeta.color,
                                                    }}
                                                    aria-hidden="true"
                                                />
                                                <span
                                                    className="w-3 rounded-t-[2px]"
                                                    style={{
                                                        height: `${p2}%`,
                                                        backgroundColor: secondaryMeta.color,
                                                    }}
                                                    aria-hidden="true"
                                                />
                                            </div>
                                            <span
                                                className={cn(
                                                    'mt-2 whitespace-nowrap text-[12px] tabular-nums',
                                                    isSelected
                                                        ? 'font-bold text-[#1C211E]'
                                                        : 'font-medium text-[#545852]',
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

type StatusRow = {
    label: string;
    count: number;
    color: string;
};

function DistributionBlock({
    title,
    total,
    rows,
}: {
    title: string;
    total: number;
    rows: StatusRow[];
}) {
    return (
        <div className="bg-[#FFFDF9] p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="atelier-h2">{title}</h2>
                <span className="text-[13px] font-semibold text-[#545852] tabular-nums">
                    {formatAmount(total)} pesanan
                </span>
            </div>

            {/* Single compact segmented distribution bar */}
            <div
                className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-[4px] bg-[#EFE9DE]"
                aria-hidden="true"
            >
                {total > 0 &&
                    rows.map((row) => {
                        if (row.count <= 0) return null;
                        const pct = (row.count / total) * 100;
                        return (
                            <div
                                key={row.label}
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: row.color,
                                }}
                            />
                        );
                    })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm tabular-nums sm:grid-cols-2">
                {rows.map((row) => {
                    const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                    return (
                        <div key={row.label} className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-[#1C211E]">
                                <span
                                    className="inline-block size-2.5 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: row.color }}
                                    aria-hidden="true"
                                />
                                {row.label}
                            </span>
                            <span className="font-semibold text-[#1C211E]">
                                {formatAmount(row.count)}{' '}
                                <span className="font-normal text-[#545852]">({pct}%)</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function StatusDistributionPanel({
    totalOrders,
    fulfillment,
    payment,
}: {
    totalOrders: number;
    fulfillment: FulfillmentBreakdown;
    payment: PaymentBreakdown;
}) {
    const fulfillmentRows: StatusRow[] = [
        { label: 'Baru', count: fulfillment.NEW, color: '#7D776C' },
        { label: 'Diproses', count: fulfillment.PROCESSING, color: '#8F4B1E' },
        { label: 'Siap Kirim', count: fulfillment.READY, color: '#193F66' },
        { label: 'Selesai', count: fulfillment.COMPLETED, color: '#1D3B2A' },
    ];

    const paymentRows: StatusRow[] = [
        { label: 'Lunas', count: payment.PAID, color: '#1D3B2A' },
        { label: 'Dibayar Sebagian', count: payment.PARTIAL, color: '#8F4B1E' },
        { label: 'Belum Lunas', count: payment.UNPAID, color: '#9A3B22' },
    ];

    return (
        <section
            aria-label="Ringkasan status pengerjaan dan pembayaran"
            className="atelier-sheet mb-7 overflow-hidden"
        >
            <div className="grid grid-cols-1 divide-y divide-[#DED6C8] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                <DistributionBlock
                    title="Status Pengerjaan"
                    total={totalOrders}
                    rows={fulfillmentRows}
                />
                <DistributionBlock
                    title="Status Pembayaran"
                    total={totalOrders}
                    rows={paymentRows}
                />
            </div>
        </section>
    );
}

export function ExpenseCategoryCard({
    items,
    totalCashOut,
}: {
    items: ExpenseBreakdownItem[];
    totalCashOut: number;
}) {
    const maxAmount = items.reduce((acc, item) => Math.max(acc, item.amount), 0);

    return (
        <section
            aria-label="Pengeluaran per kategori biaya"
            className="atelier-sheet mb-7 p-5 sm:p-6"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#DED6C8] pb-3.5">
                <h2 className="atelier-h2">Pengeluaran per Kategori</h2>
                <span className="text-sm font-bold text-[#8F4B1E] tabular-nums">
                    Total {formatRupiah(totalCashOut)}
                </span>
            </div>

            {items.length === 0 ? (
                <p className="py-7 text-center text-[15px] text-[#545852]">
                    Belum ada pengeluaran tercatat sah pada periode ini.
                </p>
            ) : (
                <div className="mt-4 space-y-3.5">
                    {items.map((item) => {
                        const barWidth =
                            maxAmount > 0 ? Math.max(4, Math.round((item.amount / maxAmount) * 100)) : 0;
                        return (
                            <div key={item.category} className="space-y-1.5">
                                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
                                    <span className="font-semibold text-[#1C211E]">
                                        {item.category}{' '}
                                        <span className="font-normal text-[#545852]">
                                            ({formatAmount(item.count)}x)
                                        </span>
                                    </span>
                                    <span className="font-bold text-[#1C211E]">
                                        {formatRupiah(item.amount)}{' '}
                                        <span className="font-normal text-[#545852]">
                                            ({item.percent}%)
                                        </span>
                                    </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-[4px] bg-[#EFE9DE]">
                                    <div
                                        className="h-full rounded-[4px] bg-[#8F4B1E]"
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
