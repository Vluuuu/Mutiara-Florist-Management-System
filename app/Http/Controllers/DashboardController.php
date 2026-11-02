<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(): View
    {
        // MVP: no cancellation. Operational order value is not the same as cash received.
        $orders = (int) DB::table('orders')->count();
        $billed = (int) DB::table('orders')->sum('total_amount');
        $received = (int) DB::table('payments')->where('status', 'POSTED')->sum('amount');
        $expenses = (int) DB::table('expenses')->where('status', 'POSTED')->sum('amount');

        return view('dashboard', [
            'stats' => [
                'orders' => $orders,
                'billed' => $billed,
                'received' => $received,
                'outstanding' => max($billed - $received, 0),
                'expenses' => $expenses,
                'cash_flow' => $received - $expenses,
            ],
        ]);
    }
}
