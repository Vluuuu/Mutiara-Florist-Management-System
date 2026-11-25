<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Controllers\UiCustomerController;
use App\Http\Controllers\UiDashboardController;
use App\Http\Controllers\UiExpenseCategoryController;
use App\Http\Controllers\UiExpenseController;
use App\Http\Controllers\UiOrderController;
use App\Http\Controllers\UiPaymentController;
use App\Http\Controllers\UiReportController;
use App\Http\Middleware\HandleInertiaRequests;
use App\Support\DemoAccessManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => redirect()->route(Auth::check() ? 'dashboard' : 'login'));

Route::get('/admin-entry', function (DemoAccessManager $demo) {
    return redirect()
        ->route(Auth::check() ? 'dashboard' : 'login')
        ->withCookie(Cookie::forget($demo->routingCookieName(), '/'))
        ->withCookie(Cookie::forget('mfms_demo_session', '/'));
})->name('admin-entry');

Route::get('/demo', function (Request $request, DemoAccessManager $demo) {
    if (! $demo->isDemoRuntime()) {
        abort(404);
    }

    $cookie = Cookie::make(
        name: $demo->routingCookieName(),
        value: $demo->routingCookieValue(),
        minutes: (int) config('session.lifetime', 120),
        path: '/',
        domain: config('session.domain'),
        secure: (bool) config('session.secure', $request->isSecure()),
        httpOnly: true,
        raw: false,
        sameSite: (string) config('session.same_site', 'lax')
    );

    return redirect()
        ->route(Auth::check() ? 'dashboard' : 'login')
        ->withCookie($cookie);
})->name('demo.entry');

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->middleware(HandleInertiaRequests::class)->name('login');
    Route::get('/ui-login', [LoginController::class, 'show'])->middleware(HandleInertiaRequests::class)->name('ui-login');
    Route::get('/blade-login', [LoginController::class, 'showBlade'])->name('blade-login');
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:login')->name('login.store');
});

