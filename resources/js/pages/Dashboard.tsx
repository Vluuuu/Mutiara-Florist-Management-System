import { useEffect, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { DeliveryConfirmModal, type DeliveryConfirmTarget } from '@/components/delivery-confirm-modal';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { PaymentModal, type PaymentModalTarget } from '@/components/payment-modal';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatAmount, formatRupiah, getWibTodayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    DashboardNav,
    DashboardQueueItem,
    DashboardQueueSummary,
    DashboardReceivableItem,
    DashboardStats,
    FulfillmentStatus,
} from '@/types';

type DashboardProps = {
    stats: DashboardStats;
    deliveryQueue?: DashboardQueueItem[];
    queueSummary?: DashboardQueueSummary;
    receivables?: DashboardReceivableItem[];
    todayIso?: string;
    todayDisplay?: string;
    nav: DashboardNav;
};

const NEXT_STEP_LABEL: Record<FulfillmentStatus, string> = {
    NEW: 'Mulai Proses',
    PROCESSING: 'Tandai Siap Kirim',
    READY: 'Tandai Terkirim',
    DELIVERED: 'Terkirim',
};

function getUrgencyBadge(item: DashboardQueueItem): {
    label: string;
    tone: 'danger' | 'warn' | 'neutral';
} {
    if (item.urgency === 'overdue') {
        return { label: `Terlambat (${item.delivery_date})`, tone: 'danger' };
    }
    if (item.urgency === 'today') {
        return { label: `Kirim hari ini (${item.delivery_date})`, tone: 'warn' };
    }
    return { label: `Jadwal ${item.delivery_date}`, tone: 'neutral' };
}

