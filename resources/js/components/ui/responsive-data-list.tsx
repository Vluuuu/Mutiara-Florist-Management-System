import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataColumn<T> = {
    key: string;
    header: string;
    align?: 'left' | 'right';
    headerClassName?: string;
    cellClassName?: string;
    render: (row: T) => ReactNode;
};

type ResponsiveDataListProps<T> = {
    items: T[];
    columns: DataColumn<T>[];
    keyExtractor: (row: T) => string | number;
    renderMobileCard: (row: T) => ReactNode;
    emptyState?: ReactNode;
    tableAriaLabel?: string;
    rowClassName?: (row: T) => string | undefined;
    tabletColumns?: 1 | 2;
};

/**
 * Daftar data 3-keadaan (Mobile 1 kolom -> Tablet 1/2 kolom -> Desktop tabel ringkas)
 * agar kartu tidak melar berlebihan di viewport tablet 768px (R-03).
 */
export function ResponsiveDataList<T>({
    items,
    columns,
    keyExtractor,
    renderMobileCard,
    emptyState,
    tableAriaLabel,
    rowClassName,
    tabletColumns = 1,
}: ResponsiveDataListProps<T>) {
    if (items.length === 0) {
        return <>{emptyState ?? null}</>;
    }

    return (
        <div>
            {/* Desktop Ledger Table (>= 1024px) */}
            <div
                tabIndex={0}
                role="region"
                aria-label={tableAriaLabel ?? 'Tabel data'}
                className="hidden overflow-x-auto focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] lg:block"
            >
                <table className="w-full border-collapse text-[14.5px]" aria-label={tableAriaLabel}>
                    <thead>
                        <tr className="border-y border-[var(--border-hairline)] bg-[var(--bg-sunken)]/65">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={cn(
                                        'px-4 py-3 text-[12.5px] font-bold tracking-[0.01em] text-[var(--text-secondary)]',
                                        col.align === 'right' ? 'text-right' : 'text-left',
                                        col.headerClassName,
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)]">
                        {items.map((row) => (
                            <tr
                                key={keyExtractor(row)}
                                className={cn(
                                    'align-middle transition-colors hover:bg-[var(--bg-hover)]',
                                    rowClassName?.(row),
                                )}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={cn(
                                            'px-4 py-3.5 text-[var(--text-primary)]',
                                            col.align === 'right' ? 'tabular-nums text-right' : 'text-left',
                                            col.cellClassName,
                                        )}
                                    >
                                        {col.render(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile (< 768px) & Tablet (768px - 1023px) Structured Cards */}
            <div
                className={cn(
                    'grid grid-cols-1 gap-3.5 lg:hidden',
                    tabletColumns === 2 && 'md:grid-cols-2',
                )}
            >
                {items.map((row) => (
                    <div key={keyExtractor(row)} className="min-w-0">
                        {renderMobileCard(row)}
                    </div>
                ))}
            </div>
        </div>
    );
}
