import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DistributionSegment = {
    key: string;
    label: string;
    count: number;
    barColor: string;
    textColor: string;
    dotColor: string;
};

type PipelineBarProps = {
    segments: DistributionSegment[];
    total: number;
    unitLabel?: string;
    emptyText?: string;
    className?: string;
};

/**
 * Distribusi proporsional horizontal yang ringan & aksesibel untuk status pengerjaan aktif
 * maupun rincian distribusi di Laporan Keuangan (Phase 13D).
 */
export function PipelineBar({
    segments,
    total,
    unitLabel = 'rangkaian aktif',
    emptyText = 'Tidak ada rangkaian aktif dalam antrean pengerjaan saat ini.',
    className,
}: PipelineBarProps) {
    if (total <= 0) {
        return (
            <div className={cn('rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/45 p-4', className)}>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                    0 {unitLabel}
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                    {emptyText}
                </p>
            </div>
        );
    }

    return (
        <div className={cn('space-y-3', className)}>
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
                    {formatAmount(total)}{' '}
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">
                        {unitLabel}
                    </span>
                </p>
            </div>

            {/* Proportional stacked bar */}
            <div
                aria-hidden="true"
                className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-sunken)]"
            >
                {segments.map((seg) => {
                    if (seg.count <= 0) return null;
                    const pct = (seg.count / total) * 100;
                    return (
                        <div
                            key={seg.key}
                            style={{ width: `${pct}%`, backgroundColor: seg.barColor }}
                            className="h-full first:rounded-l-full last:rounded-r-full"
                        />
                    );
                })}
            </div>

            {/* Exact count & share breakdown */}
            <dl className="grid grid-cols-3 gap-2">
                {segments.map((seg) => {
                    const pct = Math.round((seg.count / total) * 100);
                    return (
                        <div
                            key={seg.key}
                            className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/40 px-2.5 py-2"
                        >
                            <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                                <span
                                    aria-hidden="true"
                                    style={{ backgroundColor: seg.dotColor }}
                                    className="size-2 shrink-0 rounded-full"
                                />
                                <span className="truncate">{seg.label}</span>
                            </dt>
                            <dd
                                style={{ color: seg.textColor }}
                                className="mt-1 text-base font-bold tabular-nums"
                            >
                                {formatAmount(seg.count)}{' '}
                                <span className="text-[11.5px] font-semibold text-[var(--text-secondary)]">
                                    ({pct}%)
                                </span>
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}
