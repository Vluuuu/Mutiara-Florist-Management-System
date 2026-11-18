import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type LedgerSummaryCell = {
    index?: string;
    label: string;
    value: string;
    hint?: ReactNode;
    tone?: 'default' | 'paid' | 'urgent';
    emphasis?: boolean;
    children?: ReactNode;
};

type LedgerSummaryStripProps = {
    items: LedgerSummaryCell[];
    ariaLabel?: string;
    columns?: 2 | 3 | 4;
    mobileColumns?: 1 | 2;
    className?: string;
};

/**
 * Strip ringkasan pembukuan dengan pemisah hairline rapi di setiap ukuran layar
 * (`gap-px bg-[#DED6C8]`) agar nominal besar tidak pernah terjepit atau terpotong di mobile.
 */
export function LedgerSummaryStrip({
    items,
    ariaLabel = 'Ringkasan angka pembukuan',
    columns,
    mobileColumns = 1,
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

    return (
        <section
            aria-label={ariaLabel}
            className={cn('atelier-sheet overflow-hidden', className)}
        >
            <div className={cn('grid gap-px bg-[#DED6C8]', gridColsClass)}>
                {items.map((cell) => (
                    <div
                        key={cell.label}
                        className={cn(
                            'flex flex-col justify-between',
                            isTwoColMobile ? 'p-3.5 sm:p-5' : 'p-5',
                            cell.emphasis ? 'bg-[#EFE9DE]' : 'bg-[#FFFDF9]',
                        )}
                    >
                        <div>
                            <p
                                className={cn(
                                    'font-semibold text-[#545852]',
                                    isTwoColMobile ? 'text-[13px] sm:text-sm' : 'text-sm',
                                )}
                            >
                                {cell.label}
                            </p>
                            {cell.children ? (
                                <div className="mt-2.5">{cell.children}</div>
                            ) : (
                                <p
                                    className={cn(
                                        'tabular-nums break-words font-bold leading-tight tracking-[-0.015em]',
                                        isTwoColMobile
                                            ? 'mt-1.5 text-[17px] sm:mt-2 sm:text-2xl lg:text-[26px]'
                                            : 'mt-2 text-2xl sm:text-[26px]',
                                        cell.tone === 'paid' && 'text-[#164B2A]',
                                        cell.tone === 'urgent' && 'text-[#9A3B22]',
                                        (!cell.tone || cell.tone === 'default') && 'text-[#1C211E]',
                                    )}
                                >
                                    {cell.value}
                                </p>
                            )}
                        </div>
                        {cell.hint && (
                            <p
                                className={cn(
                                    'leading-snug text-[#545852] tabular-nums',
                                    isTwoColMobile ? 'mt-1 text-[12px] sm:mt-2 sm:text-[13px]' : 'mt-2 text-[13px]',
                                )}
                            >
                                {cell.hint}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
