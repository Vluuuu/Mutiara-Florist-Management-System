import type { FormEvent } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';

export default function CustomersCreate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        phone: '',
        notes: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post('/ui-customers');
    };

    return (
        <AppLayout title="Tambah Pelanggan">
            <Head title="Tambah Pelanggan" />

            <div className="mb-6">
                <Link
                    href="/ui-customers"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Semua pelanggan
                </Link>
                <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Formulir
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-emerald-950">
                        Tambah pelanggan baru
                    </h1>
                    <p className="mt-1.5 text-sm text-stone-500">
                        Data pelanggan digunakan untuk pencatatan dan pengiriman pesanan.
                    </p>
                </div>
            </div>

            <Card className="max-w-2xl p-6">
                <form noValidate onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label
                            htmlFor="name"
                            className="mb-1.5 block text-sm font-medium text-stone-800"
                        >
                            Nama pelanggan <span className="text-red-700">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            maxLength={255}
                            required
                            autoFocus
                            autoComplete="name"
                            placeholder="Contoh: Ibu Rina Melati"
                            className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                        />
                        {errors.name && (
                            <p role="alert" className="mt-1.5 text-xs text-red-700">
                                {errors.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <label
                            htmlFor="phone"
                            className="mb-1.5 block text-sm font-medium text-stone-800"
                        >
                            Nomor telepon <span className="font-normal text-stone-400">(opsional)</span>
                        </label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            maxLength={50}
                            autoComplete="tel"
                            placeholder="Contoh: 081234567890"
                            className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                        />
                        <p className="mt-1.5 text-xs text-stone-500">
                            Nomor telepon tidak harus unik. Dua pelanggan boleh menggunakan nomor yang sama.
                        </p>
                        {errors.phone && (
                            <p role="alert" className="mt-1.5 text-xs text-red-700">
                                {errors.phone}
                            </p>
                        )}
                    </div>

                    <div>
                        <label
                            htmlFor="notes"
                            className="mb-1.5 block text-sm font-medium text-stone-800"
                        >
                            Catatan <span className="font-normal text-stone-400">(opsional)</span>
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            maxLength={2000}
                            rows={4}
                            placeholder="Contoh: preferensi bunga, alamat patokan, atau instruksi khusus pelanggan"
                            className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                        />
                        {errors.notes && (
                            <p role="alert" className="mt-1.5 text-xs text-red-700">
                                {errors.notes}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-5">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:opacity-50"
                        >
                            {processing ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Save className="size-4" aria-hidden="true" />
                            )}
                            Simpan pelanggan
                        </button>
                        <Link
                            href="/ui-customers"
                            className="rounded-lg border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
                        >
                            Batal
                        </Link>
                    </div>
                </form>
            </Card>
        </AppLayout>
    );
}
