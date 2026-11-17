import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Flower2,
    Info,
    MapPin,
    Package,
    Plus,
    ReceiptText,
    RefreshCw,
    Truck,
    User,
    Wallet,
    X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    FulfillmentStatus,
    OrderDetail,
    OrderItemDetail,
    OrderPaymentDetail,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
} from '@/types';

type OrdersShowProps = {
    order: OrderDetail;
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
    switch (status) {
        case 'NEW':
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    Baru
                </span>
            );
        case 'PROCESSING':
            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    Diproses
                </span>
            );
        case 'READY':
            return (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                    Siap kirim
                </span>
            );
        case 'COMPLETED':
            return (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                    Selesai
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {status}
                </span>
            );
    }
}

function ItemFulfillmentBadge({ status }: { status: FulfillmentStatus }) {
    switch (status) {
        case 'NEW':
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                    Baru
                </span>
            );
        case 'PROCESSING':
            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                    Diproses
                </span>
            );
        case 'READY':
            return (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                    Siap kirim
                </span>
            );
        case 'DELIVERED':
            return (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900">
                    Terkirim
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                    {status}
                </span>
            );
    }
}

function PaymentStatusBadge({ status, label }: { status: PaymentStatus; label: string }) {
    switch (status) {
        case 'PAID':
            return (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                    {label}
                </span>
            );
        case 'PARTIAL':
            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                    {label}
                </span>
            );
        case 'UNPAID':
        default:
            return (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {label}
                </span>
            );
    }
}

const FULFILLMENT_CONFIG: Record<
    FulfillmentStatus,
    {
        label: string;
        nextStatus: FulfillmentStatus | null;
        actionLabel: string;
        actionDescription: string;
        buttonStyle: string;
    }
