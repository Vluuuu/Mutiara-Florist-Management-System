import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type StatCardProps = {
    label: string;
    prefix: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    emphasis?: boolean;
};

export function StatCard({ label, prefix, value, hint, icon: Icon, emphasis = false }: StatCardProps) {
    return (
        <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-stone-500">{label}</p>
                <span
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        emphasis ? 'bg-emerald-950 text-white' : 'bg-emerald-50 text-emerald-800',
                    )}
                    aria-hidden="true"
                >
                    <Icon className="size-4.5" />
                </span>
            </div>
            <p className="mt-4 break-words text-2xl font-semibold tracking-tight text-emerald-950">
                {prefix}
                {value}
            </p>
            <p className="mt-3 text-xs text-stone-400">{hint}</p>
        </Card>
    );
}
