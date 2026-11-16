import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
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
    Truck,
    User,
    Wallet,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';
import type { FulfillmentStatus, OrderDetail, OrderStatus, PaymentStatus } from '@/types';

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

export default function OrdersShow({ order }: OrdersShowProps) {
    const editOrderUrl = `/orders/${order.id}/edit`;
    const bladeOrderUrl = `/orders/${order.id}`;
    const paymentActionUrl = `/orders/${order.id}#pembayaran`;

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
                        <a
                            href={paymentActionUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-950 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50"
                        >
                            <Wallet className="size-4" aria-hidden="true" />
                            + Catat pembayaran
                        </a>
                        <a
                            href={editOrderUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
                        >
                            Edit pesanan
                        </a>
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

            {/* Riwayat pembayaran (Read-only) */}
            <Card className="mt-6 p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-emerald-950">Riwayat pembayaran</h2>
                        <p className="mt-1 text-xs text-stone-500">
                            POSTED dihitung sebagai uang masuk. VOIDED hanya menandai kesalahan pencatatan, bukan refund.
                        </p>
                    </div>
                    <a
                        href={paymentActionUrl}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900 bg-emerald-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
                    >
                        <Wallet className="size-3.5" aria-hidden="true" />
                        Catat / koreksi di Blade
                    </a>
                </div>

                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3.5 text-xs text-emerald-900">
                    <div className="flex items-start gap-2">
                        <Info className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                        <p>
                            Pencatatan pembayaran baru dan koreksi void dilakukan melalui antarmuka Blade lama untuk menjamin validasi idempotensi dan integritas audit.
                        </p>
                    </div>
                </div>

                {order.payments.length === 0 ? (
                    <div className="mt-6 rounded-lg bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                        <Wallet className="mx-auto mb-2 size-8 text-stone-300" aria-hidden="true" />
                        <p className="font-medium text-stone-700">Belum ada pembayaran</p>
                        <p className="mt-1 text-xs text-stone-500">
                            Pesanan boleh dikerjakan dan diselesaikan meskipun belum lunas.
                        </p>
                        <a
                            href={paymentActionUrl}
                            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-900"
                        >
                            + Catat pembayaran di Blade
                        </a>
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
                                        <a
                                            href={paymentActionUrl}
                                            className="text-xs font-medium text-stone-500 hover:text-red-700 hover:underline"
                                        >
                                            Koreksi kesalahan pencatatan di Blade &rarr;
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </AppLayout>
    );
}
