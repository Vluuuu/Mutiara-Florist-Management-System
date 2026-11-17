import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'paid' | 'warn' | 'ready' | 'danger' | 'neutral';

const toneClasses: Record<BadgeTone, string> = {
    paid: 'bg-[#DCFCE7] text-[#166534]',
    warn: 'bg-[#FEF3C7] text-[#92400E]',
    ready: 'bg-[#DBEAFE] text-[#1E40AF]',
    danger: 'bg-[#FEE2E2] text-[#991B1B]',
    neutral: 'bg-[#E5E7EB] text-[#374151]',
};

type BadgeProps = React.ComponentProps<'span'> & {
    tone?: BadgeTone;
};

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
    return (
        <span
            data-slot="badge"
            className={cn(
                'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold leading-none',
                toneClasses[tone],
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
}

const fulfillmentStatusMap: Record<string, { label: string; tone: BadgeTone }> = {
    NEW: { label: 'Baru', tone: 'neutral' },
    PROCESSING: { label: 'Diproses', tone: 'warn' },
    READY: { label: 'Siap kirim', tone: 'ready' },
    DELIVERED: { label: 'Terkirim', tone: 'paid' },
    COMPLETED: { label: 'Selesai', tone: 'paid' },
};

const paymentStatusMap: Record<string, { label: string; tone: BadgeTone }> = {
    UNPAID: { label: 'Belum bayar', tone: 'danger' },
    PARTIAL: { label: 'Sebagian', tone: 'warn' },
    PAID: { label: 'Lunas', tone: 'paid' },
    POSTED: { label: 'Tercatat', tone: 'paid' },
    VOIDED: { label: 'Dibatalkan', tone: 'neutral' },
};

export function getFulfillmentBadgeMeta(status: string): { label: string; tone: BadgeTone } {
    return fulfillmentStatusMap[status] ?? { label: status, tone: 'neutral' };
}

export function getPaymentBadgeMeta(status: string): { label: string; tone: BadgeTone } {
    return paymentStatusMap[status] ?? { label: status, tone: 'neutral' };
}
