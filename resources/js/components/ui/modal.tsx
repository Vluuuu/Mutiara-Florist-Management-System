import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ModalProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    isSubmitting?: boolean;
    maxWidthClass?: string;
    footer?: ReactNode;
    children: ReactNode;
};

export function Modal({
    open,
    onClose,
    title,
    description,
    isSubmitting = false,
    maxWidthClass = 'max-w-[500px]',
    footer,
    children,
}: ModalProps) {
    const titleId = useId();
    const descId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    const isSubmittingRef = useRef(isSubmitting);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        isSubmittingRef.current = isSubmitting;
    }, [isSubmitting]);

    useEffect(() => {
        if (!open) return;

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const container = dialogRef.current;
        const focusTimer = window.setTimeout(() => {
            if (!container) return;
            const preferredField = container.querySelector<HTMLElement>(
                '[data-modal-initial], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
            );
            const fallbackFocusable = container.querySelector<HTMLElement>(
                'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            );
            (preferredField ?? fallbackFocusable ?? container).focus();
        }, 0);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (!isSubmittingRef.current) {
                    e.preventDefault();
                    onCloseRef.current();
                }
                return;
            }

            if (e.key === 'Tab' && container) {
                const focusables = Array.from(
                    container.querySelectorAll<HTMLElement>(
                        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                    ),
                ).filter((el) => el.offsetParent !== null);

                if (focusables.length === 0) {
                    e.preventDefault();
                    container.focus();
                    return;
                }

                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            const prev = previousFocusRef.current;
            if (prev && typeof prev.focus === 'function') {
                prev.focus();
            }
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#143326]/55 p-4">
            <div
                aria-hidden="true"
                className="absolute inset-0"
                onClick={() => {
                    if (!isSubmitting) onClose();
                }}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={cn(
                    'relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-[#E3DED4] bg-white p-5',
                    maxWidthClass,
                )}
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h2 id={titleId} className="text-base font-bold text-[#1E2420]">
                            {title}
                        </h2>
                        {description && (
                            <p id={descId} className="mt-1 text-sm text-[#525B54]">
                                {description}
                            </p>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label="Tutup dialog"
                        disabled={isSubmitting}
                        onClick={onClose}
                    >
                        <X className="size-4" aria-hidden="true" />
                        <span>Tutup</span>
                    </Button>
                </div>

                <div>{children}</div>

                {footer && (
                    <div className="mt-5 flex flex-wrap justify-end gap-2.5 border-t border-[#E3DED4] pt-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
