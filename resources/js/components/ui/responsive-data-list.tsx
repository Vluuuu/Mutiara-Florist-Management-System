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
};

export function ResponsiveDataList<T>({
    items,
    columns,
    keyExtractor,
    renderMobileCard,
    emptyState,
    tableAriaLabel,
    rowClassName,
}: ResponsiveDataListProps<T>) {
    if (items.length === 0) {
        return <>{emptyState ?? null}</>;
    }

    return (
        <div>
            {/* Desktop Ledger Table (>= 1024px) */}
            <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-[15px]" aria-label={tableAriaLabel}>
                    <thead>
                        <tr className="border-y border-[#DED6C8] bg-[#EFE9DE]/75">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={cn(
                                        'px-4 py-3.5 text-[13px] font-bold tracking-[0.01em] text-[#545852]',
                                        col.align === 'right' ? 'text-right' : 'text-left',
                                        col.headerClassName,
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED6C8]">
                        {items.map((row) => (
                            <tr
                                key={keyExtractor(row)}
                                className={cn('align-middle transition-colors hover:bg-[#F7F3EC]/85', rowClassName?.(row))}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={cn(
                                            'px-4 py-4 text-[#1C211E]',
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

            {/* Mobile & Tablet Structured Cards (< 1024px) */}
            <div className="flex flex-col gap-3.5 lg:hidden">
                {items.map((row) => (
                    <div key={keyExtractor(row)}>{renderMobileCard(row)}</div>
                ))}
            </div>
        </div>
    );
}
