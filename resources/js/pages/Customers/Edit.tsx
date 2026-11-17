import type { FormEvent } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Save } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Input, Textarea } from '@/components/ui/input';

type CustomerEditProps = {
    customer: {
        id: number;
        name: string;
        phone: string;
        notes: string;
    };
};

export default function CustomersEdit({ customer }: CustomerEditProps) {
    const { data, setData, put, processing, errors } = useForm({
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        put(`/ui-customers/${customer.id}`);
    };

    return (
        <AppLayout title="Edit Pelanggan">
            <Head title={`Edit ${customer.name}`} />

            <div className="mb-5">
                <Link
                    href={`/ui-customers/${customer.id}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#143326] hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Detail pelanggan
                </Link>
                <div className="mt-2">
                    <h1 className="break-words font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Edit: {customer.name}
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Perubahan akan tercatat pada riwayat audit sistem.
                    </p>
                </div>
            </div>

            <Card className="max-w-2xl border-[#E3DED4] p-5 sm:p-6">
                <form noValidate onSubmit={handleSubmit} className="space-y-5">
                    <FormField id="name" label="Nama pelanggan" required error={errors.name}>
                        <Input
                            type="text"
                            id="name"
                            name="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            maxLength={255}
                            required
                            autoFocus
                            autoComplete="name"
                            invalid={Boolean(errors.name)}
                        />
                    </FormField>

                    <FormField
                        id="phone"
                        label="Nomor telepon (opsional)"
                        hint="Nomor telepon tidak harus unik. Dua pelanggan boleh menggunakan nomor yang sama."
                        error={errors.phone}
                    >
                        <Input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            maxLength={50}
                            autoComplete="tel"
                            placeholder="Contoh: 081234567890"
                            invalid={Boolean(errors.phone)}
                        />
                    </FormField>

                    <FormField id="notes" label="Catatan (opsional)" error={errors.notes}>
                        <Textarea
                            id="notes"
                            name="notes"
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            maxLength={2000}
                            rows={4}
                            placeholder="Contoh: instruksi khusus pelanggan"
                            invalid={Boolean(errors.notes)}
                        />
                    </FormField>

                    <div className="flex flex-wrap items-center gap-3 border-t border-[#E3DED4] pt-5">
                        <Button type="submit" variant="primary" disabled={processing}>
                            <Save className="size-4" aria-hidden="true" />
                            {processing ? 'Menyimpan...' : 'Simpan perubahan'}
                        </Button>
                        <Button asChild variant="secondary">
                            <Link href={`/ui-customers/${customer.id}`}>Batal</Link>
                        </Button>
                    </div>
                </form>
            </Card>
        </AppLayout>
    );
}