export default function Dashboard({
    stats,
    deliveryQueue = [],
    queueSummary,
    receivables = [],
    todayIso,
    todayDisplay,
    nav,
}: DashboardProps) {
    const { errors } = usePage<AppPageProps>().props;
    const ordersHref = nav?.uiOrders ?? '/ui-orders';
    const createOrderHref = nav?.uiOrdersCreate ?? '/ui-orders/create';
    const paymentsHref = nav?.uiPayments ?? '/ui-payments';

    const fallbackTodayIso = todayIso ?? getWibTodayIso();

    const [submittingItemId, setSubmittingItemId] = useState<number | null>(null);
    const stepLockRef = useRef(false);
    const [deliverTarget, setDeliverTarget] = useState<DeliveryConfirmTarget | null>(null);
    const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState<PaymentModalTarget | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const stopStart = router.on('start', () => setIsRefreshing(true));
        const stopFinish = router.on('finish', () => setIsRefreshing(false));
        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    const overdueCount =
        queueSummary?.overdue_count ??
        deliveryQueue.filter((item) => item.urgency === 'overdue').length;

    const advanceStatus = (orderId: number, itemId: number, targetStatus: FulfillmentStatus) => {
        if (stepLockRef.current || submittingItemId !== null) return;
        stepLockRef.current = true;
        setSubmittingItemId(itemId);

        router.post(
            `/ui-orders/${orderId}/items/${itemId}/status`,
            {
                target_status: targetStatus,
                return_to: 'dashboard',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setDeliverTarget(null);
                },
                onFinish: () => {
                    stepLockRef.current = false;
                    setSubmittingItemId(null);
                },
            },
        );
    };

    const handleQueueAction = (item: DashboardQueueItem) => {
        if (!item.next_status || stepLockRef.current) return;

        if (item.next_status === 'DELIVERED') {
            setDeliverTarget({
                orderId: item.order_id,
                itemId: item.item_id,
                orderNumber: item.order_number,
                flowerType: item.flower_type,
                recipient: item.recipient,
                deliveryLocation: item.delivery_location,
                currentStatus: item.fulfillment_status,
                nextStatus: 'DELIVERED',
            });
            return;
        }

        advanceStatus(item.order_id, item.item_id, item.next_status);
    };

    const queueError = errors?.target_status ?? errors?.item;

    return (
        <AppLayout title="Hari Ini">
            <Head title="Hari Ini" />

            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Jadwal Pengiriman &amp; Ringkasan Toko
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        {todayDisplay ? `Tanggal acuan: ${todayDisplay} | ` : ''}
                        Urutan berdasar tanggal kirim terdekat
                        {isRefreshing ? ' (Memperbarui data...)' : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="secondary">
                        <Link href={ordersHref}>Semua Pesanan</Link>
                    </Button>
                    {receivables.length > 0 ? (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => setPaymentPickerOpen(true)}
                        >
                            + Catat Pembayaran
                        </Button>
                    ) : (
                        <Button asChild variant="primary">
                            <Link href={createOrderHref}>
                                <Plus className="size-4" aria-hidden="true" />
                                Pesanan Baru
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            {queueError && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2.5 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3.5 text-sm font-medium text-[#991B1B]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{queueError}</span>
                </div>
            )}

            {/* Mobile (< 768px): Antrean & Piutang tampil lebih dulu (order-1), KPI ringkas 2x2 di bawah (order-2) */}
            <div className="flex flex-col gap-4">
                <section
                    aria-label="Ringkasan angka toko"
                    className="order-2 grid grid-cols-2 gap-2.5 md:order-1 md:gap-3 lg:grid-cols-4"
                >
                    <div className="rounded-[10px] border border-[#E3DED4] bg-white p-3 md:px-4 md:py-3.5">
                        <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                            Total Nilai Pesanan
                        </p>
                        <p className="mt-1 font-bold text-[#1E2420] tabular-nums text-[19px] leading-snug md:text-[22px]">
                            {formatRupiah(stats.billed)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54] tabular-nums">
                            Dari {formatAmount(stats.orders)} pesanan tercatat
                        </p>
                    </div>

                    <div className="rounded-[10px] border border-[#E3DED4] bg-white p-3 md:px-4 md:py-3.5">
                        <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                            Uang Masuk (Sah)
                        </p>
                        <p className="mt-1 font-bold text-[#166534] tabular-nums text-[19px] leading-snug md:text-[22px]">
                            {formatRupiah(stats.received)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54]">
                            Pembayaran tercatat sah
                        </p>
                    </div>

                    <div className="rounded-[10px] border border-[#E3DED4] bg-white p-3 md:px-4 md:py-3.5">
                        <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                            Sisa Piutang Berjalan
                        </p>
                        <p className="mt-1 font-bold text-[#8C3B4A] tabular-nums text-[19px] leading-snug md:text-[22px]">
                            {formatRupiah(stats.outstanding)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54]">
                            Tagihan belum dilunasi
                        </p>
                    </div>

                    <div className="rounded-[10px] border border-[#E3DED4] bg-[#F1EDE6] p-3 md:px-4 md:py-3.5">
                        <p className="text-xs font-semibold text-[#525B54] md:text-[13px]">
                            Selisih Kas Sederhana
                        </p>
                        <p className="mt-1 font-bold text-[#1E2420] tabular-nums text-[19px] leading-snug md:text-[22px]">
                            {formatRupiah(stats.cash_flow)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54] tabular-nums">
                            Biaya sah: {formatRupiah(stats.expenses)}
                        </p>
                    </div>
                </section>

                <div className="order-1 grid grid-cols-1 gap-4 md:order-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(310px,1fr)] lg:items-start">
                    {/* Kolom Kiri: Antrean Kiriman & Pengerjaan */}
                    <section
                        aria-labelledby="dash-agenda-title"
                        className="rounded-[10px] border border-[#E3DED4] bg-white p-3.5 md:p-5"
                    >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
                            <h2 id="dash-agenda-title" className="text-base font-bold text-[#1E2420]">
                                Antrean Kiriman Terlambat &amp; Hari Ini
                            </h2>
                            <Badge tone={overdueCount > 0 ? 'danger' : 'paid'}>
                                {overdueCount > 0
                                    ? `${overdueCount} Terlambat tanggal`
                                    : 'Semua tepat tanggal'}
                            </Badge>
                        </div>

                        {deliveryQueue.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[#858E87] bg-[#F1EDE6]/55 px-4 py-7 text-center">
                                <CheckCircle2
                                    className="mx-auto mb-2 size-7 text-[#166534]"
                                    aria-hidden="true"
                                />
                                <p className="text-sm font-bold text-[#1E2420]">
                                    Semua rangkaian sudah selesai dikirim
                                </p>
                                <p className="mt-1 text-[13px] text-[#525B54]">
                                    Belum ada item pesanan aktif yang perlu dirangkai atau diantar.
                                </p>
                                <div className="mt-4">
                                    <Button asChild variant="primary" size="sm">
                                        <Link href={createOrderHref}>
                                            <Plus className="size-4" aria-hidden="true" />
                                            Buat Pesanan Baru
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {deliveryQueue.map((item) => {
                                    const urgencyMeta = getUrgencyBadge(item);
                                    const statusMeta = getFulfillmentBadgeMeta(item.fulfillment_status);
                                    const isUrgent = item.urgency === 'overdue';
                                    const isBusy = submittingItemId === item.item_id;
                                    const nextLabel = item.next_status
                                        ? NEXT_STEP_LABEL[item.fulfillment_status]
                                        : null;

                                    return (
                                        <article
                                            key={item.item_id}
                                            className={cn(
                                                'flex flex-col justify-between gap-3 rounded-lg border px-3.5 py-3 md:flex-row md:items-center',
                                                isUrgent
                                                    ? 'border-[#E5B9C2] bg-[#FDF2F4]'
                                                    : 'border-[#E3DED4] bg-white',
                                            )}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                                    <Badge tone={urgencyMeta.tone}>{urgencyMeta.label}</Badge>
                                                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                                                    <OrderCodeBadge orderNumber={item.order_number} />
                                                </div>
                                                <h3 className="text-[15px] font-bold text-[#1E2420]">
                                                    {item.flower_type}{' '}
                                                    <span className="font-semibold text-[#525B54] tabular-nums">
                                                        ({formatAmount(item.quantity)} buah)
                                                    </span>
                                                </h3>
                                                <p className="mt-0.5 text-[13px] text-[#525B54]">
                                                    Untuk: <strong className="text-[#1E2420]">{item.recipient}</strong>
                                                    {' | '}
                                                    {item.delivery_location}
                                                    {' | '}
                                                    Pemesan: {item.customer_name}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                {item.next_status && nextLabel && (
                                                    <Button
                                                        type="button"
                                                        variant={isUrgent ? 'urgent' : 'primary'}
                                                        size="sm"
                                                        disabled={submittingItemId !== null}
                                                        onClick={() => handleQueueAction(item)}
                                                    >
                                                        {isBusy ? 'Memproses...' : nextLabel}
                                                    </Button>
                                                )}
                                                <Button asChild variant="secondary" size="sm">
                                                    <Link href={`/ui-orders/${item.order_id}`}>Detail</Link>
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Kolom Kanan: Piutang Belum Lunas */}
                    <aside
                        aria-labelledby="dash-piutang-title"
                        className="rounded-[10px] border border-[#E3DED4] bg-white p-3.5 md:p-5"
                    >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h2 id="dash-piutang-title" className="text-base font-bold text-[#1E2420]">
                                Piutang Belum Lunas
                            </h2>
                            <Button asChild variant="ghost" size="sm">
                                <Link href={paymentsHref}>Semua Piutang</Link>
                            </Button>
                        </div>

                        {receivables.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[#858E87] bg-[#F1EDE6]/55 px-4 py-6 text-center">
                                <p className="text-sm font-bold text-[#1E2420]">
                                    Tidak ada tagihan piutang terbuka
                                </p>
                                <p className="mt-1 text-[13px] text-[#525B54]">
                                    Seluruh pesanan tercatat telah dilunasi.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {receivables.map((rec) => {
                                    const pMeta = getPaymentBadgeMeta(rec.payment_status);
                                    return (
                                        <div
                                            key={rec.id}
                                            className="flex flex-col gap-2.5 rounded-lg border border-[#E3DED4] bg-white px-3.5 py-3"
                                        >
                                            <div>
                                                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                                    <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                                    <OrderCodeBadge orderNumber={rec.order_number} />
                                                </div>
                                                <p className="text-[15px] font-bold text-[#1E2420]">
                                                    {rec.customer_name}
                                                </p>
                                                <p className="mt-0.5 text-[13px] text-[#525B54] tabular-nums">
                                                    Total {formatRupiah(rec.total_amount)} | Sisa:{' '}
                                                    <strong className="text-[#8C3B4A]">
                                                        {formatRupiah(rec.outstanding)}
                                                    </strong>
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() =>
                                                        setPaymentTarget({
                                                            id: rec.id,
                                                            order_number: rec.order_number,
                                                            customer_name: rec.customer_name,
                                                            outstanding: rec.outstanding,
                                                        })
                                                    }
                                                >
                                                    Catat Bayar
                                                </Button>
                                                <Button asChild variant="secondary" size="sm">
                                                    <Link href={`/ui-orders/${rec.id}`}>Detail</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </aside>
                </div>
            </div>

            <DeliveryConfirmModal
                open={deliverTarget !== null}
                target={deliverTarget}
                isSubmitting={submittingItemId !== null}
                onClose={() => setDeliverTarget(null)}
                onConfirm={() => {
                    if (deliverTarget) {
                        advanceStatus(
                            deliverTarget.orderId,
                            deliverTarget.itemId,
                            deliverTarget.nextStatus,
                        );
                    }
                }}
            />

            <PaymentModal
                open={paymentTarget !== null}
                order={paymentTarget}
                todayIso={fallbackTodayIso}
                returnTo="dashboard"
                onClose={() => setPaymentTarget(null)}
            />

            <Modal
                open={paymentPickerOpen}
                onClose={() => setPaymentPickerOpen(false)}
                title="Pilih Nota untuk Pembayaran"
                description="Pilih pesanan belum lunas yang ingin dicatat pembayarannya."
                footer={
                    <>
                        <Button asChild variant="secondary">
                            <Link href={paymentsHref}>Lihat Semua Piutang</Link>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPaymentPickerOpen(false)}
                        >
                            Tutup
                        </Button>
                    </>
                }
            >
                <div className="space-y-2.5">
                    {receivables.map((rec) => {
                        const pMeta = getPaymentBadgeMeta(rec.payment_status);
                        return (
                            <div
                                key={rec.id}
                                className="flex flex-col justify-between gap-2.5 rounded-lg border border-[#E3DED4] bg-[#FAF8F4]/70 p-3 sm:flex-row sm:items-center"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                        <OrderCodeBadge orderNumber={rec.order_number} />
                                    </div>
                                    <p className="mt-1 text-sm font-bold text-[#1E2420]">
                                        {rec.customer_name}
                                    </p>
                                    <p className="mt-0.5 text-xs text-[#525B54] tabular-nums">
                                        Total {formatRupiah(rec.total_amount)} | Sisa:{' '}
                                        <strong className="text-[#8C3B4A]">
                                            {formatRupiah(rec.outstanding)}
                                        </strong>
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => {
                                        setPaymentPickerOpen(false);
                                        setPaymentTarget({
                                            id: rec.id,
                                            order_number: rec.order_number,
                                            customer_name: rec.customer_name,
                                            outstanding: rec.outstanding,
                                        });
                                    }}
                                >
                                    Pilih Nota
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </AppLayout>
    );
}
