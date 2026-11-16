import { useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    DollarSign,
    Flower2,
    Info,
    Plus,
    Trash2,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';
import type {
    AppPageProps,
    FulfillmentStatus,
    OrderCustomerOption,
    OrderEditData,
    OrderFormItem,
} from '@/types';

type OrdersEditProps = {
    order: OrderEditData;
    customers: OrderCustomerOption[];
};

const FULFILLMENT_STEPS: Array<{ value: FulfillmentStatus; label: string }> = [
    { value: 'NEW', label: 'Baru' },
    { value: 'PROCESSING', label: 'Diproses' },
    { value: 'READY', label: 'Siap kirim' },
    { value: 'DELIVERED', label: 'Terkirim' },
];

function getAllowedStatuses(initialStatus: FulfillmentStatus) {
    const idx = Math.max(
        0,
        FULFILLMENT_STEPS.findIndex((s) => s.value === initialStatus),
    );
    return FULFILLMENT_STEPS.slice(idx, Math.min(idx + 2, FULFILLMENT_STEPS.length));
}

let editKeyCounter = 1000;

export default function OrdersEdit({ order, customers }: OrdersEditProps) {
    const { errors } = usePage<AppPageProps>().props;

    const [customerId, setCustomerId] = useState<number>(order.customer_id);
    const [orderDate, setOrderDate] = useState<string>(order.order_date);
    const [notes, setNotes] = useState<string>(order.notes ?? '');
    const [changeReason, setChangeReason] = useState<string>('');

    const [items, setItems] = useState<OrderFormItem[]>(
        order.items.map((item) => ({
            _key: editKeyCounter++,
            id: item.id,
            flower_type: item.flower_type,
            recipient: item.recipient,
            sender_name: item.sender_name,
            delivery_date: item.delivery_date,
            delivery_location: item.delivery_location,
            quantity: item.quantity,
            unit_price: item.unit_price,
            shipping_mode: item.shipping_mode,
            shipping_fee: item.shipping_fee,
            fulfillment_status: item.fulfillment_status,
            _initialStatus: item.fulfillment_status,
            notes: item.notes ?? '',
        })),
    );

    const [isSubmitting, setIsSubmitting] = useState(false);

    const hasPayments = order.received > 0;

    const handleAddItem = () => {
        if (items.length >= 20) return;
        setItems([
            ...items,
            {
                _key: editKeyCounter++,
                id: null,
                flower_type: '',
                recipient: '',
                sender_name: '',
                delivery_date: orderDate,
                delivery_location: '',
                quantity: 1,
                unit_price: 0,
                shipping_mode: 'INCLUDED',
                shipping_fee: 0,
                fulfillment_status: 'NEW',
                _initialStatus: 'NEW',
                notes: '',
            },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        const item = items[index];
        // Cannot remove processed items
        if (item.id && item._initialStatus !== 'NEW') {
            return;
        }
        if (items.length <= 1) return;
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleItemChange = <K extends keyof OrderFormItem>(
        index: number,
        field: K,
        value: OrderFormItem[K],
    ) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'shipping_mode' && value === 'INCLUDED') {
            newItems[index].shipping_fee = 0;
        }

        setItems(newItems);
    };

    // Live calculation
    const productTotal = items.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0,
    );
    const shippingTotal = items.reduce(
        (sum, item) =>
            sum + (item.shipping_mode === 'SEPARATE' ? Number(item.shipping_fee) || 0 : 0),
        0,
    );
    const grandTotal = productTotal + shippingTotal;
    const belowReceived = hasPayments && grandTotal < order.received;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            customer_id: customerId,
            order_date: orderDate,
            notes: notes || null,
            change_reason: changeReason || null,
            items: items.map((item) => ({
                id: item.id || undefined,
                flower_type: item.flower_type,
                recipient: item.recipient,
                sender_name: item.sender_name,
                delivery_date: item.delivery_date,
                delivery_location: item.delivery_location,
                quantity: Number(item.quantity) || 1,
                unit_price: Number(item.unit_price) || 0,
                shipping_mode: item.shipping_mode,
                shipping_fee:
                    item.shipping_mode === 'SEPARATE' ? Number(item.shipping_fee) || 0 : 0,
                fulfillment_status: item.fulfillment_status ?? 'NEW',
                notes: item.notes || null,
            })),
        };

        router.put(`/ui-orders/${order.id}`, payload, {
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <AppLayout title={`Edit Pesanan ${order.order_number}`}>
            <Head title={`Edit Pesanan ${order.order_number}`} />

            <div className="mb-7">
                <Link
                    href={`/ui-orders/${order.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-800 hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Kembali ke detail pesanan
                </Link>
                <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Edit pesanan
                    </p>
                    <h1 className="break-all text-2xl font-semibold tracking-tight text-emerald-950 sm:text-3xl">
                        {order.order_number}
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Perbarui rincian pesanan, jadwal pengerjaan, atau status pengiriman bunga.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
                {errors && Object.keys(errors).length > 0 && (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
                    >
                        <p className="font-semibold">Ada kesalahan yang perlu diperbaiki:</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                            {Object.entries(errors).map(([key, msg]) => (
                                <li key={key}>{msg}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {hasPayments && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                        <div className="flex items-start gap-2.5">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                            <div>
                                <p className="font-semibold">
                                    Pesanan ini telah menerima pembayaran sebesar Rp
                                    {formatAmount(order.received)}
                                </p>
                                <p className="mt-1 text-stone-600">
                                    Pelanggan tidak dapat diganti. Total tagihan baru tidak boleh lebih kecil dari uang yang sudah diterima (Rp{formatAmount(order.received)}). Jika mengubah harga atau menambah/menghapus item, alasan perubahan wajib diisi.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Informasi Utama */}
                <Card className="p-5 sm:p-7">
                    <h2 className="text-base font-semibold text-emerald-950">
                        Informasi Pemesan & Tanggal
                    </h2>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="customer_id"
                                className="mb-1.5 block text-sm font-medium text-stone-800"
                            >
                                Pelanggan <span className="text-red-700">*</span>
                            </label>
                            <select
                                id="customer_id"
                                name="customer_id"
                                value={customerId}
                                disabled={hasPayments}
                                onChange={(e) => setCustomerId(Number(e.target.value))}
                                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:bg-stone-100 disabled:text-stone-500"
                            >
                                {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.phone ? `(${c.phone})` : ''}
                                    </option>
                                ))}
                            </select>
                            {hasPayments && (
                                <p className="mt-1 text-xs text-stone-500">
                                    Terkunci karena pembayaran sudah tercatat.
                                </p>
                            )}
                            {errors?.customer_id && (
                                <p className="mt-1 text-xs text-red-700">{errors.customer_id}</p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor="order_date"
                                className="mb-1.5 block text-sm font-medium text-stone-800"
                            >
                                Tanggal pemesanan <span className="text-red-700">*</span>
                            </label>
                            <input
                                id="order_date"
                                name="order_date"
                                type="date"
                                value={orderDate}
                                onChange={(e) => setOrderDate(e.target.value)}
                                required
                                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                            />
                            {errors?.order_date && (
                                <p className="mt-1 text-xs text-red-700">{errors.order_date}</p>
                            )}
                        </div>
                    </div>

                    <div className="mt-5">
                        <label
                            htmlFor="notes"
                            className="mb-1.5 block text-sm font-medium text-stone-800"
                        >
                            Catatan pesanan (opsional)
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            rows={2}
                            maxLength={2000}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                        />
                        {errors?.notes && (
                            <p className="mt-1 text-xs text-red-700">{errors.notes}</p>
                        )}
                    </div>
                </Card>

                {/* Baris Rincian Bunga */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-emerald-950">
                            Rincian Bunga dan Pengiriman
                        </h2>
                        <p className="mt-1 text-xs text-stone-500">
                            Bunga yang sudah berstatus Diproses, Siap, atau Terkirim tidak dapat dihapus.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={items.length >= 20}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Plus className="size-3.5" />
                        Tambah bunga ({items.length}/20)
                    </button>
                </div>

                <div className="space-y-4">
                    {items.map((item, index) => {
                        const isProcessed = Boolean(item.id && item._initialStatus !== 'NEW');
                        const allowedStatuses = getAllowedStatuses(item._initialStatus ?? 'NEW');
                        const subtotal =
                            (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) +
                            (item.shipping_mode === 'SEPARATE'
                                ? Number(item.shipping_fee) || 0
                                : 0);

                        return (
                            <Card key={item._key} className="p-5 sm:p-7">
                                <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-900">
                                            {index + 1}
                                        </span>
                                        <h3 className="font-semibold text-stone-900">
                                            Bunga {index + 1}
                                            {item.id ? ` · ID #${item.id}` : ' · Baru'}
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={items.length <= 1 || isProcessed}
                                        onClick={() => handleRemoveItem(index)}
                                        title={
                                            isProcessed
                                                ? 'Item yang sudah diproses tidak bisa dihapus'
                                                : 'Hapus bunga'
                                        }
                                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:text-stone-300 disabled:no-underline"
                                    >
                                        <Trash2 className="size-3.5" />
                                        Hapus bunga
                                    </button>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Jenis bunga <span className="text-red-700">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={255}
                                            value={item.flower_type}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'flower_type',
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                        {errors?.[`items.${index}.flower_type`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.flower_type`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Tanggal kirim <span className="text-red-700">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={item.delivery_date}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'delivery_date',
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                        {errors?.[`items.${index}.delivery_date`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.delivery_date`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Untuk / penerima <span className="text-red-700">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={255}
                                            value={item.recipient}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'recipient',
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                        {errors?.[`items.${index}.recipient`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.recipient`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Dari / pengirim ucapan <span className="text-red-700">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={255}
                                            value={item.sender_name}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'sender_name',
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                        {errors?.[`items.${index}.sender_name`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.sender_name`]}
                                            </p>
                                        )}
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Lokasi pengiriman <span className="text-red-700">*</span>
                                        </label>
                                        <textarea
                                            required
                                            rows={2}
                                            maxLength={1000}
                                            value={item.delivery_location}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'delivery_location',
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                        {errors?.[`items.${index}.delivery_location`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.delivery_location`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Kuantitas (buah) <span className="text-red-700">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10000}
                                            step={1}
                                            required
                                            value={item.quantity}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'quantity',
                                                    Math.max(1, Number(e.target.value) || 1),
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                        {errors?.[`items.${index}.quantity`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.quantity`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Harga satuan (Rp) <span className="text-red-700">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={1000000000}
                                            step={1}
                                            required
                                            value={item.unit_price}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'unit_price',
                                                    Math.max(0, Number(e.target.value) || 0),
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                        {errors?.[`items.${index}.unit_price`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.unit_price`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Mode ongkos kirim <span className="text-red-700">*</span>
                                        </label>
                                        <select
                                            value={item.shipping_mode}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'shipping_mode',
                                                    e.target.value as 'INCLUDED' | 'SEPARATE',
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        >
                                            <option value="INCLUDED">
                                                Sudah termasuk harga bunga (Rp0)
                                            </option>
                                            <option value="SEPARATE">
                                                Ditagih terpisah per pengiriman
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Tambahan ongkir (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={1000000000}
                                            step={1}
                                            readOnly={item.shipping_mode === 'INCLUDED'}
                                            value={item.shipping_fee}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'shipping_fee',
                                                    Math.max(0, Number(e.target.value) || 0),
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 read-only:bg-stone-100 read-only:text-stone-500"
                                        />
                                        {errors?.[`items.${index}.shipping_fee`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.shipping_fee`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Status pengerjaan bunga
                                        </label>
                                        <select
                                            value={item.fulfillment_status ?? 'NEW'}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    'fulfillment_status',
                                                    e.target.value as FulfillmentStatus,
                                                )
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        >
                                            {allowedStatuses.map((step) => (
                                                <option key={step.value} value={step.value}>
                                                    {step.label}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-xs text-stone-400">
                                            Status hanya dapat tetap atau maju 1 tahap.
                                        </p>
                                        {errors?.[`items.${index}.fulfillment_status`] && (
                                            <p className="mt-1 text-xs text-red-700">
                                                {errors[`items.${index}.fulfillment_status`]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-stone-700">
                                            Catatan khusus bunga (opsional)
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={2000}
                                            value={item.notes}
                                            onChange={(e) =>
                                                handleItemChange(index, 'notes', e.target.value)
                                            }
                                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-between rounded-lg bg-stone-50 px-4 py-2.5 text-xs">
                                    <span className="text-stone-500">
                                        Bunga ({item.quantity} × Rp
                                        {formatAmount(Number(item.unit_price) || 0)}) + Ongkir (
                                        Rp
                                        {formatAmount(
                                            item.shipping_mode === 'SEPARATE'
                                                ? Number(item.shipping_fee) || 0
                                                : 0,
                                        )}
                                        )
                                    </span>
                                    <span className="font-semibold text-emerald-950">
                                        Subtotal: Rp{formatAmount(subtotal)}
                                    </span>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Alasan Perubahan (Wajib jika ada pembayaran) */}
                <Card className="p-5 sm:p-7">
                    <label
                        htmlFor="change_reason"
                        className="mb-1.5 block text-sm font-semibold text-stone-800"
                    >
                        Alasan perubahan {hasPayments ? '(Wajib diisi jika harga berubah)' : '(Opsional)'}
                    </label>
                    <textarea
                        id="change_reason"
                        name="change_reason"
                        rows={2}
                        maxLength={500}
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Contoh: Pelanggan meminta penambahan item atau perubahan jenis bunga"
                        className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                    />
                    <p className="mt-2 text-xs text-stone-500">
                        {hasPayments
                            ? 'Karena pesanan telah memiliki pembayaran, alasan perubahan dicatat ke dalam audit log jika susunan finansial berubah.'
                            : 'Catatan alasan jika ada perubahan penting pada pesanan.'}
                    </p>
                    {errors?.change_reason && (
                        <p className="mt-1 text-xs text-red-700">{errors.change_reason}</p>
                    )}
                </Card>

                {/* Ringkasan Estimasi Tagihan */}
                <Card className="p-5 sm:p-7">
                    <h2 className="text-base font-semibold text-emerald-950">
                        Ringkasan Estimasi Tagihan
                    </h2>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-4 text-stone-600">
                            <dt>Total nilai bunga ({items.length} item)</dt>
                            <dd className="font-medium text-stone-900">
                                Rp{formatAmount(productTotal)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-4 text-stone-600">
                            <dt>Total ongkos kirim terpisah</dt>
                            <dd className="font-medium text-stone-900">
                                Rp{formatAmount(shippingTotal)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-stone-200 pt-3 text-lg font-semibold text-emerald-950">
                            <dt>Total tagihan baru</dt>
                            <dd>Rp{formatAmount(grandTotal)}</dd>
                        </div>
                        {hasPayments && (
                            <div className="flex justify-between gap-4 text-xs text-stone-500">
                                <dt>Pembayaran sudah diterima</dt>
                                <dd className="font-medium text-emerald-900">
                                    Rp{formatAmount(order.received)}
                                </dd>
                            </div>
                        )}
                    </dl>
                    {belowReceived && (
                        <p className="mt-3 text-xs font-semibold text-red-700">
                            Peringatan: Total baru tidak boleh lebih kecil daripada pembayaran yang sudah diterima (Rp{formatAmount(order.received)}).
                        </p>
                    )}
                </Card>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="submit"
                        disabled={isSubmitting || grandTotal <= 0 || belowReceived}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? 'Menyimpan...' : 'Simpan perubahan'}
                    </button>
                    <Link
                        href={`/ui-orders/${order.id}`}
                        className="rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
                    >
                        Batal
                    </Link>
                </div>
            </form>
        </AppLayout>
    );
}
