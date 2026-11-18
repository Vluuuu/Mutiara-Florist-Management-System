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
                        className="w-full sm:w-auto sm:min-w-[120px]"
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                        className="w-full sm:w-auto sm:min-w-[164px]"
                    >
                        {isSubmitting ? 'Menyimpan status...' : 'Ya, Tandai Terkirim'}
                    </Button>
                </>
            }
        >
            <div className="space-y-3 rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE]/70 p-4 text-sm text-[#1C211E]">
                <div>
                    <p className="font-[var(--font-mono)] text-[13px] font-semibold text-[#545852] tabular-nums">
                        {target.orderNumber}
                    </p>
                    <p className="mt-1 text-base font-bold text-[#1C211E]">{target.flowerType}</p>
                </div>
                <div className="text-sm text-[#545852]">
                    <p>
                        Penerima: <strong className="text-[#1C211E]">{target.recipient}</strong>
                    </p>
                    <p className="mt-1">{target.deliveryLocation}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge tone={currentMeta.tone}>{currentMeta.label}</Badge>
                    <span aria-hidden="true" className="text-sm font-semibold text-[#545852]">
                        menjadi
                    </span>
                    <Badge tone={nextMeta.tone}>{nextMeta.label}</Badge>
                </div>
            </div>
        </Modal>
    );
}
