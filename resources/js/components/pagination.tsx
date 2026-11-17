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

/**
 * Kontrol paginasi Botanical Studio dengan target sentuh minimal 44x44px.
 */
export function Pagination({ links, from, to, total, itemLabel = 'data', className }: PaginationProps) {
    if (total === 0 || links.length <= 1) {
        return null;
    }

    return (
        <nav
            aria-label="Paginasi"
            className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}
        >
            <p className="text-[13px] text-[#525B54] tabular-nums">
                Menampilkan <span className="font-semibold text-[#1E2420]">{from ?? 0}</span> sampai{' '}
                <span className="font-semibold text-[#1E2420]">{to ?? 0}</span> dari{' '}
                <span className="font-semibold text-[#1E2420]">{total}</span> {itemLabel}
            </p>

            <ul className="flex flex-wrap items-center gap-1.5">
                {links.map((link, index) => {
                    const label = formatLabel(link.label);
                    const isPrevNext =
                        link.label.includes('&laquo;') ||
                        link.label.includes('&raquo;') ||
                        /previous|next/i.test(link.label);

                    if (!link.url) {
                        return (
                            <li key={index}>
                                <span
                                    aria-disabled="true"
                                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-3 py-2 text-xs font-medium text-[#525B54]/45"
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
                                    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-3 py-2 text-xs transition-colors',
                                    link.active
                                        ? 'bg-[#143326] font-bold text-white'
                                        : 'font-semibold text-[#1E2420] hover:bg-[#F1EDE6]',
                                    isPrevNext && !link.active && 'border border-[#858E87] bg-white',
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
