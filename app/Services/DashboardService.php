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
}
