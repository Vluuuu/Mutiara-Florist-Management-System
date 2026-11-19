import { useEffect, useRef, useState, type FormEvent } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { FormField, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatRupiah } from '@/lib/format';
import type { PaymentMethod } from '@/types';

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
    returnTo?: 'dashboard' | 'order' | 'payments';
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

const PAYMENT_ERROR_KEYS = [
    'amount',
    'payment_date',
    'method',
    'reference',
    'notes',
    'idempotency_key',
    'payment',
] as const;

function extractPaymentErrors(
    source?: Record<string, string> | null,
): Record<string, string> {
    if (!source) return {};
    const next: Record<string, string> = {};
    for (const key of PAYMENT_ERROR_KEYS) {
        const message = source[key];
        if (typeof message === 'string' && message.trim() !== '') {
            next[key] = message;
        }
    }
    return next;
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
    const [amount, setAmount] = useState<number | null>(null);
    const [paymentDate, setPaymentDate] = useState(todayIso);
    const [method, setMethod] = useState<PaymentMethod>('TRANSFER');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [idempotencyKey, setIdempotencyKey] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [activeErrors, setActiveErrors] = useState<Record<string, string>>({});
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
        setActiveErrors({});
        setIdempotencyKey(generateUuidV4());
        submitLockRef.current = false;
        setIsSubmitting(false);
    }, [open, order?.id, todayIso]);

    if (!order) return null;

    const clearFieldErrors = (...keys: string[]) => {
        setActiveErrors((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const key of keys) {
                if (key in next) {
                    delete next[key];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    };

    const hasIdempotencyConflict = Boolean(activeErrors.idempotency_key);
    const amountInvalid = amount === null || amount <= 0 || amount > order.outstanding;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current || isSubmitting || hasIdempotencyConflict) return;

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
                    setActiveErrors({});
                    setLocalError(null);
                    onClose();
                },
                onError: (serverErrors) => {
                    const nextErrors = extractPaymentErrors(
                        serverErrors as Record<string, string>,
                    );
                    setActiveErrors(nextErrors);
                },
                onFinish: () => {
                    submitLockRef.current = false;
                    setIsSubmitting(false);
                },
            },
        );
    };

    const handleInspectOrderDetail = () => {
        onClose();
        router.visit(`/ui-orders/${order.id}`, {
            preserveState: false,
            preserveScroll: false,
        });
    };

    const handleReloadCurrentPage = () => {
        onClose();
        router.reload();
    };

    const serverErrorEntries = Object.entries(activeErrors).filter(
        ([key]) => key !== 'idempotency_key',
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
                {hasIdempotencyConflict && (
                    <div
                        role="alert"
                        className="space-y-3 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-sm text-[#8A2619]"
                    >
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-[#8A2619]">
                                Pembayaran mungkin sudah tersimpan (sesi ini dikunci)
                            </p>
                            <p className="font-medium text-[#1C211E]">
                                {activeErrors.idempotency_key}
                            </p>
                            <p className="text-[13px] text-[#1C211E]">
                                Periksa riwayat pembayaran pada detail nota terlebih dahulu agar tidak tercatat ganda.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={handleInspectOrderDetail}
                            >
                                Buka Detail Nota &amp; Riwayat
                            </Button>
                            {returnTo !== 'order' && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleReloadCurrentPage}
                                >
                                    Muat Ulang Halaman
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {(localError || serverErrorEntries.length > 0) && (
                    <div
                        role="alert"
                        className="rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-3.5 text-sm font-medium text-[#8A2619]"
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
                    hint="Otomatis terisi penuh. Ubah jika menerima DP atau cicilan."
                    error={activeErrors.amount}
                >
                    <CurrencyInput
                        id="payment-modal-amount"
                        data-modal-initial="true"
                        value={amount}
                        onChange={(val) => {
                            setAmount(val);
                            setLocalError(null);
                            clearFieldErrors('amount', 'payment');
                        }}
                        placeholder="Contoh: 500.000"
                        invalid={Boolean(activeErrors.amount || localError)}
                        describedBy={activeErrors.amount ? 'payment-modal-amount-error' : 'payment-modal-amount-hint'}
                        required
                    />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        id="payment-modal-date"
                        label="Tanggal pembayaran"
                        required
                        error={activeErrors.payment_date}
                    >
                        <Input
                            id="payment-modal-date"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => {
                                setPaymentDate(e.target.value);
                                clearFieldErrors('payment_date', 'payment');
                            }}
                            invalid={Boolean(activeErrors.payment_date)}
                            aria-describedby={activeErrors.payment_date ? 'payment-modal-date-error' : undefined}
                            required
                        />
                    </FormField>

                    <FormField
                        id="payment-modal-method"
                        label="Metode pembayaran"
                        required
                        error={activeErrors.method}
                    >
                        <Select
                            id="payment-modal-method"
                            value={method}
                            onChange={(e) => {
                                setMethod(e.target.value as PaymentMethod);
                                clearFieldErrors('method', 'payment');
                            }}
                            invalid={Boolean(activeErrors.method)}
                            aria-describedby={activeErrors.method ? 'payment-modal-method-error' : undefined}
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
                    error={activeErrors.reference}
                >
                    <Input
                        id="payment-modal-reference"
                        type="text"
                        maxLength={255}
                        value={reference}
                        onChange={(e) => {
                            setReference(e.target.value);
                            clearFieldErrors('reference', 'payment');
                        }}
                        placeholder="Misal: TRF-BCA-10293 atau nama rekening pengirim"
                        invalid={Boolean(activeErrors.reference)}
                        aria-describedby={activeErrors.reference ? 'payment-modal-reference-error' : undefined}
                    />
                </FormField>

                <FormField
                    id="payment-modal-notes"
                    label="Catatan pembayaran (opsional)"
                    error={activeErrors.notes}
                >
                    <Textarea
                        id="payment-modal-notes"
                        rows={2}
                        maxLength={2000}
                        value={notes}
                        onChange={(e) => {
                            setNotes(e.target.value);
                            clearFieldErrors('notes', 'payment');
                        }}
                        placeholder="Misal: DP 50% sebelum dirangkai"
                        invalid={Boolean(activeErrors.notes)}
                        aria-describedby={activeErrors.notes ? 'payment-modal-notes-error' : undefined}
                    />
                </FormField>

                <div className="flex flex-col-reverse gap-2.5 border-t border-[#DED6C8] pt-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="w-full sm:w-auto sm:min-w-[124px]"
                    >
                        {hasIdempotencyConflict ? 'Tutup Dialog' : 'Batal'}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isSubmitting || amountInvalid || hasIdempotencyConflict}
                        className="w-full sm:w-auto sm:min-w-[172px]"
                    >
                        {hasIdempotencyConflict
                            ? 'Submit Diblokir'
                            : isSubmitting
                              ? 'Menyimpan...'
                              : 'Simpan Pembayaran'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
