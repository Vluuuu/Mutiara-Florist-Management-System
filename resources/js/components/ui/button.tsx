import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-emerald-950 text-white hover:bg-emerald-900 focus-visible:outline-emerald-700',
                outline: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 focus-visible:outline-emerald-700',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 px-3',
                lg: 'h-11 px-6',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

type ButtonProps = React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    };

function Button({ asChild = false, className, variant, size, ...props }: ButtonProps) {
    const Component = asChild ? Slot : 'button';

    return (
        <Component
            data-slot="button"
            className={cn(buttonVariants({ className, variant, size }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
