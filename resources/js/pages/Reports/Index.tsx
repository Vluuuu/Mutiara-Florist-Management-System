import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Download,
    FileSpreadsheet,
    ReceiptText,
    ShoppingBag,
    Wallet,
} from 'lucide-react';
import { LedgerSummaryStrip } from '@/components/ledger-summary-strip';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
    DeferredSectionError,
    PageHeaderSkeleton,
    ReportBreakdownsSkeleton,
    ReportChartSkeleton,
    SummaryStripSkeleton,
} from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { useNavigationState, useScopedFilterLoading } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount, formatRupiah, formatSignedRupiah } from '@/lib/format';
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

// Lazy-load secondary report visualizations in parallel with deferred 'details' prop
const FinancialTrendChart = lazy(() =>
    import('@/components/report-charts').then((m) => ({ default: m.FinancialTrendChart })),
);
const ReportBreakdownsGrid = lazy(() =>
    import('@/components/report-charts').then((m) => ({ default: m.ReportBreakdownsGrid })),
);

type ReportsIndexProps = {
    report?: FinancialReportData;
    reportBreakdowns?: ReportBreakdownsData;
    reportTrends?: ReportTrendsData;
};

// All 8 presets verified against ReportService::resolvePeriod()
const PRESET_OPTIONS: Array<{ key: ReportPreset; label: string }> = [
    { key: 'today', label: 'Hari Ini' },
    { key: '7d', label: '7 Hari' },
    { key: '30d', label: '30 Hari' },
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'this_year', label: 'Tahun Ini' },
    { key: 'all_time', label: 'Semua Waktu' },
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
    const { errors, nav } = usePage<AppPageProps>().props;
    const { deferredErrors } = useNavigationState();
    const isFilterLoading = useScopedFilterLoading('/ui-reports');
    useInstantPageGuard(Boolean(report));

    const period = report?.period;
    const summary = report?.summary;
    const notes = report?.notes;
    const paymentsHref = nav?.uiPayments ?? '/ui-payments';

    const effectiveBreakdowns: ReportBreakdownsData | undefined =
        reportBreakdowns ??
        (report?.fulfillment_breakdown && report?.payment_breakdown
            ? {
                  fulfillment_breakdown: report.fulfillment_breakdown,
                  payment_breakdown: report.payment_breakdown,
                  payment_method_breakdown: report.payment_method_breakdown ?? [],
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
    const isSeriesTruncated = Boolean(chartSeries?.is_truncated);

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

    // Reconciled table totals across displayed series points
    const tableTotals = useMemo(
        () =>
            seriesPoints.reduce(
                (acc, pt) => ({
                    orders_count: acc.orders_count + pt.orders_count,
                    billed: acc.billed + pt.billed,
                    cash_in: acc.cash_in + pt.cash_in,
                    cash_out: acc.cash_out + pt.cash_out,
                    cash_diff: acc.cash_diff + pt.cash_diff,
                }),
                { orders_count: 0, billed: 0, cash_in: 0, cash_out: 0, cash_diff: 0 },
            ),
        [seriesPoints],
    );

    const serverError = errors?.to ?? errors?.from ?? errors?.preset ?? dateRangeError;

    const averageOrderValue =
        summary && summary.orders_count > 0
            ? Math.round(summary.total_billed / summary.orders_count)
            : 0;

    const trendColumns: DataColumn<ReportChartPoint>[] = [
        {
            key: 'period',
            header: `Periode (${GRANULARITY_LABEL[activeGranularity]})`,
            cellClassName: 'whitespace-nowrap font-semibold text-[var(--text-primary)] tabular-nums',
            render: (pt) => pt.full_label,
        },
        {
            key: 'orders_count',
            header: 'Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap tabular-nums',
            render: (pt) =>
                pt.orders_count > 0 ? (
                    <span className="font-bold text-[var(--text-primary)]">
                        {formatAmount(pt.orders_count)}
                    </span>
                ) : (
                    <span className="text-[var(--text-secondary)]">-</span>
                ),
        },
        {
            key: 'billed',
            header: 'Nilai Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-medium text-[var(--text-primary)] tabular-nums',
            render: (pt) => (pt.billed > 0 ? formatRupiah(pt.billed) : '-'),
        },
        {
            key: 'cash_in',
            header: 'Kas Masuk',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-semibold text-[var(--status-paid-fg)] tabular-nums',
            render: (pt) => (pt.cash_in > 0 ? formatRupiah(pt.cash_in) : '-'),
        },
        {
            key: 'cash_out',
            header: 'Kas Keluar',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-semibold text-[var(--expense-ink)] tabular-nums',
            render: (pt) => (pt.cash_out > 0 ? formatRupiah(pt.cash_out) : '-'),
        },
        {
            key: 'diff',
            header: 'Selisih Kas',
            align: 'right',
            cellClassName: 'whitespace-nowrap font-bold tabular-nums',
            render: (pt) => {
                if (pt.cash_diff === 0) return <span className="text-[var(--text-secondary)]">-</span>;
                return (
                    <span
                        className={
                            pt.cash_diff > 0
                                ? 'text-[var(--status-paid-fg)]'
                                : 'text-[var(--brand-urgent)]'
                        }
                    >
                        {formatSignedRupiah(pt.cash_diff)}
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
                    <PageHeaderSkeleton
                        title="Laporan Usaha"
                        subtitle="Memuat ringkasan dan grafik laporan..."
                    />
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

            {/* A. Header & Export Action */}
            <PageHeader
                title="Laporan Usaha"
                subtitle={
                    <span className="tabular-nums">
                        {period.label} · Zona waktu WIB (Asia/Jakarta)
                        {isLoading ? ' · Memperbarui...' : ''}
                    </span>
                }
                actions={
                    <Button asChild variant="secondary" className="w-full sm:w-auto sm:min-w-[184px]">
                        <a
                            href={exportUrl}
                            title="Unduh laporan lengkap dalam format Excel (.xlsx)"
                        >
                            <FileSpreadsheet className="size-4" aria-hidden="true" />
                            <span>Unduh Excel (.xlsx)</span>
                            <Download className="size-4 opacity-80" aria-hidden="true" />
                        </a>
                    </Button>
                }
            />

            {serverError && (
                <AlertBanner tone="error" className="mb-5">
                    {serverError}
                </AlertBanner>
            )}

            {/* Period Filter Toolbar (Single Mobile Select + Desktop/Tablet SegmentedTabs, 0 Duplication) */}
            <div className="atelier-sheet mb-6 p-3.5 sm:px-4 sm:py-3.5">
                <div className="sm:hidden">
                    <label
                        htmlFor="mobile-report-preset"
                        className="mb-1.5 block text-[13px] font-bold text-[var(--text-secondary)]"
                    >
                        Periode Laporan (WIB)
                    </label>
                    <Select
                        id="mobile-report-preset"
                        value={selectedPreset}
                        disabled={isLoading}
                        onChange={(e) => handleSelectPreset(e.target.value as ReportPreset)}
                    >
                        {PRESET_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                                {opt.label}
                            </option>
                        ))}
                    </Select>
                </div>

                <div className="hidden sm:block">
                    <SegmentedTabs<ReportPreset>
                        ariaLabel="Pilihan periode laporan"
                        value={selectedPreset}
                        disabled={isLoading}
                        onChange={handleSelectPreset}
                        options={PRESET_OPTIONS}
                    />
                </div>

                {selectedPreset === 'custom' && (
                    <form
                        onSubmit={handleApplyCustom}
                        noValidate
                        className="mt-3.5 grid grid-cols-1 items-end gap-3.5 border-t border-[var(--border-hairline)] pt-3.5 sm:grid-cols-[1fr_1fr_auto]"
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

            {/* B. Primary Financial KPI Summary (Period-Based Metrics) */}
            <LedgerSummaryStrip
                ariaLabel="Ringkasan pembukuan periode"
                mobileColumns={2}
                columns={4}
                className="mb-4"
                items={[
                    {
                        label: 'Nilai Pesanan',
                        value: formatRupiah(summary.total_billed),
                        icon: ShoppingBag,
                        tone: 'default',
                        hint: `Bunga ${formatRupiah(summary.flower_total)} · Ongkir ${formatRupiah(summary.shipping_total)}`,
                    },
                    {
                        label: 'Kas Masuk Sah',
                        value: formatRupiah(summary.cash_in),
                        icon: Wallet,
                        tone: summary.cash_in > 0 ? 'paid' : 'default',
                        hint: 'Penerimaan kas tercatat sah pada periode ini',
                    },
                    {
                        label: 'Kas Keluar Sah',
                        value: formatRupiah(summary.cash_out),
                        icon: ReceiptText,
                        tone: summary.cash_out > 0 ? 'expense' : 'default',
                        hint: 'Pengeluaran operasional tercatat sah',
                    },
                    {
                        label: notes.cash_diff_label,
                        value: formatSignedRupiah(summary.cash_diff),
                        tone:
                            summary.cash_diff < 0
                                ? 'urgent'
                                : summary.cash_diff > 0
                                  ? 'paid'
                                  : 'default',
                        hint: 'Kas masuk dikurangi kas keluar (bukan laba bersih)',
                    },
                ]}
            />

            {/* Snapshot Context Strip (Clearly separates Live Receivables from Period Metrics) */}
            <div className="mb-6 flex flex-col gap-2.5 rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/55 px-5 py-3.5 text-[13.5px] text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 tabular-nums">
                    <span>
                        Volume periode:{' '}
                        <strong className="font-bold text-[var(--text-primary)]">
                            {formatAmount(summary.orders_count)} pesanan
                        </strong>{' '}
                        (rata-rata {formatRupiah(averageOrderValue)})
                    </span>
                    <span>
                        Piutang berjalan (snapshot saat ini):{' '}
                        <strong
                            className={cn(
                                'font-bold',
                                summary.current_outstanding > 0
                                    ? 'text-[var(--brand-urgent)]'
                                    : 'text-[var(--text-primary)]',
                            )}
                        >
                            {formatRupiah(summary.current_outstanding)}
                        </strong>{' '}
                        ({formatAmount(summary.open_receivables_count)} nota terbuka)
                    </span>
                </div>
                <Link
                    href={paymentsHref}
                    component="Payments/Index"
                    prefetch="hover"
                    cacheFor="10s"
                    cacheTags={['payments', 'orders']}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline"
                >
                    <span>Kelola Piutang</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
            </div>

            {/* C. Financial Trend Chart (Deferred: reportTrends + Lazy Chunk) */}
            <Deferred
                data="reportTrends"
                fallback={
                    <div className="mb-6">
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
                    <div className="mb-6">
                        <DeferredSectionError
                            title="Grafik tren keuangan gagal dimuat"
                            reloading={reloading}
                            onRetry={() => router.reload({ only: ['reportTrends'] })}
                        />
                    </div>
                )}
            >
                <Suspense fallback={<ReportChartSkeleton />}>
                    <FinancialTrendChart
                        points={seriesPoints}
                        granularity={activeGranularity}
                        rangeLabel={seriesRangeLabel}
                        notice={seriesNotice}
                        isLoading={isLoading}
                        onGranularityChange={handleSelectGranularity}
                    />
                </Suspense>
            </Deferred>

            {/* D, F, G. Payment Methods, Expense Categories (AUD-07), & Order Statuses (Deferred: reportBreakdowns) */}
            <Deferred
                data="reportBreakdowns"
                fallback={
                    <div className="mb-6">
                        {deferredErrors.reportBreakdowns ? (
                            <DeferredSectionError
                                title="Rincian metode, status & biaya belum termuat"
                                message={deferredErrors.reportBreakdowns}
                                onRetry={() => router.reload({ only: ['reportBreakdowns'] })}
                            />
                        ) : (
                            <ReportBreakdownsSkeleton />
                        )}
                    </div>
                }
                rescue={({ reloading }) => (
                    <div className="mb-6">
                        <DeferredSectionError
                            title="Rincian metode, status & biaya gagal dimuat"
                            reloading={reloading}
                            onRetry={() => router.reload({ only: ['reportBreakdowns'] })}
                        />
                    </div>
                )}
            >
                {effectiveBreakdowns && (
                    <Suspense fallback={<ReportBreakdownsSkeleton />}>
                        <ReportBreakdownsGrid
                            totalOrders={summary.orders_count}
                            totalCashIn={summary.cash_in}
                            totalCashOut={summary.cash_out}
                            fulfillment={effectiveBreakdowns.fulfillment_breakdown}
                            payment={effectiveBreakdowns.payment_breakdown}
                            paymentMethods={effectiveBreakdowns.payment_method_breakdown ?? []}
                            expenses={effectiveBreakdowns.expense_breakdown ?? []}
                        />
                    </Suspense>
                )}
            </Deferred>

            {/* H. Expanded Period Table with Reconciled Total Footer */}
            <Deferred data="reportTrends" fallback={<></>} rescue={<></>}>
                <Card className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] px-5 py-4">
                        <div>
                            <h2 className="atelier-h2">
                                Rincian Tabel ({GRANULARITY_LABEL[activeGranularity]})
                            </h2>
                            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] tabular-nums">
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
                        <div className="border-t border-[var(--border-hairline)]">
                            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/50 px-5 py-3">
                                <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                                    Catatan: Transaksi yang dibatalkan otomatis dikecualikan dari seluruh perhitungan kas.
                                </span>
                                <SegmentedTabs<'active' | 'all'>
                                    ariaLabel="Filter baris rincian"
                                    value={onlyActiveRows ? 'active' : 'all'}
                                    onChange={(next) => setOnlyActiveRows(next === 'active')}
                                    options={[
                                        { key: 'active', label: 'Ada Transaksi', count: activePointsCount },
                                        { key: 'all', label: 'Semua', count: seriesPoints.length },
                                    ]}
                                />
                            </div>

                            <div className="p-4 lg:p-0">
                                <ResponsiveDataList
                                    items={visibleSeriesPoints}
                                    columns={trendColumns}
                                    keyExtractor={(pt) => pt.key}
                                    tabletColumns={2}
                                    tableAriaLabel={`Rincian arus transaksi ${GRANULARITY_LABEL[activeGranularity].toLowerCase()}`}
                                    emptyState={
                                        <EmptyState
                                            headingLevel="h3"
                                            title="Tidak ada transaksi pada rentang ini"
                                            description="Coba pilih tab Semua atau ubah periode laporan untuk melihat catatan transaksi."
                                            className="py-8"
                                        />
                                    }
                                    renderMobileCard={(pt) => (
                                        <article className="atelier-sheet p-4 text-[13px] tabular-nums">
                                            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2">
                                                <span className="text-[15px] font-bold text-[var(--text-primary)]">
                                                    {pt.full_label}
                                                </span>
                                                <span className="text-[var(--text-secondary)]">
                                                    {formatAmount(pt.orders_count)} pesanan
                                                </span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                <div>
                                                    <span className="block text-[var(--text-secondary)]">
                                                        Nilai Pesanan
                                                    </span>
                                                    <strong className="font-semibold text-[var(--text-primary)]">
                                                        {pt.billed > 0 ? formatRupiah(pt.billed) : '-'}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span className="block text-[var(--text-secondary)]">
                                                        Kas Masuk
                                                    </span>
                                                    <strong className="font-semibold text-[var(--status-paid-fg)]">
                                                        {pt.cash_in > 0 ? formatRupiah(pt.cash_in) : '-'}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span className="block text-[var(--text-secondary)]">
                                                        Kas Keluar
                                                    </span>
                                                    <strong className="font-semibold text-[var(--expense-ink)]">
                                                        {pt.cash_out > 0 ? formatRupiah(pt.cash_out) : '-'}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span className="block text-[var(--text-secondary)]">
                                                        Selisih Kas
                                                    </span>
                                                    <strong
                                                        className={
                                                            pt.cash_diff > 0
                                                                ? 'font-bold text-[var(--status-paid-fg)]'
                                                                : pt.cash_diff < 0
                                                                  ? 'font-bold text-[var(--brand-urgent)]'
                                                                  : 'text-[var(--text-secondary)]'
                                                        }
                                                    >
                                                        {pt.cash_diff !== 0
                                                            ? formatSignedRupiah(pt.cash_diff)
                                                            : '-'}
                                                    </strong>
                                                </div>
                                            </div>
                                        </article>
                                    )}
                                />
                            </div>

                            {/* Reconciled Total-Period Footer */}
                            <div
                                data-testid="report-table-total-footer"
                                className="border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)]/65 px-5 py-4"
                            >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-[var(--text-primary)]">
                                            {isSeriesTruncated
                                                ? `Total ${formatAmount(seriesPoints.length)} Hari Terakhir`
                                                : 'Total Periode Terpilih'}
                                        </p>
                                        <p className="text-[12px] text-[var(--text-secondary)]">
                                            {isSeriesTruncated
                                                ? 'Mode Harian dibatasi 92 hari terakhir; angka periode penuh tampil di kartu ringkasan atas.'
                                                : 'Terekonsiliasi dengan ringkasan pembukuan periode dan ekspor Excel.'}
                                        </p>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] tabular-nums sm:grid-cols-5">
                                        <div>
                                            <dt className="text-[var(--text-secondary)]">Pesanan</dt>
                                            <dd className="font-bold text-[var(--text-primary)]">
                                                {formatAmount(tableTotals.orders_count)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[var(--text-secondary)]">Nilai Pesanan</dt>
                                            <dd className="font-bold text-[var(--text-primary)]">
                                                {formatRupiah(tableTotals.billed)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[var(--text-secondary)]">Kas Masuk</dt>
                                            <dd className="font-bold text-[var(--status-paid-fg)]">
                                                {formatRupiah(tableTotals.cash_in)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[var(--text-secondary)]">Kas Keluar</dt>
                                            <dd className="font-bold text-[var(--expense-ink)]">
                                                {formatRupiah(tableTotals.cash_out)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[var(--text-secondary)]">Selisih Kas</dt>
                                            <dd
                                                className={cn(
                                                    'font-bold',
                                                    tableTotals.cash_diff < 0
                                                        ? 'text-[var(--brand-urgent)]'
                                                        : tableTotals.cash_diff > 0
                                                          ? 'text-[var(--status-paid-fg)]'
                                                          : 'text-[var(--text-primary)]',
                                                )}
                                            >
                                                {formatSignedRupiah(tableTotals.cash_diff)}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </Deferred>
        </>
    );
}
