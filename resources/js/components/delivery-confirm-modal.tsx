import { Badge, getFulfillmentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { FulfillmentStatus } from '@/types';

export type DeliveryConfirmTarget = {
    orderId: number;
    itemId: number;
    orderNumber: string;
    flowerType: string;
    recipient: string;
    deliveryLocation: string;
    currentStatus: FulfillmentStatus;
    nextStatus: FulfillmentStatus;
};

type DeliveryConfirmModalProps = {
    open: boolean;
    target: DeliveryConfirmTarget | null;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

/**
 * Dialog konfirmasi wajib sebelum memajukan status item menjadi Terkirim (final),
 * mencegah klik tidak sengaja yang tidak dapat dibalik oleh operator.
 */
export function DeliveryConfirmModal({
    open,
    target,
    isSubmitting,
    onClose,
    onConfirm,
}: DeliveryConfirmModalProps) {
    if (!target) return null;

    const currentMeta = getFulfillmentBadgeMeta(target.currentStatus);
    const nextMeta = getFulfillmentBadgeMeta(target.nextStatus);

    return (
        <Modal
            open={open}
            onClose={onClose}
            isSubmitting={isSubmitting}
            title="Konfirmasi Pengiriman Bunga"
            description="Status Terkirim bersifat final dan tidak dapat dikembalikan ke tahap sebelumnya."
            footer={
                <>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={isSubmitting}
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                    >
                        {isSubmitting ? 'Menyimpan status...' : 'Ya, Tandai Terkirim'}
                    </Button>
                </>
            }
        >
            <div className="space-y-3 rounded-md border border-[#E3DED4] bg-[#FAF8F4] p-4 text-sm text-[#1E2420]">
                <div>
                    <p className="font-[var(--font-mono)] text-xs font-semibold text-[#525B54] tabular-nums">
                        {target.orderNumber}
                    </p>
                    <p className="mt-1 font-bold text-[#1E2420]">{target.flowerType}</p>
                </div>
                <div className="text-[13px] text-[#525B54]">
                    <p>
                        Penerima: <strong className="text-[#1E2420]">{target.recipient}</strong>
                    </p>
                    <p className="mt-0.5">{target.deliveryLocation}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge tone={currentMeta.tone}>{currentMeta.label}</Badge>
                    <span aria-hidden="true" className="text-xs font-bold text-[#525B54]">
                        ke
                    </span>
                    <Badge tone={nextMeta.tone}>{nextMeta.label}</Badge>
                </div>
            </div>
        </Modal>
    );
}
