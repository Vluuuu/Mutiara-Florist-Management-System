<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route(Auth::check() ? 'dashboard' : 'login'));

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:6,1')->name('login.store');
});

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::resource('customers', CustomerController::class);
    Route::resource('orders', OrderController::class)->except(['destroy']);
    Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
    Route::post('/orders/{order}/payments', [PaymentController::class, 'store'])->name('orders.payments.store');
    Route::post('/orders/{order}/payments/{payment}/void', [PaymentController::class, 'void'])->name('orders.payments.void');
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
});
