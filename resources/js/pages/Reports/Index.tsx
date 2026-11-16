import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    BarChart3,
    Calendar,
    Download,
    FileSpreadsheet,
    Info,
    Receipt,
    ReceiptText,
    ShoppingBag,
    TrendingDown,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';
import type { FinancialReportData, ReportPreset } from '@/types';

type ReportsIndexProps = {
    report: FinancialReportData;
};

const PRESET_OPTIONS: Array<{ key: ReportPreset; label: string }> = [
    { key: 'today', label: 'Hari Ini' },
    { key: '7d', label: '7 Hari' },
    { key: '30d', label: '30 Hari' },
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'custom', label: 'Kustom' },
];

export default function ReportsIndex({ report }: ReportsIndexProps) {
    const { period, summary, fulfillment_breakdown, payment_breakdown, daily_trends, notes } = report;

    const [selectedPreset, setSelectedPreset] = useState<ReportPreset>(period.preset);
    const [customFrom, setCustomFrom] = useState<string>(period.from);
    const [customTo, setCustomTo] = useState<string>(period.to);

    const handleSelectPreset = (preset: ReportPreset) => {
        setSelectedPreset(preset);
        if (preset !== 'custom') {
            router.get(
                '/ui-reports',
                { preset },
                { preserveState: true, preserveScroll: true },
            );
        }
    };

    const handleApplyCustom = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            '/ui-reports',
            { preset: 'custom', from: customFrom, to: customTo },
            { preserveState: true, preserveScroll: true },
        );
    };

    const exportUrl = `/ui-reports/export?preset=${encodeURIComponent(period.preset)}&from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`;

    // Calculate percentage helper
    const getPercent = (val: number, total: number) => {
        if (total <= 0) return 0;
        return Math.round((val / total) * 100);
    };

    return (
        <AppLayout title="Laporan Keuangan & Operasional">
            <Head title="Laporan Keuangan & Operasional" />

            {/* Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                        Pembukuan & Analisis
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                        Laporan Keuangan & Operasional
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                        Ringkasan performa pesanan, arus kas riil, dan snapshot piutang berjalan.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <a
                        href={exportUrl}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                        title="Unduh laporan dalam format Excel (.xlsx)"
                    >
                        <FileSpreadsheet className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                        <span>Ekspor Excel (.xlsx)</span>
                        <Download className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
                    </a>
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="mb-6 border border-stone-200 bg-white p-4 shadow-xs">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs font-semibold text-stone-500">Periode:</span>
                        {PRESET_OPTIONS.map((opt) => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => handleSelectPreset(opt.key)}
                                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                    selectedPreset === opt.key
                                        ? 'bg-emerald-950 text-white shadow-xs'
                                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Active Period Label */}
                    <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                        <Calendar className="size-4 text-emerald-700" aria-hidden="true" />
                        <span className="font-semibold text-stone-900">{period.label}</span>
                    </div>
                </div>

                {/* Custom Date Form (Visible when 'custom' is active) */}
                {selectedPreset === 'custom' && (
                    <form
                        onSubmit={handleApplyCustom}
                        className="mt-4 flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3"
                    >
                        <div>
                            <label htmlFor="report-from" className="mb-1 block text-xs font-medium text-stone-700">
                                Dari Tanggal
                            </label>
                            <input
                                id="report-from"
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                required
                                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-800 shadow-2xs focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                            />
                        </div>
                        <div>
                            <label htmlFor="report-to" className="mb-1 block text-xs font-medium text-stone-700">
                                Sampai Tanggal
                            </label>
                            <input
                                id="report-to"
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                required
                                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-800 shadow-2xs focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                            />
                        </div>
                        <button
                            type="submit"
                            className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
                        >
                            Terapkan Rentang
                        </button>
                    </form>
                )}
            </Card>

            {/* KPI Cards Grid */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. Total Nilai Pesanan */}
                <Card className="flex flex-col justify-between border border-stone-200 bg-white p-5 shadow-xs">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                                Total Nilai Pesanan
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                                <ReceiptText className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                            Rp {formatAmount(summary.total_billed)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                            Dari total <strong className="font-semibold text-stone-800">{summary.orders_count} pesanan</strong> dibuat pada periode ini
                        </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3 text-[11px] text-stone-600">
                        <span>Bunga: <strong className="font-medium text-stone-900">Rp {formatAmount(summary.flower_total)}</strong></span>
                        <span>·</span>
                        <span>Ongkir: <strong className="font-medium text-stone-900">Rp {formatAmount(summary.shipping_total)}</strong></span>
                    </div>
                </Card>

                {/* 2. Kas Masuk (POSTED) */}
                <Card className="flex flex-col justify-between border border-stone-200 bg-white p-5 shadow-xs">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                                Kas Diterima (POSTED)
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                                <Wallet className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                            Rp {formatAmount(summary.cash_in)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                            Penerimaan uang riil yang sudah dicatat dalam periode ini
                        </p>
                    </div>
                    <div className="mt-4 border-t border-stone-100 pt-3 text-[11px] text-teal-800">
                        <span className="inline-flex items-center gap-1 font-medium">
                            <TrendingUp className="size-3.5" aria-hidden="true" />
                            Hanya transaksi valid berstatus POSTED
                        </span>
                    </div>
                </Card>

                {/* 3. Kas Keluar (POSTED) */}
                <Card className="flex flex-col justify-between border border-stone-200 bg-white p-5 shadow-xs">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                                Kas Keluar (POSTED)
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                                <Receipt className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                            Rp {formatAmount(summary.cash_out)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                            Pengeluaran operasional riil yang dicatat dalam periode ini
                        </p>
                    </div>
                    <div className="mt-4 border-t border-stone-100 pt-3 text-[11px] text-amber-800">
                        <span className="inline-flex items-center gap-1 font-medium">
                            <TrendingDown className="size-3.5" aria-hidden="true" />
                            Hanya pengeluaran valid berstatus POSTED
                        </span>
                    </div>
                </Card>

                {/* 4. Selisih Kas (Bukan Laba Bersih) */}
                <Card className="flex flex-col justify-between border border-emerald-200/80 bg-linear-to-br from-emerald-50/50 to-white p-5 shadow-xs">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
                                {notes.cash_diff_label}
                            </span>
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                                Arus Kas Periode
                            </span>
                        </div>
                        <p className={`mt-3 text-2xl font-bold tracking-tight sm:text-3xl ${
                            summary.cash_diff >= 0 ? 'text-emerald-950' : 'text-rose-700'
                        }`}>
                            Rp {formatAmount(summary.cash_diff)}
                        </p>
                        <p className="mt-1 text-xs text-stone-600">
                            Kas Masuk dikurangi Kas Keluar pada periode ini
                        </p>
                    </div>
                    <div className="mt-4 rounded-md border border-emerald-200/60 bg-white/80 p-2.5 text-[11px] text-stone-600">
                        <div className="flex items-start gap-1.5">
                            <Info className="size-3.5 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
                            <span><strong>Perhatian:</strong> {notes.cash_diff_disclaimer}</span>
                        </div>
                    </div>
                </Card>

                {/* 5. Piutang Berjalan (Snapshot) */}
                <Card className="flex flex-col justify-between border border-stone-200 bg-white p-5 shadow-xs">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                                Piutang Berjalan
                            </span>
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                Snapshot Saat Ini
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-amber-950 sm:text-3xl">
                            Rp {formatAmount(summary.current_outstanding)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                            Sisa tagihan terbuka dari <strong className="font-semibold text-stone-800">{summary.open_receivables_count} pesanan</strong> aktif
                        </p>
                    </div>
                    <div className="mt-4 rounded-md border border-amber-200/60 bg-amber-50/50 p-2.5 text-[11px] text-amber-900">
                        <div className="flex items-start gap-1.5">
                            <Info className="size-3.5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                            <span>{notes.outstanding_disclaimer}</span>
                        </div>
                    </div>
                </Card>

                {/* 6. Pesanan Dibuat Summary */}
                <Card className="flex flex-col justify-between border border-stone-200 bg-white p-5 shadow-xs">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                                Volume Pesanan
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
                                <ShoppingBag className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                            {summary.orders_count} <span className="text-base font-normal text-stone-500">pesanan</span>
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                            Rata-rata tagihan: <strong className="font-semibold text-stone-800">
                                Rp {formatAmount(summary.orders_count > 0 ? Math.round(summary.total_billed / summary.orders_count) : 0)}
                            </strong> per order
                        </p>
                    </div>
                    <div className="mt-4 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
                        Dihitung berdasarkan kolom <code className="rounded bg-stone-100 px-1 py-0.5 text-stone-800">order_date</code>
                    </div>
                </Card>
            </div>

            {/* Breakdown Grids: Status Pengerjaan & Status Pembayaran */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Fulfillment Status */}
                <Card className="border border-stone-200 bg-white p-5 shadow-xs">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                        Status Pengerjaan Pesanan
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                        Distribusi pesanan yang dibuat dalam periode terpilih ({summary.orders_count} total)
                    </p>

                    <div className="mt-4 space-y-3">
                        {/* NEW */}
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-stone-700">Baru (NEW)</span>
                                <span className="text-stone-500">
                                    <strong className="font-semibold text-stone-900">{fulfillment_breakdown.NEW}</strong> pesanan ({getPercent(fulfillment_breakdown.NEW, summary.orders_count)}%)
                                </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-stone-400 transition-all duration-300"
                                    style={{ width: `${getPercent(fulfillment_breakdown.NEW, summary.orders_count)}%` }}
                                />
                            </div>
                        </div>

                        {/* PROCESSING */}
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-amber-800">Diproses (PROCESSING)</span>
                                <span className="text-stone-500">
                                    <strong className="font-semibold text-stone-900">{fulfillment_breakdown.PROCESSING}</strong> pesanan ({getPercent(fulfillment_breakdown.PROCESSING, summary.orders_count)}%)
                                </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                                    style={{ width: `${getPercent(fulfillment_breakdown.PROCESSING, summary.orders_count)}%` }}
                                />
                            </div>
                        </div>

                        {/* READY */}
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-sky-800">Siap Kirim (READY)</span>
                                <span className="text-stone-500">
                                    <strong className="font-semibold text-stone-900">{fulfillment_breakdown.READY}</strong> pesanan ({getPercent(fulfillment_breakdown.READY, summary.orders_count)}%)
                                </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-sky-500 transition-all duration-300"
                                    style={{ width: `${getPercent(fulfillment_breakdown.READY, summary.orders_count)}%` }}
                                />
                            </div>
                        </div>

                        {/* COMPLETED */}
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-emerald-800">Selesai (COMPLETED)</span>
                                <span className="text-stone-500">
                                    <strong className="font-semibold text-stone-900">{fulfillment_breakdown.COMPLETED}</strong> pesanan ({getPercent(fulfillment_breakdown.COMPLETED, summary.orders_count)}%)
                                </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                                    style={{ width: `${getPercent(fulfillment_breakdown.COMPLETED, summary.orders_count)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Payment Status */}
                <Card className="border border-stone-200 bg-white p-5 shadow-xs">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                        Status Pembayaran Pesanan
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                        Kondisi pelunasan pesanan yang dibuat dalam periode terpilih
                    </p>

                    <div className="mt-4 space-y-3">
                        {/* UNPAID */}
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-rose-800">Belum Dibayar (UNPAID)</span>
                                <span className="text-stone-500">
                                    <strong className="font-semibold text-stone-900">{payment_breakdown.UNPAID}</strong> pesanan ({getPercent(payment_breakdown.UNPAID, summary.orders_count)}%)
                                </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-rose-500 transition-all duration-300"
                                    style={{ width: `${getPercent(payment_breakdown.UNPAID, summary.orders_count)}%` }}
                                />
                            </div>
                        </div>

                        {/* PARTIAL */}
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-amber-800">Dibayar Sebagian (PARTIAL)</span>
                                <span className="text-stone-500">
                                    <strong className="font-semibold text-stone-900">{payment_breakdown.PARTIAL}</strong> pesanan ({getPercent(payment_breakdown.PARTIAL, summary.orders_count)}%)
                                </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                                    style={{ width: `${getPercent(payment_breakdown.PARTIAL, summary.orders_count)}%` }}
                                />
                            </div>
                        </div>

                        {/* PAID */}
                        <div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-emerald-800">Lunas (PAID)</span>
                                <span className="text-stone-500">
                                    <strong className="font-semibold text-stone-900">{payment_breakdown.PAID}</strong> pesanan ({getPercent(payment_breakdown.PAID, summary.orders_count)}%)
                                </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                                    style={{ width: `${getPercent(payment_breakdown.PAID, summary.orders_count)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Daily Trend Table */}
            <Card className="mb-6 border border-stone-200 bg-white p-5 shadow-xs">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                            Rincian Arus Transaksi Harian
                        </h2>
                        <p className="text-xs text-stone-500">
                            Perbandingan nilai pesanan dibuat, kas masuk (POSTED), dan kas keluar (POSTED) per tanggal
                        </p>
                    </div>
                    <span className="text-xs font-semibold text-stone-500">
                        {daily_trends.length} hari dalam rentang
                    </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-stone-200">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                            <tr>
                                <th scope="col" className="px-4 py-3">Tanggal</th>
                                <th scope="col" className="px-4 py-3 text-center">Pesanan</th>
                                <th scope="col" className="px-4 py-3 text-right">Nilai Pesanan</th>
                                <th scope="col" className="px-4 py-3 text-right">Kas Masuk (POSTED)</th>
                                <th scope="col" className="px-4 py-3 text-right">Kas Keluar (POSTED)</th>
                                <th scope="col" className="px-4 py-3 text-right">Selisih Kas Harian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white text-stone-700">
                            {daily_trends.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                                        Tidak ada data pada periode ini
                                    </td>
                                </tr>
                            ) : (
                                daily_trends.map((day) => {
                                    const diff = day.cash_in - day.cash_out;
                                    return (
                                        <tr key={day.date} className="hover:bg-stone-50/70 transition-colors">
                                            <td className="px-4 py-2.5 font-medium text-stone-900 whitespace-nowrap">
                                                {day.date}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                {day.orders_count > 0 ? (
                                                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-900">
                                                        {day.orders_count}
                                                    </span>
                                                ) : (
                                                    <span className="text-stone-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-stone-900">
                                                {day.billed > 0 ? `Rp ${formatAmount(day.billed)}` : '-'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-emerald-800">
                                                {day.cash_in > 0 ? `Rp ${formatAmount(day.cash_in)}` : '-'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-amber-800">
                                                {day.cash_out > 0 ? `Rp ${formatAmount(day.cash_out)}` : '-'}
                                            </td>
                                            <td className={`px-4 py-2.5 text-right font-semibold ${
                                                diff > 0 ? 'text-emerald-900' : diff < 0 ? 'text-rose-700' : 'text-stone-400'
                                            }`}>
                                                {diff !== 0 ? `Rp ${formatAmount(diff)}` : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        <tfoot className="border-t-2 border-stone-300 bg-stone-50 font-bold text-stone-900">
                            <tr>
                                <td className="px-4 py-3">TOTAL PERIODE</td>
                                <td className="px-4 py-3 text-center">{summary.orders_count}</td>
                                <td className="px-4 py-3 text-right">Rp {formatAmount(summary.total_billed)}</td>
                                <td className="px-4 py-3 text-right text-emerald-900">Rp {formatAmount(summary.cash_in)}</td>
                                <td className="px-4 py-3 text-right text-amber-900">Rp {formatAmount(summary.cash_out)}</td>
                                <td className={`px-4 py-3 text-right ${summary.cash_diff >= 0 ? 'text-emerald-950' : 'text-rose-700'}`}>
                                    Rp {formatAmount(summary.cash_diff)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Card>

            {/* Informational Notes Alert */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600 shadow-2xs">
                <div className="flex items-start gap-2.5">
                    <Info className="size-4 shrink-0 text-emerald-800 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                        <p className="font-semibold text-stone-800">Prinsip Akuntansi & Rekonsiliasi Data:</p>
                        <p>1. <strong>Nilai pesanan</strong> dikelompokkan menurut tanggal pembuatan pesanan (<code>order_date</code>), terpisah dari tanggal penerimaan uang.</p>
                        <p>2. <strong>Kas masuk dan kas keluar</strong> dikelompokkan menurut tanggal transaksi kas riil (<code>payment_date</code> dan <code>expense_date</code>).</p>
                        <p>3. Transaksi koreksi berstatus <strong>VOIDED</strong> otomatis dikecualikan dari seluruh agregasi penerimaan dan pengeluaran kas.</p>
                        <p>4. <strong>Selisih kas</strong> merefleksikan saldo arus kas riil pada periode terkait, <em>bukan</em> laba bersih akuntansi (karena belum memperhitungkan harga pokok persediaan dan penyusutan aset).</p>
                        <p>5. <strong>Piutang berjalan</strong> adalah snapshot saldo tagihan terbuka saat ini di seluruh sistem, bukan saldo historis akhir periode terpilih.</p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
