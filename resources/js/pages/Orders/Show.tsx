import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Copy,
    Edit3,
    MapPin,
    Phone,
    Wallet,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { DeliveryConfirmModal, type DeliveryConfirmTarget } from '@/components/delivery-confirm-modal';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { PaymentModal } from '@/components/payment-modal';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatAmount, formatDateTimeWib, formatDateWib, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    FulfillmentStatus,
    OrderDetail,
    OrderItemDetail,
    OrderPaymentDetail,
} from '@/types';

type OrdersShowProps = {
    order: OrderDetail;
};

const STEPPER_ORDER: Array<{ key: FulfillmentStatus; label: string }> = [
    { key: 'NEW', label: 'Baru' },
    { key: 'PROCESSING', label: 'Diproses' },
    { key: 'READY', label: 'Siap kirim' },
    { key: 'DELIVERED', label: 'Terkirim' },
];

const NEXT_STEP_CONFIG: Record<
    FulfillmentStatus,
    { nextStatus: FulfillmentStatus | null; label: string }
> = {
    NEW: { nextStatus: 'PROCESSING', label: 'Mulai Proses' },
    PROCESSING: { nextStatus: 'READY', label: 'Tandai Siap Kirim' },
    READY: { nextStatus: 'DELIVERED', label: 'Tandai Terkirim' },
    DELIVERED: { nextStatus: null, label: 'Terkirim' },
};

