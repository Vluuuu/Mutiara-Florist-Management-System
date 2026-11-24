import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { formatAmount, formatRupiah, formatSignedRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

export function formatCompactRupiah(value: number): string {
    const num = Math.trunc(Number(value) || 0);
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) {
        const b = abs / 1_000_000_000;
        return `${sign}Rp${Number.isInteger(b) ? b : b.toFixed(1).replace('.', ',')} M`;
    }
    if (abs >= 1_000_000) {
        const m = abs / 1_000_000;
        return `${sign}Rp${Number.isInteger(m) ? m : m.toFixed(1).replace('.', ',')} jt`;
    }
    if (abs >= 1_000) return `${sign}Rp${formatAmount(Math.round(abs / 1_000))} rb`;
    return `${sign}Rp${abs}`;
}

export type CashFlowBarPoint = {
    key: string;
    label: string;
    fullLabel: string;
    cashIn: number;
    cashOut: number;
    cashDiff: number;
};

type CashFlowChartProps = {
    points: CashFlowBarPoint[];
    ariaLabel: string;
    hasActivity: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    className?: string;
};

function computeCeiling(rawMax: number): number {
    if (rawMax <= 0) return 100_000;
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const norm = rawMax / mag;
    if (norm <= 1.2) return Math.ceil(1.2 * mag);
    if (norm <= 2) return 2 * mag;
    if (norm <= 2.5) return Math.ceil(2.5 * mag);
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
}

/**
 * Grafik batang arus kas SVG ringan tanpa pustaka eksternal (reusable untuk Phase 13C & 13D).
 */
