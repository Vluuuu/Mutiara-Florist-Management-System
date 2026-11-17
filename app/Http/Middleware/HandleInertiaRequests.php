<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'inertia';

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'csrf_token' => fn () => csrf_token(),
            'auth' => [
                'user' => fn () => $request->user()?->only(['id', 'name']),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'nav' => [
                'dashboard' => route('dashboard'),
                'uiDashboard' => route('ui-dashboard'),
                'legacyDashboard' => route('legacy.dashboard'),
                'uiCustomers' => route('ui-customers.index'),
                'customers' => route('customers.index'),
                'uiOrders' => route('ui-orders.index'),
                'orders' => route('orders.index'),
                'uiPayments' => route('ui-payments.index'),
                'payments' => route('payments.index'),
                'uiExpenses' => route('ui-expenses.index'),
                'expenses' => route('expenses.index'),
                'uiExpenseCategories' => route('ui-expense-categories.index'),
                'expenseCategories' => route('expense-categories.index'),
                'uiReports' => route('ui-reports.index'),
                'uiReportsExport' => route('ui-reports.export'),
                'logout' => route('logout'),
            ],
        ]);
    }
}
