import { Head } from '@inertiajs/react';
import {
    CircleDollarSign,
    Clock3,
    Receipt,
    ReceiptText,
    ShoppingBag,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { StatCard } from '@/components/stat-card';
import { formatAmount } from '@/lib/format';
import type { DashboardNav, DashboardStats } from '@/types';

type DashboardProps = {
    stats: DashboardStats;
    nav: DashboardNav;
};

type MetricDef = {
    key: keyof DashboardStats;
    label: string;
    prefix: string;
    hint: string;
    icon: LucideIcon;
    emphasis?: boolean;
};

const metrics: MetricDef[] = [
    { key: 'orders', label: 'Total pesanan', prefix: '', hint: 'Jumlah order tercatat', icon: ShoppingBag },
    { key: 'billed', label: 'Nilai pesanan', prefix: 'Rp', hint: 'Termasuk ongkir terpisah', icon: ReceiptText },
    { key: 'received', label: 'Uang diterima', prefix: 'Rp', hint: 'Pembayaran POSTED yang telah dicatat', icon: Wallet },
    { key: 'outstanding', label: 'Piutang saat ini', prefix: 'Rp', hint: 'Sisa tagihan semua pesanan', icon: Clock3 },
    { key: 'expenses', label: 'Pengeluaran kas', prefix: 'Rp', hint: 'Pengeluaran POSTED yang tercatat', icon: Receipt },
    { key: 'cash_flow', label: 'Selisih kas sederhana', prefix: 'Rp', hint: 'Bukan laba bersih akuntansi', icon: CircleDollarSign, emphasis: true },
];

export default function Dashboard({ stats, nav }: DashboardProps) {
    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Ringkasan usaha
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-emerald-950">
                        Dashboard
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
                        Data kumulatif sejak awal pencatatan. Nilai pesanan dan uang yang sudah
                        diterima ditampilkan terpisah.
                    </p>
                </div>
                <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600">
                    Phase 3.3 · React
                </span>
            </div>

            <section
                aria-label="Statistik ringkasan"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
                {metrics.map((metric) => (
                    <StatCard
                        key={metric.key}
                        label={metric.label}
                        prefix={metric.prefix}
                        value={formatAmount(stats[metric.key])}
                        hint={metric.hint}
                        icon={metric.icon}
                        emphasis={metric.emphasis}
                    />
                ))}
            </section>

            <section className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
                <h2 className="text-base font-semibold text-emerald-950">
                    Pengembangan berikutnya
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                    Modul Pelanggan, Pesanan, Pembayaran, dan Pengeluaran masih memakai halaman
                    Blade lama dan dapat dibuka dari menu samping. Migrasi antarmuka modul-modul
                    tersebut akan mengikuti setelah dashboard ini terverifikasi.
                </p>
            </section>
        </AppLayout>
    );
}
