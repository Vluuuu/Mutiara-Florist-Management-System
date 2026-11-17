import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326] disabled:pointer-events-none disabled:opacity-55',
    {
        variants: {
            variant: {
                default: 'bg-[#143326] text-white hover:bg-[#0E251B]',
                primary: 'bg-[#143326] text-white hover:bg-[#0E251B]',
                urgent: 'bg-[#8C3B4A] text-white hover:bg-[#712D3A]',
                danger: 'bg-[#991B1B] text-white hover:bg-[#7F1D1D]',
                secondary: 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#F1EDE6]',
                outline: 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#F1EDE6]',
                ghost: 'bg-transparent text-[#525B54] hover:bg-[#F1EDE6] hover:text-[#1E2420]',
            },
            size: {
                default: 'min-h-[44px] px-4 py-2',
                sm: 'min-h-[44px] px-3 py-1.5 text-[13px]',
                lg: 'min-h-[48px] px-6 py-2.5',
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
