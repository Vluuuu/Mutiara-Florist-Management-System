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
        $validPresets = ['today', '7d', '30d', 'this_month', 'last_month', 'custom'];
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
            $label = '7 Hari Terakhir ('.$now->copy()->subDays(6)->format('d/m/Y').' – '.$now->format('d/m/Y').')';
        } elseif ($preset === 'this_month') {
            $fromStr = $now->copy()->startOfMonth()->format('Y-m-d');
            $toStr = $now->copy()->endOfMonth()->format('Y-m-d');
            $label = 'Bulan Ini ('.$now->translatedFormat('F Y').')';
        } elseif ($preset === 'last_month') {
            $lastMonth = $now->copy()->subMonth();
            $fromStr = $lastMonth->copy()->startOfMonth()->format('Y-m-d');
            $toStr = $lastMonth->copy()->endOfMonth()->format('Y-m-d');
            $label = 'Bulan Lalu ('.$lastMonth->translatedFormat('F Y').')';
        } elseif ($preset === 'custom') {
            /** @var string $fromStr */
            /** @var string $toStr */
            $label = 'Kustom ('.Carbon::parse($fromStr)->format('d/m/Y').' – '.Carbon::parse($toStr)->format('d/m/Y').')';
        } else {
            // Default 30d
            $preset = '30d';
            $fromStr = $now->copy()->subDays(29)->format('Y-m-d');
            $toStr = $now->format('Y-m-d');
            $label = '30 Hari Terakhir ('.$now->copy()->subDays(29)->format('d/m/Y').' – '.$now->format('d/m/Y').')';
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
    public function getFinancialReport(?string $preset = '30d', ?string $from = null, ?string $to = null): array
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

        // 6. Daily trend data
        $dailyTrends = $this->buildDailyTrends($fromStr, $toStr);

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
            'daily_trends' => $dailyTrends,
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

        $ordersDaily = DB::table('orders')
            ->select('order_date')
            ->selectRaw('COUNT(*) as count, SUM(total_amount) as billed')
            ->where('order_date', '>=', $startStr)
            ->where('order_date', '<=', $endStr)
            ->groupBy('order_date')
            ->get()
            ->keyBy(fn ($item) => Carbon::parse($item->order_date)->format('Y-m-d'));

        $paymentsDaily = DB::table('payments')
            ->select('payment_date')
            ->selectRaw('SUM(amount) as cash_in')
            ->where('status', 'POSTED')
            ->where('payment_date', '>=', $startStr)
            ->where('payment_date', '<=', $endStr)
            ->groupBy('payment_date')
            ->get()
            ->keyBy(fn ($item) => Carbon::parse($item->payment_date)->format('Y-m-d'));

        $expensesDaily = DB::table('expenses')
            ->select('expense_date')
            ->selectRaw('SUM(amount) as cash_out')
            ->where('status', 'POSTED')
            ->where('expense_date', '>=', $startStr)
            ->where('expense_date', '<=', $endStr)
            ->groupBy('expense_date')
            ->get()
            ->keyBy(fn ($item) => Carbon::parse($item->expense_date)->format('Y-m-d'));

        $period = CarbonPeriod::create($startDate, $endDate);
        $trends = [];

        foreach ($period as $date) {
            $d = $date->format('Y-m-d');
            $order = $ordersDaily->get($d);
            $payment = $paymentsDaily->get($d);
            $expense = $expensesDaily->get($d);

            $trends[] = [
                'date' => $d,
                'formatted_date' => $date->format('d/m'),
                'orders_count' => (int) ($order->count ?? 0),
                'billed' => (int) ($order->billed ?? 0),
                'cash_in' => (int) ($payment->cash_in ?? 0),
                'cash_out' => (int) ($expense->cash_out ?? 0),
            ];
        }

        return $trends;
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
