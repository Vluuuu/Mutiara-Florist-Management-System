import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Copy,
    Plus,
    Trash2,
    UserPlus,
} from 'lucide-react';
import { Badge, getFulfillmentBadgeMeta } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { FormField, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    FulfillmentStatus,
    OrderCustomerOption,
    OrderEditData,
    OrderFormItem,
} from '@/types';

type OrderFormProps = {
    mode: 'create' | 'edit';
    customers: OrderCustomerOption[];
    selectedCustomerId?: number | null;
    order?: OrderEditData;
    todayIso?: string;
};

const MAX_ITEMS = 20;

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

function mapErrorKeyToElementId(key: string): string {
    const itemMatch = /^items\.(\d+)\.([a-z_]+)$/.exec(key);
    if (itemMatch) {
        return `item-${itemMatch[1]}-${itemMatch[2]}`;
    }
    if (key === 'items') {
        return 'sec-order-items';
    }
    return key;
}

let keyCounter = 100;

function createBlankItem(defaultDate: string): OrderFormItem {
    return {
        _key: keyCounter++,
        id: null,
        flower_type: '',
        recipient: '',
        sender_name: '',
        delivery_date: defaultDate,
        delivery_location: '',
        quantity: 1,
        unit_price: null,
        shipping_mode: 'INCLUDED',
        shipping_fee: 0,
        fulfillment_status: 'NEW',
        _initialStatus: 'NEW',
        notes: '',
    };
}

/**
 * Formulir pesanan terpadu untuk Buat Pesanan dan Edit Pesanan.
 * Menjaga seluruh field terpisah 1:1 sesuai kontrak OrderRequest dan menyediakan
 * quick-create pelanggan tanpa mengosongkan item draf.
 */
