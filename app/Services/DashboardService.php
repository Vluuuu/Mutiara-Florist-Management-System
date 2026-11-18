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
        $orders = (int) DB::table('orders')->count();
        $billed = (int) DB::table('orders')->sum('total_amount');
        $received = (int) DB::table('payments')->where('status', 'POSTED')->sum('amount');
        $expenses = (int) DB::table('expenses')->where('status', 'POSTED')->sum('amount');

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
     * Memakai perbandingan tanggal kalender (DATE) tanpa estimasi jam/menit.
     */
    public function activeDeliveryQueue(int $limit = 12): array
    {
        $todayIso = now('Asia/Jakarta')->toDateString();

        $baseQuery = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('customers', 'customers.id', '=', 'orders.customer_id')
            ->whereIn('order_items.fulfillment_status', ['NEW', 'PROCESSING', 'READY']);

        $counts = (clone $baseQuery)
            ->selectRaw('COUNT(*) as total_count')
            ->selectRaw('SUM(CASE WHEN DATE(order_items.delivery_date) < ? THEN 1 ELSE 0 END) as overdue_count', [$todayIso])
            ->selectRaw('SUM(CASE WHEN DATE(order_items.delivery_date) = ? THEN 1 ELSE 0 END) as today_count', [$todayIso])
            ->selectRaw("SUM(CASE WHEN order_items.fulfillment_status = 'READY' THEN 1 ELSE 0 END) as ready_count")
            ->first();

        $rows = (clone $baseQuery)
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
            ->orderBy('order_items.delivery_date')
            ->orderBy('order_items.id')
            ->limit($limit)
            ->get();

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
            'total_count' => (int) ($counts->total_count ?? 0),
            'overdue_count' => (int) ($counts->overdue_count ?? 0),
            'today_count' => (int) ($counts->today_count ?? 0),
            'ready_count' => (int) ($counts->ready_count ?? 0),
        ];
    }

    /**
     * Ringkasan operasional & transaksi khusus tanggal hari ini (WIB).
     */
    public function todayStats(): array
    {
        $todayIso = now('Asia/Jakarta')->toDateString();

        $ordersToday = DB::table('orders')
            ->whereRaw('DATE(order_date) = ?', [$todayIso])
            ->selectRaw('COUNT(*) as orders_count, COALESCE(SUM(total_amount), 0) as orders_billed')
            ->first();

        $deliveries = DB::table('order_items')
            ->selectRaw('SUM(CASE WHEN DATE(delivery_date) = ? THEN 1 ELSE 0 END) as deliveries_total_today', [$todayIso])
            ->selectRaw("SUM(CASE WHEN DATE(delivery_date) = ? AND fulfillment_status IN ('NEW', 'PROCESSING', 'READY') THEN 1 ELSE 0 END) as deliveries_pending_today", [$todayIso])
            ->selectRaw("SUM(CASE WHEN DATE(delivery_date) = ? AND fulfillment_status = 'DELIVERED' THEN 1 ELSE 0 END) as deliveries_delivered_today", [$todayIso])
            ->selectRaw("SUM(CASE WHEN DATE(delivery_date) < ? AND fulfillment_status IN ('NEW', 'PROCESSING', 'READY') THEN 1 ELSE 0 END) as deliveries_overdue", [$todayIso])
            ->selectRaw("SUM(CASE WHEN fulfillment_status = 'READY' THEN 1 ELSE 0 END) as deliveries_ready")
            ->first();

        $paymentsToday = DB::table('payments')
            ->where('status', 'POSTED')
            ->whereRaw('DATE(payment_date) = ?', [$todayIso])
            ->selectRaw('COUNT(*) as cash_in_count, COALESCE(SUM(amount), 0) as cash_in')
            ->first();

        $expensesToday = DB::table('expenses')
            ->where('status', 'POSTED')
            ->whereRaw('DATE(expense_date) = ?', [$todayIso])
            ->selectRaw('COUNT(*) as cash_out_count, COALESCE(SUM(amount), 0) as cash_out')
            ->first();

        $paidSub = DB::table('payments')
            ->selectRaw('order_id, SUM(amount) as paid_amount')
            ->where('status', 'POSTED')
            ->groupBy('order_id');

        $openReceivablesCount = (int) DB::table('orders')
            ->leftJoinSub($paidSub, 'paid_totals', function ($join): void {
                $join->on('paid_totals.order_id', '=', 'orders.id');
            })
            ->whereRaw('orders.total_amount > COALESCE(paid_totals.paid_amount, 0)')
            ->count();

        return [
            'today_iso' => $todayIso,
            'orders_count' => (int) ($ordersToday->orders_count ?? 0),
            'orders_billed' => (int) ($ordersToday->orders_billed ?? 0),
            'deliveries_total_today' => (int) ($deliveries->deliveries_total_today ?? 0),
            'deliveries_pending_today' => (int) ($deliveries->deliveries_pending_today ?? 0),
            'deliveries_delivered_today' => (int) ($deliveries->deliveries_delivered_today ?? 0),
            'deliveries_overdue' => (int) ($deliveries->deliveries_overdue ?? 0),
            'deliveries_ready' => (int) ($deliveries->deliveries_ready ?? 0),
            'cash_in' => (int) ($paymentsToday->cash_in ?? 0),
            'cash_in_count' => (int) ($paymentsToday->cash_in_count ?? 0),
            'cash_out' => (int) ($expensesToday->cash_out ?? 0),
            'cash_out_count' => (int) ($expensesToday->cash_out_count ?? 0),
            'open_receivables_count' => $openReceivablesCount,
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
