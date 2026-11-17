import { Head, Link } from '@inertiajs/react';
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
import { Button } from '@/components/ui/button';
import { formatAmount, formatRupiah } from '@/lib/format';
import type { DashboardNav, DashboardStats } from '@/types';

type DashboardProps = {
    stats: DashboardStats;
    nav: DashboardNav;
};

type MetricDef = {
    key: keyof DashboardStats;
    label: string;
    isCurrency: boolean;
    hint: string;
    icon: LucideIcon;
    emphasis?: boolean;
    tone?: 'default' | 'paid' | 'urgent';
};

const metrics: MetricDef[] = [
    {
        key: 'orders',
        label: 'Total Pesanan',
        isCurrency: false,
        hint: 'Jumlah nota pesanan tercatat',
        icon: ShoppingBag,
    },
    {
        key: 'billed',
        label: 'Total Nilai Pesanan',
        isCurrency: true,
        hint: 'Termasuk ongkos kirim terpisah',
        icon: ReceiptText,
    },
    {
        key: 'received',
        label: 'Uang Masuk (Sah)',
        isCurrency: true,
        hint: 'Pembayaran tercatat yang sah',
        icon: Wallet,
        tone: 'paid',
    },
    {
        key: 'outstanding',
        label: 'Sisa Piutang Berjalan',
        isCurrency: true,
        hint: 'Tagihan yang belum dilunasi',
        icon: Clock3,
        tone: 'urgent',
    },
    {
        key: 'expenses',
        label: 'Pengeluaran Kas (Sah)',
        isCurrency: true,
        hint: 'Biaya operasional tercatat',
        icon: Receipt,
    },
    {
        key: 'cash_flow',
        label: 'Selisih Kas Sederhana',
        isCurrency: true,
        hint: 'Kas masuk dikurangi biaya sah',
        icon: CircleDollarSign,
        emphasis: true,
    },
];

export default function Dashboard({ stats, nav }: DashboardProps) {
    const ordersHref = nav?.uiOrders ?? '/ui-orders';
    const paymentsHref = nav?.uiPayments ?? '/ui-payments';

    return (
        <AppLayout title="Hari Ini">
            <Head title="Hari Ini" />

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Ringkasan Operasional Toko
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Angka kumulatif sejak awal pencatatan. Nilai tagihan pesanan dan uang masuk dipisahkan.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="secondary">
                        <Link href={ordersHref}>Semua Pesanan</Link>
                    </Button>
                    <Button asChild variant="primary">
                        <Link href={paymentsHref}>Piutang &amp; Bayar</Link>
                    </Button>
                </div>
            </div>

            <section
                aria-label="Statistik ringkasan toko"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
                {metrics.map((metric) => (
                    <StatCard
                        key={metric.key}
                        label={metric.label}
                        value={
                            metric.isCurrency
                                ? formatRupiah(stats[metric.key])
                                : `${formatAmount(stats[metric.key])} Pesanan`
                        }
                        hint={metric.hint}
                        icon={metric.icon}
                        emphasis={metric.emphasis}
                        tone={metric.tone}
                    />
                ))}
            </section>
        </AppLayout>
    );
}
