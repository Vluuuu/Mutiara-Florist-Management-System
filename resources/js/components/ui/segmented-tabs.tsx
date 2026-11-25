import { useRef } from 'react';
import { cn } from '@/lib/utils';

export type SegmentedTabOption<T extends string = string> = {
    key: T;
    label: string;
    count?: number;
};

type SegmentedTabsProps<T extends string = string> = {
    options: Array<SegmentedTabOption<T>>;
    value: T;
    onChange: (next: T) => void;
    ariaLabel: string;
    disabled?: boolean;
    variant?: 'track' | 'pills';
    roleMode?: 'group' | 'tablist';
    idPrefix?: string;
    className?: string;
};

/**
 * Kontrol filter/tab tersegmentasi dengan target sentuh >= 44px dan kontras WCAG AA.
 * Pada mode `tablist`, menerapkan roving tabindex, navigasi panah kiri/kanan/Home/End
 * (selection follows focus), dan indikator aktif non-warna yang aman untuk forced-colors.
 */
export function SegmentedTabs<T extends string = string>({
    options,
    value,
    onChange,
    ariaLabel,
    disabled = false,
    variant = 'track',
    roleMode = 'group',
    idPrefix,
    className,
}: SegmentedTabsProps<T>) {
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const isTablist = roleMode === 'tablist';

    const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (!isTablist || disabled || options.length <= 1) {
            return;
        }

        let nextIndex: number | null = null;
        if (e.key === 'ArrowRight') {
            nextIndex = (index + 1) % options.length;
        } else if (e.key === 'ArrowLeft') {
            nextIndex = (index - 1 + options.length) % options.length;
        } else if (e.key === 'Home') {
            nextIndex = 0;
        } else if (e.key === 'End') {
            nextIndex = options.length - 1;
        }

        if (nextIndex === null) {
            return;
        }

        e.preventDefault();
        const nextOption = options[nextIndex];
        onChange(nextOption.key);
        const nextButton = buttonRefs.current[nextIndex];
        if (nextButton) {
            nextButton.focus();
            nextButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    };

    if (variant === 'track') {
        return (
            <div
                role={roleMode}
                aria-label={ariaLabel}
                className={cn(
                    'inline-flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1',
                    !isTablist && 'sm:flex-wrap sm:overflow-visible',
                    className,
                )}
            >
                {options.map((opt, idx) => {
                    const selected = opt.key === value;
                    const tabId = idPrefix ? `${idPrefix}-tab-${opt.key}` : undefined;
                    return (
                        <button
                            key={opt.key || '__all__'}
                            id={tabId}
                            ref={(el) => {
                                buttonRefs.current[idx] = el;
                            }}
                            type="button"
                            role={isTablist ? 'tab' : undefined}
                            tabIndex={isTablist ? (selected ? 0 : -1) : undefined}
                            aria-selected={isTablist ? selected : undefined}
                            aria-pressed={!isTablist ? selected : undefined}
                            disabled={disabled}
                            onClick={() => {
                                onChange(opt.key);
                                buttonRefs.current[idx]?.scrollIntoView({
                                    block: 'nearest',
                                    inline: 'nearest',
                                });
                            }}
                            onKeyDown={(e) => handleTabKeyDown(e, idx)}
                            className={cn(
                                'relative inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-2 text-[13px] font-semibold transition-colors tabular-nums sm:px-3.5 sm:text-sm',
                                isTablist
                                    ? 'aria-selected:bg-[var(--bg-surface)] aria-selected:text-[var(--brand-primary)] aria-selected:shadow-[0_1px_2px_rgba(22,38,30,0.08)] aria-selected:after:pointer-events-none aria-selected:after:absolute aria-selected:after:inset-x-3 aria-selected:after:bottom-1 aria-selected:after:border-b-2 aria-selected:after:border-[var(--brand-primary)] aria-selected:after:content-[""] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    : selected
                                      ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[0_1px_2px_rgba(22,38,30,0.08)]'
                                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                            )}
                        >
                            <span>{opt.label}</span>
                            {opt.count !== undefined && (
                                <span
                                    className={cn(
                                        'rounded-[4px] px-1.5 py-0.5 text-[12px] font-bold',
                                        selected
                                            ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                                            : 'bg-[var(--bg-surface)]/70 text-[var(--text-secondary)]',
                                    )}
                                >
                                    {opt.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div
            role={roleMode}
            aria-label={ariaLabel}
            className={cn(
                'flex flex-nowrap gap-2 overflow-x-auto pb-1',
                !isTablist && 'sm:flex-wrap sm:overflow-visible sm:pb-0',
                className,
            )}
        >
            {options.map((opt, idx) => {
                const selected = opt.key === value;
                const tabId = idPrefix ? `${idPrefix}-tab-${opt.key}` : undefined;
                return (
                    <button
                        key={opt.key || '__all__'}
                        id={tabId}
                        ref={(el) => {
                            buttonRefs.current[idx] = el;
                        }}
                        type="button"
                        role={isTablist ? 'tab' : undefined}
                        tabIndex={isTablist ? (selected ? 0 : -1) : undefined}
                        aria-selected={isTablist ? selected : undefined}
                        aria-pressed={!isTablist ? selected : undefined}
                        disabled={disabled}
                        onClick={() => onChange(opt.key)}
                        onKeyDown={(e) => handleTabKeyDown(e, idx)}
                        className={cn(
                            'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border px-3.5 py-2 text-sm font-semibold transition-colors tabular-nums',
                            selected
                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--bg-surface)]'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]',
                        )}
                    >
                        <span>{opt.label}</span>
                        {opt.count !== undefined && <span>({opt.count})</span>}
                    </button>
                );
            })}
        </div>
    );
}
