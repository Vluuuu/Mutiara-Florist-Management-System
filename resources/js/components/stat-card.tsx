import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type StatCardProps = {
    label: string;
    value: string;
    hint: string;
    icon?: LucideIcon;
    index?: string;
    emphasis?: boolean;
    tone?: 'default' | 'paid' | 'urgent';
};

export function StatCard({
    label,
    value,
    hint,
    emphasis = false,
    tone = 'default',
}: StatCardProps) {
    return (
        <Card
            className={cn(
                'p-5',
                emphasis ? 'bg-[#EFE9DE]' : 'bg-[#FFFDF9]',
            )}
        >
            <p className="text-[13px] font-semibold text-[#545852]">
                {label}
            </p>
            <p
                className={cn(
                    'tabular-nums mt-1.5 break-words text-2xl font-bold tracking-tight sm:text-[26px]',
                    tone === 'paid' && 'text-[#164B2A]',
                    tone === 'urgent' && 'text-[#9A3B22]',
                    tone === 'default' && 'text-[#1C211E]',
                )}
            >
                {value}
            </p>
            <p className="mt-1.5 text-xs text-[#545852]">{hint}</p>
        </Card>
    );
}
