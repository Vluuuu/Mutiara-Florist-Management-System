import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

type PreviewProps = {
    user: { name: string };
    dashboardUrl: string;
};

const modules = [
    { num: '01', name: 'Pelanggan', detail: 'Daftar, pencarian cepat, dan riwayat nota pemesan bunga.' },
    { num: '02', name: 'Pesanan', detail: 'Pencatatan pesanan multi-rangkaian dengan jadwal kirim per item.' },
    { num: '03', name: 'Keuangan & Laporan', detail: 'Pembayaran, piutang terbuka, pengeluaran sah, dan ekspor Excel.' },
];

export default function Preview({ user, dashboardUrl }: PreviewProps) {
    return (
        <>
            <Head title="Ringkasan Sistem" />
            <main className="mx-auto min-h-screen max-w-5xl bg-[#F7F3EC] px-5 py-10 text-[#1C211E] sm:px-8">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DED6C8] pb-5">
                    <div className="flex items-center gap-2.5">
                        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#9A3B22]" />
                        <div>
                            <p className="text-xl font-bold tracking-[-0.015em] text-[#182920]">
                                Mutiara Florist
                            </p>
                            <p className="text-xs text-[#545852]">Buku Pesanan &amp; Kas Toko</p>
                        </div>
                    </div>
                    <Button asChild variant="primary">
                        <Link href={dashboardUrl}>Buka Ruang Kerja Hari Ini</Link>
                    </Button>
                </header>

                <section className="mt-10 max-w-2xl">
                    <h1 className="atelier-h1">Halo, {user.name}.</h1>
                    <p className="atelier-prose mt-3 text-[15px] leading-7">
                        Selamat datang di ruang kerja Mutiara Florist Management System. Gunakan halaman Hari Ini untuk
                        memantau antrean kiriman, piutang terbuka, pelanggan, serta pembukuan kas harian toko.
                    </p>
                </section>

                <section
                    className="atelier-sheet mt-10 overflow-hidden"
                    aria-label="Modul sistem"
                >
                    <div className="grid gap-px bg-[#DED6C8] md:grid-cols-3">
                        {modules.map((module) => (
                            <article key={module.name} className="bg-[#FFFDF9] p-6">
                                <span className="font-[var(--font-mono)] text-xs font-bold text-[#9A3B22]">
                                    {module.num}
                                </span>
                                <h2 className="atelier-h2 mt-2">{module.name}</h2>
                                <p className="mt-2 text-sm leading-6 text-[#545852]">{module.detail}</p>
                            </article>
                        ))}
                    </div>
                </section>
            </main>
        </>
    );
}
