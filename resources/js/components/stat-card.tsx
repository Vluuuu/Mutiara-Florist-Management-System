import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type StatCardProps = {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    emphasis?: boolean;
    tone?: 'default' | 'paid' | 'urgent';
};

export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    emphasis = false,
    tone = 'default',
}: StatCardProps) {
    return (
        <Card className={cn('p-4 sm:p-5', emphasis ? 'bg-[#F1EDE6]' : 'bg-white')}>
            <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold text-[#525B54]">{label}</p>
                <span
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                        emphasis ? 'bg-[#143326] text-white' : 'bg-[#E6EFEA] text-[#143326]',
                    )}
                    aria-hidden="true"
                >
                    <Icon className="size-4" />
                </span>
            </div>
            <p
                className={cn(
                    'tabular-nums mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl',
                    tone === 'paid' && 'text-[#166534]',
                    tone === 'urgent' && 'text-[#8C3B4A]',
                    tone === 'default' && 'text-[#1E2420]',
                )}
            >
                {value}
            </p>
            <p className="mt-2 text-xs text-[#525B54]">{hint}</p>
        </Card>
    );
}
