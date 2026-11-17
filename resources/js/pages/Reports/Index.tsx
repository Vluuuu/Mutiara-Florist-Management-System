import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Input } from '@/components/ui/input';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { formatAmount, formatDateWib, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppPageProps, DailyTrendItem, FinancialReportData, ReportPreset } from '@/types';

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
    const { errors } = usePage<AppPageProps>().props;
    const { period, summary, fulfillment_breakdown, payment_breakdown, daily_trends, notes } = report;

    const [selectedPreset, setSelectedPreset] = useState<ReportPreset>(period.preset);
    const [customFrom, setCustomFrom] = useState<string>(period.from);
    const [customTo, setCustomTo] = useState<string>(period.to);
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [dayViewOverride, setDayViewOverride] = useState<'active' | 'all' | null>(null);
    const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
        typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
    );
    const [isLoading, setIsLoading] = useState(false);

    const onlyActiveDays =
        dayViewOverride !== null ? dayViewOverride === 'active' : isCompactViewport;

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mql = window.matchMedia('(max-width: 1023px)');
        const update = () => setIsCompactViewport(mql.matches);
        update();
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        setSelectedPreset(period.preset);
        setCustomFrom(period.from);
        setCustomTo(period.to);
    }, [period.preset, period.from, period.to]);

    useEffect(() => {
        const stopStart = router.on('start', () => setIsLoading(true));
        const stopFinish = router.on('finish', () => setIsLoading(false));
        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    const handleSelectPreset = (preset: ReportPreset) => {
        setSelectedPreset(preset);
        setDateRangeError(null);
        if (preset !== 'custom') {
            router.get(
                '/ui-reports',
                { preset },
                { preserveState: true, preserveScroll: true },
            );
        }
    };

    const handleApplyCustom = (e: FormEvent) => {
        e.preventDefault();
        if (!customFrom || !customTo) {
            setDateRangeError('Tanggal awal dan tanggal akhir wajib diisi.');
            return;
        }
        if (customFrom > customTo) {
            setDateRangeError('Tanggal akhir tidak boleh lebih awal dari tanggal awal.');
            return;
        }
        setDateRangeError(null);
        router.get(
            '/ui-reports',
            { preset: 'custom', from: customFrom, to: customTo },
            { preserveState: true, preserveScroll: true },
        );
    };

    const exportUrl = `/ui-reports/export?preset=${encodeURIComponent(period.preset)}&from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`;

    const getPercent = (val: number, total: number) => {
        if (total <= 0) return 0;
        return Math.round((val / total) * 100);
    };

    const activeDaysCount = useMemo(
        () =>
            daily_trends.filter(
                (day) =>
                    day.orders_count > 0 ||
                    day.billed > 0 ||
                    day.cash_in > 0 ||
                    day.cash_out > 0,
            ).length,
        [daily_trends],
    );

    const totalPeriodDays = useMemo(() => {
        const start = Date.parse(`${period.from}T00:00:00Z`);
        const end = Date.parse(`${period.to}T00:00:00Z`);
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
            return daily_trends.length;
        }
        return Math.round((end - start) / 86400000) + 1;
    }, [period.from, period.to, daily_trends.length]);

    const isDailyTrendsCapped = totalPeriodDays > daily_trends.length;
    const dailyFirstDate = daily_trends[0]?.date;
    const dailyLastDate = daily_trends[daily_trends.length - 1]?.date;
    const fullDailyViewLabel = isDailyTrendsCapped
        ? `Maks. ${formatAmount(daily_trends.length)} Hari Terakhir`
        : `Semua Hari (${formatAmount(daily_trends.length)})`;

    const visibleTrends = useMemo(() => {
        if (!onlyActiveDays) return daily_trends;
        return daily_trends.filter(
            (day) =>
                day.orders_count > 0 ||
                day.billed > 0 ||
                day.cash_in > 0 ||
                day.cash_out > 0,
        );
    }, [daily_trends, onlyActiveDays]);

    const serverError = errors?.to ?? errors?.from ?? errors?.preset ?? dateRangeError;

    const averageOrderValue =
        summary.orders_count > 0 ? Math.round(summary.total_billed / summary.orders_count) : 0;

    const trendColumns: DataColumn<DailyTrendItem>[] = [
        {
            key: 'date',
            header: 'Tanggal',
            cellClassName: 'whitespace-nowrap font-semibold text-[#1E2420] tabular-nums',
            render: (day) => formatDateWib(day.date),
        },
        {
            key: 'orders_count',
            header: 'Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap tabular-nums',
            render: (day) =>
                day.orders_count > 0 ? (
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#DCFCE7] text-xs font-bold text-[#166534]">
                        {formatAmount(day.orders_count)}
                    </span>
                ) : (
                    <span className="text-[#525B54]">-</span>
                ),
        },
        {
            key: 'billed',
            header: 'Nilai Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-medium text-[#1E2420] tabular-nums',
            render: (day) => (day.billed > 0 ? formatRupiah(day.billed) : '-'),
        },
        {
            key: 'cash_in',
            header: 'Kas Masuk',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-semibold text-[#166534] tabular-nums',
            render: (day) => (day.cash_in > 0 ? formatRupiah(day.cash_in) : '-'),
        },
        {
            key: 'cash_out',
            header: 'Kas Keluar',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-semibold text-[#92400E] tabular-nums',
            render: (day) => (day.cash_out > 0 ? formatRupiah(day.cash_out) : '-'),
        },
        {
            key: 'diff',
            header: 'Selisih Kas Harian',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-bold tabular-nums',
            render: (day) => {
                const diff = day.cash_in - day.cash_out;
                if (diff === 0) return <span className="text-[#525B54]">-</span>;
                return (
                    <span className={diff > 0 ? 'text-[#143326]' : 'text-[#8C3B4A]'}>
                        {formatRupiah(diff)}
                    </span>
                );
            },
        },
    ];

    const fulfillmentItems = [
        { label: 'Baru', count: fulfillment_breakdown.NEW, barColor: 'bg-[#6B7280]' },
        { label: 'Diproses', count: fulfillment_breakdown.PROCESSING, barColor: 'bg-[#B45309]' },
        { label: 'Siap kirim', count: fulfillment_breakdown.READY, barColor: 'bg-[#1D4ED8]' },
        { label: 'Selesai', count: fulfillment_breakdown.COMPLETED, barColor: 'bg-[#166534]' },
    ];

    const paymentItems = [
        { label: 'Belum bayar', count: payment_breakdown.UNPAID, barColor: 'bg-[#8C3B4A]' },
        { label: 'Sebagian', count: payment_breakdown.PARTIAL, barColor: 'bg-[#B45309]' },
        { label: 'Lunas', count: payment_breakdown.PAID, barColor: 'bg-[#166534]' },
    ];

    return (
        <AppLayout title="Laporan Keuangan">
            <Head title="Laporan Keuangan" />

            {/* Header */}
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Laporan Keuangan & Operasional
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Rekap pesanan, arus kas masuk dan keluar dari catatan sah, serta snapshot piutang berjalan.
                    </p>
                </div>

                <div>
                    <Button asChild variant="primary">
                        <a
                            href={exportUrl}
                            title="Unduh laporan lengkap dalam format Excel (.xlsx)"
                        >
                            <FileSpreadsheet className="size-4" aria-hidden="true" />
                            <span>Unduh Excel (.xlsx)</span>
                            <Download className="size-4 opacity-85" aria-hidden="true" />
                        </a>
                    </Button>
                </div>
            </div>

            {serverError && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2.5 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3.5 text-sm font-medium text-[#991B1B]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{serverError}</span>
                </div>
            )}

            {/* Period Filter Card */}
            <Card className="mb-6 border-[#E3DED4] p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div
                        className="flex flex-wrap items-center gap-2"
                        role="group"
                        aria-label="Pilihan rentang periode laporan"
                    >
                        {PRESET_OPTIONS.map((opt) => {
                            const selected = selectedPreset === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    aria-pressed={selected}
                                    disabled={isLoading}
                                    onClick={() => handleSelectPreset(opt.key)}
                                    className={cn(
                                        'inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-xs font-bold transition-colors',
                                        selected
                                            ? 'border-[#143326] bg-[#143326] text-white'
                                            : 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#F1EDE6]',
                                    )}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 rounded-md border border-[#E3DED4] bg-[#F1EDE6] px-3.5 py-2 text-xs font-semibold text-[#1E2420] tabular-nums">
                        <Calendar className="size-4 text-[#143326]" aria-hidden="true" />
                        <span>Periode: {period.label}</span>
                    </div>
                </div>

                {selectedPreset === 'custom' && (
                    <form
                        onSubmit={handleApplyCustom}
                        noValidate
                        className="mt-4 grid grid-cols-1 items-end gap-3 border-t border-[#E3DED4] pt-4 sm:grid-cols-[1fr_1fr_auto]"
                    >
                        <FormField id="report-from" label="Dari tanggal" required>
                            <Input
                                id="report-from"
                                type="date"
                                value={customFrom}
                                onChange={(e) => {
                                    setCustomFrom(e.target.value);
                                    setDateRangeError(null);
                                }}
                                invalid={Boolean(serverError)}
                                required
                            />
                        </FormField>

                        <FormField id="report-to" label="Sampai tanggal" required>
                            <Input
                                id="report-to"
                                type="date"
                                value={customTo}
                                onChange={(e) => {
                                    setCustomTo(e.target.value);
                                    setDateRangeError(null);
                                }}
                                invalid={Boolean(serverError)}
                                required
                            />
                        </FormField>

                        <Button type="submit" variant="primary" disabled={isLoading}>
                            Terapkan Rentang
                        </Button>
                    </form>
                )}

                {isLoading && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="mt-3 text-xs font-semibold text-[#143326]"
                    >
                        Menghitung ulang data laporan...
                    </p>
                )}
            </Card>

            {/* KPI Cards Grid */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. Total Nilai Pesanan */}
                <Card className="flex flex-col justify-between border-[#E3DED4] p-5">
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
                                Total Nilai Pesanan
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-[#E6EFEA] text-[#143326]">
                                <ReceiptText className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-[#1E2420] tabular-nums">
                            {formatRupiah(summary.total_billed)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54] tabular-nums">
                            Dari <strong className="font-bold text-[#1E2420]">{formatAmount(summary.orders_count)} pesanan</strong> dibuat pada periode ini
                        </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#E3DED4] pt-3 text-xs text-[#525B54] tabular-nums">
                        <span>
                            Bunga: <strong className="font-semibold text-[#1E2420]">{formatRupiah(summary.flower_total)}</strong>
                        </span>
                        <span>
                            Ongkir ditagihkan: <strong className="font-semibold text-[#1E2420]">{formatRupiah(summary.shipping_total)}</strong>
                        </span>
                    </div>
                </Card>

                {/* 2. Kas Masuk Sah */}
                <Card className="flex flex-col justify-between border-[#E3DED4] p-5">
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
                                Kas Masuk (Sah)
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#166534]">
                                <Wallet className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-[#166534] tabular-nums">
                            {formatRupiah(summary.cash_in)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54]">
                            Total pembayaran diterima yang berstatus Tercatat
                        </p>
                    </div>
                    <div className="mt-4 border-t border-[#E3DED4] pt-3 text-xs font-medium text-[#166534]">
                        <span className="inline-flex items-center gap-1.5">
                            <TrendingUp className="size-3.5" aria-hidden="true" />
                            Transaksi dibatalkan dikecualikan
                        </span>
                    </div>
                </Card>

                {/* 3. Kas Keluar Sah */}
                <Card className="flex flex-col justify-between border-[#E3DED4] p-5">
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
                                Kas Keluar (Sah)
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#92400E]">
                                <Receipt className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-[#1E2420] tabular-nums">
                            {formatRupiah(summary.cash_out)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54]">
                            Total belanja operasional toko yang berstatus Tercatat
                        </p>
                    </div>
                    <div className="mt-4 border-t border-[#E3DED4] pt-3 text-xs font-medium text-[#92400E]">
                        <span className="inline-flex items-center gap-1.5">
                            <TrendingDown className="size-3.5" aria-hidden="true" />
                            Pengeluaran dibatalkan dikecualikan
                        </span>
                    </div>
                </Card>

                {/* 4. Selisih Kas */}
                <Card className="flex flex-col justify-between border-[#E3DED4] bg-[#F1EDE6] p-5">
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#143326]">
                                {notes.cash_diff_label}
                            </span>
                            <span className="rounded-md bg-[#E6EFEA] px-2 py-0.5 text-[11px] font-bold text-[#143326]">
                                Arus Kas Periode
                            </span>
                        </div>
                        <p
                            className={cn(
                                'mt-3 text-2xl font-bold tracking-tight tabular-nums',
                                summary.cash_diff >= 0 ? 'text-[#143326]' : 'text-[#8C3B4A]',
                            )}
                        >
                            {formatRupiah(summary.cash_diff)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54]">
                            Kas Masuk dikurangi Kas Keluar pada periode ini
                        </p>
                    </div>
                    <div className="mt-4 rounded-md border border-[#E3DED4] bg-white p-2.5 text-xs text-[#1E2420]">
                        <div className="flex items-start gap-1.5">
                            <Info className="mt-0.5 size-3.5 shrink-0 text-[#143326]" aria-hidden="true" />
                            <span>
                                <strong className="font-bold">Perhatian:</strong> {notes.cash_diff_disclaimer}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* 5. Piutang Berjalan */}
                <Card className="flex flex-col justify-between border-[#E3DED4] p-5">
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
                                Piutang Berjalan
                            </span>
                            <span className="rounded-md bg-[#FDF2F4] px-2 py-0.5 text-[11px] font-bold text-[#8C3B4A]">
                                Snapshot Saat Ini
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-[#8C3B4A] tabular-nums">
                            {formatRupiah(summary.current_outstanding)}
                        </p>
                        <p className="mt-1 text-xs text-[#525B54] tabular-nums">
                            Sisa tagihan terbuka dari{' '}
                            <strong className="font-bold text-[#1E2420]">
                                {formatAmount(summary.open_receivables_count)} pesanan
                            </strong>{' '}
                            belum lunas
                        </p>
                    </div>
                    <div className="mt-4 rounded-md border border-[#8C3B4A]/20 bg-[#FDF2F4] p-2.5 text-xs text-[#1E2420]">
                        <div className="flex items-start gap-1.5">
                            <Info className="mt-0.5 size-3.5 shrink-0 text-[#8C3B4A]" aria-hidden="true" />
                            <span>{notes.outstanding_disclaimer}</span>
                        </div>
                    </div>
                </Card>

                {/* 6. Volume Pesanan */}
                <Card className="flex flex-col justify-between border-[#E3DED4] p-5">
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
                                Volume Pesanan
                            </span>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-[#F1EDE6] text-[#1E2420]">
                                <ShoppingBag className="size-4.5" aria-hidden="true" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tracking-tight text-[#1E2420] tabular-nums">
                            {formatAmount(summary.orders_count)}{' '}
                            <span className="text-sm font-medium text-[#525B54]">pesanan</span>
                        </p>
                        <p className="mt-1 text-xs text-[#525B54] tabular-nums">
                            Rata-rata per pesanan:{' '}
                            <strong className="font-bold text-[#1E2420]">
                                {formatRupiah(averageOrderValue)}
                            </strong>
                        </p>
                    </div>
                    <div className="mt-4 border-t border-[#E3DED4] pt-3 text-xs text-[#525B54]">
                        Dikelompokkan berdasarkan tanggal pembuatan nota pesanan
                    </div>
                </Card>
            </div>

            {/* Breakdowns */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="border-[#E3DED4] p-5">
                    <h2 className="text-base font-bold text-[#1E2420]">
                        Status Pengerjaan Pesanan
                    </h2>
                    <p className="mt-0.5 text-xs text-[#525B54] tabular-nums">
                        Sebaran pesanan yang dibuat pada periode ini ({formatAmount(summary.orders_count)} total)
                    </p>

                    <div className="mt-4 space-y-3.5">
                        {fulfillmentItems.map((item) => {
                            const pct = getPercent(item.count, summary.orders_count);
                            return (
                                <div key={item.label}>
                                    <div className="flex items-center justify-between text-xs tabular-nums">
                                        <span className="font-bold text-[#1E2420]">{item.label}</span>
                                        <span className="text-[#525B54]">
                                            <strong className="font-bold text-[#1E2420]">
                                                {formatAmount(item.count)}
                                            </strong>{' '}
                                            pesanan ({pct}%)
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#F1EDE6]">
                                        <div
                                            className={cn('h-full rounded-full transition-all duration-300', item.barColor)}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card className="border-[#E3DED4] p-5">
                    <h2 className="text-base font-bold text-[#1E2420]">
                        Status Pembayaran Pesanan
                    </h2>
                    <p className="mt-0.5 text-xs text-[#525B54]">
                        Kondisi pelunasan pesanan yang dibuat dalam periode terpilih
                    </p>

                    <div className="mt-4 space-y-3.5">
                        {paymentItems.map((item) => {
                            const pct = getPercent(item.count, summary.orders_count);
                            return (
                                <div key={item.label}>
                                    <div className="flex items-center justify-between text-xs tabular-nums">
                                        <span className="font-bold text-[#1E2420]">{item.label}</span>
                                        <span className="text-[#525B54]">
                                            <strong className="font-bold text-[#1E2420]">
                                                {formatAmount(item.count)}
                                            </strong>{' '}
                                            pesanan ({pct}%)
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#F1EDE6]">
                                        <div
                                            className={cn('h-full rounded-full transition-all duration-300', item.barColor)}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Daily Cashflow Trends */}
            <Card className="mb-6 overflow-hidden border-[#E3DED4]">
                <div className="flex flex-col gap-3 border-b border-[#E3DED4] bg-[#FAF8F4]/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                        <h2 className="text-base font-bold text-[#1E2420]">
                            Rincian Arus Transaksi Harian
                        </h2>
                        <p className="mt-0.5 text-xs text-[#525B54]">
                            {isDailyTrendsCapped
                                ? `Menampilkan ${formatAmount(activeDaysCount)} hari bertransaksi dalam ${formatAmount(daily_trends.length)} hari terakhir (${dailyFirstDate ? formatDateWib(dailyFirstDate) : '-'} s.d. ${dailyLastDate ? formatDateWib(dailyLastDate) : '-'}) dari total ${formatAmount(totalPeriodDays)} hari periode.`
                                : `Nilai pesanan baru, kas masuk sah, dan kas keluar sah per hari (${formatAmount(activeDaysCount)} hari bertransaksi dari ${formatAmount(daily_trends.length)} hari ditampilkan).`}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:shrink-0" role="group" aria-label="Tampilan hari laporan">
                        <button
                            type="button"
                            aria-pressed={onlyActiveDays}
                            onClick={() => setDayViewOverride('active')}
                            className={cn(
                                'inline-flex min-h-[44px] items-center rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
                                onlyActiveDays
                                    ? 'border-[#143326] bg-[#143326] text-white'
                                    : 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#F1EDE6]',
                            )}
                        >
                            Hanya Hari Bertransaksi ({formatAmount(activeDaysCount)})
                        </button>
                        <button
                            type="button"
                            aria-pressed={!onlyActiveDays}
                            onClick={() => setDayViewOverride('all')}
                            className={cn(
                                'inline-flex min-h-[44px] items-center rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
                                !onlyActiveDays
                                    ? 'border-[#143326] bg-[#143326] text-white'
                                    : 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#F1EDE6]',
                            )}
                        >
                            {fullDailyViewLabel}
                        </button>
                    </div>
                </div>

                {isDailyTrendsCapped && (
                    <div
                        role="status"
                        className="flex items-start gap-2.5 border-b border-[#E3DED4] bg-[#FEF3C7]/70 px-4 py-3 text-xs text-[#92400E] sm:px-5"
                    >
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p>
                            <strong className="font-bold">Batas Tampilan Harian (Maksimal {formatAmount(daily_trends.length)} Hari Terakhir):</strong>{' '}
                            Ringkasan total keuangan di bawah dan pada kartu atas mencakup seluruh periode{' '}
                            <strong className="font-semibold">
                                {formatAmount(totalPeriodDays)} hari ({formatDateWib(period.from)} s.d. {formatDateWib(period.to)})
                            </strong>
                            , sedangkan rincian baris harian hanya menampilkan maksimal {formatAmount(daily_trends.length)} hari terakhir.
                        </p>
                    </div>
                )}

                {/* Period Total Bar */}
                <div className="grid grid-cols-2 gap-3 border-b border-[#E3DED4] bg-[#F1EDE6] p-4 text-xs tabular-nums sm:grid-cols-4 sm:px-5">
                    <div>
                        <span className="block text-[#525B54]">Total Nilai Pesanan</span>
                        <strong className="mt-0.5 block text-sm font-bold text-[#1E2420]">
                            {formatRupiah(summary.total_billed)}
                        </strong>
                    </div>
                    <div>
                        <span className="block text-[#525B54]">Total Kas Masuk</span>
                        <strong className="mt-0.5 block text-sm font-bold text-[#166534]">
                            {formatRupiah(summary.cash_in)}
                        </strong>
                    </div>
                    <div>
                        <span className="block text-[#525B54]">Total Kas Keluar</span>
                        <strong className="mt-0.5 block text-sm font-bold text-[#92400E]">
                            {formatRupiah(summary.cash_out)}
                        </strong>
                    </div>
                    <div>
                        <span className="block text-[#525B54]">Selisih Kas Periode</span>
                        <strong
                            className={cn(
                                'mt-0.5 block text-sm font-bold',
                                summary.cash_diff >= 0 ? 'text-[#143326]' : 'text-[#8C3B4A]',
                            )}
                        >
                            {formatRupiah(summary.cash_diff)}
                        </strong>
                    </div>
                </div>

                <div className="p-4 sm:p-0">
                    <ResponsiveDataList
                        items={visibleTrends}
                        columns={trendColumns}
                        keyExtractor={(day) => day.date}
                        tableAriaLabel="Rincian arus transaksi harian"
                        emptyState={
                            <div className="px-6 py-10 text-center text-sm text-[#525B54]">
                                <p>
                                    {onlyActiveDays
                                        ? 'Tidak ada hari dengan transaksi pesanan atau kas pada periode ini.'
                                        : 'Tidak ada data tanggal pada periode yang dipilih.'}
                                </p>
                                {onlyActiveDays && daily_trends.length > 0 && (
                                    <div className="mt-3">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setDayViewOverride('all')}
                                        >
                                            {isDailyTrendsCapped
                                                ? `Tampilkan ${formatAmount(daily_trends.length)} Hari Terakhir`
                                                : `Tampilkan Semua ${formatAmount(daily_trends.length)} Hari`}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        }
                        renderMobileCard={(day) => {
                            const diff = day.cash_in - day.cash_out;
                            return (
                                <div className="rounded-[10px] border border-[#E3DED4] bg-white p-3.5 text-xs tabular-nums">
                                    <div className="flex items-center justify-between gap-2 border-b border-[#E3DED4] pb-2">
                                        <span className="text-sm font-bold text-[#1E2420]">
                                            {formatDateWib(day.date)}
                                        </span>
                                        <span className="font-semibold text-[#525B54]">
                                            {formatAmount(day.orders_count)} pesanan
                                        </span>
                                    </div>
                                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="block text-[#525B54]">Nilai Pesanan</span>
                                            <strong className="font-semibold text-[#1E2420]">
                                                {day.billed > 0 ? formatRupiah(day.billed) : '-'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[#525B54]">Kas Masuk</span>
                                            <strong className="font-semibold text-[#166534]">
                                                {day.cash_in > 0 ? formatRupiah(day.cash_in) : '-'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[#525B54]">Kas Keluar</span>
                                            <strong className="font-semibold text-[#92400E]">
                                                {day.cash_out > 0 ? formatRupiah(day.cash_out) : '-'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[#525B54]">Selisih Harian</span>
                                            <strong
                                                className={
                                                    diff > 0
                                                        ? 'font-bold text-[#143326]'
                                                        : diff < 0
                                                          ? 'font-bold text-[#8C3B4A]'
                                                          : 'text-[#525B54]'
                                                }
                                            >
                                                {diff !== 0 ? formatRupiah(diff) : '-'}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>
            </Card>

            {/* Financial & Accounting Notes */}
            <div className="rounded-[10px] border border-[#E3DED4] bg-[#F1EDE6] p-4 sm:p-5 text-xs text-[#1E2420]">
                <div className="flex items-start gap-2.5">
                    <Info className="mt-0.5 size-4 shrink-0 text-[#143326]" aria-hidden="true" />
                    <div className="space-y-1.5">
                        <p className="font-bold">Prinsip Pencatatan & Penjelasan Angka Laporan:</p>
                        <p>
                            1. <strong className="font-semibold">Nilai pesanan</strong> dikelompokkan berdasarkan tanggal pembuatan nota pesanan, terpisah dari tanggal uang diterima.
                        </p>
                        <p>
                            2. <strong className="font-semibold">Kas masuk dan kas keluar</strong> dikelompokkan berdasarkan tanggal transaksi kas riil (pembayaran dan pengeluaran sah).
                        </p>
                        <p>
                            3. Catatan koreksi yang sudah berstatus <strong className="font-semibold">Dibatalkan</strong> otomatis dikecualikan dari seluruh hitungan penerimaan dan pengeluaran kas.
                        </p>
                        <p>
                            4. <strong className="font-semibold">Selisih kas</strong> menunjukkan selisih arus kas masuk dan keluar pada periode terkait, <em>bukan</em> laba bersih akuntansi (karena belum memperhitungkan nilai persediaan bahan dan penyusutan aset).
                        </p>
                        <p>
                            5. <strong className="font-semibold">Piutang berjalan</strong> merupakan snapshot total sisa tagihan terbuka saat ini di seluruh sistem, bukan saldo historis pada akhir periode tertentu.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
