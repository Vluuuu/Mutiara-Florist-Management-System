<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

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
     * Ringkasan operasional & transaksi khusus tanggal hari ini (WIB).
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
                d.deliveries_ready
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
                    COALESCE(SUM(CASE WHEN fulfillment_status = 'READY' THEN 1 ELSE 0 END), 0) AS deliveries_ready
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

        return [
            'today_iso' => $todayIso,
            'orders_count' => (int) ($summaryRow->orders_count ?? 0),
            'orders_billed' => (int) ($summaryRow->orders_billed ?? 0),
            'deliveries_total_today' => (int) ($summaryRow->deliveries_total_today ?? 0),
            'deliveries_pending_today' => (int) ($summaryRow->deliveries_pending_today ?? 0),
            'deliveries_delivered_today' => (int) ($summaryRow->deliveries_delivered_today ?? 0),
            'deliveries_overdue' => (int) ($summaryRow->deliveries_overdue ?? 0),
            'deliveries_ready' => (int) ($summaryRow->deliveries_ready ?? 0),
            'cash_in' => (int) ($summaryRow->cash_in ?? 0),
            'cash_in_count' => (int) ($summaryRow->cash_in_count ?? 0),
            'cash_out' => (int) ($summaryRow->cash_out ?? 0),
            'cash_out_count' => (int) ($summaryRow->cash_out_count ?? 0),
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
}
