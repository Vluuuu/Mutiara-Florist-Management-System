import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] border border-transparent px-4 py-2 text-center text-sm font-semibold leading-snug transition-colors active:translate-y-[0.5px] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:pointer-events-none disabled:opacity-55',
    {
        variants: {
            variant: {
                default: 'bg-[var(--brand-primary)] text-[var(--bg-surface)] shadow-[0_1px_2px_rgba(22,38,30,0.12)] hover:bg-[var(--brand-primary-hover)]',
                primary: 'bg-[var(--brand-primary)] text-[var(--bg-surface)] shadow-[0_1px_2px_rgba(22,38,30,0.12)] hover:bg-[var(--brand-primary-hover)]',
                urgent: 'bg-[var(--brand-urgent)] text-[var(--bg-surface)] shadow-[0_1px_2px_rgba(154,59,34,0.16)] hover:bg-[var(--brand-urgent-hover)]',
                danger: 'bg-[var(--danger-ink)] text-[var(--bg-surface)] shadow-[0_1px_2px_rgba(138,38,25,0.16)] hover:bg-[var(--danger-hover)]',
                secondary: 'border-[1.5px] border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]',
                outline: 'border-[1.5px] border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]',
                subtle: 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-input)] hover:bg-[var(--bg-sunken)]',
                ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]',
            },
            size: {
                default: 'min-h-[44px] px-4 py-2 text-sm',
                sm: 'min-h-[44px] px-3.5 py-2 text-sm',
                lg: 'min-h-[48px] px-6 py-3 text-[15px]',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'default',
        },
    },
);

type ButtonProps = React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    };

function Button({ asChild = false, className, variant, size, type = 'button', ...props }: ButtonProps) {
    const Component = asChild ? Slot : 'button';

    return (
        <Component
            data-slot="button"
            type={asChild ? undefined : type}
            className={cn(buttonVariants({ className, variant, size }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
export type { ButtonProps };
