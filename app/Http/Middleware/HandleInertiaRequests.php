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
            'auth' => [
                'user' => fn () => $request->user()?->only(['id', 'name']),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'nav' => [
                'dashboard' => route('ui-dashboard'),
                'legacyDashboard' => route('dashboard'),
                'uiCustomers' => route('ui-customers.index'),
                'customers' => route('customers.index'),
                'uiOrders' => route('ui-orders.index'),
                'orders' => route('orders.index'),
                'payments' => route('payments.index'),
                'expenses' => route('expenses.index'),
                'expenseCategories' => route('expense-categories.index'),
                'logout' => route('logout'),
            ],
        ]);
    }
}
