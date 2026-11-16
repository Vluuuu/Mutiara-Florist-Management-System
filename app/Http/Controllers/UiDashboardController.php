<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Inertia\Inertia;
use Inertia\Response;

class UiDashboardController extends Controller
{
    /**
     * Dashboard React/Inertia (Phase 3.3.1). Menghitung statistik lewat
     * DashboardService yang sama dengan dashboard Blade lama, sehingga angka
     * keduanya tidak mungkin berbeda.
     */
    public function __invoke(DashboardService $dashboard): Response
    {
        $stats = $dashboard->stats();

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'summary_formatted' => [
                'billed' => 'Rp'.number_format($stats['billed'], 0, ',', '.'),
                'received' => 'Rp'.number_format($stats['received'], 0, ',', '.'),
                'outstanding' => 'Rp'.number_format($stats['outstanding'], 0, ',', '.'),
                'expenses' => 'Rp'.number_format($stats['expenses'], 0, ',', '.'),
                'cash_flow' => 'Rp'.number_format($stats['cash_flow'], 0, ',', '.'),
                'zero' => 'Rp0',
            ],
            'nav' => [
                'dashboard' => route('dashboard'),
                'uiDashboard' => route('ui-dashboard'),
                'legacyDashboard' => route('legacy.dashboard'),
                'customers' => route('customers.index'),
                'orders' => route('orders.index'),
                'payments' => route('payments.index'),
                'expenses' => route('expenses.index'),
                'expenseCategories' => route('expense-categories.index'),
                'logout' => route('logout'),
            ],
        ]);
    }
}
