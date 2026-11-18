import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

function cleanPageLabel(label: string): string {
    return label
        .replace(/&laquo;\s*/gi, '')
        .replace(/\s*&raquo;/gi, '')
        .replace(/previous/gi, 'Sebelumnya')
        .replace(/next/gi, 'Berikutnya')
        .trim();
}

function isPrevLink(link: PaginationLink, index: number): boolean {
    return index === 0 || link.label.includes('&laquo;') || /previous|sebelumnya/i.test(link.label);
}

function isNextLink(link: PaginationLink, index: number, totalLinks: number): boolean {
    return index === totalLinks - 1 || link.label.includes('&raquo;') || /next|berikutnya/i.test(link.label);
}

/**
 * Kontrol paginasi kiri/kanan simetris, selalu terlihat saat ada data,
 * dan mudah ditekan operator senior (target minimal 44x44px).
 */
export function Pagination({ links, from, to, total, itemLabel = 'data', className }: PaginationProps) {
    if (total === 0) {
        return null;
    }

    const displayLinks: PaginationLink[] =
        links.length > 1
            ? links
            : [
                  { url: null, label: 'Sebelumnya', active: false },
                  { url: null, label: '1', active: true },
                  { url: null, label: 'Berikutnya', active: false },
              ];

    return (
        <nav
            aria-label="Paginasi"
            className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}
        >
            <p className="text-sm text-[#545852] tabular-nums">
                Menampilkan <span className="font-bold text-[#1C211E]">{from ?? 1}</span> sampai{' '}
                <span className="font-bold text-[#1C211E]">{to ?? total}</span> dari{' '}
                <span className="font-bold text-[#1C211E]">{total}</span> {itemLabel}
            </p>

            <ul className="flex flex-wrap items-center justify-center gap-2">
                {displayLinks.map((link, index) => {
                    const isPrev = isPrevLink(link, index);
                    const isNext = isNextLink(link, index, displayLinks.length);
                    const rawText = cleanPageLabel(link.label);
                    const isEllipsis = !isPrev && !isNext && rawText === '...';
                    const text = isPrev ? 'Sebelumnya' : isNext ? 'Berikutnya' : rawText;

                    if (isEllipsis) {
                        return (
                            <li key={index}>
                                <span
                                    aria-hidden="true"
                                    className="inline-flex min-h-[44px] min-w-[32px] items-center justify-center px-1 text-sm font-semibold text-[#545852]"
                                >
                                    ...
                                </span>
                            </li>
                        );
                    }

                    const content = (
                        <>
                            {isPrev && <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />}
                            <span>{text}</span>
                            {isNext && <ChevronRight className="size-4 shrink-0" aria-hidden="true" />}
                        </>
                    );

                    const baseBtnClass = cn(
                        'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[8px] border text-sm font-semibold transition-colors tabular-nums',
                        isPrev || isNext ? 'min-w-[128px] px-3.5' : 'min-w-[44px] px-3',
                    );

                    if (!link.url) {
                        return (
                            <li key={index}>
                                <span
                                    aria-disabled={!link.active ? 'true' : undefined}
                                    aria-current={link.active ? 'page' : undefined}
                                    className={cn(
                                        baseBtnClass,
                                        link.active
                                            ? 'border-[#1D3B2A] bg-[#1D3B2A] font-bold text-[#FFFDF9]'
                                            : 'cursor-not-allowed border-[#DED6C8] bg-[#EFE9DE] text-[#545852] opacity-80',
                                    )}
                                >
                                    {content}
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
                                    baseBtnClass,
                                    link.active
                                        ? 'border-[#1D3B2A] bg-[#1D3B2A] font-bold text-[#FFFDF9]'
                                        : 'border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
                                )}
                            >
                                {content}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
