import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Archive,
    ArrowLeft,
    Calendar,
    Edit3,
    FileText,
    Phone,
    Plus,
    ShoppingBag,
    User,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { formatAmount, formatDateTimeWib, formatRupiah } from '@/lib/format';
import type { CustomerDetail, CustomerOrderHistoryItem } from '@/types';

type CustomerShowProps = {
    customer: CustomerDetail;
    orders?: CustomerOrderHistoryItem[];
};

export default function CustomersShow({ customer, orders = [] }: CustomerShowProps) {
    const [isArchiving, setIsArchiving] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    const handleArchive = () => {
        if (isArchiving) return;
        setIsArchiving(true);
        router.delete(`/ui-customers/${customer.id}`, {
            onFinish: () => {
                setIsArchiving(false);
                setConfirmModalOpen(false);
            },
        });
    };

    const orderColumns: DataColumn<CustomerOrderHistoryItem>[] = [
        {
            key: 'order_number',
            header: 'No. Pesanan',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => (
                <Link
                    href={`/ui-orders/${ord.id}`}
                    className="inline-flex min-h-[44px] items-center hover:underline"
                >
                    <OrderCodeBadge orderNumber={ord.order_number} />
                </Link>
            ),
        },
        {
            key: 'summary',
            header: 'Rangkaian & Tanggal',
            render: (ord) => (
                <div>
                    <p className="font-semibold text-[#1E2420]">
                        {ord.first_flower ?? `${formatAmount(ord.items_count)} item bunga`}
                    </p>
                    <p className="mt-0.5 text-xs text-[#525B54] tabular-nums">
                        Nota {ord.order_date ?? '-'}
                        {ord.earliest_delivery_date ? ` | Kirim ${ord.earliest_delivery_date}` : ''}
                    </p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Pengerjaan',
            render: (ord) => {
                const meta = getFulfillmentBadgeMeta(ord.status);
                return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
        },
        {
            key: 'payment_status',
            header: 'Pembayaran',
            render: (ord) => {
                const meta = getPaymentBadgeMeta(ord.payment_status);
                return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
        },
        {
            key: 'total_amount',
            header: 'Total',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-bold tabular-nums',
            render: (ord) => formatRupiah(ord.total_amount),
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => (
                <Button asChild variant="secondary" size="sm">
                    <Link href={`/ui-orders/${ord.id}`}>Detail</Link>
                </Button>
            ),
        },
    ];

    return (
        <AppLayout title="Detail Pelanggan">
            <Head title={`Pelanggan: ${customer.name}`} />

            <div className="mb-6">
                <Link
                    href="/ui-customers"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#143326] hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Semua pelanggan
                </Link>

                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#525B54]">
                            Profil Pelanggan
                        </p>
                        <h1 className="mt-1 break-words font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                            {customer.name}
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="secondary">
                            <Link href={`/ui-customers/${customer.id}/edit`}>
                                <Edit3 className="size-4" aria-hidden="true" />
                                Edit pelanggan
                            </Link>
                        </Button>
                        <Button asChild variant="primary">
                            <Link href={`/ui-orders/create?customer_id=${customer.id}`}>
                                <Plus className="size-4" aria-hidden="true" />
                                Buat Pesanan
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(290px,1fr)] lg:items-start">
                <div className="space-y-5">
                    <Card className="border-[#E3DED4] p-5">
                        <h2 className="text-base font-bold text-[#1E2420]">
                            Informasi pelanggan
                        </h2>
                        <dl className="mt-4 divide-y divide-[#E3DED4]">
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#525B54]">
                                    <User className="size-4 shrink-0" aria-hidden="true" />
                                    Nama
                                </dt>
                                <dd className="break-words text-sm font-semibold text-[#1E2420]">
                                    {customer.name}
                                </dd>
                            </div>
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#525B54]">
                                    <Phone className="size-4 shrink-0" aria-hidden="true" />
                                    Telepon
                                </dt>
                                <dd className="break-words font-[var(--font-mono)] text-sm text-[#1E2420] tabular-nums">
                                    {customer.phone || (
                                        <span className="font-sans italic text-[#525B54]">
                                            Belum diisi
                                        </span>
                                    )}
                                </dd>
                            </div>
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#525B54]">
                                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                                    Catatan
                                </dt>
                                <dd className="whitespace-pre-wrap break-words text-sm text-[#1E2420]">
                                    {customer.notes || (
                                        <span className="italic text-[#525B54]">
                                            Tidak ada catatan
                                        </span>
                                    )}
                                </dd>
                            </div>
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#525B54]">
                                    <Calendar className="size-4 shrink-0" aria-hidden="true" />
                                    Tanggal ditambahkan
                                </dt>
                                <dd className="text-sm text-[#1E2420] tabular-nums">
                                    {customer.created_at
                                        ? formatDateTimeWib(customer.created_at)
                                        : '-'}
                                </dd>
                            </div>
                        </dl>
                    </Card>

                    {/* Riwayat Pesanan Pelanggan */}
                    <Card className="overflow-hidden border-[#E3DED4]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3DED4] p-4 sm:px-5">
                            <div>
                                <h2 className="text-base font-bold text-[#1E2420]">
                                    Riwayat Pesanan Pelanggan
                                </h2>
                                <p className="mt-0.5 text-[13px] text-[#525B54]">
                                    Daftar nota pesanan yang terhubung dengan profil ini.
                                </p>
                            </div>
                            <Button asChild variant="secondary" size="sm">
                                <Link href={`/ui-orders/create?customer_id=${customer.id}`}>
                                    + Pesan lagi
                                </Link>
                            </Button>
                        </div>

                        <div className="p-3 lg:p-0">
                            <ResponsiveDataList
                                items={orders}
                                columns={orderColumns}
                                keyExtractor={(ord) => ord.id}
                                tableAriaLabel="Riwayat pesanan pelanggan"
                                renderMobileCard={(ord) => {
                                    const fMeta = getFulfillmentBadgeMeta(ord.status);
                                    const pMeta = getPaymentBadgeMeta(ord.payment_status);

                                    return (
                                        <article className="flex flex-col gap-3 rounded-lg border border-[#E3DED4] bg-white p-3.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <OrderCodeBadge orderNumber={ord.order_number} />
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge tone={fMeta.tone}>{fMeta.label}</Badge>
                                                    <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[15px] font-bold text-[#1E2420]">
                                                    {ord.first_flower ?? `${formatAmount(ord.items_count)} item bunga`}
                                                </p>
                                                <p className="mt-0.5 text-[13px] text-[#525B54] tabular-nums">
                                                    Nota {ord.order_date ?? '-'}
                                                    {ord.earliest_delivery_date ? ` | Kirim ${ord.earliest_delivery_date}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 border-t border-[#E3DED4] pt-2.5">
                                                <div className="tabular-nums">
                                                    <p className="text-sm font-bold text-[#1E2420]">
                                                        {formatRupiah(ord.total_amount)}
                                                    </p>
                                                    {ord.outstanding > 0 && (
                                                        <p className="text-xs font-semibold text-[#8C3B4A]">
                                                            Sisa {formatRupiah(ord.outstanding)}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button asChild variant="secondary" size="sm">
                                                    <Link href={`/ui-orders/${ord.id}`}>Detail Nota</Link>
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                }}
                                emptyState={
                                    <div className="px-6 py-10 text-center">
                                        <ShoppingBag
                                            className="mx-auto mb-2 size-8 text-[#525B54]/60"
                                            aria-hidden="true"
                                        />
                                        <p className="text-sm font-bold text-[#1E2420]">
                                            Belum ada pesanan tercatat
                                        </p>
                                        <p className="mt-1 text-[13px] text-[#525B54]">
                                            Mulai catat pesanan pertama langsung dari profil pelanggan ini.
                                        </p>
                                        <div className="mt-4">
                                            <Button asChild variant="primary" size="sm">
                                                <Link href={`/ui-orders/create?customer_id=${customer.id}`}>
                                                    + Buat Pesanan
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                }
                            />
                        </div>
                    </Card>
                </div>

                <aside className="space-y-5">
                    <Card className="border-[#E3DED4] p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-[#525B54]">Total pesanan</h2>
                            <ShoppingBag className="size-5 text-[#143326]" aria-hidden="true" />
                        </div>
                        <p className="mt-2 text-3xl font-bold text-[#143326] tabular-nums">
                            {formatAmount(customer.orders_count)}
                        </p>
                        <p className="mt-2 text-[13px] text-[#525B54]">
                            {customer.orders_count > 0
                                ? 'Pilih baris pesanan untuk melihat progres bunga dan catatan pembayaran.'
                                : 'Siap menerima pesanan pertama.'}
                        </p>
                    </Card>

                    <Card className="border-[#E3DED4] p-5">
                        <div className="flex items-center gap-2">
                            <Archive className="size-4 text-[#525B54]" aria-hidden="true" />
                            <h2 className="text-sm font-bold text-[#1E2420]">Arsip pelanggan</h2>
                        </div>

                        {customer.orders_count > 0 ? (
                            <div className="mt-3 rounded-md border border-[#92400E]/30 bg-[#FEF3C7] p-3.5 text-xs leading-relaxed text-[#92400E]">
                                <p className="font-bold">Tidak dapat diarsipkan</p>
                                <p className="mt-1">
                                    Pelanggan ini memiliki {formatAmount(customer.orders_count)} riwayat pesanan tercatat. Demi integritas audit pesanan dan tagihan, data tidak dapat diarsipkan.
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="mt-2 text-sm leading-relaxed text-[#525B54]">
                                    Arsip menyembunyikan pelanggan dari daftar dan pencarian. Data tidak dihapus permanen.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-4 w-full border-[#991B1B]/40 text-[#991B1B] hover:bg-[#FEE2E2]"
                                    onClick={() => setConfirmModalOpen(true)}
                                >
                                    <Archive className="size-4" aria-hidden="true" />
                                    Arsipkan pelanggan
                                </Button>
                            </>
                        )}
                    </Card>
                </aside>
            </div>

            <Modal
                open={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                isSubmitting={isArchiving}
                title="Arsipkan pelanggan?"
                description={`"${customer.name}" akan disembunyikan dari daftar aktif dan pencarian. Data tetap disimpan di database untuk audit.`}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={isArchiving}
                            onClick={() => setConfirmModalOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            disabled={isArchiving}
                            onClick={handleArchive}
                        >
                            {isArchiving ? 'Mengarsipkan...' : 'Ya, arsipkan'}
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-[#525B54]">
                    Pelanggan yang tidak memiliki pesanan dapat diarsipkan dengan aman. Anda tidak akan melihatnya lagi di daftar aktif.
                </p>
            </Modal>
        </AppLayout>
    );
}
