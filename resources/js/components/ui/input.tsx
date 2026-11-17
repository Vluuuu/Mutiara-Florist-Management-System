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
                'min-h-[44px] w-full rounded-md border-[1.5px] px-3 py-2 text-[15px] text-[#1E2420] placeholder:text-[#525B54]/75 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326] disabled:bg-[#F1EDE6] disabled:text-[#525B54]',
                invalid || props['aria-invalid']
                    ? 'border-[#991B1B] bg-[#FFF9F9]'
                    : 'border-[#858E87] bg-white',
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
                'min-h-[84px] w-full rounded-md border-[1.5px] px-3 py-2 text-[15px] text-[#1E2420] placeholder:text-[#525B54]/75 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326] disabled:bg-[#F1EDE6]',
                invalid || props['aria-invalid']
                    ? 'border-[#991B1B] bg-[#FFF9F9]'
                    : 'border-[#858E87] bg-white',
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
                'min-h-[44px] w-full rounded-md border-[1.5px] px-3 py-2 text-[15px] text-[#1E2420] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326] disabled:bg-[#F1EDE6]',
                invalid || props['aria-invalid']
                    ? 'border-[#991B1B] bg-[#FFF9F9]'
                    : 'border-[#858E87] bg-white',
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
            <label htmlFor={id} className="block text-sm font-semibold text-[#1E2420]">
                {label}
                {required && (
                    <span className="ml-0.5 text-[#8C3B4A]" aria-hidden="true">
                        *
                    </span>
                )}
            </label>
            {children}
            {hint && (
                <p id={`${id}-hint`} className="text-[13px] text-[#525B54]">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} role="alert" className="text-[13px] font-semibold text-[#991B1B]">
                    {error}
                </p>
            )}
        </div>
    );
}
