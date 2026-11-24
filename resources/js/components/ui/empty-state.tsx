import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
    icon?: LucideIcon;
    iconTone?: 'neutral' | 'paid';
    title: string;
    headingLevel?: 'h2' | 'h3';
    description?: string;
    action?: ReactNode;
    className?: string;
};

/**
 * Keadaan kosong standar (R-27): selalu menjelaskan sebab dan menyediakan aksi lanjutan.
 */
export function EmptyState({
    icon: Icon,
    iconTone = 'neutral',
    title,
    headingLevel = 'h2',
    description,
    action,
    className,
}: EmptyStateProps) {
    const Heading = headingLevel;

    return (
        <div className={cn('px-6 py-12 text-center', className)}>
            {Icon && (
                <div
                    className={cn(
                        'mx-auto mb-3.5 flex size-12 items-center justify-center rounded-[10px] border',
                        iconTone === 'paid'
                            ? 'border-[var(--status-paid-border)] bg-[var(--status-paid-bg)] text-[var(--status-paid-fg)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)]',
                    )}
                >
                    <Icon className="size-6" aria-hidden="true" />
                </div>
            )}
            <Heading className="atelier-h2">{title}</Heading>
            {description && (
                <p className="mx-auto mt-1.5 max-w-md text-[15px] text-[var(--text-secondary)]">
                    {description}
                </p>
            )}
            {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
        </div>
    );
}
