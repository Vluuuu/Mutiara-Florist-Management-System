import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] border border-transparent px-4 py-2.5 text-center text-sm font-semibold leading-snug transition-colors active:translate-y-[0.5px] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:pointer-events-none disabled:opacity-55',
    {
        variants: {
            variant: {
                default: 'bg-[#1D3B2A] text-[#FFFDF9] hover:bg-[#13281C]',
                primary: 'bg-[#1D3B2A] text-[#FFFDF9] hover:bg-[#13281C]',
                urgent: 'bg-[#9A3B22] text-[#FFFDF9] hover:bg-[#7D2E19]',
                danger: 'bg-[#8A2619] text-[#FFFDF9] hover:bg-[#6E1D12]',
                secondary: 'border-[1.5px] border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
                outline: 'border-[1.5px] border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
                ghost: 'bg-transparent text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]',
            },
            size: {
                default: 'min-h-[44px] px-4 py-2.5 text-sm',
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
