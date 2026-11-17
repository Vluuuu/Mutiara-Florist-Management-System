import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderCodeBadgeProps = {
    orderNumber: string;
    compact?: boolean;
    copyable?: boolean;
    className?: string;
};

/**
 * Format kode nota panjang (contoh MF-261117-01K...XYZ -> MF-261117 · #K...XYZ)
 * agar tetap ringkas pada tabel dan kartu mobile tanpa memotong akses salin kode lengkap.
 */
export function formatCompactOrderCode(orderNumber: string): string {
    if (orderNumber.length <= 18) {
        return orderNumber;
    }
    const parts = orderNumber.split('-');
    if (parts.length >= 3) {
        const prefix = parts.slice(0, 2).join('-');
        const suffix = parts.slice(2).join('-').slice(-6);
        return `${prefix} · #${suffix}`;
    }
    return `${orderNumber.slice(0, 10)} · #${orderNumber.slice(-6)}`;
}

/**
 * Menampilkan kode nota pesanan dengan tipografi monospace tabular yang dapat disalin bila diperlukan.
 */
export function OrderCodeBadge({
    orderNumber,
    compact = true,
    copyable = false,
    className,
}: OrderCodeBadgeProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(orderNumber);
            } else {
                const ta = document.createElement('textarea');
                ta.value = orderNumber;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    const displayText = compact ? formatCompactOrderCode(orderNumber) : orderNumber;

    return (
        <span className={cn('inline-flex items-center gap-1.5', className)}>
            <span
                title={orderNumber}
                className="font-[var(--font-mono)] tabular-nums text-[13px] font-semibold text-[#1E2420]"
            >
                {displayText}
            </span>
            {copyable && (
                <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copied ? `Kode nota ${orderNumber} tersalin` : `Salin kode nota ${orderNumber}`}
                    className="inline-flex size-11 items-center justify-center rounded-md border border-[#E3DED4] bg-white text-[#525B54] transition-colors hover:bg-[#F1EDE6] hover:text-[#1E2420]"
                >
                    {copied ? (
                        <Check className="size-4 text-[#166534]" aria-hidden="true" />
                    ) : (
                        <Copy className="size-4" aria-hidden="true" />
                    )}
                </button>
            )}
        </span>
    );
}
