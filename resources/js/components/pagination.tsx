import { Link } from '@inertiajs/react';
import type { PaginationLink } from '@/types';
import { cn } from '@/lib/utils';

type PaginationProps = {
    links: PaginationLink[];
    from: number | null;
    to: number | null;
    total: number;
    itemLabel?: string;
    className?: string;
};

function formatLabel(label: string): string {
    return label
        .replace(/&laquo;\s*/gi, '')
        .replace(/\s*&raquo;/gi, '')
        .replace(/previous/gi, 'Sebelumnya')
        .replace(/next/gi, 'Berikutnya');
}

export function Pagination({ links, from, to, total, itemLabel = 'data', className }: PaginationProps) {
    if (total === 0 || links.length <= 1) {
        return null;
    }

    return (
        <nav
            aria-label="Paginasi"
            className={cn('flex flex-col items-center justify-between gap-4 sm:flex-row', className)}
        >
            <p className="text-xs text-stone-500">
                Menampilkan <span className="font-medium text-stone-800">{from ?? 0}</span> sampai{' '}
                <span className="font-medium text-stone-800">{to ?? 0}</span> dari{' '}
                <span className="font-medium text-stone-800">{total}</span> {itemLabel}
            </p>

            <ul className="flex flex-wrap items-center gap-1">
                {links.map((link, index) => {
                    const label = formatLabel(link.label);
                    const isPrevNext = link.label.includes('&laquo;') || link.label.includes('&raquo;') || /previous|next/i.test(link.label);

                    if (!link.url) {
                        return (
                            <li key={index}>
                                <span
                                    aria-disabled="true"
                                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs text-stone-300"
                                >
                                    {label}
                                </span>
                            </li>
                        );
                    }

                    return (
                        <li key={index}>
                            <Link
                                href={link.url}
                                preserveScroll
                                preserveState
                                aria-current={link.active ? 'page' : undefined}
                                className={cn(
                                    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                    link.active
                                        ? 'bg-emerald-950 font-semibold text-white'
                                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                                    isPrevNext && 'border border-stone-200 bg-white hover:bg-stone-50',
                                )}
                            >
                                {label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
