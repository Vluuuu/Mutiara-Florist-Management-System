import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'paid' | 'warn' | 'ready' | 'danger' | 'neutral';

const toneClasses: Record<BadgeTone, string> = {
    paid: 'border-[#B8D0C0] bg-[#EEF5F0] text-[#164B2A]',
    warn: 'border-[#DFC393] bg-[#FAF1E1] text-[#6E3D09]',
    ready: 'border-[#B5CAE0] bg-[#EDF3F8] text-[#193F66]',
    danger: 'border-[#E2B3AA] bg-[#FCECE9] text-[#8A2619]',
    neutral: 'border-[#CCC3B3] bg-[#EFE9DE] text-[#3D3A35]',
};

type BadgeProps = React.ComponentProps<'span'> & {
    tone?: BadgeTone;
};

/**
 * Tag status profesional bergaya buku pembukuan: persegi bersih (`rounded-[4px]`),
 * tanpa titik dekoratif, tanpa simbol ASCII, dan mudah dibaca pengguna senior (`13px`).
 */
export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
    return (
        <span
            data-slot="badge"
            className={cn(
                'inline-flex items-center rounded-[4px] border px-2.5 py-1 text-[13px] font-semibold leading-tight tracking-normal whitespace-nowrap',
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
    READY: { label: 'Siap Kirim', tone: 'ready' },
    DELIVERED: { label: 'Terkirim', tone: 'paid' },
    COMPLETED: { label: 'Selesai', tone: 'paid' },
};

const paymentStatusMap: Record<string, { label: string; tone: BadgeTone }> = {
    UNPAID: { label: 'Belum Lunas', tone: 'danger' },
    PARTIAL: { label: 'Dibayar Sebagian', tone: 'warn' },
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
