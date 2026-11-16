import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

type PreviewProps = {
    user: { name: string };
    dashboardUrl: string;
};

const nextModules = [
    { name: 'Pelanggan', detail: 'Daftar, pencarian, dan pengelolaan data pelanggan.' },
    { name: 'Pesanan', detail: 'Form multi-item dengan pengiriman per item.' },
    { name: 'Keuangan', detail: 'Pembayaran, piutang, pengeluaran, dan audit.' },
];

export default function Preview({ user, dashboardUrl }: PreviewProps) {
    return (
        <>
            <Head title="Pratinjau UI React" />
            <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-950 text-lg font-semibold text-white">
                            M
                        </span>
                        <div>
                            <p className="font-semibold text-emerald-950">Mutiara Florist</p>
                            <p className="text-xs text-stone-500">Management System</p>
                        </div>
                    </div>
                    <Button asChild variant="outline">
                        <a href={dashboardUrl}>Kembali ke dashboard lama</a>
                    </Button>
                </header>

                <section className="mt-16 max-w-2xl">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                        Phase 3.3 · React + TypeScript
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                        Halo, {user.name}.
                    </h1>
                    <p className="mt-4 text-base leading-7 text-stone-600">
                        Ini pratinjau terpisah untuk migrasi antarmuka MFMS. Halaman login,
                        pesanan, pembayaran, dan pengeluaran lama masih menggunakan Blade
                        sampai pengujian migrasi selesai.
                    </p>
                </section>

                <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Rencana modul antarmuka">
                    {nextModules.map((module) => (
                        <article key={module.name} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                            <h2 className="font-semibold text-emerald-950">{module.name}</h2>
                            <p className="mt-3 text-sm leading-6 text-stone-600">{module.detail}</p>
                            <p className="mt-6 text-xs font-medium text-stone-400">Belum dimigrasikan</p>
                        </article>
                    ))}
                </section>
            </main>
        </>
    );
}
