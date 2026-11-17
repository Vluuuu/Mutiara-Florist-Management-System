import { useEffect, useRef, useState, type FormEvent } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { FormField, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatRupiah } from '@/lib/format';
import type { AppPageProps, PaymentMethod } from '@/types';

export type PaymentModalTarget = {
    id: number;
    order_number: string;
    customer_name: string;
    outstanding: number;
};

type PaymentModalProps = {
    open: boolean;
    order: PaymentModalTarget | null;
    todayIso: string;
    returnTo?: 'dashboard' | 'order';
    onClose: () => void;
};

function generateUuidV4(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return '00000000-0000-4000-8000-000000000000';
}

/**
 * Modal pencatatan pembayaran (DP, cicilan, atau pelunasan) dengan kunci idempotensi stabil
 * per sesi pembukaan dialog agar klik ulang atau retry jaringan tidak membuat catatan ganda.
 */
export function PaymentModal({
    open,
    order,
    todayIso,
    returnTo = 'order',
    onClose,
}: PaymentModalProps) {
    const { errors } = usePage<AppPageProps>().props;
    const [amount, setAmount] = useState<number | null>(null);
    const [paymentDate, setPaymentDate] = useState(todayIso);
    const [method, setMethod] = useState<PaymentMethod>('TRANSFER');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [idempotencyKey, setIdempotencyKey] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitLockRef = useRef(false);

    useEffect(() => {
        if (!open || !order) return;
        setAmount(order.outstanding);
        setPaymentDate(todayIso);
        setMethod('TRANSFER');
        setReference('');
        setNotes('');
        setLocalError(null);
        setIdempotencyKey(generateUuidV4());
        submitLockRef.current = false;
        setIsSubmitting(false);
    }, [open, order?.id, todayIso]);

    if (!order) return null;

    const amountInvalid = amount === null || amount <= 0 || amount > order.outstanding;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current || isSubmitting) return;

        if (amount === null || amount <= 0) {
            setLocalError('Nominal pembayaran wajib lebih dari Rp0.');
            return;
        }
        if (amount > order.outstanding) {
            setLocalError(
                `Nominal melebihi sisa tagihan (${formatRupiah(order.outstanding)}).`,
            );
            return;
        }

        setLocalError(null);
        submitLockRef.current = true;
        setIsSubmitting(true);

        router.post(
            `/ui-orders/${order.id}/payments`,
            {
                amount,
                payment_date: paymentDate,
                method,
                reference: reference.trim() || null,
                notes: notes.trim() || null,
                idempotency_key: idempotencyKey,
                return_to: returnTo,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                },
                onFinish: () => {
                    submitLockRef.current = false;
                    setIsSubmitting(false);
                },
            },
        );
    };

    const serverErrorEntries = Object.entries(errors ?? {}).filter(([key]) =>
        ['amount', 'payment_date', 'method', 'reference', 'notes', 'idempotency_key', 'payment'].includes(key),
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            isSubmitting={isSubmitting}
            title="Catat Pembayaran"
            description={`${order.order_number} · ${order.customer_name} · Sisa tagihan ${formatRupiah(order.outstanding)}`}
        >
            <form id="shared-payment-form" onSubmit={handleSubmit} noValidate className="space-y-4">
                {(localError || serverErrorEntries.length > 0) && (
                    <div
                        role="alert"
                        className="rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3 text-xs font-medium text-[#991B1B]"
                    >
                        <p className="font-bold">Pembayaran belum tersimpan:</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                            {localError && <li>{localError}</li>}
                            {serverErrorEntries.map(([key, message]) => (
                                <li key={key}>{message}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <FormField
                    id="payment-modal-amount"
                    label="Nominal diterima (Rp)"
                    required
                    hint="Diisi otomatis untuk pelunasan penuh. Ubah angka jika mencatat DP atau cicilan."
                    error={errors?.amount}
                >
                    <CurrencyInput
                        id="payment-modal-amount"
                        data-modal-initial="true"
                        value={amount}
                        onChange={(val) => {
                            setAmount(val);
                            setLocalError(null);
                        }}
                        placeholder="Contoh: 500.000"
                        invalid={Boolean(errors?.amount || localError)}
                        describedBy={errors?.amount ? 'payment-modal-amount-error' : 'payment-modal-amount-hint'}
                        required
                    />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        id="payment-modal-date"
                        label="Tanggal pembayaran"
                        required
                        error={errors?.payment_date}
                    >
                        <Input
                            id="payment-modal-date"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            invalid={Boolean(errors?.payment_date)}
                            required
                        />
                    </FormField>

                    <FormField
                        id="payment-modal-method"
                        label="Metode pembayaran"
                        required
                        error={errors?.method}
                    >
                        <Select
                            id="payment-modal-method"
                            value={method}
                            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                            invalid={Boolean(errors?.method)}
                        >
                            <option value="TRANSFER">Transfer bank</option>
                            <option value="CASH">Tunai</option>
                            <option value="QRIS">QRIS</option>
                            <option value="OTHER">Lainnya</option>
                        </Select>
                    </FormField>
                </div>

                <FormField
                    id="payment-modal-reference"
                    label="Nomor referensi / bukti (opsional)"
                    error={errors?.reference}
                >
                    <Input
                        id="payment-modal-reference"
                        type="text"
                        maxLength={255}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Misal: TRF-BCA-10293 atau nama rekening pengirim"
                        invalid={Boolean(errors?.reference)}
                    />
                </FormField>

                <FormField
                    id="payment-modal-notes"
                    label="Catatan pembayaran (opsional)"
                    error={errors?.notes}
                >
                    <Textarea
                        id="payment-modal-notes"
                        rows={2}
                        maxLength={2000}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Misal: DP 50% sebelum dirangkai"
                        invalid={Boolean(errors?.notes)}
                    />
                </FormField>

                <div className="flex flex-col-reverse gap-2 border-t border-[#E3DED4] pt-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={isSubmitting}
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isSubmitting || amountInvalid}
                    >
                        {isSubmitting ? 'Memproses pembayaran...' : 'Simpan Pembayaran'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
