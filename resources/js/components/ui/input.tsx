import * as React from 'react';
import { cn } from '@/lib/utils';

type InputProps = React.ComponentProps<'input'> & {
    invalid?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
    { className, invalid = false, ...props },
    ref,
) {
    return (
        <input
            ref={ref}
            aria-invalid={invalid || props['aria-invalid'] ? true : undefined}
            className={cn(
                'min-h-[44px] w-full rounded-[8px] border-[1.5px] px-3.5 py-2 text-[15px] text-[#1C211E] placeholder:text-[#60645E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A] disabled:bg-[#EFE9DE] disabled:text-[#545852]',
                invalid || props['aria-invalid']
                    ? 'border-[#8A2619] bg-[#FCF0EC]/60'
                    : 'border-[#7D776C] bg-[#FFFDF9]',
                className,
            )}
            {...props}
        />
    );
});

type TextareaProps = React.ComponentProps<'textarea'> & {
    invalid?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { className, invalid = false, ...props },
    ref,
) {
    return (
        <textarea
            ref={ref}
            aria-invalid={invalid || props['aria-invalid'] ? true : undefined}
            className={cn(
                'min-h-[88px] w-full rounded-[8px] border-[1.5px] px-3.5 py-2.5 text-[15px] text-[#1C211E] placeholder:text-[#60645E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A] disabled:bg-[#EFE9DE] disabled:text-[#545852]',
                invalid || props['aria-invalid']
                    ? 'border-[#8A2619] bg-[#FCF0EC]/60'
                    : 'border-[#7D776C] bg-[#FFFDF9]',
                className,
            )}
            {...props}
        />
    );
});

type SelectProps = React.ComponentProps<'select'> & {
    invalid?: boolean;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { className, invalid = false, children, ...props },
    ref,
) {
    return (
        <select
            ref={ref}
            aria-invalid={invalid || props['aria-invalid'] ? true : undefined}
            className={cn(
                'min-h-[44px] w-full rounded-[8px] border-[1.5px] px-3.5 py-2 text-[15px] text-[#1C211E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A] disabled:bg-[#EFE9DE] disabled:text-[#545852]',
                invalid || props['aria-invalid']
                    ? 'border-[#8A2619] bg-[#FCF0EC]/60'
                    : 'border-[#7D776C] bg-[#FFFDF9]',
                className,
            )}
            {...props}
        >
            {children}
        </select>
    );
});

type FormFieldProps = {
    id: string;
    label: string;
    required?: boolean;
    hint?: string;
    error?: string | null;
    className?: string;
    children: React.ReactNode;
};

export function FormField({
    id,
    label,
    required = false,
    hint,
    error,
    className,
    children,
}: FormFieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <label htmlFor={id} className="block text-sm font-semibold text-[#1C211E]">
                {label}
                {required && (
                    <span className="ml-0.5 text-[#9A3B22]" aria-hidden="true">
                        *
                    </span>
                )}
            </label>
            {children}
            {hint && (
                <p id={`${id}-hint`} className="text-[13px] leading-snug text-[#545852]">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} role="alert" className="text-[13px] font-semibold text-[#8A2619]">
                    {error}
                </p>
            )}
        </div>
    );
}