export function OrderForm({
    mode,
    customers: initialCustomers,
    selectedCustomerId = null,
    order,
    todayIso,
}: OrderFormProps) {
    const { errors, csrf_token } = usePage<AppPageProps>().props;
    const defaultDate = todayIso ?? new Date().toISOString().split('T')[0];

    const [customerList, setCustomerList] = useState<OrderCustomerOption[]>(initialCustomers);
    const [customerId, setCustomerId] = useState<number | null>(() => {
        if (mode === 'edit' && order) return order.customer_id;
        return selectedCustomerId ?? null;
    });
    const [orderDate, setOrderDate] = useState<string>(() =>
        mode === 'edit' && order ? order.order_date : defaultDate,
    );
    const [notes, setNotes] = useState<string>(() =>
        mode === 'edit' && order ? order.notes ?? '' : '',
    );
    const [changeReason, setChangeReason] = useState<string>('');
    const [items, setItems] = useState<OrderFormItem[]>(() => {
        if (mode === 'edit' && order) {
            return order.items.map((item) => ({
                _key: keyCounter++,
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
            }));
        }
        return [createBlankItem(defaultDate)];
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitLockRef = useRef(false);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    // Modal tambah pelanggan cepat
    const [quickModalOpen, setQuickModalOpen] = useState(false);
    const [quickName, setQuickName] = useState('');
    const [quickPhone, setQuickPhone] = useState('');
    const [quickNotes, setQuickNotes] = useState('');
    const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});
    const [isSavingQuickCustomer, setIsSavingQuickCustomer] = useState(false);
    const [quickSuccessMessage, setQuickSuccessMessage] = useState<string | null>(null);

    const hasPayments = mode === 'edit' && (order?.received ?? 0) > 0;

    const financialChanged = useMemo(() => {
        if (mode !== 'edit' || !order) return false;
        if (items.length !== order.items.length) return true;

        const origById = new Map(order.items.map((it) => [it.id, it]));
        for (const item of items) {
            if (!item.id) return true;
            const orig = origById.get(item.id);
            if (!orig) return true;
            if (
                Number(orig.quantity) !== Number(item.quantity) ||
                Number(orig.unit_price) !== Number(item.unit_price ?? 0) ||
                orig.shipping_mode !== item.shipping_mode ||
                Number(orig.shipping_fee) !==
                    (item.shipping_mode === 'SEPARATE' ? Number(item.shipping_fee ?? 0) : 0)
            ) {
                return true;
            }
        }
        return false;
    }, [mode, order, items]);

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
    const belowReceived = hasPayments && order ? grandTotal < order.received : false;

    const errorEntries = useMemo(() => Object.entries(errors ?? {}), [errors]);

    useEffect(() => {
        if (errorEntries.length > 0) {
            errorSummaryRef.current?.focus();
        }
    }, [errorEntries]);

    const customerOptions = useMemo(
        () =>
            customerList.map((c) => ({
                value: c.id,
                label: c.name,
                description: c.phone ?? undefined,
            })),
        [customerList],
    );

    const handleAddItem = () => {
        if (items.length >= MAX_ITEMS) return;
        setItems((prev) => [...prev, createBlankItem(orderDate || defaultDate)]);
    };

    const handleDuplicateItem = (index: number) => {
        if (items.length >= MAX_ITEMS) return;
        const source = items[index];
        const copy: OrderFormItem = {
            ...source,
            _key: keyCounter++,
            id: null,
            fulfillment_status: 'NEW',
            _initialStatus: 'NEW',
        };
        setItems((prev) => {
            const next = [...prev];
            next.splice(index + 1, 0, copy);
            return next;
        });
    };

    const handleRemoveItem = (index: number) => {
        const target = items[index];
        if (target.id && target._initialStatus && target._initialStatus !== 'NEW') return;
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleItemChange = <K extends keyof OrderFormItem>(
        index: number,
        field: K,
        value: OrderFormItem[K],
    ) => {
        setItems((prev) => {
            const next = [...prev];
            const updated = { ...next[index], [field]: value };
            if (field === 'shipping_mode') {
                if (value === 'INCLUDED') {
                    updated.shipping_fee = 0;
                } else if (updated.shipping_fee === 0) {
                    updated.shipping_fee = null;
                }
            }
            next[index] = updated;
            return next;
        });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current || isSubmitting || belowReceived) return;

        submitLockRef.current = true;
        setIsSubmitting(true);

        const mappedItems = items.map((item) => ({
            ...(mode === 'edit' && item.id ? { id: item.id } : {}),
            flower_type: item.flower_type,
            recipient: item.recipient,
            sender_name: item.sender_name,
            delivery_date: item.delivery_date,
            delivery_location: item.delivery_location,
            quantity: Number(item.quantity) || 0,
            unit_price: item.unit_price === null ? '' : Number(item.unit_price),
            shipping_mode: item.shipping_mode,
            shipping_fee:
                item.shipping_mode === 'SEPARATE'
                    ? item.shipping_fee === null
                        ? ''
                        : Number(item.shipping_fee)
                    : 0,
            ...(mode === 'edit' ? { fulfillment_status: item.fulfillment_status ?? 'NEW' } : {}),
            notes: item.notes.trim() || null,
        }));

        const payload = {
            customer_id: customerId ?? '',
            order_date: orderDate,
            notes: notes.trim() || null,
            ...(mode === 'edit' ? { change_reason: changeReason.trim() || null } : {}),
            items: mappedItems,
        };

        const options = {
            preserveScroll: true,
            onFinish: () => {
                submitLockRef.current = false;
                setIsSubmitting(false);
            },
        };

        if (mode === 'edit' && order) {
            router.put(`/ui-orders/${order.id}`, payload, options);
        } else {
            router.post('/ui-orders', payload, options);
        }
    };

    const openQuickModal = () => {
        setQuickName('');
        setQuickPhone('');
        setQuickNotes('');
        setQuickErrors({});
        setQuickModalOpen(true);
    };

    const handleQuickCustomerSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSavingQuickCustomer) return;

        setIsSavingQuickCustomer(true);
        setQuickErrors({});

        const metaToken =
            typeof document !== 'undefined'
                ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
                : undefined;
        const token = csrf_token ?? metaToken ?? '';

        try {
            const response = await fetch('/ui-customers', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({
                    name: quickName,
                    phone: quickPhone || null,
                    notes: quickNotes || null,
                }),
            });

            const body = (await response.json().catch(() => ({}))) as {
                customer?: OrderCustomerOption;
                message?: string;
                errors?: Record<string, string[]>;
            };

            if (response.status === 422 && body.errors) {
                const flat: Record<string, string> = {};
                for (const [field, messages] of Object.entries(body.errors)) {
                    if (messages && messages.length > 0) {
                        flat[field] = messages[0];
                    }
                }
                setQuickErrors(flat);
                return;
            }

            if (!response.ok || !body.customer) {
                setQuickErrors({
                    form: body.message ?? 'Gagal menambahkan pelanggan baru. Coba lagi.',
                });
                return;
            }

            const created = body.customer;
            setCustomerList((prev) =>
                [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'id')),
            );
            setCustomerId(created.id);
            setQuickSuccessMessage(`Pelanggan "${created.name}" ditambahkan dan langsung dipilih.`);
            setQuickModalOpen(false);
        } catch {
            setQuickErrors({
                form: 'Koneksi terputus saat menambahkan pelanggan baru.',
            });
        } finally {
            setIsSavingQuickCustomer(false);
        }
    };

    const backHref = mode === 'edit' && order ? `/ui-orders/${order.id}` : '/ui-orders';

    return (
        <div className="pb-24 lg:pb-0">
            <div className="mb-5">
                <Link
                    href={backHref}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#143326] hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {mode === 'edit' ? 'Kembali ke detail pesanan' : 'Kembali ke daftar pesanan'}
                </Link>
                <div className="mt-2">
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        {mode === 'edit' && order
                            ? `Edit Pesanan ${order.order_number}`
                            : 'Buat Pesanan Baru'}
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Seluruh rincian dihitung ulang oleh server saat disimpan; nominal memakai Rupiah bulat.
                    </p>
                </div>
            </div>

            {errorEntries.length > 0 && (
                <div
                    id="order-error-summary"
                    ref={errorSummaryRef}
                    role="alert"
                    tabIndex={-1}
                    className="mb-5 rounded-md border-2 border-[#991B1B] bg-[#FEF2F2] p-4 text-sm text-[#991B1B] focus:outline-none"
                >
                    <div className="flex items-start gap-2.5">
                        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <div>
                            <h2 className="text-base font-bold text-[#991B1B]">
                                Ada bagian yang perlu dilengkapi sebelum menyimpan
                            </h2>
                            <ul className="mt-2 list-inside list-disc space-y-1">
                                {errorEntries.map(([key, msg]) => {
                                    const targetId = mapErrorKeyToElementId(key);
                                    return (
                                        <li key={key}>
                                            <a
                                                href={`#${targetId}`}
                                                onClick={(ev) => {
                                                    const el = document.getElementById(targetId);
                                                    if (el) {
                                                        ev.preventDefault();
                                                        el.scrollIntoView({
                                                            behavior: 'smooth',
                                                            block: 'center',
                                                        });
                                                        el.focus({ preventScroll: true });
                                                    }
                                                }}
                                                className="font-semibold underline underline-offset-2 hover:text-[#7F1D1D]"
                                            >
                                                {msg}
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {hasPayments && order && (
                <div
                    className={cn(
                        'mb-5 flex items-start gap-3 rounded-md border p-4 text-sm',
                        belowReceived
                            ? 'border-[#991B1B] bg-[#FEE2E2] text-[#991B1B]'
                            : 'border-[#92400E]/30 bg-[#FEF3C7] text-[#92400E]',
                    )}
                >
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="font-bold">
                            Pesanan sudah menerima pembayaran {formatRupiah(order.received)}
                        </p>
                        <p className="mt-1 text-[13px]">
                            {belowReceived
                                ? `Total tagihan baru (${formatRupiah(grandTotal)}) tidak boleh kurang dari pembayaran yang sudah diterima.`
                                : 'Mengubah harga, ongkir, atau jumlah item mewajibkan pengisian Alasan Perubahan di bawah.'}
                        </p>
                    </div>
                </div>
            )}

            <form id="order-main-form" onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(310px,1fr)] lg:items-start">
                    <div className="space-y-5">
                        {/* Seksi 1: Header Nota & Pelanggan */}
                        <Card className="border-[#E3DED4] p-4 sm:p-5">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <h2 className="text-base font-bold text-[#1E2420]">
                                    1. Informasi Pemesan &amp; Nota
                                </h2>
                                {!(hasPayments && mode === 'edit') && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={openQuickModal}
                                    >
                                        <UserPlus className="size-4" aria-hidden="true" />
                                        + Pelanggan Baru
                                    </Button>
                                )}
                            </div>

                            {quickSuccessMessage && (
                                <div
                                    role="status"
                                    className="mb-4 rounded-md border border-[#166534]/30 bg-[#DCFCE7] px-3 py-2 text-xs font-semibold text-[#166534]"
                                >
                                    {quickSuccessMessage}
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <FormField
                                    id="customer_id"
                                    label="Pelanggan"
                                    required
                                    hint={
                                        hasPayments && mode === 'edit'
                                            ? 'Pelanggan tidak dapat diganti setelah pesanan menerima pembayaran.'
                                            : 'Ketik nama atau nomor HP untuk mencari. Menambah pelanggan baru tidak menghapus draf bunga.'
                                    }
                                    error={errors?.customer_id}
                                >
                                    <SearchableSelect
                                        id="customer_id"
                                        options={customerOptions}
                                        value={customerId}
                                        onChange={(val) =>
                                            setCustomerId(val === null ? null : Number(val))
                                        }
                                        placeholder="Pilih atau cari nama/telepon pelanggan..."
                                        emptyText="Pelanggan tidak cocok. Gunakan + Pelanggan Baru."
                                        invalid={Boolean(errors?.customer_id)}
                                        disabled={hasPayments && mode === 'edit'}
                                        describedBy={
                                            errors?.customer_id
                                                ? 'customer_id-error'
                                                : 'customer_id-hint'
                                        }
                                        footerAction={
                                            !(hasPayments && mode === 'edit') ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-[#143326]"
                                                    onClick={openQuickModal}
                                                >
                                                    <UserPlus className="size-4" aria-hidden="true" />
                                                    + Tambah Pelanggan Baru
                                                </Button>
                                            ) : undefined
                                        }
                                    />
                                </FormField>

                                <FormField
                                    id="order_date"
                                    label="Tanggal Nota / Pesan"
                                    required
                                    error={errors?.order_date}
                                >
                                    <Input
                                        id="order_date"
                                        name="order_date"
                                        type="date"
                                        value={orderDate}
                                        onChange={(e) => setOrderDate(e.target.value)}
                                        invalid={Boolean(errors?.order_date)}
                                        required
                                    />
                                </FormField>
                            </div>

                            <div className="mt-4">
                                <FormField
                                    id="notes"
                                    label="Catatan Pesanan (opsional)"
                                    error={errors?.notes}
                                >
                                    <Textarea
                                        id="notes"
                                        name="notes"
                                        rows={2}
                                        maxLength={2000}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Misal: Konfirmasi foto hasil rangkaian ke WA pemesan"
                                        invalid={Boolean(errors?.notes)}
                                    />
                                </FormField>
                            </div>

                            {mode === 'edit' && (
                                <div className="mt-4">
                                    <FormField
                                        id="change_reason"
                                        label={
                                            hasPayments && financialChanged
                                                ? 'Alasan perubahan nominal (wajib karena sudah ada pembayaran)'
                                                : 'Alasan perubahan pesanan (opsional)'
                                        }
                                        required={hasPayments && financialChanged}
                                        hint={
                                            hasPayments && financialChanged
                                                ? 'Wajib diisi karena nilai, ongkir, atau jumlah item berubah pada pesanan yang sudah menerima pembayaran.'
                                                : 'Isi alasan perubahan jika melakukan penyesuaian harga atau daftar bunga.'
                                        }
                                        error={errors?.change_reason}
                                    >
                                        <Input
                                            id="change_reason"
                                            name="change_reason"
                                            type="text"
                                            maxLength={500}
                                            value={changeReason}
                                            onChange={(e) => setChangeReason(e.target.value)}
                                            placeholder="Misal: Tambah 1 rangkaian sesuai permintaan pemesan"
                                            invalid={Boolean(errors?.change_reason)}
                                            required={hasPayments && financialChanged}
                                        />
                                    </FormField>
                                </div>
                            )}
                        </Card>

                        {/* Seksi 2: Daftar Item Bunga (1..20) */}
                        <Card className="border-[#E3DED4] p-4 sm:p-5">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2
                                        id="sec-order-items"
                                        className="text-base font-bold text-[#1E2420]"
                                    >
                                        2. Daftar Rangkaian Bunga ({items.length}/{MAX_ITEMS})
                                    </h2>
                                    <p className="mt-0.5 text-[13px] text-[#525B54]">
                                        Setiap baris dapat memiliki penerima, ucapan, jadwal kirim, dan ongkir berbeda.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={items.length >= MAX_ITEMS}
                                    onClick={handleAddItem}
                                >
                                    <Plus className="size-4" aria-hidden="true" />
                                    Tambah Item Lain
                                </Button>
                            </div>

                            {errors?.items && (
                                <div
                                    role="alert"
                                    className="mb-4 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3 text-xs font-semibold text-[#991B1B]"
                                >
                                    {errors.items}
                                </div>
                            )}

                            <div className="space-y-4">
                                {items.map((item, idx) => {
                                    const itemStatusLocked = Boolean(
                                        item.id && item._initialStatus && item._initialStatus !== 'NEW',
                                    );
                                    const canDelete = items.length > 1 && !itemStatusLocked;
                                    const lineTotal =
                                        (Number(item.quantity) || 0) *
                                            (Number(item.unit_price) || 0) +
                                        (item.shipping_mode === 'SEPARATE'
                                            ? Number(item.shipping_fee) || 0
                                            : 0);
                                    const statusMeta = getFulfillmentBadgeMeta(
                                        item._initialStatus ?? 'NEW',
                                    );

                                    return (
                                        <section
                                            key={item._key}
                                            aria-label={`Rangkaian bunga ${idx + 1}`}
                                            className="rounded-lg border border-[#E3DED4] bg-[#FAF8F4]/70 p-4"
                                        >
                                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#E3DED4] pb-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-sm font-bold text-[#143326]">
                                                        Bunga #{idx + 1}
                                                    </h3>
                                                    {mode === 'edit' && item.id && (
                                                        <Badge tone={statusMeta.tone}>
                                                            {statusMeta.label}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs font-bold text-[#1E2420] tabular-nums">
                                                        Subtotal {formatRupiah(lineTotal)}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        disabled={items.length >= MAX_ITEMS}
                                                        onClick={() => handleDuplicateItem(idx)}
                                                    >
                                                        <Copy className="size-3.5" aria-hidden="true" />
                                                        Duplikat Item
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={!canDelete}
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className={
                                                            canDelete
                                                                ? 'text-[#991B1B] hover:bg-[#FEE2E2] hover:text-[#991B1B]'
                                                                : undefined
                                                        }
                                                    >
                                                        <Trash2 className="size-3.5" aria-hidden="true" />
                                                        Hapus
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <FormField
                                                    id={`item-${idx}-flower_type`}
                                                    label="Jenis bunga / rangkaian"
                                                    required
                                                    error={errors?.[`items.${idx}.flower_type`]}
                                                >
                                                    <Input
                                                        id={`item-${idx}-flower_type`}
                                                        type="text"
                                                        maxLength={255}
                                                        value={item.flower_type}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'flower_type',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Contoh: Papan Bunga Ucapan Selamat"
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.flower_type`],
                                                        )}
                                                        required
                                                    />
                                                </FormField>

                                                <FormField
                                                    id={`item-${idx}-delivery_date`}
                                                    label="Tanggal kirim"
                                                    required
                                                    error={errors?.[`items.${idx}.delivery_date`]}
                                                >
                                                    <Input
                                                        id={`item-${idx}-delivery_date`}
                                                        type="date"
                                                        value={item.delivery_date}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'delivery_date',
                                                                e.target.value,
                                                            )
                                                        }
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.delivery_date`],
                                                        )}
                                                        required
                                                    />
                                                </FormField>

                                                <FormField
                                                    id={`item-${idx}-recipient`}
                                                    label="Untuk / nama penerima"
                                                    required
                                                    error={errors?.[`items.${idx}.recipient`]}
                                                >
                                                    <Input
                                                        id={`item-${idx}-recipient`}
                                                        type="text"
                                                        maxLength={255}
                                                        value={item.recipient}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'recipient',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Contoh: Bapak Hendra Wijaya"
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.recipient`],
                                                        )}
                                                        required
                                                    />
                                                </FormField>

                                                <FormField
                                                    id={`item-${idx}-sender_name`}
                                                    label="Dari / nama pengirim ucapan"
                                                    required
                                                    error={errors?.[`items.${idx}.sender_name`]}
                                                >
                                                    <Input
                                                        id={`item-${idx}-sender_name`}
                                                        type="text"
                                                        maxLength={255}
                                                        value={item.sender_name}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'sender_name',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Contoh: Direksi PT Maju Jaya"
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.sender_name`],
                                                        )}
                                                        required
                                                    />
                                                </FormField>
                                            </div>

                                            <div className="mt-4">
                                                <FormField
                                                    id={`item-${idx}-delivery_location`}
                                                    label="Alamat / lokasi pengiriman"
                                                    required
                                                    error={errors?.[`items.${idx}.delivery_location`]}
                                                >
                                                    <Textarea
                                                        id={`item-${idx}-delivery_location`}
                                                        rows={2}
                                                        maxLength={1000}
                                                        value={item.delivery_location}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'delivery_location',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Alamat lengkap lokasi pengiriman dan patokan"
                                                        invalid={Boolean(
                                                            errors?.[
                                                                `items.${idx}.delivery_location`
                                                            ],
                                                        )}
                                                        required
                                                    />
                                                </FormField>
                                            </div>

                                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                                                <FormField
                                                    id={`item-${idx}-quantity`}
                                                    label="Jumlah (buah)"
                                                    required
                                                    error={errors?.[`items.${idx}.quantity`]}
                                                >
                                                    <Input
                                                        id={`item-${idx}-quantity`}
                                                        type="number"
                                                        min={1}
                                                        max={10000}
                                                        value={item.quantity}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'quantity',
                                                                Math.max(
                                                                    1,
                                                                    Number.parseInt(
                                                                        e.target.value || '1',
                                                                        10,
                                                                    ) || 1,
                                                                ),
                                                            )
                                                        }
                                                        className="tabular-nums"
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.quantity`],
                                                        )}
                                                        required
                                                    />
                                                </FormField>

                                                <FormField
                                                    id={`item-${idx}-unit_price`}
                                                    label="Harga satuan"
                                                    required
                                                    error={errors?.[`items.${idx}.unit_price`]}
                                                    className="md:col-span-2"
                                                >
                                                    <CurrencyInput
                                                        id={`item-${idx}-unit_price`}
                                                        value={item.unit_price}
                                                        onChange={(val) =>
                                                            handleItemChange(idx, 'unit_price', val)
                                                        }
                                                        placeholder="Contoh: 500.000"
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.unit_price`],
                                                        )}
                                                        required
                                                    />
                                                </FormField>
                                            </div>

                                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <span className="block text-sm font-semibold text-[#1E2420]">
                                                        Skema ongkos kirim
                                                        <span
                                                            className="ml-0.5 text-[#8C3B4A]"
                                                            aria-hidden="true"
                                                        >
                                                            *
                                                        </span>
                                                    </span>
                                                    <div
                                                        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                                                        role="group"
                                                        aria-label={`Skema ongkos kirim bunga ${idx + 1}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            aria-pressed={
                                                                item.shipping_mode === 'INCLUDED'
                                                            }
                                                            onClick={() =>
                                                                handleItemChange(
                                                                    idx,
                                                                    'shipping_mode',
                                                                    'INCLUDED',
                                                                )
                                                            }
                                                            className={cn(
                                                                'min-h-[44px] rounded-md border-[1.5px] px-3 py-2 text-left text-xs font-bold transition-colors',
                                                                item.shipping_mode === 'INCLUDED'
                                                                    ? 'border-[#143326] bg-[#E6EFEA] text-[#143326]'
                                                                    : 'border-[#858E87] bg-white text-[#525B54] hover:bg-[#F1EDE6]',
                                                            )}
                                                        >
                                                            Sudah termasuk harga bunga
                                                        </button>
                                                        <button
                                                            type="button"
                                                            aria-pressed={
                                                                item.shipping_mode === 'SEPARATE'
                                                            }
                                                            onClick={() =>
                                                                handleItemChange(
                                                                    idx,
                                                                    'shipping_mode',
                                                                    'SEPARATE',
                                                                )
                                                            }
                                                            className={cn(
                                                                'min-h-[44px] rounded-md border-[1.5px] px-3 py-2 text-left text-xs font-bold transition-colors',
                                                                item.shipping_mode === 'SEPARATE'
                                                                    ? 'border-[#143326] bg-[#E6EFEA] text-[#143326]'
                                                                    : 'border-[#858E87] bg-white text-[#525B54] hover:bg-[#F1EDE6]',
                                                            )}
                                                        >
                                                            Ditagih terpisah
                                                        </button>
                                                    </div>
                                                    {errors?.[`items.${idx}.shipping_mode`] && (
                                                        <p
                                                            role="alert"
                                                            className="text-[13px] font-semibold text-[#991B1B]"
                                                        >
                                                            {errors[`items.${idx}.shipping_mode`]}
                                                        </p>
                                                    )}
                                                </div>

                                                <FormField
                                                    id={`item-${idx}-shipping_fee`}
                                                    label="Biaya ongkos kirim"
                                                    required={item.shipping_mode === 'SEPARATE'}
                                                    hint={
                                                        item.shipping_mode === 'INCLUDED'
                                                            ? 'Dikunci Rp0 karena ongkir sudah termasuk harga bunga.'
                                                            : 'Wajib lebih dari Rp0 karena ongkir ditagih terpisah.'
                                                    }
                                                    error={errors?.[`items.${idx}.shipping_fee`]}
                                                >
                                                    <CurrencyInput
                                                        id={`item-${idx}-shipping_fee`}
                                                        value={
                                                            item.shipping_mode === 'INCLUDED'
                                                                ? 0
                                                                : item.shipping_fee
                                                        }
                                                        disabled={item.shipping_mode === 'INCLUDED'}
                                                        onChange={(val) =>
                                                            handleItemChange(idx, 'shipping_fee', val)
                                                        }
                                                        placeholder="Contoh: 50.000"
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.shipping_fee`],
                                                        )}
                                                        required={item.shipping_mode === 'SEPARATE'}
                                                    />
                                                </FormField>
                                            </div>

                                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <FormField
                                                    id={`item-${idx}-notes`}
                                                    label="Catatan item / pita ucapan (opsional)"
                                                    error={errors?.[`items.${idx}.notes`]}
                                                    className={mode === 'edit' ? '' : 'md:col-span-2'}
                                                >
                                                    <Input
                                                        id={`item-${idx}-notes`}
                                                        type="text"
                                                        maxLength={2000}
                                                        value={item.notes}
                                                        onChange={(e) =>
                                                            handleItemChange(
                                                                idx,
                                                                'notes',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Misal: Pita warna emas, tulisan di kartu"
                                                        invalid={Boolean(
                                                            errors?.[`items.${idx}.notes`],
                                                        )}
                                                    />
                                                </FormField>

                                                {mode === 'edit' && (
                                                    <FormField
                                                        id={`item-${idx}-fulfillment_status`}
                                                        label="Status pengerjaan item"
                                                        hint={
                                                            itemStatusLocked
                                                                ? 'Item yang sudah diproses tidak dapat dihapus atau dimundurkan.'
                                                                : 'Status hanya dapat tetap atau maju satu tahap.'
                                                        }
                                                        error={
                                                            errors?.[
                                                                `items.${idx}.fulfillment_status`
                                                            ]
                                                        }
                                                    >
                                                        <Select
                                                            id={`item-${idx}-fulfillment_status`}
                                                            value={item.fulfillment_status ?? 'NEW'}
                                                            onChange={(e) =>
                                                                handleItemChange(
                                                                    idx,
                                                                    'fulfillment_status',
                                                                    e.target
                                                                        .value as FulfillmentStatus,
                                                                )
                                                            }
                                                            invalid={Boolean(
                                                                errors?.[
                                                                    `items.${idx}.fulfillment_status`
                                                                ],
                                                            )}
                                                        >
                                                            {getAllowedStatuses(
                                                                item._initialStatus ?? 'NEW',
                                                            ).map((opt) => (
                                                                <option
                                                                    key={opt.value}
                                                                    value={opt.value}
                                                                >
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                    </FormField>
                                                )}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>

                    {/* Panel Kanan Sticky Desktop (>= 1024px) */}
                    <aside
                        aria-labelledby="sec-summary-receipt"
                        className="hidden lg:sticky lg:top-20 lg:block"
                    >
                        <Card className="border-[#E3DED4] p-5">
                            <h2
                                id="sec-summary-receipt"
                                className="mb-3 text-base font-bold text-[#1E2420]"
                            >
                                Ringkasan Hitungan Nota
                            </h2>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="text-[#525B54]">Subtotal Rangkaian</dt>
                                    <dd className="font-bold text-[#1E2420] tabular-nums">
                                        {formatRupiah(productTotal)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="text-[#525B54]">Ongkos Kirim Terpisah</dt>
                                    <dd className="font-bold text-[#1E2420] tabular-nums">
                                        {formatRupiah(shippingTotal)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2 border-t-[1.5px] border-[#E3DED4] pt-3">
                                    <dt className="font-bold text-[#1E2420]">Perkiraan Total</dt>
                                    <dd className="text-xl font-bold text-[#143326] tabular-nums">
                                        {formatRupiah(grandTotal)}
                                    </dd>
                                </div>
                            </dl>

                            <p className="mt-3 text-[13px] text-[#525B54]">
                                Nominal Rupiah bulat tanpa desimal. Total resmi dikunci server saat Anda menekan simpan.
                            </p>

                            <div className="mt-5">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    disabled={isSubmitting || belowReceived}
                                    className="w-full"
                                >
                                    {isSubmitting
                                        ? 'Menyimpan pesanan...'
                                        : mode === 'edit'
                                          ? 'Simpan Perubahan'
                                          : 'Simpan Pesanan'}
                                </Button>
                            </div>
                        </Card>
                    </aside>
                </div>

                {/* Bilah Simpan Mobile/Tablet (< 1024px) */}
                <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 border-t border-[#E3DED4] bg-white px-4 py-3 md:bottom-0 lg:hidden">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#525B54]">Perkiraan Total Tagihan</p>
                        <p className="truncate text-lg font-bold text-[#143326] tabular-nums">
                            {formatRupiah(grandTotal)}
                        </p>
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isSubmitting || belowReceived}
                        className="shrink-0"
                    >
                        {isSubmitting
                            ? 'Menyimpan...'
                            : mode === 'edit'
                              ? 'Simpan Perubahan'
                              : 'Simpan Pesanan'}
                    </Button>
                </div>
            </form>

            {/* Modal Tambah Pelanggan Baru tanpa keluar dari form */}
            <Modal
                open={quickModalOpen}
                onClose={() => setQuickModalOpen(false)}
                isSubmitting={isSavingQuickCustomer}
                title="Tambah Pelanggan Baru"
                description="Pelanggan baru akan langsung dipilih pada pesanan ini tanpa menghapus draf bunga."
            >
                <form onSubmit={handleQuickCustomerSubmit} noValidate className="space-y-4">
                    {quickErrors.form && (
                        <div
                            role="alert"
                            className="rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3 text-xs font-semibold text-[#991B1B]"
                        >
                            {quickErrors.form}
                        </div>
                    )}

                    <FormField
                        id="quick-customer-name"
                        label="Nama pelanggan"
                        required
                        error={quickErrors.name}
                    >
                        <Input
                            id="quick-customer-name"
                            data-modal-initial="true"
                            type="text"
                            maxLength={255}
                            value={quickName}
                            onChange={(e) => setQuickName(e.target.value)}
                            placeholder="Contoh: Ibu Dewi Kusuma"
                            invalid={Boolean(quickErrors.name)}
                            required
                        />
                    </FormField>

                    <FormField
                        id="quick-customer-phone"
                        label="Nomor telepon / WA (opsional)"
                        error={quickErrors.phone}
                    >
                        <Input
                            id="quick-customer-phone"
                            type="tel"
                            maxLength={50}
                            value={quickPhone}
                            onChange={(e) => setQuickPhone(e.target.value)}
                            placeholder="Contoh: 081234567890"
                            invalid={Boolean(quickErrors.phone)}
                        />
                    </FormField>

                    <FormField
                        id="quick-customer-notes"
                        label="Catatan pelanggan (opsional)"
                        error={quickErrors.notes}
                    >
                        <Textarea
                            id="quick-customer-notes"
                            rows={2}
                            maxLength={2000}
                            value={quickNotes}
                            onChange={(e) => setQuickNotes(e.target.value)}
                            placeholder="Instruksi khusus atau patokan alamat"
                            invalid={Boolean(quickErrors.notes)}
                        />
                    </FormField>

                    <div className="flex flex-col-reverse gap-2 border-t border-[#E3DED4] pt-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={isSavingQuickCustomer}
                            onClick={() => setQuickModalOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSavingQuickCustomer}
                        >
                            {isSavingQuickCustomer ? 'Menyimpan...' : 'Simpan & Pilih'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
