import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Deferred, Head, router, usePage } from '@inertiajs/react';
import { AlertCircle, ChevronDown, ChevronUp, Download, FileSpreadsheet } from 'lucide-react';
import { LedgerSummaryStrip } from '@/components/ledger-summary-strip';
import {
    ExpenseCategoryCard,
    FinancialTrendChart,
    StatusDistributionPanel,
} from '@/components/report-charts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Input } from '@/components/ui/input';
import {
    DeferredSectionError,
    PageHeaderSkeleton,
    ReportBreakdownsSkeleton,
    ReportChartSkeleton,
    SummaryStripSkeleton,
} from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { useNavigationState, useScopedFilterLoading } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AppPageProps,
    FinancialReportData,
    ReportBreakdownsData,
    ReportChartPoint,
    ReportGranularity,
    ReportPreset,
    ReportTrendsData,
} from '@/types';

type ReportsIndexProps = {
    report?: FinancialReportData;
    reportBreakdowns?: ReportBreakdownsData;
    reportTrends?: ReportTrendsData;
};

const PRESET_OPTIONS: Array<{ key: ReportPreset; label: string }> = [
    { key: 'today', label: 'Hari Ini' },
    { key: '7d', label: '7 Hari' },
    { key: '30d', label: '30 Hari' },
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'this_year', label: 'Tahun Ini' },
    { key: 'custom', label: 'Kustom' },
];

const GRANULARITY_LABEL: Record<ReportGranularity, string> = {
    daily: 'Harian',
    weekly: 'Mingguan',
    monthly: 'Bulanan',
    yearly: 'Tahunan',
};

