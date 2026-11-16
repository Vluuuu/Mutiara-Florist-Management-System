import { useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    DollarSign,
    Flower2,
    Info,
    Plus,
    Trash2,
    Truck,
    UserPlus,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';
import type { AppPageProps, OrderCustomerOption, OrderFormItem } from '@/types';

type OrdersCreateProps = {
    customers: OrderCustomerOption[];
};

let itemKeyCounter = 1;

function createBlankItem(defaultDate: string): OrderFormItem {
    return {
        _key: itemKeyCounter++,
        flower_type: '',
        recipient: '',
        sender_name: '',
        delivery_date: defaultDate,
        delivery_location: '',
        quantity: 1,
        unit_price: 0,
        shipping_mode: 'INCLUDED',
        shipping_fee: 0,
        notes: '',
    };
}

export default function OrdersCreate({ customers }: OrdersCreateProps) {
    const { errors } = usePage<AppPageProps>().props;
    const today = new Date().toISOString().split('T')[0];

    const [customerId, setCustomerId] = useState<number | ''>(
        customers.length > 0 ? customers[0].id : '',
    );
    const [orderDate, setOrderDate] = useState<string>(today);
    const [notes, setNotes] = useState<string>('');
    const [items, setItems] = useState<OrderFormItem[]>([createBlankItem(today)]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddItem = () => {
        if (items.length >= 20) return;
        setItems([...items, createBlankItem(orderDate || today)]);
    };

    const handleRemoveItem = (index: number) => {
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

    // Calculations
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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            customer_id: customerId,
            order_date: orderDate,
            notes: notes || null,
            items: items.map((item) => ({
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
                notes: item.notes || null,
            })),
        };

        router.post('/ui-orders', payload, {
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <AppLayout title="Buat Pesanan">
            <Head title="Buat Pesanan" />

            <div className="mb-7">
                <Link
                    href="/ui-orders"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-800 hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Kembali ke daftar pesanan
                </Link>
                <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Pencatatan bunga
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-emerald-950">
                        Buat pesanan bunga
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Satu pesanan dapat memuat 1–20 bunga dengan penerima, lokasi pengiriman, jadwal, dan ongkir berbeda.
                    </p>
                </div>
            </div>

            {customers.length === 0 ? (
                <Card className="border-amber-200 bg-amber-50/70 p-6 text-sm text-amber-900">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" />
                        <div>
                            <p className="font-semibold text-amber-950">Belum ada pelanggan aktif</p>
                            <p className="mt-1 text-stone-600">
                                Tambahkan data pelanggan terlebih dahulu sebelum membuat pesanan bunga.
                            </p>
                            <Link
                                href="/ui-customers/create"
                                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-950 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
                            >
                                <UserPlus className="size-3.5" />
                                Tambah pelanggan baru
                            </Link>
                        </div>
                    </div>
                </Card>
            ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                    {errors && Object.keys(errors).length > 0 && (
                        <div
                            role="alert"
                            className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
                        >
                            <p className="font-semibold">Ada kesalahan pada pengisian pesanan:</p>
                            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                                {Object.entries(errors).map(([key, msg]) => (
                                    <li key={key}>{msg}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Informasi Utama Pesanan */}
                    <Card className="p-5 sm:p-7">
                        <h2 className="text-base font-semibold text-emerald-950">
                            Informasi Pemesan & Jadwal
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
                                    onChange={(e) =>
                                        setCustomerId(
                                            e.target.value ? Number(e.target.value) : '',
                                        )
                                    }
                                    required
                                    className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                                >
                                    <option value="">Pilih pelanggan</option>
                                    {customers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.phone ? `(${c.phone})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {errors?.customer_id && (
                                    <p className="mt-1.5 text-xs text-red-700">{errors.customer_id}</p>
                                )}
                                <div className="mt-2">
                                    <Link
                                        href="/ui-customers/create"
                                        className="text-xs font-medium text-emerald-800 hover:underline"
                                    >
                                        + Tambah pelanggan baru
                                    </Link>
                                </div>
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
                                    <p className="mt-1.5 text-xs text-red-700">{errors.order_date}</p>
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
                                placeholder="Informasi umum untuk seluruh pesanan"
                                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                            />
                            {errors?.notes && (
                                <p className="mt-1.5 text-xs text-red-700">{errors.notes}</p>
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
                                Maksimal 20 item bunga. Setiap item memiliki penerima, jadwal kirim, dan ongkir sendiri.
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
                                            </h3>
                                        </div>
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline"
                                            >
                                                <Trash2 className="size-3.5" />
                                                Hapus bunga
                                            </button>
                                        )}
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
                                                placeholder="Contoh: Papan ucapan, Standing flower, Buket meja"
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
                                                placeholder="Nama orang atau instansi penerima"
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
                                                placeholder="Nama yang dicantumkan pada bunga"
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
                                                placeholder="Alamat lengkap, gedung, nomor ruangan atau patokan jalan"
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
                                                Ongkir tambahan (Rp)
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
                                            <p className="mt-1 text-xs text-stone-400">
                                                Dihitung sekali per item/tujuan, bukan dikali kuantitas.
                                            </p>
                                            {errors?.[`items.${index}.shipping_fee`] && (
                                                <p className="mt-1 text-xs text-red-700">
                                                    {errors[`items.${index}.shipping_fee`]}
                                                </p>
                                            )}
                                        </div>

                                        <div className="sm:col-span-2">
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
                                                placeholder="Contoh: dominan pita biru, tiba sebelum jam 10 pagi"
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

                    {/* Ringkasan Biaya */}
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
                                <dt>Total pesanan</dt>
                                <dd>Rp{formatAmount(grandTotal)}</dd>
                            </div>
                        </dl>
                        <p className="mt-4 text-xs leading-5 text-stone-500">
                            Pratinjau tagihan di atas dihitung otomatis secara lokal dan akan diverifikasi ulang oleh server transaksi. DP/pembayaran dapat dicatat setelah pesanan berhasil disimpan.
                        </p>
                    </Card>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="submit"
                            disabled={isSubmitting || grandTotal <= 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting ? 'Menyimpan...' : 'Simpan pesanan'}
                        </button>
                        <Link
                            href="/ui-orders"
                            className="rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
                        >
                            Batal
                        </Link>
                    </div>
                </form>
            )}
        </AppLayout>
    );
}
