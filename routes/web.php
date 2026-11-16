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
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => redirect()->route(Auth::check() ? 'dashboard' : 'login'));

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->middleware(HandleInertiaRequests::class)->name('login');
    Route::get('/ui-login', [LoginController::class, 'show'])->middleware(HandleInertiaRequests::class)->name('ui-login');
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:6,1')->name('login.store');
});

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
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

    // Phase 3.3.1: React dashboard on an isolated route. Blade /dashboard stays
    // until the whole migration is verified, then /ui-dashboard takes over.
    Route::get('/ui-dashboard', UiDashboardController::class)
        ->middleware(HandleInertiaRequests::class)
        ->name('ui-dashboard');

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

    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
});