export function CashFlowChart({
    points,
    ariaLabel,
    hasActivity,
    emptyTitle = 'Belum ada arus kas pada periode ini',
    emptyDescription = 'Pembayaran masuk dan pengeluaran sah yang dicatat akan muncul otomatis pada grafik harian ini.',
    className,
}: CashFlowChartProps) {
    const defaultIndex = useMemo(() => {
        for (let i = points.length - 1; i >= 0; i -= 1) {
            if (points[i].cashIn > 0 || points[i].cashOut > 0) return i;
        }
        return Math.max(points.length - 1, 0);
    }, [points]);

    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

    if (!hasActivity || points.length === 0) {
        return (
            <EmptyState
                icon={BarChart3}
                headingLevel="h3"
                title={emptyTitle}
                description={emptyDescription}
                className={cn('py-10', className)}
            />
        );
    }

    const activeIdx =
        selectedIdx !== null && selectedIdx >= 0 && selectedIdx < points.length
            ? selectedIdx
            : defaultIndex;
    const active = points[activeIdx];
    const maxVal = points.reduce((m, p) => Math.max(m, p.cashIn, p.cashOut), 0);
    const yCeiling = computeCeiling(maxVal);

    const W = 680;
    const H = 224;
    const padL = 64;
    const padR = 14;
    const padT = 14;
    const padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = points.length;
    const slotW = plotW / n;
    const dense = n > 14;
    const gap = dense ? 1.5 : 4;
    const barW = Math.max(dense ? 4 : 10, Math.min(dense ? 7.5 : 22, (slotW * 0.68 - gap) / 2));
    const pairW = barW * 2 + gap;
    const rx = dense ? 1.5 : 3;
    const xStep = n <= 7 ? 1 : n <= 14 ? 2 : 5;
    const barH = (v: number) => (v <= 0 || yCeiling <= 0 ? 0 : Math.max(3, (v / yCeiling) * plotH));

    return (
        <div className={cn('space-y-3', className)}>
            {active && (
                <div
                    aria-live="polite"
                    className="flex flex-col gap-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/55 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                            Rincian tanggal dipilih
                        </p>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{active.fullLabel}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] tabular-nums">
                        <div className="whitespace-nowrap">
                            <span className="block text-[11.5px] font-semibold text-[var(--text-secondary)]">
                                Kas Masuk
                            </span>
                            <strong className="font-bold text-[var(--status-paid-fg)]">
                                {formatRupiah(active.cashIn)}
                            </strong>
                        </div>
                        <div className="whitespace-nowrap">
                            <span className="block text-[11.5px] font-semibold text-[var(--text-secondary)]">
                                Kas Keluar
                            </span>
                            <strong className="font-bold text-[var(--expense-ink)]">
                                {formatRupiah(active.cashOut)}
                            </strong>
                        </div>
                        <div className="whitespace-nowrap">
                            <span className="block text-[11.5px] font-semibold text-[var(--text-secondary)]">
                                Selisih Kas
                            </span>
                            <strong
                                className={cn(
                                    'font-bold',
                                    active.cashDiff < 0
                                        ? 'text-[var(--brand-urgent)]'
                                        : active.cashDiff > 0
                                          ? 'text-[var(--text-primary)]'
                                          : 'text-[var(--text-secondary)]',
                                )}
                            >
                                {formatSignedRupiah(active.cashDiff)}
                            </strong>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full select-none">
                    {[0, Math.round(yCeiling / 2), yCeiling].map((tick) => {
                        const y = padT + plotH - (tick / yCeiling) * plotH;
                        return (
                            <g key={tick}>
                                <line
                                    x1={padL}
                                    x2={W - padR}
                                    y1={y}
                                    y2={y}
                                    stroke={tick === 0 ? '#D5CCC0' : '#E7E0D6'}
                                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                                />
                                <text
                                    x={padL - 8}
                                    y={y + 4}
                                    textAnchor="end"
                                    fill="#525750"
                                    fontSize="11"
                                    fontWeight="600"
                                >
                                    {formatCompactRupiah(tick)}
                                </text>
                            </g>
                        );
                    })}

                    {points.map((pt, i) => {
                        const slotX = padL + i * slotW;
                        const cx = slotX + slotW / 2;
                        const gx = cx - pairW / 2;
                        const hIn = barH(pt.cashIn);
                        const hOut = barH(pt.cashOut);
                        const y0 = padT + plotH;
                        const isActive = i === activeIdx;
                        const showX = i === 0 || i === n - 1 || i % xStep === 0;

                        return (
                            <g key={pt.key}>
                                {isActive && (
                                    <rect
                                        x={slotX + 1}
                                        y={padT - 2}
                                        width={Math.max(slotW - 2, 4)}
                                        height={plotH + 4}
                                        rx={6}
                                        fill="#EFEAE0"
                                        stroke={focusedIdx === i ? '#1B3B2B' : 'none'}
                                        strokeWidth={focusedIdx === i ? 1.5 : 0}
                                    />
                                )}
                                {hIn > 0 && <rect x={gx} y={y0 - hIn} width={barW} height={hIn} rx={rx} fill="#1B3B2B" />}
                                {hOut > 0 && <rect x={gx + barW + gap} y={y0 - hOut} width={barW} height={hOut} rx={rx} fill="#C07624" />}
                                <rect
                                    x={slotX}
                                    y={padT}
                                    width={slotW}
                                    height={plotH}
                                    fill="transparent"
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`${pt.fullLabel}: Kas masuk ${formatRupiah(pt.cashIn)}, kas keluar ${formatRupiah(pt.cashOut)}, selisih kas ${formatSignedRupiah(pt.cashDiff)}`}
                                    onMouseEnter={() => setSelectedIdx(i)}
                                    onFocus={() => {
                                        setSelectedIdx(i);
                                        setFocusedIdx(i);
                                    }}
                                    onBlur={() => setFocusedIdx(null)}
                                    onClick={() => setSelectedIdx(i)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedIdx(i);
                                        } else if (e.key === 'ArrowRight' && i < n - 1) setSelectedIdx(i + 1);
                                        else if (e.key === 'ArrowLeft' && i > 0) setSelectedIdx(i - 1);
                                    }}
                                    className="cursor-pointer focus:outline-none"
                                />
                                {showX && (
                                    <text
                                        x={cx}
                                        y={H - 7}
                                        textAnchor="middle"
                                        fill={isActive ? '#1B211D' : '#525750'}
                                        fontSize="11"
                                        fontWeight={isActive ? '700' : '500'}
                                    >
                                        {pt.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-2.5 text-[12.5px] text-[var(--text-secondary)]">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                        <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-[#1B3B2B]" />
                        Kas Masuk
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                        <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-[#C07624]" />
                        Kas Keluar
                    </span>
                </div>
                <span>Hanya catatan sah (WIB). Selisih kas bukan laba bersih.</span>
            </div>
        </div>
    );
}