Route::middleware('auth')->group(function () {
    // Release Candidate: React Dashboard is now the primary /dashboard route.
    Route::get('/dashboard', UiDashboardController::class)
        ->middleware(HandleInertiaRequests::class)
        ->name('dashboard');

    // Retain /ui-dashboard for backwards compatibility and direct navigation
    Route::get('/ui-dashboard', UiDashboardController::class)
        ->middleware(HandleInertiaRequests::class)
        ->name('ui-dashboard');

    // Fallback Blade Dashboard for emergency rollback
    Route::get('/legacy/dashboard', DashboardController::class)->name('legacy.dashboard');
    Route::get('/blade-dashboard', DashboardController::class)->name('blade.dashboard');

    Route::resource('customers', CustomerController::class);
    Route::resource('orders', OrderController::class)->except(['destroy']);
    Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
    Route::post('/orders/{order}/payments', [PaymentController::class, 'store'])->name('orders.payments.store');
    Route::post('/orders/{order}/payments/{payment}/void', [PaymentController::class, 'void'])->name('orders.payments.void');
    Route::get('/expenses', [ExpenseController::class, 'index'])->name('expenses.index');
    Route::get('/expenses/create', [ExpenseController::class, 'create'])->name('expenses.create');
    Route::post('/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
    Route::post('/expenses/{expense}/void', [ExpenseController::class, 'void'])->name('expenses.void');

    Route::get('/expense-categories', [ExpenseCategoryController::class, 'index'])->name('expense-categories.index');
    Route::post('/expense-categories', [ExpenseCategoryController::class, 'store'])->name('expense-categories.store');
    Route::put('/expense-categories/{expenseCategory}', [ExpenseCategoryController::class, 'update'])->name('expense-categories.update');
    Route::post('/expense-categories/{expenseCategory}/status', [ExpenseCategoryController::class, 'status'])->name('expense-categories.status');

    // React/Inertia preview is isolated from existing Blade management screens.
    Route::get('/ui-preview', function () {
        return Inertia::render('Preview', [
            'user' => ['name' => request()->user()->name],
            'dashboardUrl' => route('dashboard'),
        ]);
    })->middleware(HandleInertiaRequests::class)->name('ui-preview');

    // Phase 3.3.2: React Customer Management on isolated routes
    Route::prefix('ui-customers')->name('ui-customers.')->middleware(HandleInertiaRequests::class)->group(function () {
        Route::get('/', [UiCustomerController::class, 'index'])->name('index');
        Route::get('/create', [UiCustomerController::class, 'create'])->name('create');
        Route::post('/', [UiCustomerController::class, 'store'])->name('store');
        Route::get('/{customer}', [UiCustomerController::class, 'show'])->name('show');
        Route::get('/{customer}/edit', [UiCustomerController::class, 'edit'])->name('edit');
        Route::put('/{customer}', [UiCustomerController::class, 'update'])->name('update');
        Route::delete('/{customer}', [UiCustomerController::class, 'destroy'])->name('destroy');
    });

    // Phase 3.3.3: React Orders (CRUD) on isolated routes
    Route::prefix('ui-orders')->name('ui-orders.')->middleware(HandleInertiaRequests::class)->group(function () {
        Route::get('/', [UiOrderController::class, 'index'])->name('index');
        Route::get('/create', [UiOrderController::class, 'create'])->name('create');
        Route::post('/', [UiOrderController::class, 'store'])->name('store');
        Route::get('/{order}', [UiOrderController::class, 'show'])->name('show');
        Route::get('/{order}/edit', [UiOrderController::class, 'edit'])->name('edit');
        Route::put('/{order}', [UiOrderController::class, 'update'])->name('update');
        Route::post('/{order}/items/{item}/status', [UiOrderController::class, 'updateItemStatus'])->name('items.status');
    });

    // Phase 3.3.4: React Payments & Receivables on isolated routes
    Route::prefix('ui-payments')->name('ui-payments.')->middleware(HandleInertiaRequests::class)->group(function () {
        Route::get('/', [UiPaymentController::class, 'index'])->name('index');
    });
    Route::post('/ui-orders/{order}/payments', [UiPaymentController::class, 'store'])
        ->middleware(HandleInertiaRequests::class)
        ->name('ui-orders.payments.store');
    Route::post('/ui-orders/{order}/payments/{payment}/void', [UiPaymentController::class, 'void'])
        ->middleware(HandleInertiaRequests::class)
        ->name('ui-orders.payments.void');

    // Phase 3.3.5: React Expenses & Expense Categories on isolated routes
    Route::prefix('ui-expenses')->name('ui-expenses.')->middleware(HandleInertiaRequests::class)->group(function () {
        Route::get('/', [UiExpenseController::class, 'index'])->name('index');
        Route::get('/create', [UiExpenseController::class, 'create'])->name('create');
        Route::post('/', [UiExpenseController::class, 'store'])->name('store');
        Route::post('/{expense}/void', [UiExpenseController::class, 'void'])->name('void');
    });

    Route::prefix('ui-expense-categories')->name('ui-expense-categories.')->middleware(HandleInertiaRequests::class)->group(function () {
        Route::get('/', [UiExpenseCategoryController::class, 'index'])->name('index');
        Route::post('/', [UiExpenseCategoryController::class, 'store'])->name('store');
        Route::put('/{expenseCategory}', [UiExpenseCategoryController::class, 'update'])->name('update');
        Route::patch('/{expenseCategory}/status', [UiExpenseCategoryController::class, 'status'])->name('status');
    });

    // Phase 4: Financial and Operational Reports & Excel Export
    Route::prefix('ui-reports')->name('ui-reports.')->middleware(HandleInertiaRequests::class)->group(function () {
        Route::get('/', [UiReportController::class, 'index'])->name('index');
        Route::get('/export', [UiReportController::class, 'export'])->middleware('throttle:demo-export')->name('export');
    });

    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
});
