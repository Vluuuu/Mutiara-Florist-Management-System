import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LedgerSummaryCell = {
    index?: string;
    label: string;
    value: string;
    hint?: ReactNode;
    icon?: LucideIcon;
    tone?: 'default' | 'paid' | 'expense' | 'urgent';
    emphasis?: boolean;
    children?: ReactNode;
};

type LedgerSummaryStripProps = {
    items: LedgerSummaryCell[];
    ariaLabel?: string;
    columns?: 2 | 3 | 4;
    mobileColumns?: 1 | 2;
    variant?: 'cards' | 'strip';
    className?: string;
};

const ICON_CHIP_TONE: Record<NonNullable<LedgerSummaryCell['tone']>, string> = {
    default: 'bg-[var(--bg-sunken)] text-[var(--text-secondary)]',
    paid: 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]',
    expense: 'bg-[var(--expense-soft)] text-[var(--expense-ink)]',
    urgent: 'bg-[var(--brand-urgent-soft)] text-[var(--brand-urgent)]',
};

const VALUE_TONE: Record<NonNullable<LedgerSummaryCell['tone']>, string> = {
    default: 'text-[var(--text-primary)]',
    paid: 'text-[var(--status-paid-fg)]',
    expense: 'text-[var(--expense-ink)]',
    urgent: 'text-[var(--brand-urgent)]',
};

/**
 * Modular KPI summary grid (Syncro + Calm Botanical V2):
 * mendukung tampilan kartu modular terpisah ('cards') maupun strip menyatu ('strip')
 * dengan angka Rupiah tabular dan keterbacaan WCAG AA di semua ukuran layar.
 */
export function LedgerSummaryStrip({
    items,
    ariaLabel = 'Ringkasan angka pembukuan',
    columns,
    mobileColumns = 1,
    variant = 'cards',
    className,
}: LedgerSummaryStripProps) {
    const colCount = columns ?? (items.length === 3 ? 3 : items.length === 2 ? 2 : 4);
    const isTwoColMobile = mobileColumns === 2 && colCount >= 2;
    const gridColsClass =
        colCount === 2
            ? isTwoColMobile
                ? 'grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2'
            : colCount === 3
              ? isTwoColMobile
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-3'
              : isTwoColMobile
                ? 'grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

    const renderCellContent = (cell: LedgerSummaryCell) => {
        const tone = cell.tone ?? 'default';
        const Icon = cell.icon;

        return (
            <>
                <div>
                    <div className="flex items-start justify-between gap-2">
                        <p
                            className={cn(
                                'font-semibold leading-snug text-[var(--text-secondary)]',
                                isTwoColMobile ? 'text-[12.5px] sm:text-[13.5px]' : 'text-[13.5px]',
                            )}
                        >
                            {cell.label}
                        </p>
                        {Icon && (
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'inline-flex size-8 shrink-0 items-center justify-center rounded-[8px]',
                                    ICON_CHIP_TONE[tone],
                                )}
                            >
                                <Icon className="size-4" />
                            </span>
                        )}
                    </div>

                    {cell.children ? (
                        <div className="mt-2.5">{cell.children}</div>
                    ) : (
                        <p
                            className={cn(
                                'tabular-nums break-words font-bold leading-tight tracking-[-0.02em]',
                                isTwoColMobile
                                    ? 'mt-2 text-[18px] sm:mt-2.5 sm:text-2xl lg:text-[25px]'
                                    : 'mt-2.5 text-2xl sm:text-[25px]',
                                VALUE_TONE[tone],
                            )}
                        >
                            {cell.value}
                        </p>
                    )}
                </div>

                {cell.hint && (
                    <p
                        className={cn(
                            'leading-snug text-[var(--text-secondary)] tabular-nums',
                            isTwoColMobile ? 'mt-1.5 text-[12px] sm:mt-2 sm:text-[13px]' : 'mt-2 text-[13px]',
                        )}
                    >
                        {cell.hint}
                    </p>
                )}
            </>
        );
    };

    if (variant === 'strip') {
        return (
            <section aria-label={ariaLabel} className={cn('atelier-sheet overflow-hidden', className)}>
                <div className={cn('grid gap-px bg-[var(--border-hairline)]', gridColsClass)}>
                    {items.map((cell) => (
                        <div
                            key={cell.label}
                            className={cn(
                                'flex flex-col justify-between',
                                isTwoColMobile ? 'p-3.5 sm:p-5' : 'p-5',
                                cell.emphasis ? 'bg-[var(--bg-sunken)]' : 'bg-[var(--bg-surface)]',
                            )}
                        >
                            {renderCellContent(cell)}
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section aria-label={ariaLabel} className={className}>
            <div className={cn('grid gap-3 sm:gap-4', gridColsClass)}>
                {items.map((cell) => (
                    <div
                        key={cell.label}
                        className={cn(
                            'atelier-sheet flex flex-col justify-between',
                            isTwoColMobile ? 'p-3.5 sm:p-5' : 'p-5',
                            cell.emphasis && 'bg-[var(--bg-sunken)]/70',
                        )}
                    >
                        {renderCellContent(cell)}
                    </div>
                ))}
            </div>
        </section>
    );
}
