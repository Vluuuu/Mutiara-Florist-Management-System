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
import { LedgerSummaryStrip } from '@/components/ledger-summary-strip';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { PaymentModal } from '@/components/payment-modal';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatAmount, formatDateTimeWib, formatDateWib, formatRupiah, getWibTodayIso } from '@/lib/format';
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
    todayIso?: string;
};

const STEPPER_ORDER: Array<{ key: FulfillmentStatus; label: string }> = [
    { key: 'NEW', label: 'Baru' },
    { key: 'PROCESSING', label: 'Diproses' },
    { key: 'READY', label: 'Siap Kirim' },
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

export default function OrdersShow({ order, todayIso: serverTodayIso }: OrdersShowProps) {
    const { errors } = usePage<AppPageProps>().props;
    const todayIso = useMemo(() => serverTodayIso ?? getWibTodayIso(), [serverTodayIso]);

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

            <div className="mb-7 border-b border-[#DED6C8] pb-5">
                <Link
                    href="/ui-orders"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#1D3B2A] hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Kembali ke daftar pesanan
                </Link>

                <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={orderStatusMeta.tone}>{orderStatusMeta.label}</Badge>
                            <Badge tone={paymentStatusMeta.tone}>{paymentStatusMeta.label}</Badge>
                        </div>
                        <h1 className="atelier-h1 mt-2.5">
                            Nota{' '}
                            <OrderCodeBadge
                                orderNumber={order.order_number}
                                compact={false}
                                copyable
                                className="inline-flex align-middle"
                            />
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-[#545852]">
                            <Link
                                href={`/ui-customers/${order.customer.id}`}
                                className="inline-flex min-h-[44px] items-center font-bold text-[#1D3B2A] hover:underline"
                            >
                                {order.customer.name}
                            </Link>
                            {order.customer.phone && (
                                <span className="inline-flex items-center gap-1 font-[var(--font-mono)] text-sm tabular-nums">
                                    <Phone className="size-3.5" aria-hidden="true" />
                                    {order.customer.phone}
                                </span>
                            )}
                            <span className="tabular-nums">
                                Tanggal Nota {formatDateWib(order.order_date)}
                            </span>
                        </p>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                        <Button asChild variant="secondary" className="w-full sm:w-auto sm:min-w-[152px]">
                            <Link href={`/ui-orders/${order.id}/edit`}>
                                <Edit3 className="size-4" aria-hidden="true" />
                                Edit Pesanan
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCopyWhatsappSummary}
                            className="w-full sm:w-auto sm:min-w-[168px]"
                        >
                            <Copy className="size-4" aria-hidden="true" />
                            <span>
                                Salin <span className="hidden sm:inline">Ringkasan </span>WA
                            </span>
                        </Button>
                        {order.outstanding > 0 && (
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => setPaymentModalOpen(true)}
                                className="col-span-2 w-full sm:col-span-1 sm:w-auto sm:min-w-[172px]"
                            >
                                <Wallet className="size-4" aria-hidden="true" />
                                Catat Pembayaran
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {stepError && (
                <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-sm font-medium text-[#8A2619]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{stepError}</span>
                </div>
            )}

            {waPreviewVisible && (
                <div
                    role="status"
                    className="mb-6 rounded-[8px] border border-[#B8D0C0] bg-[#EEF5F0] p-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#164B2A]">{waCopyStatus}</p>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setWaPreviewVisible(false)}
                        >
                            Tutup Pratinjau
                        </Button>
                    </div>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-[8px] border border-[#DED6C8] bg-[#FFFDF9] p-3.5 font-[var(--font-sans)] text-[13px] leading-relaxed text-[#1C211E]">
                        {waCopiedText}
                    </pre>
                </div>
            )}

            <LedgerSummaryStrip
                ariaLabel="Ringkasan tagihan pesanan"
                columns={3}
                className="mb-7"
                items={[
                    {
                        label: 'Total Tagihan',
                        value: formatRupiah(order.total_amount),
                        hint: `Bunga ${formatRupiah(order.flower_total)} · Ongkir ${formatRupiah(order.shipping_total)}`,
                    },
                    {
                        label: 'Sudah Diterima',
                        value: formatRupiah(order.received),
                        hint: `${formatAmount(order.items.length)} item bunga`,
                    },
                    {
                        label: 'Sisa Tagihan',
                        value: formatRupiah(order.outstanding),
                        hint: order.outstanding > 0 ? 'Belum dilunasi' : 'Sudah lunas',
                        tone: order.outstanding > 0 ? 'urgent' : 'default',
                    },
                ]}
            />

            {order.notes && (
                <Card className="mb-6 bg-[#EFE9DE]/60 p-5">
                    <p className="text-sm font-bold text-[#545852]">
                        Catatan Pesanan
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-[#1C211E]">
                        {order.notes}
                    </p>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:items-start">
                {/* Kolom Kiri: Daftar Rangkaian & Progres Pengerjaan */}
                <Card className="overflow-hidden">
                    <div className="border-b border-[#DED6C8] bg-[#EFE9DE]/45 px-5 py-4">
                        <h2 className="atelier-h2">
                            Daftar Rangkaian &amp; Status Kerja
                        </h2>
                    </div>

                    <div className="divide-y divide-[#DED6C8]">
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
                                        'bg-[#FFFDF9] p-4 sm:p-5',
                                        isOverdue && 'border-l-[3px] border-l-[#9A3B22]',
                                    )}
                                >
                                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                                                {isOverdue && (
                                                    <Badge tone="danger">
                                                        Terlambat ({formatDateWib(item.delivery_date)})
                                                    </Badge>
                                                )}
                                                <span className="text-[13px] font-medium text-[#545852] tabular-nums">
                                                    Kirim {formatDateWib(item.delivery_date)} · {shipText}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold text-[#1C211E]">
                                                {item.item_number}. {item.flower_type}{' '}
                                                <span className="font-semibold text-[#545852] tabular-nums">
                                                    ({formatAmount(item.quantity)} buah)
                                                </span>
                                            </h3>
                                            <p className="mt-1.5 text-sm text-[#545852]">
                                                Penerima:{' '}
                                                <strong className="text-[#1C211E]">
                                                    {item.recipient}
                                                </strong>
                                                {' · '}Pengirim kartu:{' '}
                                                <strong className="text-[#1C211E]">
                                                    {item.sender_name}
                                                </strong>
                                            </p>
                                            <p className="mt-1 flex items-start gap-1.5 text-sm text-[#545852]">
                                                <MapPin
                                                    className="mt-0.5 size-4 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <span>{item.delivery_location}</span>
                                            </p>
                                            {item.notes && (
                                                <p className="mt-1.5 text-sm text-[#545852]">
                                                    Catatan: {item.notes}
                                                </p>
                                            )}
                                        </div>

                                        <div className="text-left tabular-nums sm:text-right">
                                            <p className="text-lg font-bold text-[#1C211E]">
                                                {formatRupiah(itemTotal)}
                                            </p>
                                            <p className="text-[13px] text-[#545852]">
                                                {formatAmount(item.quantity)} x{' '}
                                                {formatRupiah(item.unit_price)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-[#DED6C8] pt-3.5 sm:flex-row sm:items-center sm:justify-between">
                                        <ol
                                            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm"
                                            aria-label={`Tahap pengerjaan item ${item.item_number}`}
                                        >
                                            {STEPPER_ORDER.map((step, idx) => {
                                                const isDone = idx < currentStepIdx;
                                                const isCurrent = idx === currentStepIdx;
                                                return (
                                                    <li
                                                        key={step.key}
                                                        aria-current={isCurrent ? 'step' : undefined}
                                                        className={cn(
                                                            'inline-flex items-center gap-1.5',
                                                            isCurrent && 'border-b-2 border-[#1D3B2A] pb-0.5 font-bold text-[#1D3B2A]',
                                                            isDone && 'font-semibold text-[#164B2A]',
                                                            !isDone && !isCurrent && 'font-medium text-[#545852]',
                                                        )}
                                                    >
                                                        <span>{idx + 1}.</span>
                                                        <span>{step.label}</span>
                                                        {idx < STEPPER_ORDER.length - 1 && (
                                                            <span aria-hidden="true" className="ml-1.5 text-[#7D776C]">
                                                                /
                                                            </span>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ol>

                                        <div className="shrink-0">
                                            {nextCfg.nextStatus ? (
                                                <Button
                                                    type="button"
                                                    variant={isOverdue ? 'urgent' : 'primary'}
                                                    disabled={submittingItemId !== null}
                                                    onClick={() =>
                                                        handleStepClick(item, nextCfg.nextStatus!)
                                                    }
                                                    className="w-full sm:w-auto sm:min-w-[168px]"
                                                >
                                                    {isBusy ? 'Memproses...' : nextCfg.label}
                                                </Button>
                                            ) : (
                                                <span className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-sm font-bold text-[#164B2A]">
                                                    <CheckCircle2
                                                        className="size-4 shrink-0"
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
                    <Card className="overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED6C8] bg-[#EFE9DE]/45 px-5 py-4">
                            <h2 className="atelier-h2">
                                Riwayat Pembayaran
                            </h2>
                            {order.outstanding > 0 && (
                                <Button
                                    type="button"
                                    variant="urgent"
                                    size="sm"
                                    onClick={() => setPaymentModalOpen(true)}
                                    className="min-w-[120px]"
                                >
                                    Catat Bayar
                                </Button>
                            )}
                        </div>

                        {order.payments.length === 0 ? (
                            <div className="bg-[#EFE9DE]/35 px-5 py-9 text-center">
                                <Wallet
                                    className="mx-auto mb-2 size-7 text-[#545852]"
                                    aria-hidden="true"
                                />
                                <p className="text-[15px] font-bold text-[#1C211E]">
                                    Belum ada pembayaran tercatat
                                </p>
                                <p className="mt-1 text-sm text-[#545852]">
                                    Pesanan tetap bisa dirangkai sambil menunggu pelunasan.
                                </p>
                                {order.outstanding > 0 && (
                                    <div className="mt-4">
                                        <Button
                                            type="button"
                                            variant="urgent"
                                            onClick={() => setPaymentModalOpen(true)}
                                            className="min-w-[168px]"
                                        >
                                            Catat Pembayaran
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-[#DED6C8]">
                                {order.payments.map((payment) => {
                                    const isPosted = payment.status === 'POSTED';
                                    const badgeMeta = getPaymentBadgeMeta(payment.status);

                                    return (
                                        <div
                                            key={payment.id}
                                            className="bg-[#FFFDF9] p-5"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge tone={badgeMeta.tone}>{badgeMeta.label}</Badge>
                                                <span className="text-[13px] font-medium text-[#545852] tabular-nums">
                                                    {formatDateWib(payment.payment_date)}
                                                </span>
                                            </div>

                                            <p
                                                className={cn(
                                                    'mt-2.5 text-lg font-bold tabular-nums',
                                                    isPosted
                                                        ? 'text-[#1C211E]'
                                                        : 'text-[#545852] line-through',
                                                )}
                                            >
                                                {formatRupiah(payment.amount)}
                                            </p>

                                            <p className="mt-0.5 text-sm text-[#545852]">
                                                {payment.method_label}
                                                {payment.reference ? ` · Ref: ${payment.reference}` : ''}
                                            </p>

                                            {payment.notes && (
                                                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-[#545852]">
                                                    Catatan: {payment.notes}
                                                </p>
                                            )}

                                            <p className="mt-1.5 text-[13px] text-[#545852]">
                                                Dicatat oleh {payment.recorded_by}
                                            </p>

                                            {isPosted ? (
                                                <div className="mt-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full border-[#E2B3AA] text-[#8A2619] hover:bg-[#FCECE9] sm:w-auto sm:min-w-[160px]"
                                                        onClick={() => handleOpenVoidModal(payment)}
                                                    >
                                                        Batalkan Catatan
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="mt-3 rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] p-3 text-[13px] text-[#545852]">
                                                    <p className="font-semibold text-[#1C211E]">
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
                        <div className="rounded-[8px] border border-[#DFC393] bg-[#FAF1E1] p-3.5 text-[13px] leading-relaxed text-[#6E3D09]">
                            <strong>Perhatian Audit:</strong> Pembatalan menandai kesalahan entri agar riwayat kas akurat, dan{' '}
                            <strong>bukan pengembalian uang (refund)</strong> kepada pelanggan.
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

                        <div className="flex flex-col-reverse gap-2.5 border-t border-[#DED6C8] pt-4 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={isSavingVoid}
                                onClick={() => setVoidTarget(null)}
                                className="w-full sm:w-auto sm:min-w-[120px]"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                variant="danger"
                                disabled={isSavingVoid || voidReasonLen < 10}
                                className="w-full sm:w-auto sm:min-w-[180px]"
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
