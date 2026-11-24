import type { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type PageHeaderBackLink = {
    href: string;
    label: string;
    component?: string;
    cacheTags?: string[];
};

type PageHeaderProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    backLink?: PageHeaderBackLink;
    badges?: ReactNode;
    actions?: ReactNode;
    className?: string;
};

/**
 * Header halaman standar Calm Botanical Workspace V2:
 * hierarki judul tunggal (h1), jarak napas konsisten, dan slot aksi rapi tanpa duplikasi.
 */
export function PageHeader({
    title,
    subtitle,
    backLink,
    badges,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <header
            className={cn(
                'mb-6 border-b border-[var(--border-hairline)] pb-5',
                className,
            )}
        >
            {backLink && (
                <Link
                    href={backLink.href}
                    component={backLink.component}
                    prefetch="hover"
                    cacheFor="10s"
                    cacheTags={backLink.cacheTags}
                    className="mb-1.5 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[var(--brand-primary)] hover:underline"
                >
                    <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                    <span>{backLink.label}</span>
                </Link>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    {badges && (
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            {badges}
                        </div>
                    )}
                    <h1 className="atelier-h1 break-words">{title}</h1>
                    {subtitle && (
                        <div className="mt-1 text-sm text-[var(--text-secondary)] sm:text-[15px]">
                            {subtitle}
                        </div>
                    )}
                </div>

                {actions && (
                    <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}