> = {
    NEW: {
        label: 'Baru',
        nextStatus: 'PROCESSING',
        actionLabel: 'Rangkai / Proses Bunga →',
        actionDescription: 'Mulai proses perangkaian bunga oleh tim florist.',
        buttonStyle: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    PROCESSING: {
        label: 'Diproses',
        nextStatus: 'READY',
        actionLabel: 'Bunga Siap Kirim →',
        actionDescription: 'Rangkaian bunga telah selesai dan siap diantar kurir.',
        buttonStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    READY: {
        label: 'Siap kirim',
        nextStatus: 'DELIVERED',
        actionLabel: 'Konfirmasi Terkirim di Lokasi ✓',
        actionDescription: 'Pesanan telah diterima oleh penerima di alamat tujuan.',
        buttonStyle: 'bg-emerald-800 hover:bg-emerald-900 text-white',
    },
    DELIVERED: {
        label: 'Terkirim',
        nextStatus: null,
        actionLabel: '✓ Sudah Terkirim ke Penerima',
        actionDescription: 'Pengerjaan & pengiriman item ini telah selesai tuntas.',
        buttonStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200 cursor-default',
    },
};

export default function OrdersShow({ order }: OrdersShowProps) {
    const { errors } = usePage<AppPageProps>().props;
    const today = new Date().toISOString().split('T')[0];

    const editOrderUrl = `/ui-orders/${order.id}/edit`;
    const bladeOrderUrl = `/orders/${order.id}`;
    const paymentActionUrl = `/orders/${order.id}#pembayaran`;

    // Payment recording modal state
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<number>(order.outstanding);
    const [paymentDate, setPaymentDate] = useState<string>(today);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER');
    const [paymentReference, setPaymentReference] = useState<string>('');
    const [paymentNotes, setPaymentNotes] = useState<string>('');
    const [idempotencyKey, setIdempotencyKey] = useState<string>('');
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    // Payment void modal state
    const [voidModalOpen, setVoidModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<OrderPaymentDetail | null>(null);
    const [voidReason, setVoidReason] = useState<string>('');
    const [isSavingVoid, setIsSavingVoid] = useState(false);

    // Fulfillment advancement modal state
    const [fulfillmentModalOpen, setFulfillmentModalOpen] = useState(false);
    const [selectedFulfillmentItem, setSelectedFulfillmentItem] = useState<OrderItemDetail | null>(null);
    const [targetFulfillmentStatus, setTargetFulfillmentStatus] = useState<FulfillmentStatus | null>(null);
    const [isSavingFulfillment, setIsSavingFulfillment] = useState(false);

    const handleOpenFulfillmentModal = (item: OrderItemDetail, nextStatus: FulfillmentStatus) => {
        setSelectedFulfillmentItem(item);
        setTargetFulfillmentStatus(nextStatus);
        setFulfillmentModalOpen(true);
    };

    const handleConfirmFulfillmentSubmit = () => {
        if (!selectedFulfillmentItem || !targetFulfillmentStatus || isSavingFulfillment) return;
        setIsSavingFulfillment(true);

        router.post(
            `/ui-orders/${order.id}/items/${selectedFulfillmentItem.id}/status`,
            {
                target_status: targetFulfillmentStatus,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setFulfillmentModalOpen(false);
                    setSelectedFulfillmentItem(null);
                    setTargetFulfillmentStatus(null);
                },
                onFinish: () => setIsSavingFulfillment(false),
            },
        );
    };

    // Open Payment Modal
    const handleOpenPaymentModal = () => {
        setPaymentAmount(order.outstanding);
        setPaymentDate(today);
        setPaymentMethod('TRANSFER');
        setPaymentReference('');
        setPaymentNotes('');
        setIdempotencyKey(crypto.randomUUID ? crypto.randomUUID() : 'idemp-' + Date.now());
        setPaymentModalOpen(true);
    };

    // Open Void Modal
    const handleOpenVoidModal = (payment: OrderPaymentDetail) => {
        setSelectedPayment(payment);
        setVoidReason('');
        setVoidModalOpen(true);
    };

    // Keyboard Escape listeners for modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (paymentModalOpen && !isSavingPayment) setPaymentModalOpen(false);
                if (voidModalOpen && !isSavingVoid) setVoidModalOpen(false);
                if (fulfillmentModalOpen && !isSavingFulfillment) setFulfillmentModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [paymentModalOpen, voidModalOpen, fulfillmentModalOpen, isSavingPayment, isSavingVoid, isSavingFulfillment]);

    const handleRecordPaymentSubmit = (e: FormEvent) => {
        e.preventDefault();
        setIsSavingPayment(true);

        router.post(
            `/ui-orders/${order.id}/payments`,
            {
                amount: Number(paymentAmount),
                payment_date: paymentDate,
                method: paymentMethod,
                reference: paymentReference || null,
                notes: paymentNotes || null,
                idempotency_key: idempotencyKey,
            },
            {
                preserveScroll: true,
                onSuccess: () => setPaymentModalOpen(false),
                onFinish: () => setIsSavingPayment(false),
            },
        );
    };

    const handleVoidPaymentSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!selectedPayment) return;
        setIsSavingVoid(true);

        router.post(
            `/ui-orders/${order.id}/payments/${selectedPayment.id}/void`,
            {
                void_reason: voidReason,
            },
            {
                preserveScroll: true,
                onSuccess: () => setVoidModalOpen(false),
                onFinish: () => setIsSavingVoid(false),
            },
        );
    };

    return (
        <AppLayout title={`Pesanan ${order.order_number}`}>
            <Head title={`Pesanan ${order.order_number}`} />

            <div className="mb-7">
                <Link
                    href="/ui-orders"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-800 hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Kembali ke daftar pesanan
                </Link>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                            Detail pesanan
                        </p>
                        <h1 className="break-all text-2xl font-semibold tracking-tight text-emerald-950 sm:text-3xl">
                            {order.order_number}
                        </h1>
                        <p className="mt-2 text-sm text-stone-500">
                            {order.customer.name} · Pesan {order.order_date}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={bladeOrderUrl}
                            className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                        >
                            Buka di Blade lama
                        </a>
                        {order.outstanding > 0 && (
                            <button
                                type="button"
                                onClick={handleOpenPaymentModal}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-950 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50"
                            >
                                <Wallet className="size-4" aria-hidden="true" />
                                + Catat pembayaran
                            </button>
                        )}
                        <Link
                            href={editOrderUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
                        >
                            Edit pesanan
                        </Link>
                    </div>
                </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="p-5">
                    <p className="text-xs font-medium text-stone-500">Total tagihan</p>
                    <p className="mt-3 break-words text-xl font-semibold text-emerald-950">
                        Rp{formatAmount(order.total_amount)}
                    </p>
                </Card>
                <Card className="p-5">
                    <p className="text-xs font-medium text-stone-500">Uang diterima</p>
                    <p className="mt-3 break-words text-xl font-semibold text-emerald-950">
                        Rp{formatAmount(order.received)}
                    </p>
                </Card>
                <Card className="p-5">
                    <p className="text-xs font-medium text-stone-500">Sisa tagihan</p>
                    <p className="mt-3 break-words text-xl font-semibold text-emerald-950">
                        Rp{formatAmount(order.outstanding)}
                    </p>
                </Card>
                <Card className="p-5">
                    <p className="text-xs font-medium text-stone-500">Status pembayaran</p>
                    <div className="mt-3">
                        <PaymentStatusBadge
                            status={order.payment_status}
                            label={order.payment_status_label}
                        />
                    </div>
                </Card>
            </div>

            {/* Pengerjaan pesanan */}
            <Card className="mb-7 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold text-stone-800">Pengerjaan pesanan</h2>
                    <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                    Status pengerjaan terpisah dari pembayaran. Pesanan selesai hanya jika semua bunga telah dikirim.
                </p>
                {order.notes && (
                    <div className="mt-4 rounded-lg bg-stone-50 p-4">
                        <p className="text-xs font-medium text-stone-500">Catatan pesanan</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-800">
                            {order.notes}
                        </p>
                    </div>
                )}
            </Card>

            {/* Daftar bunga / Order items */}
            <div className="space-y-4">
                {order.items.map((item) => (
                    <Card key={item.id} className="p-5 sm:p-7">
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
                                    Bunga {item.item_number}
                                </p>
                                <h2 className="mt-2 text-lg font-semibold text-stone-900">
                                    {item.flower_type}
                                </h2>
                            </div>
                            <ItemFulfillmentBadge status={item.fulfillment_status} />
                        </div>

                        <dl className="grid gap-5 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-xs font-medium text-stone-500">Untuk / penerima</dt>
                                <dd className="mt-1 break-words font-medium text-stone-900">
                                    {item.recipient}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-stone-500">Dari / pengirim</dt>
                                <dd className="mt-1 break-words font-medium text-stone-900">
                                    {item.sender_name}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-stone-500">Tanggal kirim</dt>
                                <dd className="mt-1 font-medium text-stone-900">
                                    {item.delivery_date}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-stone-500">Jumlah</dt>
                                <dd className="mt-1 font-medium text-stone-900">
                                    {formatAmount(item.quantity)} buah
                                </dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-xs font-medium text-stone-500">Lokasi pengiriman</dt>
                                <dd className="mt-1 whitespace-pre-wrap break-words font-medium text-stone-900">
                                    {item.delivery_location}
                                </dd>
                            </div>
                            {item.notes && (
                                <div className="sm:col-span-2">
                                    <dt className="text-xs font-medium text-stone-500">Catatan</dt>
                                    <dd className="mt-1 whitespace-pre-wrap break-words text-stone-700">
                                        {item.notes}
                                    </dd>
                                </div>
                            )}
                        </dl>

                        <div className="mt-5 space-y-2 rounded-lg bg-stone-50 px-4 py-4 text-sm">
                            <div className="flex justify-between gap-4">
                                <span className="text-stone-500">
                                    Bunga ({item.quantity} × Rp{formatAmount(item.unit_price)})
                                </span>
                                <strong className="font-semibold text-stone-900">
                                    Rp{formatAmount(item.subtotal)}
                                </strong>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-stone-500">
                                    Ongkir {item.shipping_mode === 'INCLUDED' ? '(termasuk)' : '(terpisah)'}
                                </span>
                                <strong className="font-semibold text-stone-900">
                                    Rp{formatAmount(item.effective_shipping_fee)}
                                </strong>
                            </div>
                        </div>

                        {/* Kontrol Alur Pengerjaan & Pengiriman (Fulfillment) */}
                        {(() => {
                            const cfg = FULFILLMENT_CONFIG[item.fulfillment_status] ?? FULFILLMENT_CONFIG.NEW;
                            return (
                                <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                                                    Status Pengerjaan:
                                                </span>
                                                <ItemFulfillmentBadge status={item.fulfillment_status} />
                                            </div>
                                            <p className="mt-1 text-xs text-stone-500">
                                                {cfg.actionDescription}
                                            </p>
                                        </div>

                                        <div className="shrink-0">
                                            {cfg.nextStatus ? (
                                                <button
                                                    type="button"
                                                    disabled={isSavingFulfillment}
                                                    onClick={() => handleOpenFulfillmentModal(item, cfg.nextStatus!)}
                                                    className={cn(
                                                        'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2',
                                                        cfg.buttonStyle,
                                                        isSavingFulfillment && 'cursor-not-allowed opacity-60'
                                                    )}
                                                >
                                                    {isSavingFulfillment && selectedFulfillmentItem?.id === item.id ? (
                                                        <>
                                                            <RefreshCw className="size-3.5 animate-spin" />
                                                            <span>Memproses...</span>
                                                        </>
                                                    ) : (
                                                        <span>{cfg.actionLabel}</span>
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3.5 py-2 text-xs font-semibold text-emerald-900">
                                                    <CheckCircle2 className="size-4 text-emerald-700" />
                                                    ✓ Sudah Terkirim ke Penerima
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>
                ))}
            </div>

            {/* Rincian nilai pesanan */}
            <Card className="mt-6 p-6">
                <h2 className="font-semibold text-emerald-950">Rincian nilai pesanan</h2>
                <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3">
                        <dt className="text-stone-500">Total nilai bunga</dt>
                        <dd className="font-medium text-stone-900">
                            Rp{formatAmount(order.flower_total)}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-stone-500">Total ongkir tambahan</dt>
                        <dd className="font-medium text-stone-900">
                            Rp{formatAmount(order.shipping_total)}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-stone-200 pt-3 text-lg font-semibold text-emerald-950">
                        <dt>Total tagihan</dt>
                        <dd>Rp{formatAmount(order.total_amount)}</dd>
                    </div>
                </dl>
                <p className="mt-4 text-xs leading-5 text-stone-500">
                    Pembayaran hanya dihitung jika status POSTED. Koreksi pencatatan (VOIDED) tidak berarti uang dikembalikan.
                </p>
            </Card>

            {/* Riwayat pembayaran */}
            <Card className="mt-6 p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-emerald-950">Riwayat pembayaran</h2>
                        <p className="mt-1 text-xs text-stone-500">
                            POSTED dihitung sebagai uang masuk. VOIDED hanya menandai kesalahan pencatatan, bukan refund.
                        </p>
                    </div>
                    {order.outstanding > 0 && (
                        <button
                            type="button"
                            onClick={handleOpenPaymentModal}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900 bg-emerald-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
                        >
                            <Wallet className="size-3.5" aria-hidden="true" />
                            + Catat pembayaran
                        </button>
                    )}
                </div>

                {order.payments.length === 0 ? (
                    <div className="mt-6 rounded-lg bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                        <Wallet className="mx-auto mb-2 size-8 text-stone-300" aria-hidden="true" />
                        <p className="font-medium text-stone-700">Belum ada pembayaran</p>
                        <p className="mt-1 text-xs text-stone-500">
                            Pesanan boleh dikerjakan dan diselesaikan meskipun belum lunas.
                        </p>
                        {order.outstanding > 0 && (
                            <button
                                type="button"
                                onClick={handleOpenPaymentModal}
                                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-900"
                            >
                                + Catat pembayaran sekarang
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="mt-5 divide-y divide-stone-200">
                        {order.payments.map((payment) => (
                            <div key={payment.id} className="py-5 first:pt-2">
                                <div className="flex flex-wrap justify-between gap-3">
                                    <div>
                                        <p className="text-base font-semibold text-stone-900">
                                            Rp{formatAmount(payment.amount)}
                                        </p>
                                        <p className="mt-1 text-xs text-stone-500">
                                            {payment.payment_date} · {payment.method_label}
                                        </p>
                                    </div>
                                    <span
                                        className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${
                                            payment.status === 'POSTED'
                                                ? 'bg-emerald-50 text-emerald-900'
                                                : 'bg-stone-100 text-stone-600'
                                        }`}
                                    >
                                        {payment.status === 'POSTED' ? 'Tercatat' : 'VOIDED'}
                                    </span>
                                </div>

                                {payment.reference && (
                                    <p className="mt-2 break-all text-xs text-stone-500">
                                        Referensi: {payment.reference}
                                    </p>
                                )}

                                {payment.notes && (
                                    <p className="mt-2 whitespace-pre-wrap break-words text-xs text-stone-600">
                                        {payment.notes}
                                    </p>
                                )}

                                <p className="mt-2 text-xs text-stone-400">
                                    Dicatat oleh {payment.recorded_by}
                                </p>

                                {payment.status === 'VOIDED' ? (
                                    <div className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
                                        <p className="font-semibold text-stone-800">
                                            Koreksi: {payment.void_reason}
                                        </p>
                                        <p className="mt-1 text-stone-500">{payment.voided_at} WIB</p>
                                    </div>
                                ) : (
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenVoidModal(payment)}
                                            className="text-xs font-medium text-red-700 hover:underline"
                                        >
                                            Koreksi kesalahan pencatatan (Void) &rarr;
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Modal Catat Pembayaran */}
            {paymentModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="record-payment-title"
                >
                    <div
                        className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
                        onClick={() => !isSavingPayment && setPaymentModalOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl sm:p-7">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                            <div>
                                <h3
                                    id="record-payment-title"
                                    className="text-lg font-semibold text-emerald-950"
                                >
                                    Catat Penerimaan Pembayaran
                                </h3>
                                <p className="mt-1 text-xs text-stone-500">
                                    Sisa tagihan pesanan: Rp{formatAmount(order.outstanding)}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={isSavingPayment}
                                onClick={() => setPaymentModalOpen(false)}
                                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-50 hover:text-stone-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handleRecordPaymentSubmit} noValidate className="mt-5 space-y-4">
                            {errors && Object.keys(errors).length > 0 && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                                    <p className="font-semibold">Pembayaran belum tersimpan:</p>
                                    <ul className="mt-1 list-inside list-disc">
                                        {Object.entries(errors).map(([k, v]) => (
                                            <li key={k}>{v}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div>
                                <label
                                    htmlFor="modal_amount"
                                    className="mb-1.5 block text-xs font-medium text-stone-700"
                                >
                                    Jumlah diterima (Rp) <span className="text-red-700">*</span>
                                </label>
                                <input
                                    id="modal_amount"
                                    type="number"
                                    min={1}
                                    max={order.outstanding}
                                    required
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                />
                                <p className="mt-1 text-xs text-stone-400">
                                    Nilai default diisi untuk pelunasan penuh. Ganti jika hanya menerima DP/cicilan.
                                </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="modal_date"
                                        className="mb-1.5 block text-xs font-medium text-stone-700"
                                    >
                                        Tanggal uang diterima <span className="text-red-700">*</span>
                                    </label>
                                    <input
                                        id="modal_date"
                                        type="date"
                                        required
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="modal_method"
                                        className="mb-1.5 block text-xs font-medium text-stone-700"
                                    >
                                        Metode pembayaran <span className="text-red-700">*</span>
                                    </label>
                                    <select
                                        id="modal_method"
                                        value={paymentMethod}
                                        onChange={(e) =>
                                            setPaymentMethod(e.target.value as PaymentMethod)
                                        }
                                        className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                    >
                                        <option value="TRANSFER">Transfer bank</option>
                                        <option value="CASH">Tunai</option>
                                        <option value="QRIS">QRIS</option>
                                        <option value="OTHER">Lainnya</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="modal_ref"
                                    className="mb-1.5 block text-xs font-medium text-stone-700"
                                >
                                    Referensi transaksi (opsional)
                                </label>
                                <input
                                    id="modal_ref"
                                    type="text"
                                    maxLength={255}
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    placeholder="Contoh: Nomor resi transfer atau bukti bayar"
                                    className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="modal_notes"
                                    className="mb-1.5 block text-xs font-medium text-stone-700"
                                >
                                    Catatan tambahan (opsional)
                                </label>
                                <textarea
                                    id="modal_notes"
                                    rows={2}
                                    maxLength={2000}
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                />
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={isSavingPayment}
                                    onClick={() => setPaymentModalOpen(false)}
                                    className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        isSavingPayment ||
                                        paymentAmount <= 0 ||
                                        paymentAmount > order.outstanding
                                    }
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSavingPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Void Pembayaran */}
            {voidModalOpen && selectedPayment && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="void-payment-title"
                >
                    <div
                        className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
                        onClick={() => !isSavingVoid && setVoidModalOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xl sm:p-7">
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
                                <AlertCircle className="size-5" />
                            </span>
                            <div>
                                <h3
                                    id="void-payment-title"
                                    className="text-lg font-semibold text-stone-900"
                                >
                                    Koreksi Kesalahan Pencatatan (Void)
                                </h3>
                                <p className="mt-1 text-xs text-stone-500">
                                    Membatalkan pencatatan pembayaran Rp{formatAmount(selectedPayment.amount)} (
                                    {selectedPayment.method_label}).
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                            <strong>Perhatian:</strong> Void adalah koreksi audit akuntansi kesalahan entri data dan <em>bukan pengembalian uang (refund)</em> kepada pelanggan. Baris pembayaran tetap tersimpan di riwayat.
                        </div>

                        <form onSubmit={handleVoidPaymentSubmit} noValidate className="mt-4 space-y-4">
                            <div>
                                <label
                                    htmlFor="void_reason"
                                    className="mb-1.5 block text-xs font-semibold text-stone-700"
                                >
                                    Alasan koreksi (minimal 10 karakter) <span className="text-red-700">*</span>
                                </label>
                                <textarea
                                    id="void_reason"
                                    name="void_reason"
                                    required
                                    rows={3}
                                    minLength={10}
                                    maxLength={1000}
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    placeholder="Contoh: Kasir salah memasukkan nominal, pembayaran akan dicatat ulang"
                                    className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                                />
                                {errors?.void_reason && (
                                    <p className="mt-1 text-xs text-red-700">{errors.void_reason}</p>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={isSavingVoid}
                                    onClick={() => setVoidModalOpen(false)}
                                    className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingVoid || voidReason.trim().length < 10}
                                    className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSavingVoid ? 'Memproses...' : 'Void Pencatatan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Kemajuan Status Fulfillment */}
            {fulfillmentModalOpen && selectedFulfillmentItem && targetFulfillmentStatus && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="fulfillment-modal-title"
                >
                    <div
                        className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
                        onClick={() => !isSavingFulfillment && setFulfillmentModalOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl sm:p-7">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3
                                    id="fulfillment-modal-title"
                                    className="text-lg font-semibold text-stone-900"
                                >
                                    Konfirmasi Status Bunga
                                </h3>
                                <p className="mt-1 text-xs text-stone-500">
                                    Pastikan fisik pengerjaan atau pengiriman bunga sudah sesuai tahap berikut.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !isSavingFulfillment && setFulfillmentModalOpen(false)}
                                disabled={isSavingFulfillment}
                                className="rounded p-1 text-stone-400 hover:text-stone-600"
                                aria-label="Tutup"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3.5 text-xs text-stone-700 space-y-2">
                            <div>
                                <span className="font-medium text-stone-500">Item: </span>
                                <strong className="font-semibold text-stone-900">
                                    Bunga #{selectedFulfillmentItem.item_number} — {selectedFulfillmentItem.flower_type}
                                </strong>
                            </div>
                            <div>
                                <span className="font-medium text-stone-500">Penerima: </span>
                                <span className="text-stone-900">{selectedFulfillmentItem.recipient}</span>
                                <span className="text-stone-500"> ({selectedFulfillmentItem.delivery_location})</span>
                            </div>
                            <div className="flex items-center gap-2 pt-1 font-medium">
                                <span className="rounded bg-stone-200 px-2 py-0.5 text-stone-800">
                                    {FULFILLMENT_CONFIG[selectedFulfillmentItem.fulfillment_status]?.label}
                                </span>
                                <span className="text-stone-400 font-bold">→</span>
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 font-bold">
                                    {FULFILLMENT_CONFIG[targetFulfillmentStatus as FulfillmentStatus]?.label}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isSavingFulfillment}
                                onClick={() => setFulfillmentModalOpen(false)}
                                className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                disabled={isSavingFulfillment}
                                onClick={handleConfirmFulfillmentSubmit}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSavingFulfillment ? (
                                    <>
                                        <RefreshCw className="size-4 animate-spin" />
                                        <span>Memproses...</span>
                                    </>
                                ) : (
                                    <span>Ya, Majukan Status</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
