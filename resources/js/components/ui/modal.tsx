import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ModalStackEntry {
    id: string;
    onClose: () => void;
    isSubmitting: boolean;
    dialogElement: HTMLElement | null;
    overlayElement: HTMLElement | null;
    previousFocus: HTMLElement | null;
}

const modalStack: ModalStackEntry[] = [];
let keydownListenerAttached = false;

function syncModalStackA11y() {
    if (typeof document === 'undefined') return;
    const appRoot = document.getElementById('app') as (HTMLElement & { inert?: boolean }) | null;

    if (modalStack.length === 0) {
        if (appRoot) {
            appRoot.inert = false;
            appRoot.removeAttribute('aria-hidden');
        }
        return;
    }

    if (appRoot) {
        appRoot.inert = true;
        appRoot.setAttribute('aria-hidden', 'true');
    }

    // Modal stack layering:
    // Only the top-most modal (last in modalStack) is interactive and visible to screen readers.
    // Lower modals (0 to length - 2) must be inert and hidden from assistive technology.
    modalStack.forEach((entry, index) => {
        const isTop = index === modalStack.length - 1;
        if (entry.overlayElement) {
            const overlay = entry.overlayElement as HTMLElement & { inert?: boolean };
            if (isTop) {
                overlay.inert = false;
                overlay.removeAttribute('aria-hidden');
            } else {
                overlay.inert = true;
                overlay.setAttribute('aria-hidden', 'true');
            }
        }
    });
}

function handleGlobalKeyDown(e: KeyboardEvent) {
    if (modalStack.length === 0) return;
    const top = modalStack[modalStack.length - 1];
    if (!top) return;

    if (e.key === 'Escape') {
        if (!top.isSubmitting) {
            e.preventDefault();
            e.stopPropagation();
            top.onClose();
        }
        return;
    }

    if (e.key === 'Tab' && top.dialogElement) {
        const container = top.dialogElement;
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
}

function ensureGlobalKeydownListener() {
    if (typeof document === 'undefined') return;
    if (!keydownListenerAttached) {
        document.addEventListener('keydown', handleGlobalKeyDown, true);
        keydownListenerAttached = true;
    }
}

function teardownGlobalKeydownListenerIfEmpty() {
    if (typeof document === 'undefined') return;
    if (modalStack.length === 0 && keydownListenerAttached) {
        document.removeEventListener('keydown', handleGlobalKeyDown, true);
        keydownListenerAttached = false;
    }
}

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
    const modalId = useId();
    const overlayRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    const isSubmittingRef = useRef(isSubmitting);
    const [, setStackVersion] = useState(0);

    useEffect(() => {
        onCloseRef.current = onClose;
        const entry = modalStack.find((m) => m.id === modalId);
        if (entry) {
            entry.onClose = () => onCloseRef.current();
        }
    }, [onClose, modalId]);

    useEffect(() => {
        isSubmittingRef.current = isSubmitting;
        const entry = modalStack.find((m) => m.id === modalId);
        if (entry) {
            entry.isSubmitting = isSubmitting;
        }
    }, [isSubmitting, modalId]);

    useEffect(() => {
        if (!open) return;

        // Capture the active element before this modal took over
        previousFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        let entry = modalStack.find((m) => m.id === modalId);
        if (!entry) {
            entry = {
                id: modalId,
                onClose: () => onCloseRef.current(),
                isSubmitting: isSubmittingRef.current,
                dialogElement: dialogRef.current,
                overlayElement: overlayRef.current,
                previousFocus: previousFocusRef.current,
            };
            modalStack.push(entry);
        } else {
            entry.onClose = () => onCloseRef.current();
            entry.isSubmitting = isSubmittingRef.current;
            entry.dialogElement = dialogRef.current;
            entry.overlayElement = overlayRef.current;
            if (!entry.previousFocus) {
                entry.previousFocus = previousFocusRef.current;
            }
        }

        ensureGlobalKeydownListener();
        syncModalStackA11y();
        setStackVersion((v) => v + 1);

        const container = dialogRef.current;
        const focusTimer = window.setTimeout(() => {
            if (!container) return;
            // Only auto-focus if this modal is currently the top-most modal
            const currentTop = modalStack[modalStack.length - 1];
            if (currentTop?.id !== modalId) return;

            const preferredField = container.querySelector<HTMLElement>(
                '[data-modal-initial], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
            );
            const fallbackFocusable = container.querySelector<HTMLElement>(
                'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            );
            (preferredField ?? fallbackFocusable ?? container).focus();
        }, 0);

        return () => {
            window.clearTimeout(focusTimer);

            const index = modalStack.findIndex((m) => m.id === modalId);
            if (index === -1) return;

            const isTop = index === modalStack.length - 1;
            const [removed] = modalStack.splice(index, 1);

            syncModalStackA11y();
            teardownGlobalKeydownListenerIfEmpty();

            if (isTop) {
                if (modalStack.length > 0) {
                    const newTop = modalStack[modalStack.length - 1];
                    // Return focus to the previous element inside the newly-revealed top modal if possible
                    if (
                        removed.previousFocus &&
                        newTop.overlayElement?.contains(removed.previousFocus) &&
                        typeof removed.previousFocus.focus === 'function'
                    ) {
                        removed.previousFocus.focus();
                    } else if (newTop.dialogElement) {
                        const preferredField = newTop.dialogElement.querySelector<HTMLElement>(
                            '[data-modal-initial], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
                        );
                        const fallbackFocusable = newTop.dialogElement.querySelector<HTMLElement>(
                            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
                        );
                        (preferredField ?? fallbackFocusable ?? newTop.dialogElement).focus();
                    }
                } else {
                    const prev = removed.previousFocus;
                    if (prev && typeof prev.focus === 'function') {
                        prev.focus();
                    }
                }
            }
            // If removed was not top, do NOT disturb focus of the currently active top modal
        };
    }, [open, modalId]);

    // Keep DOM refs synced with the stack entry after every render of an open modal
    useEffect(() => {
        if (!open) return;
        const entry = modalStack.find((m) => m.id === modalId);
        if (entry) {
            entry.dialogElement = dialogRef.current;
            entry.overlayElement = overlayRef.current;
            syncModalStackA11y();
        }
    });

    if (!open) return null;

    const modalNode = (
        <div
            ref={overlayRef}
            data-modal-id={modalId}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-contain bg-[#182920]/60 p-3 sm:p-4"
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden overscroll-contain"
                onClick={() => {
                    const isTop = modalStack[modalStack.length - 1]?.id === modalId;
                    if (isTop && !isSubmitting) onClose();
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
                    'relative z-10 max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-[8px] border border-[#DED6C8] bg-[#FFFDF9] p-4 sm:p-6 shadow-[0_16px_40px_rgba(24,41,32,0.18)]',
                    maxWidthClass,
                )}
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 id={titleId} className="atelier-h2">
                            {title}
                        </h2>
                        {description && (
                            <p id={descId} className="mt-1 text-sm text-[#545852]">
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
                        className="shrink-0"
                    >
                        <X className="size-4" aria-hidden="true" />
                        <span>Tutup</span>
                    </Button>
                </div>

                <div>{children}</div>

                {footer && (
                    <div className="mt-5 flex flex-wrap justify-end gap-2.5 border-t border-[#DED6C8] pt-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalNode, document.body);
    }

    return modalNode;
}
