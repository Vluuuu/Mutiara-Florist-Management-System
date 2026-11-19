import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchableOption = {
    value: string | number;
    label: string;
    description?: string | null;
};

type SearchableSelectProps = {
    id: string;
    options: SearchableOption[];
    value: string | number | null | undefined;
    onChange: (value: string | number | null) => void;
    placeholder?: string;
    emptyText?: string;
    invalid?: boolean;
    disabled?: boolean;
    describedBy?: string;
    footerAction?: ReactNode;
};

export function SearchableSelect({
    id,
    options,
    value,
    onChange,
    placeholder = 'Cari atau pilih...',
    emptyText = 'Tidak ada pilihan yang cocok.',
    invalid = false,
    disabled = false,
    describedBy,
    footerAction,
}: SearchableSelectProps) {
    const listboxId = useId();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const suppressFocusOpenRef = useRef(false);

    const selectedOption = useMemo(
        () => options.find((opt) => String(opt.value) === String(value ?? '')),
        [options, value],
    );

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(selectedOption ? selectedOption.label : '');
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (!open) {
            setQuery(selectedOption ? selectedOption.label : '');
        }
    }, [selectedOption, open]);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q || (selectedOption && q === selectedOption.label.toLowerCase())) {
            return options;
        }
        return options.filter(
            (opt) =>
                opt.label.toLowerCase().includes(q) ||
                (opt.description && opt.description.toLowerCase().includes(q)),
        );
    }, [options, query, selectedOption]);

    useEffect(() => {
        if (!open) return;
        const activeEl = document.getElementById(`${listboxId}-opt-${activeIndex}`);
        activeEl?.scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex, listboxId]);

    const selectOption = (opt: SearchableOption) => {
        onChange(opt.value);
        setQuery(opt.label);
        setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) {
                setOpen(true);
                setActiveIndex(0);
                return;
            }
            setActiveIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Home' && open && filtered.length > 0) {
            e.preventDefault();
            setActiveIndex(0);
        } else if (e.key === 'End' && open && filtered.length > 0) {
            e.preventDefault();
            setActiveIndex(filtered.length - 1);
        } else if (e.key === 'Enter' && open) {
            if (e.nativeEvent.isComposing || e.keyCode === 229) {
                return;
            }
            const target = filtered[activeIndex];
            if (target) {
                e.preventDefault();
                selectOption(target);
            }
        }
    };

    const handleWrapperBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        if (open && wrapperRef.current && !wrapperRef.current.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
        }
    };

    const handleWrapperKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
            setOpen(false);
            setQuery(selectedOption ? selectedOption.label : '');
            if (document.activeElement !== inputRef.current) {
                suppressFocusOpenRef.current = true;
                inputRef.current?.focus();
            }
        }
    };

    return (
        <div
            ref={wrapperRef}
            onKeyDown={handleWrapperKeyDown}
            onBlur={handleWrapperBlur}
            className="relative"
        >
            <div className="relative flex items-center">
                <Search
                    className="pointer-events-none absolute left-3 size-4 text-[#545852]"
                    aria-hidden="true"
                />
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={describedBy}
                    aria-activedescendant={
                        open && filtered[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined
                    }
                    disabled={disabled}
                    value={query}
                    placeholder={placeholder}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    onFocus={() => {
                        if (suppressFocusOpenRef.current) {
                            suppressFocusOpenRef.current = false;
                            return;
                        }
                        setOpen(true);
                        setActiveIndex(0);
                    }}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (selectedOption) onChange(null);
                        setOpen(true);
                        setActiveIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        'min-h-[44px] w-full rounded-[8px] border-[1.5px] py-2 pl-9 text-[15px] text-[#1C211E] placeholder:text-[#60645E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A] disabled:bg-[#EFE9DE] disabled:text-[#545852]',
                        query && !disabled ? 'pr-[92px]' : 'pr-12',
                        invalid ? 'border-[#8A2619] bg-[#FCF0EC]/60' : 'border-[#7D776C] bg-[#FFFDF9]',
                    )}
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                    {query && !disabled && (
                        <button
                            type="button"
                            aria-label="Bersihkan pilihan"
                            onClick={() => {
                                setQuery('');
                                onChange(null);
                                setOpen(true);
                                inputRef.current?.focus();
                            }}
                            className="inline-flex size-11 items-center justify-center rounded-[8px] text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label={open ? 'Tutup daftar' : 'Buka daftar'}
                        disabled={disabled}
                        onClick={() => setOpen((prev) => !prev)}
                        className="inline-flex size-11 items-center justify-center rounded-[8px] text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]"
                    >
                        <ChevronDown className="size-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {open && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] p-1.5 shadow-[0_8px_24px_rgba(24,41,32,0.12)]">
                    <div
                        id={listboxId}
                        role="listbox"
                        className="max-h-[40dvh] space-y-0.5 overflow-y-auto overscroll-contain sm:max-h-60"
                    >
                        {filtered.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-[#545852]">{emptyText}</p>
                        ) : (
                            filtered.map((opt, idx) => {
                                const isSelected = String(opt.value) === String(value ?? '');
                                const isActive = idx === activeIndex;
                                return (
                                    <button
                                        key={String(opt.value)}
                                        id={`${listboxId}-opt-${idx}`}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => selectOption(opt)}
                                        className={cn(
                                            'flex min-h-[44px] w-full flex-col justify-center rounded-[6px] px-3 py-2 text-left text-[15px] transition-colors',
                                            isActive || isSelected
                                                ? 'bg-[#EFE9DE] font-semibold text-[#182920]'
                                                : 'text-[#1C211E] hover:bg-[#F7F3EC]',
                                        )}
                                    >
                                        <span>{opt.label}</span>
                                        {opt.description && (
                                            <span className="text-[13px] font-normal text-[#545852]">
                                                {opt.description}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                    {footerAction && (
                        <div className="mt-1 border-t border-[#DED6C8] pt-1.5">{footerAction}</div>
                    )}
                </div>
            )}
        </div>
    );
}