export default function ReportsIndex({
    report,
    reportBreakdowns,
    reportTrends,
}: ReportsIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
    const { deferredErrors } = useNavigationState();
    const isFilterLoading = useScopedFilterLoading('/ui-reports');
    useInstantPageGuard(Boolean(report));

    const period = report?.period;
    const summary = report?.summary;
    const notes = report?.notes;

    const effectiveBreakdowns: ReportBreakdownsData | undefined =
        reportBreakdowns ??
        (report?.fulfillment_breakdown && report?.payment_breakdown
            ? {
                  fulfillment_breakdown: report.fulfillment_breakdown,
                  payment_breakdown: report.payment_breakdown,
                  expense_breakdown: report.expense_breakdown ?? [],
              }
            : undefined);

    const effectiveTrends: ReportTrendsData | undefined =
        reportTrends ??
        (report?.daily_trends
            ? {
                  daily_trends: report.daily_trends,
                  chart_series: report.chart_series,
              }
            : undefined);

    const dailyTrends = effectiveTrends?.daily_trends ?? [];
    const chartSeries = effectiveTrends?.chart_series;

    const [selectedPreset, setSelectedPreset] = useState<ReportPreset>(period?.preset ?? '30d');
    const [customFrom, setCustomFrom] = useState<string>(period?.from ?? '');
    const [customTo, setCustomTo] = useState<string>(period?.to ?? '');
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [tableOpen, setTableOpen] = useState(false);
    const [onlyActiveRows, setOnlyActiveRows] = useState(true);
    const [isChartLoading, setIsChartLoading] = useState(false);
    const isLoading = isFilterLoading || isChartLoading;

    useEffect(() => {
        if (!period) return;
        setSelectedPreset(period.preset);
        setCustomFrom(period.from);
        setCustomTo(period.to);
    }, [period?.preset, period?.from, period?.to]);

    const activeGranularity: ReportGranularity = chartSeries?.granularity ?? 'weekly';

    const visitReport = (
        nextPreset: ReportPreset,
        nextFrom?: string,
        nextTo?: string,
        nextGranularity?: ReportGranularity,
        trendsOnly = false,
    ) => {
        const params: Record<string, string> = { preset: nextPreset };
        if (nextPreset === 'custom' && nextFrom && nextTo) {
            params.from = nextFrom;
            params.to = nextTo;
        }
        if (nextGranularity) {
            params.granularity = nextGranularity;
        }
        if (trendsOnly) {
            router.get('/ui-reports', params, {
                only: ['reportTrends'],
                preserveState: true,
                preserveScroll: true,
                onStart: () => setIsChartLoading(true),
                onFinish: () => setIsChartLoading(false),
            });
            return;
        }
        router.get('/ui-reports', params, { preserveState: true, preserveScroll: true });
    };

    const handleSelectPreset = (preset: ReportPreset) => {
        setSelectedPreset(preset);
        setDateRangeError(null);
        if (preset !== 'custom') {
            visitReport(preset);
        }
    };

    const handleSelectGranularity = (granularity: ReportGranularity) => {
        if (!period) return;
        visitReport(period.preset, period.from, period.to, granularity, true);
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
        visitReport('custom', customFrom, customTo);
    };

    const exportUrl = period
        ? `/ui-reports/export?preset=${encodeURIComponent(period.preset)}&from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`
        : '#';

    const fallbackPoints: ReportChartPoint[] = useMemo(
        () =>
            dailyTrends.map((day) => ({
                key: day.date,
                label: day.formatted_date,
                full_label: day.date,
                orders_count: day.orders_count,
                billed: day.billed,
                cash_in: day.cash_in,
                cash_out: day.cash_out,
                cash_diff: day.cash_in - day.cash_out,
            })),
        [dailyTrends],
    );

    const seriesPoints = chartSeries?.points ?? fallbackPoints;
    const seriesRangeLabel =
        chartSeries?.range_label ??
        (period ? `Per Hari (${period.from} - ${period.to})` : 'Per Hari');
    const seriesNotice = chartSeries?.notice ?? null;

    const activePointsCount = useMemo(
        () =>
            seriesPoints.filter(
                (pt) => pt.orders_count > 0 || pt.billed > 0 || pt.cash_in > 0 || pt.cash_out > 0,
            ).length,
        [seriesPoints],
    );

    const visibleSeriesPoints = useMemo(() => {
        if (!onlyActiveRows) return seriesPoints;
        return seriesPoints.filter(
            (pt) => pt.orders_count > 0 || pt.billed > 0 || pt.cash_in > 0 || pt.cash_out > 0,
        );
    }, [seriesPoints, onlyActiveRows]);

    const serverError = errors?.to ?? errors?.from ?? errors?.preset ?? dateRangeError;

    const averageOrderValue =
        summary && summary.orders_count > 0
            ? Math.round(summary.total_billed / summary.orders_count)
            : 0;

    const trendColumns: DataColumn<ReportChartPoint>[] = [
        {
            key: 'period',
            header: `Periode (${GRANULARITY_LABEL[activeGranularity]})`,
            cellClassName: 'whitespace-nowrap font-semibold text-[#1C211E] tabular-nums',
            render: (pt) => pt.full_label,
        },
        {
            key: 'orders_count',
            header: 'Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap tabular-nums',
            render: (pt) =>
                pt.orders_count > 0 ? (
                    <span className="font-bold text-[#1C211E]">
                        {formatAmount(pt.orders_count)}
                    </span>
                ) : (
                    <span className="text-[#545852]">-</span>
                ),
        },
        {
            key: 'billed',
            header: 'Nilai Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-medium text-[#1C211E] tabular-nums',
            render: (pt) => (pt.billed > 0 ? formatRupiah(pt.billed) : '-'),
        },
        {
            key: 'cash_in',
            header: 'Kas Masuk',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-semibold text-[#1D3B2A] tabular-nums',
            render: (pt) => (pt.cash_in > 0 ? formatRupiah(pt.cash_in) : '-'),
        },
        {
            key: 'cash_out',
            header: 'Kas Keluar',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-semibold text-[#8F4B1E] tabular-nums',
            render: (pt) => (pt.cash_out > 0 ? formatRupiah(pt.cash_out) : '-'),
        },
        {
            key: 'diff',
            header: 'Selisih Kas',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-bold tabular-nums',
            render: (pt) => {
                if (pt.cash_diff === 0) return <span className="text-[#545852]">-</span>;
                return (
                    <span className={pt.cash_diff > 0 ? 'text-[#1D3B2A]' : 'text-[#9A3B22]'}>
                        {formatRupiah(pt.cash_diff)}
                    </span>
                );
            },
        },
    ];

    if (!report || !period || !summary || !notes) {
        return (
            <>
                <Head title="Laporan Keuangan" />
                <div className="space-y-6">
                    <PageHeaderSkeleton title="Laporan Usaha" subtitle="Memuat ringkasan dan grafik laporan..." />
                    <SummaryStripSkeleton cards={4} />
                    <ReportChartSkeleton />
                    <ReportBreakdownsSkeleton />
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Laporan Keuangan" />

            {/* A. Header Ringkas */}
            <header className="mb-5 flex flex-col gap-3 border-b border-[#DED6C8] pb-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
                <div>
                    <h1 className="atelier-h1">Laporan Usaha</h1>
                    <p className="mt-0.5 text-[14px] text-[#545852] tabular-nums sm:mt-1 sm:text-[15px]">
                        {period.label}
                        {isLoading ? ' · Memperbarui...' : ''}
                    </p>
                </div>

                <Button asChild variant="secondary" className="w-full sm:w-auto sm:min-w-[180px]">
                    <a
                        href={exportUrl}
                        title="Unduh laporan lengkap dalam format Excel (.xlsx)"
                    >
                        <FileSpreadsheet className="size-4" aria-hidden="true" />
                        <span>Unduh Excel (.xlsx)</span>
                        <Download className="size-4 opacity-80" aria-hidden="true" />
                    </a>
                </Button>
            </header>

            {serverError && (
                <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-sm font-medium text-[#8A2619]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{serverError}</span>
                </div>
            )}

            {/* Period Filter Tabs */}
            <div className="mb-5 rounded-[8px] border border-[#DED6C8] bg-[#FFFDF9] p-3 sm:mb-6 sm:px-4 sm:py-3">
                {/* Mobile Compact Filter (< 640px): 4 quick buttons + select for other presets */}
                <div className="space-y-2.5 sm:hidden">
                    <div
                        className="grid grid-cols-4 gap-1"
                        role="group"
                        aria-label="Pilihan periode cepat laporan"
                    >
                        {PRESET_OPTIONS.slice(0, 4).map((opt) => {
                            const selected = selectedPreset === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    aria-pressed={selected}
                                    disabled={isLoading}
                                    onClick={() => handleSelectPreset(opt.key)}
                                    className={cn(
                                        'inline-flex min-h-[44px] items-center justify-center rounded-[6px] px-1.5 py-2 text-[13px] font-semibold transition-colors',
                                        selected
                                            ? 'bg-[#1D3B2A] text-[#FFFDF9]'
                                            : 'bg-[#F7F3EC] text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]',
                                    )}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="mobile-report-preset"
                            className="shrink-0 text-[13px] font-semibold text-[#545852]"
                        >
                            Periode lain:
                        </label>
                        <select
                            id="mobile-report-preset"
                            value={selectedPreset}
                            disabled={isLoading}
                            onChange={(e) => handleSelectPreset(e.target.value as ReportPreset)}
                            className="min-h-[44px] w-full rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] px-3 text-sm font-semibold text-[#1C211E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                        >
                            {PRESET_OPTIONS.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Desktop & Tablet Preset Row (>= 640px) - Preserved */}
                <div
                    className="hidden flex-wrap items-center gap-1.5 sm:flex"
                    role="group"
                    aria-label="Pilihan periode laporan"
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
                                    'inline-flex min-h-[44px] items-center rounded-[6px] px-3.5 py-2 text-sm font-semibold transition-colors',
                                    selected
                                        ? 'bg-[#1D3B2A] text-[#FFFDF9]'
                                        : 'bg-transparent text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]',
                                )}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>

                {selectedPreset === 'custom' && (
                    <form
                        onSubmit={handleApplyCustom}
                        noValidate
                        className="mt-3 grid grid-cols-1 items-end gap-3.5 border-t border-[#DED6C8] pt-3.5 sm:grid-cols-[1fr_1fr_auto]"
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

                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isLoading}
                            className="h-11 min-w-[164px]"
                        >
                            Terapkan
                        </Button>
                    </form>
                )}
            </div>

            {/* B. Financial Overview (2x2 ringkas di mobile, 4 kolom di desktop) */}
            <LedgerSummaryStrip
                ariaLabel="Ringkasan pembukuan periode"
                mobileColumns={2}
                className="mb-4"
                items={[
                    {
                        label: 'Nilai Pesanan',
                        value: formatRupiah(summary.total_billed),
                        hint: `Bunga ${formatRupiah(summary.flower_total)} · Ongkir ${formatRupiah(summary.shipping_total)}`,
                    },
                    {
                        label: 'Kas Masuk (Sah)',
                        value: formatRupiah(summary.cash_in),
                        hint: 'Pembayaran tercatat sah',
                    },
                    {
                        label: 'Kas Keluar (Sah)',
                        value: formatRupiah(summary.cash_out),
                        hint: 'Pengeluaran tercatat sah',
                    },
                    {
                        label: notes.cash_diff_label,
                        value: formatRupiah(summary.cash_diff),
                        hint: 'Masuk dikurangi keluar (bukan laba bersih)',
                    },
                ]}
            />

            <div className="mb-7 flex flex-col gap-2 rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE]/55 px-5 py-3.5 text-[13px] text-[#545852] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 tabular-nums">
                    <span>
                        Volume:{' '}
                        <strong className="font-bold text-[#1C211E]">
                            {formatAmount(summary.orders_count)} pesanan
                        </strong>{' '}
                        (rata-rata {formatRupiah(averageOrderValue)})
                    </span>
                    <span>
                        Piutang berjalan:{' '}
                        <strong
                            className={cn(
                                'font-bold',
                                summary.current_outstanding > 0 ? 'text-[#9A3B22]' : 'text-[#1C211E]',
                            )}
                        >
                            {formatRupiah(summary.current_outstanding)}
                        </strong>{' '}
                        ({formatAmount(summary.open_receivables_count)} belum lunas saat ini)
                    </span>
                </div>
            </div>

            {/* C. Grafik Keuangan Utama (Deferred: reportTrends) */}
            <Deferred
                data="reportTrends"
                fallback={
                    <div className="mb-7 space-y-4">
                        {deferredErrors.reportTrends ? (
                            <DeferredSectionError
                                title="Grafik tren keuangan belum termuat"
                                message={deferredErrors.reportTrends}
                                onRetry={() => router.reload({ only: ['reportTrends'] })}
                            />
                        ) : (
                            <ReportChartSkeleton />
                        )}
                    </div>
                }
                rescue={({ reloading }) => (
                    <div className="mb-7">
                        <DeferredSectionError
                            title="Grafik tren keuangan gagal dimuat"
                            reloading={reloading}
                            onRetry={() => router.reload({ only: ['reportTrends'] })}
                        />
                    </div>
                )}
            >
                <FinancialTrendChart
                    points={seriesPoints}
                    granularity={activeGranularity}
                    rangeLabel={seriesRangeLabel}
                    notice={seriesNotice}
                    isLoading={isLoading}
                    onGranularityChange={handleSelectGranularity}
                />
            </Deferred>

            {/* D & E. Ringkasan Status & Pengeluaran per Kategori (Deferred: reportBreakdowns) */}
            <Deferred
                data="reportBreakdowns"
                fallback={
                    <div className="mb-7">
                        {deferredErrors.reportBreakdowns ? (
                            <DeferredSectionError
                                title="Rincian status & biaya belum termuat"
                                message={deferredErrors.reportBreakdowns}
                                onRetry={() => router.reload({ only: ['reportBreakdowns'] })}
                            />
                        ) : (
                            <ReportBreakdownsSkeleton />
                        )}
                    </div>
                }
                rescue={({ reloading }) => (
                    <div className="mb-7">
                        <DeferredSectionError
                            title="Rincian status & biaya gagal dimuat"
                            reloading={reloading}
                            onRetry={() => router.reload({ only: ['reportBreakdowns'] })}
                        />
                    </div>
                )}
            >
                {effectiveBreakdowns && (
                    <>
                        <StatusDistributionPanel
                            totalOrders={summary.orders_count}
                            fulfillment={effectiveBreakdowns.fulfillment_breakdown}
                            payment={effectiveBreakdowns.payment_breakdown}
                        />
                        <ExpenseCategoryCard
                            items={effectiveBreakdowns.expense_breakdown ?? []}
                            totalCashOut={summary.cash_out}
                        />
                    </>
                )}
            </Deferred>

            {/* F. Rincian Angka (Progressive Disclosure) */}
            <Deferred
                data="reportTrends"
                fallback={<></>}
                rescue={<></>}
            >
                <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFFDF9] px-5 py-4">
                    <div>
                        <h2 className="atelier-h2">
                            Rincian Tabel ({GRANULARITY_LABEL[activeGranularity]})
                        </h2>
                        <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                            {formatAmount(activePointsCount)} periode bertransaksi dari{' '}
                            {formatAmount(seriesPoints.length)} rentang
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        aria-expanded={tableOpen}
                        onClick={() => setTableOpen((open) => !open)}
                        className="min-w-[164px]"
                    >
                        <span>{tableOpen ? 'Tutup Rincian' : 'Lihat Rincian Tabel'}</span>
                        {tableOpen ? (
                            <ChevronUp className="size-4" aria-hidden="true" />
                        ) : (
                            <ChevronDown className="size-4" aria-hidden="true" />
                        )}
                    </Button>
                </div>

                {tableOpen && (
                    <div className="border-t border-[#DED6C8]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DED6C8] bg-[#F7F3EC] px-5 py-3">
                            <span className="text-[13px] font-medium text-[#545852]">
                                Catatan: Dibatalkan (VOIDED) otomatis dikecualikan.
                            </span>
                            <div className="flex gap-2" role="group" aria-label="Filter baris rincian">
                                <button
                                    type="button"
                                    aria-pressed={onlyActiveRows}
                                    onClick={() => setOnlyActiveRows(true)}
                                    className={cn(
                                        'inline-flex min-h-[44px] items-center rounded-[8px] border px-3.5 text-[13px] font-semibold transition-colors',
                                        onlyActiveRows
                                            ? 'border-[#1D3B2A] bg-[#1D3B2A] text-[#FFFDF9]'
                                            : 'border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
                                    )}
                                >
                                    Ada Transaksi ({formatAmount(activePointsCount)})
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={!onlyActiveRows}
                                    onClick={() => setOnlyActiveRows(false)}
                                    className={cn(
                                        'inline-flex min-h-[44px] items-center rounded-[8px] border px-3.5 text-[13px] font-semibold transition-colors',
                                        !onlyActiveRows
                                            ? 'border-[#1D3B2A] bg-[#1D3B2A] text-[#FFFDF9]'
                                            : 'border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
                                    )}
                                >
                                    Semua ({formatAmount(seriesPoints.length)})
                                </button>
                            </div>
                        </div>

                        <div className="p-4 lg:p-0">
                            <ResponsiveDataList
                                items={visibleSeriesPoints}
                                columns={trendColumns}
                                keyExtractor={(pt) => pt.key}
                                tableAriaLabel={`Rincian arus transaksi ${GRANULARITY_LABEL[activeGranularity].toLowerCase()}`}
                                emptyState={
                                    <div className="px-6 py-8 text-center text-[15px] text-[#545852]">
                                        Tidak ada transaksi pada rentang ini.
                                    </div>
                                }
                                renderMobileCard={(pt) => (
                                    <div className="atelier-sheet p-4 text-[13px] tabular-nums">
                                        <div className="flex items-center justify-between gap-2 border-b border-[#DED6C8] pb-2">
                                            <span className="text-[15px] font-bold text-[#1C211E]">
                                                {pt.full_label}
                                            </span>
                                            <span className="text-[#545852]">
                                                {formatAmount(pt.orders_count)} pesanan
                                            </span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div>
                                                <span className="block text-[#545852]">Nilai Pesanan</span>
                                                <strong className="font-semibold text-[#1C211E]">
                                                    {pt.billed > 0 ? formatRupiah(pt.billed) : '-'}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="block text-[#545852]">Kas Masuk</span>
                                                <strong className="font-semibold text-[#1D3B2A]">
                                                    {pt.cash_in > 0 ? formatRupiah(pt.cash_in) : '-'}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="block text-[#545852]">Kas Keluar</span>
                                                <strong className="font-semibold text-[#8F4B1E]">
                                                    {pt.cash_out > 0 ? formatRupiah(pt.cash_out) : '-'}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="block text-[#545852]">Selisih Kas</span>
                                                <strong
                                                    className={
                                                        pt.cash_diff > 0
                                                            ? 'font-bold text-[#1D3B2A]'
                                                            : pt.cash_diff < 0
                                                              ? 'font-bold text-[#9A3B22]'
                                                              : 'text-[#545852]'
                                                    }
                                                >
                                                    {pt.cash_diff !== 0 ? formatRupiah(pt.cash_diff) : '-'}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                )}
            </Card>
            </Deferred>
        </>
    );
}
