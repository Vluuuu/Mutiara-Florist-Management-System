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
import { OrderCodeBadge } from '@/components/order-code-badge';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { DetailPageSkeleton } from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatDateTimeWib, formatRupiah } from '@/lib/format';
import type { CustomerDetail, CustomerOrderHistoryItem } from '@/types';

type CustomerShowProps = {
    customer?: CustomerDetail;
    orders?: CustomerOrderHistoryItem[];
};

export default function CustomersShow({ customer, orders = [] }: CustomerShowProps) {
    useInstantPageGuard(Boolean(customer));
    const [isArchiving, setIsArchiving] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    if (!customer) {
        return (
            <>
                <Head title="Detail Pelanggan" />
                <DetailPageSkeleton />
            </>
        );
    }

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
                    component="Orders/Show"
                    prefetch="hover"
                    cacheFor="10s"
                    cacheTags={['orders']}
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
                    <p className="font-semibold text-[#1C211E]">
                        {ord.first_flower ?? `${formatAmount(ord.items_count)} item bunga`}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                        Nota {ord.order_date ?? '-'}
                        {ord.earliest_delivery_date ? ` · Kirim ${ord.earliest_delivery_date}` : ''}
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
                    <Link
                        href={`/ui-orders/${ord.id}`}
                        component="Orders/Show"
                        prefetch="hover"
                        cacheFor="10s"
                        cacheTags={['orders']}
                    >
                        Detail
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <>
            <Head title={`Pelanggan: ${customer.name}`} />

            <div className="mb-7 border-b border-[#DED6C8] pb-5">
                <Link
                    href="/ui-customers"
                    component="Customers/Index"
                    prefetch="hover"
                    cacheFor="10s"
                    cacheTags={['customers']}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#1D3B2A] hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Semua pelanggan
                </Link>

                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                        <h1 className="atelier-h1 break-words">
                            {customer.name}
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button asChild variant="secondary" className="min-w-[156px]">
                            <Link
                                href={`/ui-customers/${customer.id}/edit`}
                                component="Customers/Edit"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['customers']}
                            >
                                <Edit3 className="size-4" aria-hidden="true" />
                                Edit pelanggan
                            </Link>
                        </Button>
                        <Button asChild variant="primary" className="min-w-[156px]">
                            <Link
                                href={`/ui-orders/create?customer_id=${customer.id}`}
                                component="Orders/Create"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['customers', 'orders']}
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                Buat Pesanan
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(290px,1fr)] lg:items-start">
                <div className="space-y-6">
                    <Card className="p-5 sm:p-6">
                        <h2 className="atelier-h2">
                            Informasi pelanggan
                        </h2>
                        <dl className="mt-4 divide-y divide-[#DED6C8]">
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#545852]">
                                    <User className="size-4 shrink-0" aria-hidden="true" />
                                    Nama
                                </dt>
                                <dd className="break-words text-[15px] font-semibold text-[#1C211E]">
                                    {customer.name}
                                </dd>
                            </div>
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#545852]">
                                    <Phone className="size-4 shrink-0" aria-hidden="true" />
                                    Telepon
                                </dt>
                                <dd className="break-words font-[var(--font-mono)] text-[15px] text-[#1C211E] tabular-nums">
                                    {customer.phone || (
                                        <span className="font-sans italic text-[#545852]">
                                            Belum diisi
                                        </span>
                                    )}
                                </dd>
                            </div>
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#545852]">
                                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                                    Catatan
                                </dt>
                                <dd className="whitespace-pre-wrap break-words text-[15px] text-[#1C211E]">
                                    {customer.notes || (
                                        <span className="italic text-[#545852]">
                                            Tidak ada catatan
                                        </span>
                                    )}
                                </dd>
                            </div>
                            <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                                <dt className="flex items-center gap-2 text-sm text-[#545852]">
                                    <Calendar className="size-4 shrink-0" aria-hidden="true" />
                                    Tanggal ditambahkan
                                </dt>
                                <dd className="text-[15px] text-[#1C211E] tabular-nums">
                                    {customer.created_at
                                        ? formatDateTimeWib(customer.created_at)
                                        : '-'}
                                </dd>
                            </div>
                        </dl>
                    </Card>

                    {/* Riwayat Pesanan Pelanggan */}
                    <Card className="overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED6C8] bg-[#EFE9DE]/45 px-5 py-4">
                            <h2 className="atelier-h2">
                                Riwayat Pesanan Pelanggan
                            </h2>
                            <Button asChild variant="secondary" size="sm" className="min-w-[124px]">
                                <Link
                                    href={`/ui-orders/create?customer_id=${customer.id}`}
                                    component="Orders/Create"
                                    prefetch="hover"
                                    cacheFor="10s"
                                    cacheTags={['customers', 'orders']}
                                >
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
                                        <article className="atelier-sheet flex flex-col gap-3 p-3.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <OrderCodeBadge orderNumber={ord.order_number} />
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge tone={fMeta.tone}>{fMeta.label}</Badge>
                                                    <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[15px] font-bold text-[#1C211E]">
                                                    {ord.first_flower ?? `${formatAmount(ord.items_count)} item bunga`}
                                                </p>
                                                <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                                                    Nota {ord.order_date ?? '-'}
                                                    {ord.earliest_delivery_date ? ` | Kirim ${ord.earliest_delivery_date}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 border-t border-[#DED6C8] pt-3">
                                                <div className="tabular-nums">
                                                    <p className="text-base font-bold text-[#1C211E]">
                                                        {formatRupiah(ord.total_amount)}
                                                    </p>
                                                    {ord.outstanding > 0 && (
                                                        <p className="text-[13px] font-semibold text-[#9A3B22]">
                                                            Sisa {formatRupiah(ord.outstanding)}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button asChild variant="secondary" className="min-w-[120px]">
                                                    <Link
                                                        href={`/ui-orders/${ord.id}`}
                                                        component="Orders/Show"
                                                        prefetch="hover"
                                                        cacheFor="10s"
                                                        cacheTags={['orders']}
                                                    >
                                                        Detail Nota
                                                    </Link>
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                }}
                                emptyState={
                                    <div className="px-6 py-10 text-center">
                                        <ShoppingBag
                                            className="mx-auto mb-2 size-8 text-[#545852]"
                                            aria-hidden="true"
                                        />
                                        <p className="text-sm font-bold text-[#1C211E]">
                                            Belum ada pesanan tercatat
                                        </p>
                                        <p className="mt-1 text-[13px] text-[#545852]">
                                            Mulai catat pesanan pertama langsung dari profil pelanggan ini.
                                        </p>
                                        <div className="mt-4">
                                            <Button asChild variant="primary" size="sm">
                                                <Link
                                                    href={`/ui-orders/create?customer_id=${customer.id}`}
                                                    component="Orders/Create"
                                                    prefetch="hover"
                                                    cacheFor="10s"
                                                    cacheTags={['customers', 'orders']}
                                                >
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
                    <Card className="bg-[#EFE9DE]/70 p-5">
                        <h2 className="text-sm font-semibold text-[#545852]">Total pesanan</h2>
                        <p className="mt-2 text-3xl font-bold text-[#1D3B2A] tabular-nums">
                            {formatAmount(customer.orders_count)}
                        </p>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center gap-2">
                            <Archive className="size-4 text-[#545852]" aria-hidden="true" />
                            <h2 className="text-sm font-bold text-[#1C211E]">Arsip pelanggan</h2>
                        </div>

                        {customer.orders_count > 0 ? (
                            <div className="mt-3 rounded-[8px] border border-[#DFC393] bg-[#FAF1E1] p-4 text-[13px] leading-relaxed text-[#6E3D09]">
                                <p className="font-bold">Tidak dapat diarsipkan</p>
                                <p className="mt-1">
                                    Pelanggan ini memiliki {formatAmount(customer.orders_count)} riwayat pesanan tercatat.
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="mt-2 text-sm leading-relaxed text-[#545852]">
                                    Arsip menyembunyikan pelanggan dari daftar aktif tanpa menghapus data audit.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-4 w-full border-[#E5B5AC] text-[#8A2619] hover:bg-[#FAE5E1]"
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
                <p className="text-sm text-[#545852]">
                    Pelanggan yang tidak memiliki pesanan dapat diarsipkan dengan aman. Anda tidak akan melihatnya lagi di daftar aktif.
                </p>
            </Modal>
        </>
    );
}
