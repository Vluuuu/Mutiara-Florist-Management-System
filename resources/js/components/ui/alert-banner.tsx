import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertTone = 'success' | 'error' | 'warning' | 'info';

type AlertBannerProps = {
    tone: AlertTone;
    title?: string;
    children: ReactNode;
    onDismiss?: () => void;
    dismissLabel?: string;
    className?: string;
};

const TONE_STYLES: Record<
    AlertTone,
    { container: string; icon: typeof Info; role: 'alert' | 'status'; dismissHover: string }
> = {
    success: {
        container: 'border-[var(--status-paid-border)] bg-[var(--status-paid-bg)] text-[var(--status-paid-fg)]',
        icon: CheckCircle2,
        role: 'status',
        dismissHover: 'hover:bg-[#164B2A]/10',
    },
    error: {
        container: 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]',
        icon: AlertCircle,
        role: 'alert',
        dismissHover: 'hover:bg-[#8A2619]/10',
    },
    warning: {
        container: 'border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-[var(--status-warn-fg)]',
        icon: AlertTriangle,
        role: 'alert',
        dismissHover: 'hover:bg-[#6E3D09]/10',
    },
    info: {
        container: 'border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-primary)]',
        icon: Info,
        role: 'status',
        dismissHover: 'hover:bg-[#1B211D]/10',
    },
};

/**
 * Banner notifikasi & peringatan persisten yang seragam dan terverifikasi WCAG AA.
 */
export function AlertBanner({
    tone,
    title,
    children,
    onDismiss,
    dismissLabel = 'Tutup pemberitahuan',
    className,
}: AlertBannerProps) {
    const style = TONE_STYLES[tone];
    const Icon = style.icon;

    return (
        <div
            role={style.role}
            className={cn(
                'flex items-start justify-between gap-3 rounded-[10px] border p-4 text-sm font-medium leading-relaxed',
                style.container,
                className,
            )}
        >
            <div className="flex min-w-0 items-start gap-2.5">
                <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                    {title && <p className="font-bold">{title}</p>}
                    <div className={title ? 'mt-0.5' : undefined}>{children}</div>
                </div>
            </div>
            {onDismiss && (
                <button
                    type="button"
                    aria-label={dismissLabel}
                    onClick={onDismiss}
                    className={cn(
                        'inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] transition-colors',
                        style.dismissHover,
                    )}
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
