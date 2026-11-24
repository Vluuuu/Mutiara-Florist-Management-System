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
    className?: string;
};

/**
 * Kontrol filter/tab tersegmentasi dengan target sentuh >= 44px dan kontras WCAG AA.
 */
export function SegmentedTabs<T extends string = string>({
    options,
    value,
    onChange,
    ariaLabel,
    disabled = false,
    variant = 'track',
    roleMode = 'group',
    className,
}: SegmentedTabsProps<T>) {
    if (variant === 'track') {
        return (
            <div
                role={roleMode}
                aria-label={ariaLabel}
                className={cn(
                    'inline-flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1 sm:flex-wrap sm:overflow-visible',
                    className,
                )}
            >
                {options.map((opt) => {
                    const selected = opt.key === value;
                    return (
                        <button
                            key={opt.key || '__all__'}
                            type="button"
                            role={roleMode === 'tablist' ? 'tab' : undefined}
                            aria-selected={roleMode === 'tablist' ? selected : undefined}
                            aria-pressed={roleMode === 'group' ? selected : undefined}
                            disabled={disabled}
                            onClick={() => onChange(opt.key)}
                            className={cn(
                                'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 py-2 text-[13px] font-semibold transition-colors tabular-nums sm:px-3.5 sm:text-sm',
                                selected
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
                'flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0',
                className,
            )}
        >
            {options.map((opt) => {
                const selected = opt.key === value;
                return (
                    <button
                        key={opt.key || '__all__'}
                        type="button"
                        role={roleMode === 'tablist' ? 'tab' : undefined}
                        aria-selected={roleMode === 'tablist' ? selected : undefined}
                        aria-pressed={roleMode === 'group' ? selected : undefined}
                        disabled={disabled}
                        onClick={() => onChange(opt.key)}
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
