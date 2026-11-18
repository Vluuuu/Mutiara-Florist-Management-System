<?php

namespace App\Services;

use App\Services\Excel\SimpleXlsxExporter;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * Resolves the date range based on preset or custom parameters.
     *
     * @return array{preset: string, from: string, to: string, label: string}
     */
    public function resolvePeriod(?string $preset = '30d', ?string $from = null, ?string $to = null): array
    {
        $now = Carbon::now('Asia/Jakarta');
        $validPresets = ['today', '7d', '30d', 'this_month', 'last_month', 'this_year', 'all_time', 'custom'];
        $preset = in_array($preset, $validPresets, true) ? $preset : '30d';

        if ($preset === 'custom') {
            $fromDate = $from ? Carbon::createFromFormat('Y-m-d', $from, 'Asia/Jakarta') : null;
            $toDate = $to ? Carbon::createFromFormat('Y-m-d', $to, 'Asia/Jakarta') : null;

            if ($fromDate && $toDate) {
                if ($fromDate->gt($toDate)) {
                    [$fromDate, $toDate] = [$toDate, $fromDate];
                }
                $fromStr = $fromDate->format('Y-m-d');
                $toStr = $toDate->format('Y-m-d');
            } else {
                $preset = '30d';
            }
        }

        if ($preset === 'today') {
            $fromStr = $now->format('Y-m-d');
            $toStr = $now->format('Y-m-d');
            $label = 'Hari Ini ('.$now->translatedFormat('d F Y').')';
        } elseif ($preset === '7d') {
            $fromStr = $now->copy()->subDays(6)->format('Y-m-d');
            $toStr = $now->format('Y-m-d');
            $label = '7 Hari Terakhir ('.$now->copy()->subDays(6)->format('d/m/Y').' - '.$now->format('d/m/Y').')';
        } elseif ($preset === 'this_month') {
            $fromStr = $now->copy()->startOfMonth()->format('Y-m-d');
            $toStr = $now->copy()->endOfMonth()->format('Y-m-d');
            $label = 'Bulan Ini ('.$now->translatedFormat('F Y').')';
        } elseif ($preset === 'last_month') {
            $lastMonth = $now->copy()->subMonth();
            $fromStr = $lastMonth->copy()->startOfMonth()->format('Y-m-d');
            $toStr = $lastMonth->copy()->endOfMonth()->format('Y-m-d');
            $label = 'Bulan Lalu ('.$lastMonth->translatedFormat('F Y').')';
        } elseif ($preset === 'this_year') {
            $fromStr = $now->copy()->startOfYear()->format('Y-m-d');
            $toStr = $now->format('Y-m-d');
            $label = 'Tahun Ini ('.$now->format('Y').')';
        } elseif ($preset === 'all_time') {
            $earliest = $this->findEarliestRecordDate($now);
            $fromStr = $earliest->format('Y-m-d');
            $toStr = $now->format('Y-m-d');
            $label = 'Semua Waktu ('.$earliest->format('d/m/Y').' - '.$now->format('d/m/Y').')';
        } elseif ($preset === 'custom') {
            /** @var string $fromStr */
            /** @var string $toStr */
            $label = 'Kustom ('.Carbon::parse($fromStr)->format('d/m/Y').' - '.Carbon::parse($toStr)->format('d/m/Y').')';
        } else {
            // Default 30d
            $preset = '30d';
            $fromStr = $now->copy()->subDays(29)->format('Y-m-d');
            $toStr = $now->format('Y-m-d');
            $label = '30 Hari Terakhir ('.$now->copy()->subDays(29)->format('d/m/Y').' - '.$now->format('d/m/Y').')';
        }

        return [
            'preset' => $preset,
            'from' => $fromStr,
            'to' => $toStr,
            'label' => $label,
        ];
    }

    /**
     * Gathers all operational and financial metrics for the resolved period.
     */
    public function getFinancialReport(?string $preset = '30d', ?string $from = null, ?string $to = null, ?string $granularity = null): array
    {
        $period = $this->resolvePeriod($preset, $from, $to);
        $fromStr = $period['from'];
        $toStr = $period['to'];

        $toEnd = $toStr.' 23:59:59';

        // 1. Operational order metrics (based on order_date)
        $ordersCount = (int) DB::table('orders')
            ->where('order_date', '>=', $fromStr)
            ->where('order_date', '<=', $toEnd)
            ->count();

        $totalBilled = (int) DB::table('orders')
            ->where('order_date', '>=', $fromStr)
            ->where('order_date', '<=', $toEnd)
            ->sum('total_amount');

        $flowerTotal = (int) DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.order_date', '>=', $fromStr)
            ->where('orders.order_date', '<=', $toEnd)
            ->sum(DB::raw('order_items.quantity * order_items.unit_price'));

        $shippingTotal = (int) DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.order_date', '>=', $fromStr)
            ->where('orders.order_date', '<=', $toEnd)
            ->where('order_items.shipping_mode', 'SEPARATE')
            ->sum('order_items.shipping_fee');

        // 2. Cash metrics (only POSTED, based on transaction dates)
        $cashIn = (int) DB::table('payments')
            ->where('status', 'POSTED')
            ->where('payment_date', '>=', $fromStr)
            ->where('payment_date', '<=', $toEnd)
            ->sum('amount');

        $cashOut = (int) DB::table('expenses')
            ->where('status', 'POSTED')
            ->where('expense_date', '>=', $fromStr)
            ->where('expense_date', '<=', $toEnd)
            ->sum('amount');

        $cashDiff = $cashIn - $cashOut;

        // 3. Current running receivables snapshot (all open orders)
        $postedPaymentsSub = DB::table('payments')
            ->select('order_id')
            ->selectRaw('SUM(amount) AS paid_amount')
            ->where('status', 'POSTED')
            ->groupBy('order_id');

        $currentOutstanding = (int) DB::table('orders')
            ->leftJoinSub($postedPaymentsSub, 'received', fn ($join) => $join->on('orders.id', '=', 'received.order_id'))
            ->whereRaw('orders.total_amount > COALESCE(received.paid_amount, 0)')
            ->sum(DB::raw('orders.total_amount - COALESCE(received.paid_amount, 0)'));

        $openReceivablesCount = (int) DB::table('orders')
            ->leftJoinSub($postedPaymentsSub, 'received', fn ($join) => $join->on('orders.id', '=', 'received.order_id'))
            ->whereRaw('orders.total_amount > COALESCE(received.paid_amount, 0)')
            ->count();

        // 4. Fulfillment breakdown (orders created in period)
        $fulfillmentCounts = DB::table('orders')
            ->select('status')
            ->selectRaw('COUNT(*) as total')
            ->where('order_date', '>=', $fromStr)
            ->where('order_date', '<=', $toEnd)
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $fulfillmentBreakdown = [
            'NEW' => (int) ($fulfillmentCounts['NEW'] ?? 0),
            'PROCESSING' => (int) ($fulfillmentCounts['PROCESSING'] ?? 0),
            'READY' => (int) ($fulfillmentCounts['READY'] ?? 0),
            'COMPLETED' => (int) ($fulfillmentCounts['COMPLETED'] ?? 0),
        ];

        // 5. Payment breakdown (orders created in period)
        $ordersInPeriod = DB::table('orders')
            ->leftJoinSub($postedPaymentsSub, 'received', fn ($join) => $join->on('orders.id', '=', 'received.order_id'))
            ->select([
                'orders.id',
                'orders.total_amount',
            ])
            ->selectRaw('COALESCE(received.paid_amount, 0) AS paid_amount')
            ->where('orders.order_date', '>=', $fromStr)
            ->where('orders.order_date', '<=', $toEnd)
            ->get();

        $unpaidCount = 0;
        $partialCount = 0;
        $paidCount = 0;

        foreach ($ordersInPeriod as $ord) {
            $paid = (int) $ord->paid_amount;
            $total = (int) $ord->total_amount;

            if ($paid <= 0) {
                $unpaidCount++;
            } elseif ($paid < $total) {
                $partialCount++;
            } else {
                $paidCount++;
            }
        }

        $paymentBreakdown = [
            'UNPAID' => $unpaidCount,
            'PARTIAL' => $partialCount,
            'PAID' => $paidCount,
        ];

        // 6. Daily trend data (max 92 days) + grouped chart series & expense breakdown
        $dailyTrends = $this->buildDailyTrends($fromStr, $toStr);
        $resolvedGranularity = $this->resolveGranularity($granularity, $period);
        $chartSeries = $this->buildChartSeries($resolvedGranularity, $fromStr, $toStr, $dailyTrends);
        $expenseBreakdown = $this->buildExpenseBreakdown($fromStr, $toEnd, $cashOut);

        return [
            'period' => $period,
            'summary' => [
                'orders_count' => $ordersCount,
                'total_billed' => $totalBilled,
                'flower_total' => $flowerTotal,
                'shipping_total' => $shippingTotal,
                'cash_in' => $cashIn,
                'cash_out' => $cashOut,
                'cash_diff' => $cashDiff,
                'current_outstanding' => $currentOutstanding,
                'open_receivables_count' => $openReceivablesCount,
            ],
            'fulfillment_breakdown' => $fulfillmentBreakdown,
            'payment_breakdown' => $paymentBreakdown,
            'expense_breakdown' => $expenseBreakdown,
            'daily_trends' => $dailyTrends,
            'chart_series' => $chartSeries,
            'notes' => [
                'cash_diff_label' => 'Selisih Kas',
                'cash_diff_disclaimer' => 'Selisih kas merupakan penerimaan kas dikurangi pengeluaran kas pada periode ini, BUKAN laba bersih usaha.',
                'outstanding_disclaimer' => 'Piutang berjalan merupakan snapshot saldo tagihan terbuka saat ini (bukan saldo historis pada akhir periode).',
            ],
        ];
    }

    /**
     * Assembles daily trend metrics between two dates (capped at 92 days).
     *
     * @return array<int, array{date: string, formatted_date: string, orders_count: int, billed: int, cash_in: int, cash_out: int}>
     */
    protected function buildDailyTrends(string $from, string $to): array
    {
        $startDate = Carbon::parse($from);
        $endDate = Carbon::parse($to);

        // Cap daily range to max 92 days for UI responsiveness
        if ($startDate->diffInDays($endDate) > 92) {
            $startDate = $endDate->copy()->subDays(91);
        }

        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d').' 23:59:59';

        $dailyMap = $this->fetchDailyActivityMap($startStr, $endStr);
        $period = CarbonPeriod::create($startDate, $endDate);
        $trends = [];

        foreach ($period as $date) {
            $d = $date->format('Y-m-d');
            $row = $dailyMap[$d] ?? null;

            $trends[] = [
                'date' => $d,
                'formatted_date' => $date->format('d/m'),
                'orders_count' => (int) ($row['orders_count'] ?? 0),
                'billed' => (int) ($row['billed'] ?? 0),
                'cash_in' => (int) ($row['cash_in'] ?? 0),
                'cash_out' => (int) ($row['cash_out'] ?? 0),
            ];
        }

        return $trends;
    }

    protected function resolveGranularity(?string $granularity, array $period): string
    {
        $valid = ['daily', 'weekly', 'monthly', 'yearly'];
        if (is_string($granularity) && in_array($granularity, $valid, true)) {
            return $granularity;
        }

        $days = Carbon::parse($period['from'])->diffInDays(Carbon::parse($period['to'])) + 1;
        if (($period['preset'] ?? '') === 'all_time' && $days > 366) {
            return 'yearly';
        }
        if (($period['preset'] ?? '') === 'this_year' || $days > 92) {
            return 'monthly';
        }
        if ($days > 14) {
            return 'weekly';
        }

        return 'daily';
    }

    /**
     * Fetches daily order, payment (POSTED), and expense (POSTED) totals indexed by Y-m-d.
     *
     * @return array<string, array{orders_count: int, billed: int, cash_in: int, cash_out: int}>
     */
    protected function fetchDailyActivityMap(string $startStr, string $endStr): array
    {
        $map = [];
        $ensure = function (string $dateKey) use (&$map): void {
            if (! isset($map[$dateKey])) {
                $map[$dateKey] = ['orders_count' => 0, 'billed' => 0, 'cash_in' => 0, 'cash_out' => 0];
            }
        };

        $ordersDaily = DB::table('orders')
            ->select('order_date')
            ->selectRaw('COUNT(*) as count, SUM(total_amount) as billed')
            ->where('order_date', '>=', $startStr)
            ->where('order_date', '<=', $endStr)
            ->groupBy('order_date')
            ->get();

        foreach ($ordersDaily as $row) {
            $d = Carbon::parse($row->order_date)->format('Y-m-d');
            $ensure($d);
            $map[$d]['orders_count'] += (int) $row->count;
            $map[$d]['billed'] += (int) $row->billed;
        }

        $paymentsDaily = DB::table('payments')
            ->select('payment_date')
            ->selectRaw('SUM(amount) as cash_in')
            ->where('status', 'POSTED')
            ->where('payment_date', '>=', $startStr)
            ->where('payment_date', '<=', $endStr)
            ->groupBy('payment_date')
            ->get();

        foreach ($paymentsDaily as $row) {
            $d = Carbon::parse($row->payment_date)->format('Y-m-d');
            $ensure($d);
            $map[$d]['cash_in'] += (int) $row->cash_in;
        }

        $expensesDaily = DB::table('expenses')
            ->select('expense_date')
            ->selectRaw('SUM(amount) as cash_out')
            ->where('status', 'POSTED')
            ->where('expense_date', '>=', $startStr)
            ->where('expense_date', '<=', $endStr)
            ->groupBy('expense_date')
            ->get();

        foreach ($expensesDaily as $row) {
            $d = Carbon::parse($row->expense_date)->format('Y-m-d');
            $ensure($d);
            $map[$d]['cash_out'] += (int) $row->cash_out;
        }

        return $map;
    }

    protected function findEarliestRecordDate(Carbon $fallbackNow): Carbon
    {
        $candidates = array_filter([
            DB::table('orders')->min('order_date'),
            DB::table('payments')->where('status', 'POSTED')->min('payment_date'),
            DB::table('expenses')->where('status', 'POSTED')->min('expense_date'),
        ]);

        if (empty($candidates)) {
            return $fallbackNow->copy()->startOfYear();
        }

        $dates = array_map(fn ($d) => Carbon::parse($d, 'Asia/Jakarta')->startOfDay(), $candidates);
        usort($dates, fn (Carbon $a, Carbon $b) => $a->getTimestamp() <=> $b->getTimestamp());

        return $dates[0];
    }

    /**
     * Builds grouped trend series for Harian / Mingguan / Bulanan / Tahunan visualizations.
     */
    protected function buildChartSeries(string $granularity, string $from, string $to, array $dailyTrends): array
    {
        $fromDate = Carbon::parse($from, 'Asia/Jakarta')->startOfDay();
        $toDate = Carbon::parse($to, 'Asia/Jakarta')->startOfDay();

        if ($granularity === 'daily') {
            $points = array_map(function (array $day): array {
                return [
                    'key' => $day['date'],
                    'label' => $day['formatted_date'],
                    'full_label' => Carbon::parse($day['date'])->locale('id')->translatedFormat('d M Y'),
                    'orders_count' => $day['orders_count'],
                    'billed' => $day['billed'],
                    'cash_in' => $day['cash_in'],
                    'cash_out' => $day['cash_out'],
                    'cash_diff' => $day['cash_in'] - $day['cash_out'],
                ];
            }, $dailyTrends);

            $first = $dailyTrends[0]['date'] ?? $from;
            $last = $dailyTrends[count($dailyTrends) - 1]['date'] ?? $to;

            return [
                'granularity' => 'daily',
                'range_label' => 'Per Hari ('.Carbon::parse($first)->format('d/m/Y').' - '.Carbon::parse($last)->format('d/m/Y').')',
                'points' => $points,
            ];
        }

        if ($granularity === 'weekly') {
            $spanDays = $fromDate->diffInDays($toDate) + 1;
            $start = $spanDays >= 15
                ? $fromDate->copy()->startOfWeek(Carbon::MONDAY)
                : $toDate->copy()->subWeeks(7)->startOfWeek(Carbon::MONDAY);
            $end = $toDate->copy()->endOfWeek(Carbon::SUNDAY);

            $raw = $this->fetchDailyActivityMap($start->format('Y-m-d'), $toDate->format('Y-m-d').' 23:59:59');
            $buckets = [];
            $cursor = $start->copy();
            while ($cursor->lte($toDate)) {
                $wkEnd = $cursor->copy()->endOfWeek(Carbon::SUNDAY);
                if ($wkEnd->gt($toDate)) {
                    $wkEnd = $toDate->copy();
                }
                $key = $cursor->format('o-\WW');
                $buckets[$key] = [
                    'key' => $key,
                    'label' => $cursor->format('d/m'),
                    'full_label' => $cursor->format('d/m/Y').' - '.$wkEnd->format('d/m/Y'),
                    'orders_count' => 0,
                    'billed' => 0,
                    'cash_in' => 0,
                    'cash_out' => 0,
                    'cash_diff' => 0,
                ];
                $cursor->addWeek();
            }

            foreach ($raw as $dateStr => $row) {
                $d = Carbon::parse($dateStr, 'Asia/Jakarta');
                $key = $d->format('o-\WW');
                if (! isset($buckets[$key])) {
                    continue;
                }
                $buckets[$key]['orders_count'] += $row['orders_count'];
                $buckets[$key]['billed'] += $row['billed'];
                $buckets[$key]['cash_in'] += $row['cash_in'];
                $buckets[$key]['cash_out'] += $row['cash_out'];
                $buckets[$key]['cash_diff'] = $buckets[$key]['cash_in'] - $buckets[$key]['cash_out'];
            }

            return [
                'granularity' => 'weekly',
                'range_label' => 'Per Minggu ('.$start->format('d/m/Y').' - '.$toDate->format('d/m/Y').')',
                'points' => array_values($buckets),
            ];
        }

        if ($granularity === 'monthly') {
            $sameMonth = $fromDate->format('Y-m') === $toDate->format('Y-m');
            $start = $sameMonth
                ? $toDate->copy()->startOfMonth()->subMonths(11)
                : $fromDate->copy()->startOfMonth();

            $raw = $this->fetchDailyActivityMap($start->format('Y-m-d'), $toDate->format('Y-m-d').' 23:59:59');
            $buckets = [];
            $cursor = $start->copy();
            $endMonth = $toDate->copy()->startOfMonth();

            while ($cursor->lte($endMonth)) {
                $key = $cursor->format('Y-m');
                $buckets[$key] = [
                    'key' => $key,
                    'label' => $cursor->locale('id')->translatedFormat('M y'),
                    'full_label' => $cursor->locale('id')->translatedFormat('F Y'),
                    'orders_count' => 0,
                    'billed' => 0,
                    'cash_in' => 0,
                    'cash_out' => 0,
                    'cash_diff' => 0,
                ];
                $cursor->addMonth();
            }

            foreach ($raw as $dateStr => $row) {
                $key = substr($dateStr, 0, 7);
                if (! isset($buckets[$key])) {
                    continue;
                }
                $buckets[$key]['orders_count'] += $row['orders_count'];
                $buckets[$key]['billed'] += $row['billed'];
                $buckets[$key]['cash_in'] += $row['cash_in'];
                $buckets[$key]['cash_out'] += $row['cash_out'];
                $buckets[$key]['cash_diff'] = $buckets[$key]['cash_in'] - $buckets[$key]['cash_out'];
            }

            return [
                'granularity' => 'monthly',
                'range_label' => 'Per Bulan ('.$start->locale('id')->translatedFormat('M Y').' - '.$toDate->locale('id')->translatedFormat('M Y').')',
                'points' => array_values($buckets),
            ];
        }

        // yearly: all recorded years up to end year (minimum 1 year)
        $earliest = $this->findEarliestRecordDate($toDate);
        $startYear = min((int) $earliest->format('Y'), (int) $fromDate->format('Y'));
        $endYear = max((int) $toDate->format('Y'), (int) Carbon::now('Asia/Jakarta')->format('Y'));

        $raw = $this->fetchDailyActivityMap($startYear.'-01-01', $endYear.'-12-31 23:59:59');
        $buckets = [];
        for ($yr = $startYear; $yr <= $endYear; $yr++) {
            $key = (string) $yr;
            $buckets[$key] = [
                'key' => $key,
                'label' => $key,
                'full_label' => 'Tahun '.$key,
                'orders_count' => 0,
                'billed' => 0,
                'cash_in' => 0,
                'cash_out' => 0,
                'cash_diff' => 0,
            ];
        }

        foreach ($raw as $dateStr => $row) {
            $key = substr($dateStr, 0, 4);
            if (! isset($buckets[$key])) {
                continue;
            }
            $buckets[$key]['orders_count'] += $row['orders_count'];
            $buckets[$key]['billed'] += $row['billed'];
            $buckets[$key]['cash_in'] += $row['cash_in'];
            $buckets[$key]['cash_out'] += $row['cash_out'];
            $buckets[$key]['cash_diff'] = $buckets[$key]['cash_in'] - $buckets[$key]['cash_out'];
        }

        return [
            'granularity' => 'yearly',
            'range_label' => "Per Tahun ({$startYear} - {$endYear})",
            'points' => array_values($buckets),
        ];
    }

    /**
     * Breakdown of POSTED expenses by category inside the active report window.
     *
     * @return array<int, array{category: string, amount: int, count: int, percent: int}>
     */
    protected function buildExpenseBreakdown(string $fromStr, string $toEnd, int $totalCashOut): array
    {
        $rows = DB::table('expenses')
            ->leftJoin('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->where('expenses.status', 'POSTED')
            ->where('expenses.expense_date', '>=', $fromStr)
            ->where('expenses.expense_date', '<=', $toEnd)
            ->selectRaw("COALESCE(expense_categories.name, 'Lainnya') as category_name")
            ->selectRaw('SUM(expenses.amount) as total_amount, COUNT(*) as tx_count')
            ->groupBy('expense_categories.id', 'expense_categories.name')
            ->orderByDesc('total_amount')
            ->get();

        return $rows->map(function ($row) use ($totalCashOut): array {
            $amt = (int) $row->total_amount;
            $pct = $totalCashOut > 0 ? (int) round(($amt / $totalCashOut) * 100) : 0;

            return [
                'category' => (string) $row->category_name,
                'amount' => $amt,
                'count' => (int) $row->tx_count,
                'percent' => $pct,
            ];
        })->values()->all();
    }

    /**
     * Generates a comprehensive Excel export (.xlsx) and returns the file path.
     */
    public function exportExcel(?string $preset = '30d', ?string $from = null, ?string $to = null): string
    {
        $report = $this->getFinancialReport($preset, $from, $to);
        $period = $report['period'];
        $summary = $report['summary'];

        $exporter = new SimpleXlsxExporter();

        // -------------------------------------------------------------
        // Sheet 1: Ringkasan & Metrik
        // -------------------------------------------------------------
        $summaryRows = [
            [['type' => 'string', 'value' => 'MUTIARA FLORIST MANAGEMENT SYSTEM', 'style' => 1]],
            [['type' => 'string', 'value' => 'LAPORAN KEUANGAN & OPERASIONAL', 'style' => 1]],
            [['type' => 'string', 'value' => 'Periode: '.$period['label'], 'style' => 2]],
            [['type' => 'string', 'value' => 'Dicetak pada: '.Carbon::now('Asia/Jakarta')->translatedFormat('d F Y, H:i').' WIB', 'style' => 2]],
            [], // Empty row
            [['type' => 'string', 'value' => 'RINGKASAN METRIK', 'style' => 9]],
            [
                ['type' => 'string', 'value' => 'Metrik', 'style' => 3],
                ['type' => 'string', 'value' => 'Nilai', 'style' => 3],
                ['type' => 'string', 'value' => 'Keterangan', 'style' => 3],
            ],
            [
                ['type' => 'string', 'value' => 'Jumlah Pesanan Dibuat', 'style' => 7],
                ['type' => 'integer', 'value' => $summary['orders_count'], 'style' => 6],
                ['type' => 'string', 'value' => 'Semua pesanan dengan order_date dalam periode', 'style' => 7],
            ],
            [
                ['type' => 'string', 'value' => 'Total Nilai Pesanan', 'style' => 7],
                ['type' => 'currency', 'value' => $summary['total_billed'], 'style' => 5],
                ['type' => 'string', 'value' => 'Akumulasi total_amount pesanan dalam periode', 'style' => 7],
            ],
            [
                ['type' => 'string', 'value' => ' - Subtotal Nilai Bunga', 'style' => 7],
                ['type' => 'currency', 'value' => $summary['flower_total'], 'style' => 5],
                ['type' => 'string', 'value' => 'Total harga pokok produk bunga (qty x harga)', 'style' => 7],
            ],
            [
                ['type' => 'string', 'value' => ' - Subtotal Ongkir Ditagihkan', 'style' => 7],
                ['type' => 'currency', 'value' => $summary['shipping_total'], 'style' => 5],
                ['type' => 'string', 'value' => 'Ongkir mode SEPARATE yang ditagihkan ke pelanggan', 'style' => 7],
            ],
            [
                ['type' => 'string', 'value' => 'Total Kas Masuk (POSTED)', 'style' => 7],
                ['type' => 'currency', 'value' => $summary['cash_in'], 'style' => 5],
                ['type' => 'string', 'value' => 'Penerimaan riil berstatus POSTED dalam periode', 'style' => 7],
            ],
            [
                ['type' => 'string', 'value' => 'Total Kas Keluar (POSTED)', 'style' => 7],
                ['type' => 'currency', 'value' => $summary['cash_out'], 'style' => 5],
                ['type' => 'string', 'value' => 'Pengeluaran kas berstatus POSTED dalam periode', 'style' => 7],
            ],
            [
                ['type' => 'string', 'value' => 'Selisih Kas (Kas Masuk - Kas Keluar)', 'style' => 9],
                ['type' => 'currency', 'value' => $summary['cash_diff'], 'style' => 10],
                ['type' => 'string', 'value' => 'Selisih arus kas bersih (BUKAN laba bersih usaha)', 'style' => 7],
            ],
            [
                ['type' => 'string', 'value' => 'Piutang Berjalan (Snapshot Saat Ini)', 'style' => 9],
                ['type' => 'currency', 'value' => $summary['current_outstanding'], 'style' => 10],
                ['type' => 'string', 'value' => 'Snapshot sisa tagihan terbuka dari '.$summary['open_receivables_count'].' pesanan', 'style' => 7],
            ],
            [],
            [['type' => 'string', 'value' => 'RINGKASAN STATUS OPERASIONAL & PEMBAYARAN', 'style' => 9]],
            [
                ['type' => 'string', 'value' => 'Status Pengerjaan', 'style' => 3],
                ['type' => 'string', 'value' => 'Jumlah', 'style' => 3],
                ['type' => 'string', 'value' => 'Status Pembayaran', 'style' => 3],
                ['type' => 'string', 'value' => 'Jumlah', 'style' => 3],
            ],
            [
                ['type' => 'string', 'value' => 'Baru (NEW)', 'style' => 7],
                ['type' => 'integer', 'value' => $report['fulfillment_breakdown']['NEW'], 'style' => 6],
                ['type' => 'string', 'value' => 'Belum Dibayar (UNPAID)', 'style' => 7],
                ['type' => 'integer', 'value' => $report['payment_breakdown']['UNPAID'], 'style' => 6],
            ],
            [
                ['type' => 'string', 'value' => 'Diproses (PROCESSING)', 'style' => 7],
                ['type' => 'integer', 'value' => $report['fulfillment_breakdown']['PROCESSING'], 'style' => 6],
                ['type' => 'string', 'value' => 'Sebagian (PARTIAL)', 'style' => 7],
                ['type' => 'integer', 'value' => $report['payment_breakdown']['PARTIAL'], 'style' => 6],
            ],
            [
                ['type' => 'string', 'value' => 'Siap Kirim (READY)', 'style' => 7],
                ['type' => 'integer', 'value' => $report['fulfillment_breakdown']['READY'], 'style' => 6],
                ['type' => 'string', 'value' => 'Lunas (PAID)', 'style' => 7],
                ['type' => 'integer', 'value' => $report['payment_breakdown']['PAID'], 'style' => 6],
            ],
            [
                ['type' => 'string', 'value' => 'Selesai (COMPLETED)', 'style' => 7],
                ['type' => 'integer', 'value' => $report['fulfillment_breakdown']['COMPLETED'], 'style' => 6],
                ['type' => 'string', 'value' => '', 'style' => 7],
                ['type' => 'string', 'value' => '', 'style' => 7],
            ],
            [],
            [['type' => 'string', 'value' => 'CATATAN KETENTUAN LAPORAN:', 'style' => 9]],
            [['type' => 'string', 'value' => '1. Nilai pesanan dihitung dari tanggal dibuatnya pesanan (order_date).', 'style' => 11]],
            [['type' => 'string', 'value' => '2. Kas masuk dan keluar dihitung berdasarkan tanggal transaksi kas riil (payment_date / expense_date).', 'style' => 11]],
            [['type' => 'string', 'value' => '3. Transaksi koreksi berstatus VOIDED otomatis dikecualikan dari seluruh perhitungan kas.', 'style' => 11]],
            [['type' => 'string', 'value' => '4. Selisih kas merupakan penerimaan dikurangi pengeluaran, BUKAN laba bersih usaha.', 'style' => 11]],
            [['type' => 'string', 'value' => '5. Piutang berjalan merupakan snapshot saldo tagihan terbuka saat ini (bukan saldo historis akhir periode).', 'style' => 11]],
        ];
        $exporter->addSheet('Ringkasan', $summaryRows, [35, 22, 55, 20]);

        // -------------------------------------------------------------
        // Sheet 2: Daftar Pesanan dalam Periode
        // -------------------------------------------------------------
        $postedPaymentsSub = DB::table('payments')
            ->select('order_id')
            ->selectRaw('SUM(amount) AS paid_amount')
            ->where('status', 'POSTED')
            ->groupBy('order_id');

        $orders = DB::table('orders')
            ->join('customers', 'orders.customer_id', '=', 'customers.id')
            ->leftJoinSub($postedPaymentsSub, 'received', fn ($join) => $join->on('orders.id', '=', 'received.order_id'))
            ->select([
                'orders.id',
                'orders.order_number',
                'orders.order_date',
                'orders.total_amount',
                'orders.status',
                'customers.name AS customer_name',
            ])
            ->selectRaw('COALESCE(received.paid_amount, 0) AS paid_amount')
            ->where('orders.order_date', '>=', $period['from'])
            ->where('orders.order_date', '<=', $period['to'].' 23:59:59')
            ->orderBy('orders.order_date')
            ->orderBy('orders.id')
            ->get();

        $orderRows = [
            [['type' => 'string', 'value' => 'DAFTAR PESANAN — PERIODE: '.$period['label'], 'style' => 1]],
            [],
            [
                ['type' => 'string', 'value' => 'No', 'style' => 3],
                ['type' => 'string', 'value' => 'Nomor Pesanan', 'style' => 3],
                ['type' => 'string', 'value' => 'Tanggal', 'style' => 3],
                ['type' => 'string', 'value' => 'Pelanggan', 'style' => 3],
                ['type' => 'string', 'value' => 'Total Tagihan', 'style' => 3],
                ['type' => 'string', 'value' => 'Terbayar (POSTED)', 'style' => 3],
                ['type' => 'string', 'value' => 'Sisa Tagihan', 'style' => 3],
                ['type' => 'string', 'value' => 'Status Pengerjaan', 'style' => 3],
                ['type' => 'string', 'value' => 'Status Pembayaran', 'style' => 3],
            ],
        ];

        $idx = 1;
        $sumBilled = 0;
        $sumPaid = 0;
        $sumRemaining = 0;

        foreach ($orders as $order) {
            $billed = (int) $order->total_amount;
            $paid = (int) $order->paid_amount;
            $remaining = max($billed - $paid, 0);

            $payStatus = 'UNPAID';
            if ($paid >= $billed) {
                $payStatus = 'PAID';
            } elseif ($paid > 0) {
                $payStatus = 'PARTIAL';
            }

            $orderRows[] = [
                ['type' => 'integer', 'value' => $idx++, 'style' => 8],
                ['type' => 'string', 'value' => $order->order_number, 'style' => 8],
                ['type' => 'string', 'value' => Carbon::parse($order->order_date)->format('Y-m-d'), 'style' => 4],
                ['type' => 'string', 'value' => $order->customer_name, 'style' => 7],
                ['type' => 'currency', 'value' => $billed, 'style' => 5],
                ['type' => 'currency', 'value' => $paid, 'style' => 5],
                ['type' => 'currency', 'value' => $remaining, 'style' => 5],
                ['type' => 'string', 'value' => $order->status, 'style' => 8],
                ['type' => 'string', 'value' => $payStatus, 'style' => 8],
            ];

            $sumBilled += $billed;
            $sumPaid += $paid;
            $sumRemaining += $remaining;
        }

        // Total row
        $orderRows[] = [
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => 'TOTAL', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'currency', 'value' => $sumBilled, 'style' => 10],
            ['type' => 'currency', 'value' => $sumPaid, 'style' => 10],
            ['type' => 'currency', 'value' => $sumRemaining, 'style' => 10],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
        ];

        $exporter->addSheet('Pesanan', $orderRows, [6, 18, 14, 28, 18, 18, 18, 18, 18]);

        // -------------------------------------------------------------
        // Sheet 3: Penerimaan Kas (POSTED)
        // -------------------------------------------------------------
        $payments = DB::table('payments')
            ->join('orders', 'payments.order_id', '=', 'orders.id')
            ->join('customers', 'orders.customer_id', '=', 'customers.id')
            ->select([
                'payments.id',
                'payments.payment_date',
                'payments.amount',
                'payments.method',
                'payments.reference',
                'payments.notes',
                'orders.order_number',
                'customers.name AS customer_name',
            ])
            ->where('payments.status', 'POSTED')
            ->where('payments.payment_date', '>=', $period['from'])
            ->where('payments.payment_date', '<=', $period['to'].' 23:59:59')
            ->orderBy('payments.payment_date')
            ->orderBy('payments.id')
            ->get();

        $paymentRows = [
            [['type' => 'string', 'value' => 'PENERIMAAN KAS (POSTED) — PERIODE: '.$period['label'], 'style' => 1]],
            [['type' => 'string', 'value' => 'Hanya mencatat transaksi POSTED. Transaksi VOIDED tidak disertakan.', 'style' => 2]],
            [],
            [
                ['type' => 'string', 'value' => 'No', 'style' => 3],
                ['type' => 'string', 'value' => 'Tanggal', 'style' => 3],
                ['type' => 'string', 'value' => 'Nomor Pesanan', 'style' => 3],
                ['type' => 'string', 'value' => 'Pelanggan', 'style' => 3],
                ['type' => 'string', 'value' => 'Metode', 'style' => 3],
                ['type' => 'string', 'value' => 'Nominal', 'style' => 3],
                ['type' => 'string', 'value' => 'Referensi', 'style' => 3],
                ['type' => 'string', 'value' => 'Catatan', 'style' => 3],
            ],
        ];

        $idx = 1;
        $sumPayments = 0;
        foreach ($payments as $p) {
            $amt = (int) $p->amount;
            $paymentRows[] = [
                ['type' => 'integer', 'value' => $idx++, 'style' => 8],
                ['type' => 'string', 'value' => Carbon::parse($p->payment_date)->format('Y-m-d'), 'style' => 4],
                ['type' => 'string', 'value' => $p->order_number, 'style' => 8],
                ['type' => 'string', 'value' => $p->customer_name, 'style' => 7],
                ['type' => 'string', 'value' => $p->method, 'style' => 8],
                ['type' => 'currency', 'value' => $amt, 'style' => 5],
                ['type' => 'string', 'value' => $p->reference ?? '-', 'style' => 7],
                ['type' => 'string', 'value' => $p->notes ?? '-', 'style' => 7],
            ];
            $sumPayments += $amt;
        }

        $paymentRows[] = [
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => 'TOTAL', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'currency', 'value' => $sumPayments, 'style' => 10],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
        ];

        $exporter->addSheet('Kas Masuk (POSTED)', $paymentRows, [6, 14, 18, 28, 14, 18, 20, 30]);

        // -------------------------------------------------------------
        // Sheet 4: Pengeluaran Kas (POSTED)
        // -------------------------------------------------------------
        $expenses = DB::table('expenses')
            ->join('expense_categories', 'expenses.expense_category_id', '=', 'expense_categories.id')
            ->select([
                'expenses.id',
                'expenses.expense_date',
                'expenses.amount',
                'expenses.description',
                'expense_categories.name AS category_name',
            ])
            ->where('expenses.status', 'POSTED')
            ->where('expenses.expense_date', '>=', $period['from'])
            ->where('expenses.expense_date', '<=', $period['to'].' 23:59:59')
            ->orderBy('expenses.expense_date')
            ->orderBy('expenses.id')
            ->get();

        $expenseRows = [
            [['type' => 'string', 'value' => 'PENGELUARAN KAS (POSTED) — PERIODE: '.$period['label'], 'style' => 1]],
            [['type' => 'string', 'value' => 'Hanya mencatat pengeluaran POSTED. Pengeluaran VOIDED tidak disertakan.', 'style' => 2]],
            [],
            [
                ['type' => 'string', 'value' => 'No', 'style' => 3],
                ['type' => 'string', 'value' => 'Tanggal', 'style' => 3],
                ['type' => 'string', 'value' => 'Kategori Biaya', 'style' => 3],
                ['type' => 'string', 'value' => 'Nominal', 'style' => 3],
                ['type' => 'string', 'value' => 'Keterangan', 'style' => 3],
            ],
        ];

        $idx = 1;
        $sumExpenses = 0;
        foreach ($expenses as $e) {
            $amt = (int) $e->amount;
            $expenseRows[] = [
                ['type' => 'integer', 'value' => $idx++, 'style' => 8],
                ['type' => 'string', 'value' => Carbon::parse($e->expense_date)->format('Y-m-d'), 'style' => 4],
                ['type' => 'string', 'value' => $e->category_name, 'style' => 7],
                ['type' => 'currency', 'value' => $amt, 'style' => 5],
                ['type' => 'string', 'value' => $e->description, 'style' => 7],
            ];
            $sumExpenses += $amt;
        }

        $expenseRows[] = [
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'string', 'value' => 'TOTAL', 'style' => 9],
            ['type' => 'string', 'value' => '', 'style' => 9],
            ['type' => 'currency', 'value' => $sumExpenses, 'style' => 10],
            ['type' => 'string', 'value' => '', 'style' => 9],
        ];

        $exporter->addSheet('Kas Keluar (POSTED)', $expenseRows, [6, 14, 25, 18, 45]);

        // Output file
        $fileName = 'laporan_keuangan_'.$period['from'].'_'.$period['to'].'_'.time().'.xlsx';
        $exportPath = storage_path('app/exports/'.$fileName);

        $exporter->save($exportPath);

        return $exportPath;
    }
}
