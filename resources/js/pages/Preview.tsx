import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

type PreviewProps = {
    user: { name: string };
    dashboardUrl: string;
};

const modules = [
    { name: 'Pelanggan', detail: 'Daftar, pencarian, dan pengelolaan data pemesan bunga.' },
    { name: 'Pesanan', detail: 'Pencatatan pesanan multi-item dengan jadwal kirim per item.' },
    { name: 'Keuangan', detail: 'Pembayaran, piutang terbuka, pengeluaran, dan laporan kas.' },
];

export default function Preview({ user, dashboardUrl }: PreviewProps) {
    return (
        <>
            <Head title="Ringkasan Sistem" />
            <main className="mx-auto min-h-screen max-w-5xl bg-[#FBF9F6] px-5 py-12 text-[#1E2420] sm:px-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="grid size-10 place-items-center rounded-xl bg-[#143326] font-[var(--font-display)] text-lg font-semibold text-[#E6EFEA]"
                        >
                            M
                        </span>
                        <div>
                            <p className="font-bold text-[#1E2420]">Mutiara Florist</p>
                            <p className="text-xs text-[#525B54]">Manajemen Pesanan &amp; Kas</p>
                        </div>
                    </div>
                    <Button asChild variant="secondary">
                        <Link href={dashboardUrl}>Buka Dashboard</Link>
                    </Button>
                </header>

                <section className="mt-14 max-w-2xl">
                    <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[#1E2420]">
                        Halo, {user.name}.
                    </h1>
                    <p className="mt-3 text-base leading-7 text-[#525B54]">
                        Selamat datang di ruang kerja Mutiara Florist Management System. Gunakan dashboard untuk
                        memantau pesanan, pembayaran, pelanggan, dan laporan keuangan toko.
                    </p>
                </section>

                <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Modul sistem">
                    {modules.map((module) => (
                        <article key={module.name} className="rounded-xl border border-[#E3DED4] bg-white p-6">
                            <h2 className="font-bold text-[#1E2420]">{module.name}</h2>
                            <p className="mt-2.5 text-sm leading-6 text-[#525B54]">{module.detail}</p>
                        </article>
                    ))}
                </section>
            </main>
        </>
    );
}
