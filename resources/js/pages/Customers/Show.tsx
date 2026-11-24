import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Archive,
    Calendar,
    Edit3,
    FileText,
    Phone,
    Plus,
    ShoppingBag,
    User,
} from 'lucide-react';
import { OrderCodeBadge } from '@/components/order-code-badge';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Badge, getFulfillmentBadgeMeta, getPaymentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
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
                    <OrderCodeBadge orderNumber={ord.order_number} compact />
                </Link>
            ),
        },
        {
            key: 'summary',
            header: 'Rangkaian & Tanggal',
            render: (ord) => (
                <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                        {ord.first_flower ?? `${formatAmount(ord.items_count)} item bunga`}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                        Nota {ord.order_date ?? '-'}
                        {ord.earliest_delivery_date ? ` · Kirim ${ord.earliest_delivery_date}` : ''}
                    </p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Pengerjaan',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => {
                const meta = getFulfillmentBadgeMeta(ord.status);
                return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
        },
        {
            key: 'payment_status',
            header: 'Pembayaran',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => {
                const meta = getPaymentBadgeMeta(ord.payment_status);
                return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
        },
        {
            key: 'total_amount',
            header: 'Total',
            align: 'right',
            cellClassName: 'whitespace-nowrap tabular-nums',
            render: (ord) => (
                <div>
                    <p className="font-bold text-[var(--text-primary)]">
                        {formatRupiah(ord.total_amount)}
                    </p>
                    {ord.outstanding > 0 && (
                        <p className="mt-0.5 text-[13px] font-semibold text-[var(--brand-urgent)]">
                            Sisa {formatRupiah(ord.outstanding)}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (ord) => (
                <Button asChild variant="subtle" size="sm" className="min-w-[88px]">
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

            <PageHeader
                title={customer.name}
                backLink={{
                    href: '/ui-customers',
                    label: 'Semua pelanggan',
                    component: 'Customers/Index',
                    cacheTags: ['customers'],
                }}
                actions={
                    <>
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
                        <Button asChild variant="primary" className="min-w-[172px]">
                            <Link
                                href={`/ui-orders/create?customer_id=${customer.id}`}
                                component="Orders/Create"
                                prefetch="hover"
                                cacheFor="10s"
                                cacheTags={['customers', 'orders']}
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                Pesan untuk Pelanggan
                            </Link>
                        </Button>
                    </>
                }
            />

            {/* Profil Pelanggan & Ringkasan */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(290px,1fr)] lg:items-start">
                <Card className="p-5 sm:p-6">
                    <h2 className="atelier-h2">Informasi pelanggan</h2>
                    <dl className="mt-4 divide-y divide-[var(--border-hairline)]">
                        <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                <User className="size-4 shrink-0" aria-hidden="true" />
                                Nama
                            </dt>
                            <dd className="break-words text-[15px] font-semibold text-[var(--text-primary)]">
                                {customer.name}
                            </dd>
                        </div>
                        <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                <Phone className="size-4 shrink-0" aria-hidden="true" />
                                Telepon
                            </dt>
                            <dd className="break-words font-[var(--font-mono)] text-[15px] text-[var(--text-primary)] tabular-nums">
                                {customer.phone || (
                                    <span className="font-sans italic text-[var(--text-secondary)]">
                                        Belum diisi
                                    </span>
                                )}
                            </dd>
                        </div>
                        <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                <FileText className="size-4 shrink-0" aria-hidden="true" />
                                Catatan
                            </dt>
                            <dd className="whitespace-pre-wrap break-words text-[15px] text-[var(--text-primary)]">
                                {customer.notes || (
                                    <span className="italic text-[var(--text-secondary)]">
                                        Tidak ada catatan
                                    </span>
                                )}
                            </dd>
                        </div>
                        <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                <Calendar className="size-4 shrink-0" aria-hidden="true" />
                                Tanggal ditambahkan
                            </dt>
                            <dd className="text-[15px] text-[var(--text-primary)] tabular-nums">
                                {customer.created_at
                                    ? formatDateTimeWib(customer.created_at)
                                    : '-'}
                            </dd>
                        </div>
                    </dl>
                </Card>

                <aside className="space-y-5">
                    <Card className="bg-[var(--bg-sunken)]/70 p-5">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
                                Total pesanan
                            </h2>
                            <span
                                aria-hidden="true"
                                className="inline-flex size-8 items-center justify-center rounded-[8px] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"
                            >
                                <ShoppingBag className="size-4" />
                            </span>
                        </div>
                        <p className="mt-2 text-3xl font-bold text-[var(--brand-primary)] tabular-nums">
                            {formatAmount(customer.orders_count)}
                        </p>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center gap-2">
                            <Archive className="size-4 text-[var(--text-secondary)]" aria-hidden="true" />
                            <h2 className="text-sm font-bold text-[var(--text-primary)]">
                                Arsip pelanggan
                            </h2>
                        </div>

                        {customer.orders_count > 0 ? (
                            <AlertBanner
                                tone="warning"
                                title="Tidak dapat diarsipkan"
                                className="mt-3 p-3.5 text-[13px]"
                            >
                                Pelanggan ini memiliki {formatAmount(customer.orders_count)} riwayat
                                pesanan tercatat.
                            </AlertBanner>
                        ) : (
                            <>
                                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                                    Arsip menyembunyikan pelanggan dari daftar aktif tanpa menghapus
                                    data audit.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-4 w-full border-[var(--status-danger-border)] text-[var(--danger-ink)] hover:bg-[var(--status-danger-bg)]"
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

            {/* Riwayat Pesanan Pelanggan (Full-Width untuk mencegah clipping kolom Aksi di 1366px/1440px) */}
            <section aria-labelledby="customer-orders-heading" className="mt-6">
                <Card className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 px-5 py-4 sm:px-6">
                        <div>
                            <h2 id="customer-orders-heading" className="atelier-h2">
                                Riwayat Pesanan Pelanggan
                            </h2>
                            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                                {formatAmount(orders.length)} catatan pesanan terkait
                            </p>
                        </div>
                    </div>

                    <div className="p-4 lg:p-0">
                        <ResponsiveDataList
                            items={orders}
                            columns={orderColumns}
                            keyExtractor={(ord) => ord.id}
                            tabletColumns={2}
                            tableAriaLabel="Riwayat pesanan pelanggan"
                            renderMobileCard={(ord) => {
                                const fMeta = getFulfillmentBadgeMeta(ord.status);
                                const pMeta = getPaymentBadgeMeta(ord.payment_status);

                                return (
                                    <article className="atelier-sheet flex flex-col gap-3 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <OrderCodeBadge orderNumber={ord.order_number} compact />
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <Badge tone={fMeta.tone}>{fMeta.label}</Badge>
                                                <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[15px] font-bold text-[var(--text-primary)]">
                                                {ord.first_flower ?? `${formatAmount(ord.items_count)} item bunga`}
                                            </p>
                                            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
                                                Nota {ord.order_date ?? '-'}
                                                {ord.earliest_delivery_date
                                                    ? ` · Kirim ${ord.earliest_delivery_date}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
                                            <div className="tabular-nums">
                                                <p className="text-base font-bold text-[var(--text-primary)]">
                                                    {formatRupiah(ord.total_amount)}
                                                </p>
                                                {ord.outstanding > 0 && (
                                                    <p className="text-[13px] font-semibold text-[var(--brand-urgent)]">
                                                        Sisa {formatRupiah(ord.outstanding)}
                                                    </p>
                                                )}
                                            </div>
                                            <Button asChild variant="subtle" className="min-w-[112px]">
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
                                <EmptyState
                                    icon={ShoppingBag}
                                    headingLevel="h3"
                                    title="Belum ada pesanan tercatat"
                                    description="Mulai catat pesanan pertama langsung dari profil pelanggan ini."
                                    action={
                                        <Button asChild variant="primary">
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
                                    }
                                />
                            }
                        />
                    </div>
                </Card>
            </section>

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
                <p className="text-sm text-[var(--text-secondary)]">
                    Pelanggan yang tidak memiliki pesanan dapat diarsipkan dengan aman. Anda tidak akan
                    melihatnya lagi di daftar aktif.
                </p>
            </Modal>
        </>
    );
}
