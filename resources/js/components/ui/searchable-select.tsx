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
        } else if (e.key === 'Enter' && open) {
            const target = filtered[activeIndex];
            if (target) {
                e.preventDefault();
                selectOption(target);
            }
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
        <div ref={wrapperRef} onKeyDown={handleWrapperKeyDown} className="relative">
            <div className="relative flex items-center">
                <Search
                    className="pointer-events-none absolute left-3 size-4 text-[#525B54]"
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
                        'min-h-[44px] w-full rounded-md border-[1.5px] py-2 pl-9 text-[15px] text-[#1E2420] placeholder:text-[#525B54]/75 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326] disabled:bg-[#F1EDE6]',
                        query && !disabled ? 'pr-[92px]' : 'pr-12',
                        invalid ? 'border-[#991B1B] bg-[#FFF9F9]' : 'border-[#858E87] bg-white',
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
                            className="inline-flex size-11 items-center justify-center rounded text-[#525B54] hover:bg-[#F1EDE6] hover:text-[#1E2420]"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label={open ? 'Tutup daftar' : 'Buka daftar'}
                        disabled={disabled}
                        onClick={() => setOpen((prev) => !prev)}
                        className="inline-flex size-11 items-center justify-center rounded text-[#525B54] hover:bg-[#F1EDE6] hover:text-[#1E2420]"
                    >
                        <ChevronDown className="size-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {open && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-md border-[1.5px] border-[#858E87] bg-white p-1.5 shadow-sm">
                    <div
                        id={listboxId}
                        role="listbox"
                        className="max-h-60 space-y-0.5 overflow-y-auto"
                    >
                        {filtered.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-[#525B54]">{emptyText}</p>
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
                                            'flex min-h-[44px] w-full flex-col justify-center rounded px-3 py-2 text-left text-sm transition-colors',
                                            isActive || isSelected
                                                ? 'bg-[#E6EFEA] font-semibold text-[#143326]'
                                                : 'text-[#1E2420] hover:bg-[#F1EDE6]',
                                        )}
                                    >
                                        <span>{opt.label}</span>
                                        {opt.description && (
                                            <span className="text-xs font-normal text-[#525B54]">
                                                {opt.description}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                    {footerAction && (
                        <div className="mt-1 border-t border-[#E3DED4] pt-1.5">{footerAction}</div>
                    )}
                </div>
            )}
        </div>
    );
}
