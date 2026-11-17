import { useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Archive,
    ArrowLeft,
    Calendar,
    Edit3,
    FileText,
    Loader2,
    Phone,
    ShoppingBag,
    User,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';
import type { CustomerDetail } from '@/types';

type CustomerShowProps = {
    customer: CustomerDetail;
};

export default function CustomersShow({ customer }: CustomerShowProps) {
    const [isArchiving, setIsArchiving] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!confirmModalOpen) return;

        // Auto-focus cancel button for safe keyboard accessibility
        cancelButtonRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isArchiving) {
                setConfirmModalOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [confirmModalOpen, isArchiving]);

    const handleArchive = () => {
        setIsArchiving(true);
        router.delete(`/ui-customers/${customer.id}`, {
            onFinish: () => {
                setIsArchiving(false);
                setConfirmModalOpen(false);
            },
        });
    };

    return (
        <AppLayout title="Detail Pelanggan">
            <Head title={`Pelanggan: ${customer.name}`} />

            <div className="mb-8">
                <Link
                    href="/ui-customers"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Semua pelanggan
                </Link>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                            Detail pelanggan
                        </p>
                        <h1 className="break-words text-3xl font-semibold tracking-tight text-emerald-950">
                            {customer.name}
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={`/ui-customers/${customer.id}/edit`}
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#143326] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0E251B]"
                        >
                            <Edit3 className="size-4" aria-hidden="true" />
                            Edit pelanggan
                        </Link>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                {/* Informasi utama */}
                <Card className="p-6">
                    <h2 className="text-base font-semibold text-stone-900">
                        Informasi pelanggan
                    </h2>
                    <dl className="mt-5 divide-y divide-stone-100">
                        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-stone-500">
                                <User className="size-4 text-stone-400" aria-hidden="true" />
                                Nama
                            </dt>
                            <dd className="break-words text-sm font-medium text-stone-900">
                                {customer.name}
                            </dd>
                        </div>
                        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-stone-500">
                                <Phone className="size-4 text-stone-400" aria-hidden="true" />
                                Telepon
                            </dt>
                            <dd className="break-words text-sm text-stone-900">
                                {customer.phone || (
                                    <span className="italic text-stone-400">Belum diisi</span>
                                )}
                            </dd>
                        </div>
                        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-stone-500">
                                <FileText className="size-4 text-stone-400" aria-hidden="true" />
                                Catatan
                            </dt>
                            <dd className="whitespace-pre-wrap break-words text-sm text-stone-900">
                                {customer.notes || (
                                    <span className="italic text-stone-400">Tidak ada catatan</span>
                                )}
                            </dd>
                        </div>
                        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                            <dt className="flex items-center gap-2 text-sm text-stone-500">
                                <Calendar className="size-4 text-stone-400" aria-hidden="true" />
                                Tanggal ditambahkan
                            </dt>
                            <dd className="text-sm text-stone-900">
                                {customer.created_at ? `${customer.created_at} WIB` : '—'}
                            </dd>
                        </div>
                    </dl>
                </Card>

                {/* Kolom samping: pesanan & arsip */}
                <aside className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-medium text-stone-500">Total pesanan</h2>
                            <ShoppingBag className="size-5 text-emerald-900" aria-hidden="true" />
                        </div>
                        <p className="mt-3 text-3xl font-semibold text-emerald-950">
                            {formatAmount(customer.orders_count)}
                        </p>
                        <p className="mt-3 text-xs leading-5 text-stone-500">
                            Riwayat pesanan akan dapat dibuka setelah modul Pesanan tersedia.
                        </p>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center gap-2">
                            <Archive className="size-4 text-stone-500" aria-hidden="true" />
                            <h2 className="text-sm font-semibold text-stone-800">
                                Arsip pelanggan
                            </h2>
                        </div>

                        {customer.orders_count > 0 ? (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs leading-relaxed text-amber-900">
                                <p className="font-semibold">Tidak dapat diarsipkan</p>
                                <p className="mt-1">
                                    Pelanggan ini memiliki {customer.orders_count} riwayat pesanan tercatat. Demi integritas audit pesanan dan tagihan, data tidak dapat diarsipkan.
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="mt-2 text-sm leading-6 text-stone-500">
                                    Arsip menyembunyikan pelanggan dari daftar dan pencarian. Data tidak dihapus permanen.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setConfirmModalOpen(true)}
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                >
                                    <Archive className="size-4" aria-hidden="true" />
                                    Arsipkan pelanggan
                                </button>
                            </>
                        )}
                    </Card>
                </aside>
            </div>

            {/* Modal konfirmasi arsip */}
            {confirmModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    <div
                        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
                        onClick={() => !isArchiving && setConfirmModalOpen(false)}
                    />
                    <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
                        <div className="flex items-start gap-4">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                                <AlertTriangle className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <h3 id="modal-title" className="text-base font-semibold text-stone-900">
                                    Arsipkan pelanggan?
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-stone-500">
                                    Pelanggan <span className="font-semibold text-stone-800">{customer.name}</span> akan disembunyikan dari daftar aktif. Data riwayat tetap tersimpan di database dan tidak dihapus permanen.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                ref={cancelButtonRef}
                                type="button"
                                disabled={isArchiving}
                                onClick={() => setConfirmModalOpen(false)}
                                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                disabled={isArchiving}
                                onClick={handleArchive}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                                {isArchiving && (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                )}
                                Ya, arsipkan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
