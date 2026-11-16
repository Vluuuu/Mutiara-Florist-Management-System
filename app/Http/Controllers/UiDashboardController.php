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
        return Inertia::render('Dashboard', [
            'stats' => $dashboard->stats(),
            'nav' => [
                'dashboard' => route('ui-dashboard'),
                'legacyDashboard' => route('dashboard'),
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
