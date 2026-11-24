<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DashboardService
{
    /**
     * Kumulatif statistik ringkas sejak awal pencatatan.
     *
     * Dipakai bersama oleh dashboard Blade lama dan dashboard React baru agar
     * angka keduanya selalu konsisten. Hanya pembayaran dan pengeluaran
     * berstatus POSTED yang dihitung; VOIDED tidak masuk perhitungan kas.
     */
    public function stats(): array
    {
        // MVP: no cancellation. Operational order value is not the same as cash received.
        // Consolidated into a single round-trip query for Supabase/Postgres latency optimization.
        $row = DB::selectOne(
            "SELECT
                o.orders_count,
                o.billed,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'POSTED') AS received,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status = 'POSTED') AS expenses
            FROM (
                SELECT COUNT(*) AS orders_count, COALESCE(SUM(total_amount), 0) AS billed
                FROM orders
            ) o"
        );

        $orders = (int) ($row->orders_count ?? 0);
        $billed = (int) ($row->billed ?? 0);
        $received = (int) ($row->received ?? 0);
        $expenses = (int) ($row->expenses ?? 0);

        return [
            'orders' => $orders,
            'billed' => $billed,
            'received' => $received,
            'outstanding' => max($billed - $received, 0),
            'expenses' => $expenses,
            'cash_flow' => $received - $expenses,
        ];
    }

    /**
     * Query read-only antrean item bunga yang belum selesai dikirim (urut tanggal kirim terdekat).
     * Memakai perbandingan rentang tanggal kalender yang ramah indeks B-Tree PostgreSQL/MySQL.
     */
    public function activeDeliveryQueue(int $limit = 12): array
    {
        $todayIso = now('Asia/Jakarta')->toDateString();
        $todayEnd = $todayIso.' 23:59:59';

        $rows = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('customers', 'customers.id', '=', 'orders.customer_id')
            ->whereIn('order_items.fulfillment_status', ['NEW', 'PROCESSING', 'READY'])
            ->select([
                'order_items.id as item_id',
                'order_items.order_id',
                'order_items.flower_type',
                'order_items.recipient',
                'order_items.delivery_location',
                'order_items.delivery_date',
                'order_items.quantity',
                'order_items.fulfillment_status',
                'orders.order_number',
                'customers.name as customer_name',
            ])
            ->selectRaw('COUNT(*) OVER() as total_count')
            ->selectRaw('SUM(CASE WHEN order_items.delivery_date < ? THEN 1 ELSE 0 END) OVER() as overdue_count', [$todayIso])
            ->selectRaw('SUM(CASE WHEN order_items.delivery_date >= ? AND order_items.delivery_date <= ? THEN 1 ELSE 0 END) OVER() as today_count', [$todayIso, $todayEnd])
            ->selectRaw("SUM(CASE WHEN order_items.fulfillment_status = 'READY' THEN 1 ELSE 0 END) OVER() as ready_count")
            ->orderBy('order_items.delivery_date')
            ->orderBy('order_items.id')
            ->limit($limit)
            ->get();

        $first = $rows->first();

        $nextMap = [
            'NEW' => 'PROCESSING',
            'PROCESSING' => 'READY',
            'READY' => 'DELIVERED',
        ];

        $items = $rows->map(function ($row) use ($todayIso, $nextMap): array {
            $rawDate = substr((string) $row->delivery_date, 0, 10);
            $urgency = $rawDate < $todayIso
                ? 'overdue'
                : ($rawDate === $todayIso ? 'today' : 'upcoming');

            return [
                'item_id' => (int) $row->item_id,
                'order_id' => (int) $row->order_id,
                'order_number' => $row->order_number,
                'customer_name' => $row->customer_name,
                'flower_type' => $row->flower_type,
                'recipient' => $row->recipient,
                'delivery_location' => $row->delivery_location,
                'delivery_date' => date('d/m/Y', strtotime($rawDate)),
                'delivery_date_raw' => $rawDate,
                'quantity' => (int) $row->quantity,
                'fulfillment_status' => $row->fulfillment_status,
                'next_status' => $nextMap[$row->fulfillment_status] ?? null,
                'urgency' => $urgency,
            ];
        })->values()->all();

        return [
            'items' => $items,
            'total_count' => (int) ($first->total_count ?? 0),
            'overdue_count' => (int) ($first->overdue_count ?? 0),
            'today_count' => (int) ($first->today_count ?? 0),
            'ready_count' => (int) ($first->ready_count ?? 0),
        ];
    }

    /**
     * Ringkasan operasional & transaksi khusus tanggal hari ini (WIB) serta distribusi
     * seluruh item pengerjaan aktif (NEW/PROCESSING/READY).
     * Menggabungkan seluruh agregasi dalam 1 round-trip query ke Supabase PostgreSQL.
     */
    public function todayStats(): array
    {
        $todayIso = now('Asia/Jakarta')->toDateString();
        $todayEnd = $todayIso.' 23:59:59';

        $summaryRow = DB::selectOne(
            "SELECT
                o.orders_count,
                o.orders_billed,
                p.cash_in_count,
                p.cash_in,
                e.cash_out_count,
                e.cash_out,
                r.open_receivables_count,
                d.deliveries_total_today,
                d.deliveries_pending_today,
                d.deliveries_delivered_today,
                d.deliveries_overdue,
                d.deliveries_ready,
                d.pipeline_new,
                d.pipeline_processing
            FROM (
                SELECT COUNT(*) AS orders_count, COALESCE(SUM(total_amount), 0) AS orders_billed
                FROM orders
                WHERE order_date >= ? AND order_date <= ?
            ) o
            CROSS JOIN (
                SELECT COUNT(*) AS cash_in_count, COALESCE(SUM(amount), 0) AS cash_in
                FROM payments
                WHERE status = 'POSTED' AND payment_date >= ? AND payment_date <= ?
            ) p
            CROSS JOIN (
                SELECT COUNT(*) AS cash_out_count, COALESCE(SUM(amount), 0) AS cash_out
                FROM expenses
                WHERE status = 'POSTED' AND expense_date >= ? AND expense_date <= ?
            ) e
            CROSS JOIN (
                SELECT COUNT(*) AS open_receivables_count
                FROM orders ord
                LEFT JOIN (
                    SELECT order_id, SUM(amount) AS paid_amount
                    FROM payments
                    WHERE status = 'POSTED'
                    GROUP BY order_id
                ) paid_totals ON paid_totals.order_id = ord.id
                WHERE ord.total_amount > COALESCE(paid_totals.paid_amount, 0)
            ) r
            CROSS JOIN (
                SELECT
                    COALESCE(SUM(CASE WHEN delivery_date >= ? AND delivery_date <= ? THEN 1 ELSE 0 END), 0) AS deliveries_total_today,
                    COALESCE(SUM(CASE WHEN delivery_date >= ? AND delivery_date <= ? AND fulfillment_status IN ('NEW', 'PROCESSING', 'READY') THEN 1 ELSE 0 END), 0) AS deliveries_pending_today,
                    COALESCE(SUM(CASE WHEN delivery_date >= ? AND delivery_date <= ? AND fulfillment_status = 'DELIVERED' THEN 1 ELSE 0 END), 0) AS deliveries_delivered_today,
                    COALESCE(SUM(CASE WHEN delivery_date < ? AND fulfillment_status IN ('NEW', 'PROCESSING', 'READY') THEN 1 ELSE 0 END), 0) AS deliveries_overdue,
                    COALESCE(SUM(CASE WHEN fulfillment_status = 'READY' THEN 1 ELSE 0 END), 0) AS deliveries_ready,
                    COALESCE(SUM(CASE WHEN fulfillment_status = 'NEW' THEN 1 ELSE 0 END), 0) AS pipeline_new,
                    COALESCE(SUM(CASE WHEN fulfillment_status = 'PROCESSING' THEN 1 ELSE 0 END), 0) AS pipeline_processing
                FROM order_items
                WHERE fulfillment_status IN ('NEW', 'PROCESSING', 'READY')
                   OR (delivery_date >= ? AND delivery_date <= ?)
            ) d",
            [
                $todayIso, $todayEnd,
                $todayIso, $todayEnd,
                $todayIso, $todayEnd,
                $todayIso, $todayEnd,
                $todayIso, $todayEnd,
                $todayIso, $todayEnd,
                $todayIso,
                $todayIso, $todayEnd,
            ]
        );

        $cashIn = (int) ($summaryRow->cash_in ?? 0);
        $cashOut = (int) ($summaryRow->cash_out ?? 0);
        $pipelineNew = (int) ($summaryRow->pipeline_new ?? 0);
        $pipelineProcessing = (int) ($summaryRow->pipeline_processing ?? 0);
        $pipelineReady = (int) ($summaryRow->deliveries_ready ?? 0);

        return [
            'today_iso' => $todayIso,
            'orders_count' => (int) ($summaryRow->orders_count ?? 0),
            'orders_billed' => (int) ($summaryRow->orders_billed ?? 0),
            'deliveries_total_today' => (int) ($summaryRow->deliveries_total_today ?? 0),
            'deliveries_pending_today' => (int) ($summaryRow->deliveries_pending_today ?? 0),
            'deliveries_delivered_today' => (int) ($summaryRow->deliveries_delivered_today ?? 0),
            'deliveries_overdue' => (int) ($summaryRow->deliveries_overdue ?? 0),
            'deliveries_ready' => $pipelineReady,
            'pipeline_new' => $pipelineNew,
            'pipeline_processing' => $pipelineProcessing,
            'pipeline_ready' => $pipelineReady,
            'pipeline_total' => $pipelineNew + $pipelineProcessing + $pipelineReady,
            'cash_in' => $cashIn,
            'cash_in_count' => (int) ($summaryRow->cash_in_count ?? 0),
            'cash_out' => $cashOut,
            'cash_out_count' => (int) ($summaryRow->cash_out_count ?? 0),
            'cash_diff' => $cashIn - $cashOut,
            'open_receivables_count' => (int) ($summaryRow->open_receivables_count ?? 0),
        ];
    }

    /**
     * Query read-only daftar piutang aktif (order dengan sisa tagihan > 0).
     * Hanya pembayaran berstatus POSTED yang dihitung sebagai sudah terbayar.
     */
    public function openReceivables(int $limit = 8): array
    {
        $paidSub = DB::table('payments')
            ->selectRaw('order_id, SUM(amount) as paid_amount')
            ->where('status', 'POSTED')
            ->groupBy('order_id');

        $rows = DB::table('orders')
            ->join('customers', 'customers.id', '=', 'orders.customer_id')
            ->leftJoinSub($paidSub, 'paid_totals', function ($join): void {
                $join->on('paid_totals.order_id', '=', 'orders.id');
            })
            ->select([
                'orders.id',
                'orders.order_number',
                'orders.order_date',
                'orders.total_amount',
                'customers.name as customer_name',
                DB::raw('COALESCE(paid_totals.paid_amount, 0) as paid_amount'),
            ])
            ->whereRaw('orders.total_amount > COALESCE(paid_totals.paid_amount, 0)')
            ->orderBy('orders.order_date')
            ->orderBy('orders.id')
            ->limit($limit)
            ->get();

        return $rows->map(function ($row): array {
            $total = (int) $row->total_amount;
            $paid = (int) $row->paid_amount;

            return [
                'id' => (int) $row->id,
                'order_number' => $row->order_number,
                'order_date' => date('d/m/Y', strtotime((string) $row->order_date)),
                'customer_name' => $row->customer_name,
                'total_amount' => $total,
                'paid_amount' => $paid,
                'outstanding' => max($total - $paid, 0),
                'payment_status' => $paid === 0 ? 'UNPAID' : 'PARTIAL',
            ];
        })->values()->all();
    }

    /**
     * Ringkasan arus kas harian 7 hari dan 30 hari terakhir (batas kalender WIB)
     * dalam 1 query SQL read-only. Hanya catatan berstatus POSTED yang dihitung.
     */
    public function cashFlowPulse(): array
    {
        $todayWib = Carbon::now('Asia/Jakarta')->startOfDay();
        $start30d = $todayWib->copy()->subDays(29);
        $start7d = $todayWib->copy()->subDays(6);

        $from30Str = $start30d->format('Y-m-d');
        $toStr = $todayWib->format('Y-m-d');
        $toEndStr = $toStr.' 23:59:59';

        $rows = DB::select(
            "SELECT 'in' AS flow_type, payment_date AS tx_date, COALESCE(SUM(amount), 0) AS total_amount
             FROM payments
             WHERE status = 'POSTED' AND payment_date >= ? AND payment_date <= ?
             GROUP BY payment_date
             UNION ALL
             SELECT 'out' AS flow_type, expense_date AS tx_date, COALESCE(SUM(amount), 0) AS total_amount
             FROM expenses
             WHERE status = 'POSTED' AND expense_date >= ? AND expense_date <= ?
             GROUP BY expense_date",
            [$from30Str, $toEndStr, $from30Str, $toEndStr]
        );

        $dailyMap = [];
        foreach ($rows as $row) {
            $dateKey = substr((string) $row->tx_date, 0, 10);
            if (! isset($dailyMap[$dateKey])) {
                $dailyMap[$dateKey] = ['cash_in' => 0, 'cash_out' => 0];
            }
            if ($row->flow_type === 'in') {
                $dailyMap[$dateKey]['cash_in'] += (int) $row->total_amount;
            } else {
                $dailyMap[$dateKey]['cash_out'] += (int) $row->total_amount;
            }
        }

        $points30d = [];
        $sum30In = 0;
        $sum30Out = 0;
        $has30Activity = false;

        foreach (CarbonPeriod::create($start30d, $todayWib) as $date) {
            $iso = $date->format('Y-m-d');
            $cashIn = $dailyMap[$iso]['cash_in'] ?? 0;
            $cashOut = $dailyMap[$iso]['cash_out'] ?? 0;
            $cashDiff = $cashIn - $cashOut;

            if ($cashIn > 0 || $cashOut > 0) {
                $has30Activity = true;
            }

            $sum30In += $cashIn;
            $sum30Out += $cashOut;

            $points30d[] = [
                'date' => $iso,
                'label' => $date->format('d/m'),
                'full_label' => $date->copy()->locale('id')->translatedFormat('D, d M Y'),
                'cash_in' => $cashIn,
                'cash_out' => $cashOut,
                'cash_diff' => $cashDiff,
            ];
        }

        $points7d = array_slice($points30d, -7);
        $sum7In = 0;
        $sum7Out = 0;
        $has7Activity = false;

        foreach ($points7d as $pt) {
            $sum7In += $pt['cash_in'];
            $sum7Out += $pt['cash_out'];
            if ($pt['cash_in'] > 0 || $pt['cash_out'] > 0) {
                $has7Activity = true;
            }
        }

        return [
            'timezone' => 'WIB (Asia/Jakarta)',
            'period_7d' => [
                'from' => $start7d->format('Y-m-d'),
                'to' => $toStr,
                'label' => $start7d->format('d/m/Y').' - '.$todayWib->format('d/m/Y').' WIB',
                'cash_in' => $sum7In,
                'cash_out' => $sum7Out,
                'cash_diff' => $sum7In - $sum7Out,
                'has_activity' => $has7Activity,
                'points' => $points7d,
            ],
            'period_30d' => [
                'from' => $from30Str,
                'to' => $toStr,
                'label' => $start30d->format('d/m/Y').' - '.$todayWib->format('d/m/Y').' WIB',
                'cash_in' => $sum30In,
                'cash_out' => $sum30Out,
                'cash_diff' => $sum30In - $sum30Out,
                'has_activity' => $has30Activity,
                'points' => $points30d,
            ],
        ];
    }

    /**
     * Aktivitas bisnis terbaru (maksimal $limit catatan nyata): pesanan baru,
     * pembayaran sah (POSTED), dan pengeluaran sah (POSTED).
     * Tidak menampilkan data sensitif atau log audit penuh.
     */
    public function recentActivity(int $limit = 6): array
    {
        $events = [];

        $recentOrders = DB::table('orders')
            ->join('customers', 'customers.id', '=', 'orders.customer_id')
            ->select([
                'orders.id',
                'orders.order_number',
                'orders.total_amount',
                'orders.order_date',
                'orders.created_at',
                'customers.name as customer_name',
            ])
            ->orderByDesc('orders.created_at')
            ->orderByDesc('orders.id')
            ->limit($limit)
            ->get();

        foreach ($recentOrders as $ord) {
            $ts = $this->parseTimestampWib($ord->created_at ?? $ord->order_date);
            $events[] = [
                'key' => 'order-'.$ord->id,
                'type' => 'order',
                'label' => 'Pesanan Baru',
                'title' => (string) $ord->customer_name,
                'subtitle' => 'Nota tanggal '.date('d/m/Y', strtotime((string) $ord->order_date)),
                'order_number' => (string) $ord->order_number,
                'amount' => (int) $ord->total_amount,
                'occurred_at' => $ts->format('d/m/Y H:i').' WIB',
                'occurred_iso' => $ts->toIso8601String(),
                'href' => '/ui-orders/'.$ord->id,
                'component' => 'Orders/Show',
                '_sort_ts' => $ts->getTimestamp(),
                '_sort_id' => (int) $ord->id,
                '_sort_rank' => 1,
            ];
        }

        $recentPayments = DB::table('payments')
            ->join('orders', 'orders.id', '=', 'payments.order_id')
            ->join('customers', 'customers.id', '=', 'orders.customer_id')
            ->where('payments.status', 'POSTED')
            ->select([
                'payments.id',
                'payments.order_id',
                'payments.amount',
                'payments.method',
                'payments.payment_date',
                'payments.created_at',
                'orders.order_number',
                'customers.name as customer_name',
            ])
            ->orderByDesc('payments.created_at')
            ->orderByDesc('payments.id')
            ->limit($limit)
            ->get();

        foreach ($recentPayments as $pay) {
            $ts = $this->parseTimestampWib($pay->created_at ?? $pay->payment_date);
            $methodLabel = match (strtoupper((string) $pay->method)) {
                'TRANSFER' => 'Transfer bank',
                'CASH' => 'Tunai',
                'QRIS' => 'QRIS',
                default => 'Lainnya',
            };
            $events[] = [
                'key' => 'payment-'.$pay->id,
                'type' => 'payment',
                'label' => 'Pembayaran Masuk',
                'title' => (string) $pay->customer_name,
                'subtitle' => $methodLabel.' · '.date('d/m/Y', strtotime((string) $pay->payment_date)),
                'order_number' => (string) $pay->order_number,
                'amount' => (int) $pay->amount,
                'occurred_at' => $ts->format('d/m/Y H:i').' WIB',
                'occurred_iso' => $ts->toIso8601String(),
                'href' => '/ui-orders/'.$pay->order_id,
                'component' => 'Orders/Show',
                '_sort_ts' => $ts->getTimestamp(),
                '_sort_id' => (int) $pay->id,
                '_sort_rank' => 3,
            ];
        }

        $recentExpenses = DB::table('expenses')
            ->leftJoin('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->where('expenses.status', 'POSTED')
            ->select([
                'expenses.id',
                'expenses.amount',
                'expenses.description',
                'expenses.expense_date',
                'expenses.created_at',
                'expense_categories.name as category_name',
            ])
            ->orderByDesc('expenses.created_at')
            ->orderByDesc('expenses.id')
            ->limit($limit)
            ->get();

        foreach ($recentExpenses as $exp) {
            $ts = $this->parseTimestampWib($exp->created_at ?? $exp->expense_date);
            $events[] = [
                'key' => 'expense-'.$exp->id,
                'type' => 'expense',
                'label' => 'Pengeluaran',
                'title' => (string) ($exp->category_name ?? 'Pengeluaran Operasional'),
                'subtitle' => Str::limit(trim((string) $exp->description), 72),
                'order_number' => null,
                'amount' => (int) $exp->amount,
                'occurred_at' => $ts->format('d/m/Y H:i').' WIB',
                'occurred_iso' => $ts->toIso8601String(),
                'href' => '/ui-expenses',
                'component' => 'Expenses/Index',
                '_sort_ts' => $ts->getTimestamp(),
                '_sort_id' => (int) $exp->id,
                '_sort_rank' => 2,
            ];
        }

        usort($events, static function (array $a, array $b): int {
            if ($a['_sort_ts'] !== $b['_sort_ts']) {
                return $b['_sort_ts'] <=> $a['_sort_ts'];
            }
            if ($a['_sort_rank'] !== $b['_sort_rank']) {
                return $b['_sort_rank'] <=> $a['_sort_rank'];
            }

            return $b['_sort_id'] <=> $a['_sort_id'];
        });

        return array_map(
            static function (array $item): array {
                unset($item['_sort_ts'], $item['_sort_id'], $item['_sort_rank']);

                return $item;
            },
            array_slice($events, 0, $limit)
        );
    }

    private function parseTimestampWib(mixed $value): Carbon
    {
        if (! $value) {
            return Carbon::now('Asia/Jakarta');
        }

        return Carbon::parse((string) $value, config('app.timezone', 'UTC'))->timezone('Asia/Jakarta');
    }
}
