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
            {/* Desktop Table (>= 1024px) */}
            <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-sm" aria-label={tableAriaLabel}>
                    <thead>
                        <tr className="border-b-[1.5px] border-[#E3DED4] bg-[#F1EDE6]">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={cn(
                                        'px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-[#525B54]',
                                        col.align === 'right' ? 'text-right' : 'text-left',
                                        col.headerClassName,
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3DED4]">
                        {items.map((row) => (
                            <tr
                                key={keyExtractor(row)}
                                className={cn('align-top transition-colors hover:bg-[#FAF8F4]', rowClassName?.(row))}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={cn(
                                            'px-3 py-3 text-[#1E2420]',
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
            <div className="flex flex-col gap-2.5 lg:hidden">
                {items.map((row) => (
                    <div key={keyExtractor(row)}>{renderMobileCard(row)}</div>
                ))}
            </div>
        </div>
    );
}
