import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastViewportProps = {
    message: string | null | undefined;
    toastKey: string;
    onDismiss: () => void;
    autoHideMs?: number;
};

/**
 * Notifikasi toast sukses non-blocking: tidak menggeser tata letak (zero CLS),
 * berhenti otomatis menghitung saat kursor/fokus berada di atasnya, dan dapat ditutup kapan saja.
 */
export function ToastViewport({
    message,
    toastKey,
    onDismiss,
    autoHideMs = 5500,
}: ToastViewportProps) {
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (!message || paused) return;
        const timer = window.setTimeout(() => {
            onDismiss();
        }, autoHideMs);
        return () => window.clearTimeout(timer);
    }, [message, toastKey, paused, autoHideMs, onDismiss]);

    if (!message) {
        return null;
    }

    return (
        <div
            aria-live="polite"
            aria-atomic="true"
            className="pointer-events-none fixed inset-x-4 bottom-[calc(74px+env(safe-area-inset-bottom,0px))] z-40 flex justify-end md:inset-x-auto md:bottom-auto md:right-6 md:top-[72px]"
        >
            <div
                role="status"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                className={cn(
                    'atelier-elevated pointer-events-auto flex w-full max-w-[420px] items-start justify-between gap-3 border-[var(--status-paid-border)] bg-[var(--status-paid-bg)] p-3.5 pl-4 text-sm font-medium text-[var(--status-paid-fg)]',
                )}
            >
                <div className="flex min-w-0 items-start gap-2.5 pt-1">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <span className="break-words leading-snug">{message}</span>
                </div>
                <button
                    type="button"
                    aria-label="Tutup pemberitahuan"
                    onClick={onDismiss}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] text-[var(--status-paid-fg)] transition-colors hover:bg-[#164B2A]/10"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