function getWibTodayIso(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export default function OrdersShow({ order }: OrdersShowProps) {
    const { errors } = usePage<AppPageProps>().props;
    const todayIso = useMemo(() => getWibTodayIso(), []);

    // Modal Catat Pembayaran (berbagi komponen dengan Dashboard)
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);

    // Modal Void Pembayaran
    const [voidTarget, setVoidTarget] = useState<OrderPaymentDetail | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [isSavingVoid, setIsSavingVoid] = useState(false);
    const voidLockRef = useRef(false);

    // Kemajuan status item + modal konfirmasi Terkirim
    const [submittingItemId, setSubmittingItemId] = useState<number | null>(null);
    const itemLockRef = useRef(false);
    const [deliverTarget, setDeliverTarget] = useState<DeliveryConfirmTarget | null>(null);

    // Salin Ringkasan WhatsApp
    const [waPreviewVisible, setWaPreviewVisible] = useState(false);
    const [waCopiedText, setWaCopiedText] = useState('');
    const [waCopyStatus, setWaCopyStatus] = useState('');

    const orderStatusMeta = getFulfillmentBadgeMeta(order.status);
    const paymentStatusMeta = getPaymentBadgeMeta(order.payment_status);

    const advanceItemStatus = (item: OrderItemDetail, nextStatus: FulfillmentStatus) => {
        if (itemLockRef.current || submittingItemId !== null) return;
        itemLockRef.current = true;
        setSubmittingItemId(item.id);

        router.post(
            `/ui-orders/${order.id}/items/${item.id}/status`,
            {
                target_status: nextStatus,
                return_to: 'order',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setDeliverTarget(null);
                },
                onFinish: () => {
                    itemLockRef.current = false;
                    setSubmittingItemId(null);
                },
            },
        );
    };

    const handleStepClick = (item: OrderItemDetail, nextStatus: FulfillmentStatus) => {
        if (itemLockRef.current) return;

        if (nextStatus === 'DELIVERED') {
            setDeliverTarget({
                orderId: order.id,
                itemId: item.id,
                orderNumber: order.order_number,
                flowerType: item.flower_type,
                recipient: item.recipient,
                deliveryLocation: item.delivery_location,
                currentStatus: item.fulfillment_status,
                nextStatus: 'DELIVERED',
            });
            return;
        }

        advanceItemStatus(item, nextStatus);
    };

    const handleCopyWhatsappSummary = async () => {
        const lines = [
            '*Ringkasan Nota Mutiara Florist*',
            `No. Nota: ${order.order_number}`,
            `Pemesan: ${order.customer.name}${order.customer.phone ? ` (${order.customer.phone})` : ''}`,
            `Tanggal Nota: ${formatDateWib(order.order_date)}`,
            '',
            'Rincian Pesanan:',
            ...order.items.map(
                (it, idx) =>
                    `${idx + 1}. ${it.flower_type} (${formatAmount(it.quantity)} bh) - Kirim ${formatDateWib(it.delivery_date)} ke ${it.recipient} (${it.delivery_location})`,
            ),
            '',
            `Total Tagihan: ${formatRupiah(order.total_amount)}`,
            `Sudah Dibayar: ${formatRupiah(order.received)}`,
            `Sisa Tagihan: ${formatRupiah(order.outstanding)}`,
        ];

        const text = lines.join('\n');
        let copied = false;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                copied = true;
            }
        } catch {
            copied = false;
        }

        if (!copied) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                copied = document.execCommand('copy');
            } catch {
                copied = false;
            }
            document.body.removeChild(ta);
        }

        setWaCopiedText(text);
        setWaCopyStatus(
            copied
                ? 'Teks ringkasan WhatsApp berhasil disalin ke clipboard:'
                : 'Salin manual teks ringkasan WhatsApp di bawah ini:',
        );
        setWaPreviewVisible(true);
    };

    const handleOpenVoidModal = (payment: OrderPaymentDetail) => {
        setVoidTarget(payment);
        setVoidReason('');
        voidLockRef.current = false;
        setIsSavingVoid(false);
    };

    const handleVoidSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!voidTarget || voidLockRef.current || isSavingVoid) return;
        if (voidReason.trim().length < 10) return;

        voidLockRef.current = true;
        setIsSavingVoid(true);

        router.post(
            `/ui-orders/${order.id}/payments/${voidTarget.id}/void`,
            {
                void_reason: voidReason,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setVoidTarget(null);
                    setVoidReason('');
                },
                onFinish: () => {
                    voidLockRef.current = false;
                    setIsSavingVoid(false);
                },
            },
        );
    };

    const stepError = errors?.target_status ?? errors?.item;
    const voidReasonLen = voidReason.trim().length;

    return (
        <AppLayout title={`Pesanan ${order.order_number}`}>
            <Head title={`Pesanan ${order.order_number}`} />

            <div className="mb-5">
                <Link
                    href="/ui-orders"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#143326] hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Kembali ke daftar pesanan
                </Link>

                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={orderStatusMeta.tone}>{orderStatusMeta.label}</Badge>
                            <Badge tone={paymentStatusMeta.tone}>
                                {order.payment_status_label || paymentStatusMeta.label}
                            </Badge>
                        </div>
                        <h1 className="mt-2 break-all font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                            Nota{' '}
                            <OrderCodeBadge
                                orderNumber={order.order_number}
                                compact={false}
                                copyable
                                className="inline-flex align-middle"
                            />
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#525B54]">
                            <Link
                                href={`/ui-customers/${order.customer.id}`}
                                className="inline-flex min-h-[44px] items-center font-bold text-[#143326] hover:underline"
                            >
                                {order.customer.name}
                            </Link>
                            {order.customer.phone && (
                                <span className="inline-flex items-center gap-1 font-[var(--font-mono)] text-[13px] tabular-nums">
                                    <Phone className="size-3.5" aria-hidden="true" />
                                    {order.customer.phone}
                                </span>
                            )}
                            <span className="tabular-nums">
                                Tanggal Nota {formatDateWib(order.order_date)}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="secondary">
                            <Link href={`/ui-orders/${order.id}/edit`}>
                                <Edit3 className="size-4" aria-hidden="true" />
                                Edit Pesanan
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCopyWhatsappSummary}
                        >
                            <Copy className="size-4" aria-hidden="true" />
                            Salin Ringkasan WA
                        </Button>
                        {order.outstanding > 0 && (
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => setPaymentModalOpen(true)}
                            >
                                <Wallet className="size-4" aria-hidden="true" />
                                + Catat Pembayaran
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {stepError && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2.5 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3.5 text-sm font-medium text-[#991B1B]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{stepError}</span>
                </div>
            )}

            {waPreviewVisible && (
                <div
                    role="status"
                    className="mb-5 rounded-lg border border-[#143326]/30 bg-[#E6EFEA] p-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#143326]">{waCopyStatus}</p>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setWaPreviewVisible(false)}
                        >
                            Tutup Pratinjau
                        </Button>
                    </div>
                    <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-[#E3DED4] bg-white p-3 font-[var(--font-sans)] text-xs leading-relaxed text-[#1E2420]">
                        {waCopiedText}
                    </pre>
                </div>
            )}

            {/* 4 Kartu Ringkasan Tagihan */}
            <section
                aria-label="Ringkasan tagihan pesanan"
                className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3"
            >
                <div className="rounded-[10px] border border-[#E3DED4] bg-white p-3.5 md:px-4">
                    <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                        Total Tagihan
                    </p>
                    <p className="mt-1 text-[19px] font-bold text-[#1E2420] tabular-nums md:text-[22px]">
                        {formatRupiah(order.total_amount)}
                    </p>
                    <p className="mt-1 text-xs text-[#525B54] tabular-nums">
                        Bunga {formatRupiah(order.flower_total)} | Ongkir{' '}
                        {formatRupiah(order.shipping_total)}
                    </p>
                </div>

                <div className="rounded-[10px] border border-[#E3DED4] bg-white p-3.5 md:px-4">
                    <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                        Sudah Diterima
                    </p>
                    <p className="mt-1 text-[19px] font-bold text-[#166534] tabular-nums md:text-[22px]">
                        {formatRupiah(order.received)}
                    </p>
                    <p className="mt-1 text-xs text-[#525B54]">Hanya catatan sah (tercatat)</p>
                </div>

                <div className="rounded-[10px] border border-[#E3DED4] bg-white p-3.5 md:px-4">
                    <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                        Sisa Tagihan
                    </p>
                    <p
                        className={cn(
                            'mt-1 text-[19px] font-bold tabular-nums md:text-[22px]',
                            order.outstanding > 0 ? 'text-[#8C3B4A]' : 'text-[#166534]',
                        )}
                    >
                        {formatRupiah(order.outstanding)}
                    </p>
                    <p className="mt-1 text-xs text-[#525B54]">
                        {order.outstanding > 0 ? 'Belum dilunasi' : 'Sudah lunas'}
                    </p>
                </div>

                <div className="rounded-[10px] border border-[#E3DED4] bg-[#F1EDE6] p-3.5 md:px-4">
                    <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                        Status Nota
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={paymentStatusMeta.tone}>
                            {order.payment_status_label || paymentStatusMeta.label}
                        </Badge>
                        <Badge tone={orderStatusMeta.tone}>{orderStatusMeta.label}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-[#525B54] tabular-nums">
                        {formatAmount(order.items.length)} item bunga
                    </p>
                </div>
            </section>

            {order.notes && (
                <Card className="mb-5 border-[#E3DED4] bg-[#FAF8F4] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
                        Catatan Pesanan
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#1E2420]">
                        {order.notes}
                    </p>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(310px,1fr)] lg:items-start">
                {/* Kolom Kiri: Daftar Rangkaian & Stepper Pengerjaan */}
                <Card className="border-[#E3DED4] p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-base font-bold text-[#1E2420]">
                                Daftar Rangkaian &amp; Status Kerja
                            </h2>
                            <p className="mt-0.5 text-[13px] text-[#525B54]">
                                Status tiap bunga maju bertahap: Baru, Diproses, Siap kirim, lalu Terkirim.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {order.items.map((item) => {
                            const statusMeta = getFulfillmentBadgeMeta(item.fulfillment_status);
                            const nextCfg =
                                NEXT_STEP_CONFIG[item.fulfillment_status] ?? NEXT_STEP_CONFIG.NEW;
                            const isOverdue =
                                Boolean(item.delivery_date_raw) &&
                                item.delivery_date_raw! < todayIso &&
                                item.fulfillment_status !== 'DELIVERED';
                            const itemTotal = item.subtotal + item.effective_shipping_fee;
                            const shipText =
                                item.shipping_mode === 'SEPARATE'
                                    ? `Ongkir ditagih terpisah ${formatRupiah(item.effective_shipping_fee)}`
                                    : 'Ongkir sudah termasuk harga bunga';
                            const currentStepIdx = STEPPER_ORDER.findIndex(
                                (s) => s.key === item.fulfillment_status,
                            );
                            const isBusy = submittingItemId === item.id;

                            return (
                                <article
                                    key={item.id}
                                    className={cn(
                                        'rounded-lg border p-4',
                                        isOverdue
                                            ? 'border-[#E5B9C2] bg-[#FDF2F4]'
                                            : 'border-[#E3DED4] bg-white',
                                    )}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                                <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                                                {isOverdue && (
                                                    <Badge tone="danger">
                                                        Terlambat ({formatDateWib(item.delivery_date)})
                                                    </Badge>
                                                )}
                                                <span className="text-xs font-medium text-[#525B54] tabular-nums">
                                                    Kirim {formatDateWib(item.delivery_date)} | {shipText}
                                                </span>
                                            </div>
                                            <h3 className="text-[15px] font-bold text-[#1E2420]">
                                                {item.item_number}. {item.flower_type}{' '}
                                                <span className="font-semibold text-[#525B54] tabular-nums">
                                                    ({formatAmount(item.quantity)} buah)
                                                </span>
                                            </h3>
                                            <p className="mt-1 text-[13px] text-[#525B54]">
                                                Penerima:{' '}
                                                <strong className="text-[#1E2420]">
                                                    {item.recipient}
                                                </strong>
                                                {' | '}Pengirim kartu:{' '}
                                                <strong className="text-[#1E2420]">
                                                    {item.sender_name}
                                                </strong>
                                            </p>
                                            <p className="mt-1 flex items-start gap-1.5 text-[13px] text-[#525B54]">
                                                <MapPin
                                                    className="mt-0.5 size-3.5 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <span>{item.delivery_location}</span>
                                            </p>
                                            {item.notes && (
                                                <p className="mt-1 text-[13px] text-[#525B54]">
                                                    Catatan: {item.notes}
                                                </p>
                                            )}
                                        </div>

                                        <div className="text-right tabular-nums">
                                            <p className="text-base font-bold text-[#1E2420]">
                                                {formatRupiah(itemTotal)}
                                            </p>
                                            <p className="text-xs text-[#525B54]">
                                                {formatAmount(item.quantity)} x{' '}
                                                {formatRupiah(item.unit_price)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3.5 flex flex-col gap-3 border-t border-[#E3DED4] pt-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div
                                            className="flex flex-wrap items-center gap-1.5"
                                            aria-label={`Tahap pengerjaan item ${item.item_number}`}
                                        >
                                            {STEPPER_ORDER.map((step, idx) => {
                                                const isDone = idx < currentStepIdx;
                                                const isCurrent = idx === currentStepIdx;
                                                return (
                                                    <span
                                                        key={step.key}
                                                        className={cn(
                                                            'rounded px-2 py-1 text-xs font-semibold',
                                                            isCurrent &&
                                                                'bg-[#143326] text-white',
                                                            isDone &&
                                                                'bg-[#DCFCE7] text-[#166534]',
                                                            !isDone &&
                                                                !isCurrent &&
                                                                'bg-[#F1EDE6] text-[#525B54]',
                                                        )}
                                                    >
                                                        {step.label}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        <div className="shrink-0">
                                            {nextCfg.nextStatus ? (
                                                <Button
                                                    type="button"
                                                    variant={isOverdue ? 'urgent' : 'primary'}
                                                    size="sm"
                                                    disabled={submittingItemId !== null}
                                                    onClick={() =>
                                                        handleStepClick(item, nextCfg.nextStatus!)
                                                    }
                                                >
                                                    {isBusy ? 'Memproses...' : nextCfg.label}
                                                </Button>
                                            ) : (
                                                <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#166534]/30 bg-[#DCFCE7] px-3 py-2 text-xs font-bold text-[#166534]">
                                                    <CheckCircle2
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                    Sudah Terkirim
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </Card>

                {/* Kolom Kanan: Riwayat Pembayaran & Audit */}
                <aside className="space-y-5">
                    <Card className="border-[#E3DED4] p-4 sm:p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-base font-bold text-[#1E2420]">
                                    Riwayat Pembayaran &amp; Audit
                                </h2>
                                <p className="mt-0.5 text-xs text-[#525B54]">
                                    Pembatalan hanya mengoreksi pencatatan dan bukan pengembalian uang.
                                </p>
                            </div>
                            {order.outstanding > 0 && (
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setPaymentModalOpen(true)}
                                >
                                    + Catat Bayar
                                </Button>
                            )}
                        </div>

                        {order.payments.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[#858E87] bg-[#F1EDE6]/60 px-4 py-7 text-center">
                                <Wallet
                                    className="mx-auto mb-2 size-7 text-[#525B54]"
                                    aria-hidden="true"
                                />
                                <p className="text-sm font-bold text-[#1E2420]">
                                    Belum ada pembayaran tercatat
                                </p>
                                <p className="mt-1 text-xs text-[#525B54]">
                                    Pesanan tetap bisa dirangkai dan dikirim sambil menunggu pelunasan.
                                </p>
                                {order.outstanding > 0 && (
                                    <div className="mt-4">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={() => setPaymentModalOpen(true)}
                                        >
                                            + Catat Pembayaran
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {order.payments.map((payment) => {
                                    const isPosted = payment.status === 'POSTED';
                                    const badgeMeta = getPaymentBadgeMeta(payment.status);

                                    return (
                                        <div
                                            key={payment.id}
                                            className="rounded-lg border border-[#E3DED4] bg-white p-3.5"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge tone={badgeMeta.tone}>{badgeMeta.label}</Badge>
                                                <span className="text-xs font-medium text-[#525B54] tabular-nums">
                                                    {formatDateWib(payment.payment_date)}
                                                </span>
                                            </div>

                                            <p
                                                className={cn(
                                                    'mt-2 text-lg font-bold tabular-nums',
                                                    isPosted
                                                        ? 'text-[#1E2420]'
                                                        : 'text-[#525B54] line-through',
                                                )}
                                            >
                                                {formatRupiah(payment.amount)}
                                            </p>

                                            <p className="mt-0.5 text-[13px] text-[#525B54]">
                                                {payment.method_label}
                                                {payment.reference ? ` | Ref: ${payment.reference}` : ''}
                                            </p>

                                            {payment.notes && (
                                                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#525B54]">
                                                    Catatan: {payment.notes}
                                                </p>
                                            )}

                                            <p className="mt-1.5 text-xs text-[#525B54]">
                                                Dicatat oleh {payment.recorded_by}
                                            </p>

                                            {isPosted ? (
                                                <div className="mt-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-[#991B1B]/40 text-[#991B1B] hover:bg-[#FEE2E2]"
                                                        onClick={() => handleOpenVoidModal(payment)}
                                                    >
                                                        Batalkan Catatan
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="mt-2.5 rounded-md bg-[#F1EDE6] p-2.5 text-xs text-[#525B54]">
                                                    <p className="font-semibold text-[#1E2420]">
                                                        Alasan: {payment.void_reason}
                                                    </p>
                                                    {payment.voided_at && (
                                                        <p className="mt-0.5 tabular-nums">
                                                            {formatDateTimeWib(payment.voided_at)}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </aside>
            </div>

            <PaymentModal
                open={paymentModalOpen}
                order={{
                    id: order.id,
                    order_number: order.order_number,
                    customer_name: order.customer.name,
                    outstanding: order.outstanding,
                }}
                todayIso={todayIso}
                returnTo="order"
                onClose={() => setPaymentModalOpen(false)}
            />

            <DeliveryConfirmModal
                open={deliverTarget !== null}
                target={deliverTarget}
                isSubmitting={submittingItemId !== null}
                onClose={() => setDeliverTarget(null)}
                onConfirm={() => {
                    if (deliverTarget) {
                        const targetItem = order.items.find(
                            (it) => it.id === deliverTarget.itemId,
                        );
                        if (targetItem) {
                            advanceItemStatus(targetItem, deliverTarget.nextStatus);
                        }
                    }
                }}
            />

            {/* Modal Batalkan Catatan Pembayaran (Void) */}
            <Modal
                open={voidTarget !== null}
                onClose={() => setVoidTarget(null)}
                isSubmitting={isSavingVoid}
                title="Batalkan Catatan Pembayaran"
                description={
                    voidTarget
                        ? `Membatalkan catatan ${formatRupiah(voidTarget.amount)} (${voidTarget.method_label}).`
                        : undefined
                }
            >
                {voidTarget && (
                    <form onSubmit={handleVoidSubmit} noValidate className="space-y-4">
                        <div className="rounded-md border border-[#92400E]/30 bg-[#FEF3C7] p-3 text-xs leading-relaxed text-[#92400E]">
                            <strong>Perhatian Audit:</strong> Pembatalan ini menandai kesalahan entri agar riwayat kas akurat, dan{' '}
                            <strong>bukan pengembalian uang (refund)</strong> kepada pelanggan. Baris riwayat tetap tersimpan.
                        </div>

                        <FormField
                            id="void_reason"
                            label="Alasan pembatalan catatan (minimal 10 karakter)"
                            required
                            hint={`${voidReasonLen}/10 karakter minimum`}
                            error={errors?.void_reason}
                        >
                            <Textarea
                                id="void_reason"
                                data-modal-initial="true"
                                name="void_reason"
                                rows={3}
                                minLength={10}
                                maxLength={1000}
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="Contoh: Salah catat nominal transfer, akan diinput ulang"
                                invalid={Boolean(errors?.void_reason)}
                                required
                            />
                        </FormField>

                        <div className="flex flex-col-reverse gap-2 border-t border-[#E3DED4] pt-4 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={isSavingVoid}
                                onClick={() => setVoidTarget(null)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                variant="danger"
                                disabled={isSavingVoid || voidReasonLen < 10}
                            >
                                {isSavingVoid ? 'Memproses...' : 'Ya, Batalkan Catatan'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </AppLayout>
    );
}
