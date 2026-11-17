import * as React from 'react';
import { formatAmount, parseRupiahDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

type CurrencyInputProps = {
    id: string;
    name?: string;
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    required?: boolean;
    describedBy?: string;
    className?: string;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    function CurrencyInput(
        {
            id,
            name,
            value,
            onChange,
            placeholder = 'Contoh: 500.000',
            disabled = false,
            invalid = false,
            required = false,
            describedBy,
            className,
        },
        ref,
    ) {
        const displayValue =
            value === null || value === undefined ? '' : formatAmount(Math.max(0, value));

        const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
            const parsed = parseRupiahDigits(e.target.value);
            onChange(parsed);
        };

        return (
            <div
                className={cn(
                    'flex min-h-[44px] items-stretch overflow-hidden rounded-md border-[1.5px] transition-colors focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[#143326]',
                    disabled ? 'bg-[#F1EDE6] opacity-80' : 'bg-white',
                    invalid ? 'border-[#991B1B] bg-[#FFF9F9]' : 'border-[#858E87]',
                    className,
                )}
            >
                <span
                    aria-hidden="true"
                    className="grid shrink-0 place-items-center border-r border-[#E3DED4] bg-[#F1EDE6] px-3 text-sm font-bold text-[#525B54]"
                >
                    Rp
                </span>
                <input
                    ref={ref}
                    id={id}
                    name={name}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={disabled && displayValue === '' ? '0' : displayValue}
                    onChange={handleInput}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={describedBy}
                    className="tabular-nums min-h-[44px] w-full min-w-0 border-0 bg-transparent px-3 py-2 text-[15px] font-semibold text-[#1E2420] placeholder:font-normal placeholder:text-[#525B54]/75 focus:outline-none"
                />
            </div>
        );
    },
);
