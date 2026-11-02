<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Dashboard') — Mutiara Florist</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-stone-50 text-stone-900 antialiased">
    <div class="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
        <aside class="border-b border-stone-200 bg-white lg:border-b-0 lg:border-r">
            <div class="flex items-center gap-3 px-6 py-7">
                <span class="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-950 text-lg font-semibold text-white">M</span>
                <div>
                    <p class="font-semibold tracking-tight text-emerald-950">Mutiara Florist</p>
                    <p class="text-xs text-stone-500">Management System</p>
                </div>
            </div>
            <nav aria-label="Navigasi utama" class="px-4 pb-5">
                <a href="{{ route('dashboard') }}" @if(request()->routeIs('dashboard')) aria-current="page" @endif class="flex items-center rounded-lg px-4 py-3 text-sm font-semibold {{ request()->routeIs('dashboard') ? 'bg-emerald-50 text-emerald-900' : 'text-stone-600 hover:bg-stone-50' }}">
                    <span class="mr-3">◫</span> Dashboard
                </a>
                <a href="{{ route('customers.index') }}" @if(request()->routeIs('customers.*')) aria-current="page" @endif class="mt-1 flex items-center rounded-lg px-4 py-3 text-sm font-semibold {{ request()->routeIs('customers.*') ? 'bg-emerald-50 text-emerald-900' : 'text-stone-600 hover:bg-stone-50' }}">
                    <span class="mr-3">♧</span> Pelanggan
                </a>
                <a href="{{ route('orders.index') }}" @if(request()->routeIs('orders.*')) aria-current="page" @endif class="mt-1 flex items-center rounded-lg px-4 py-3 text-sm font-semibold {{ request()->routeIs('orders.*') ? 'bg-emerald-50 text-emerald-900' : 'text-stone-600 hover:bg-stone-50' }}">
                    <span class="mr-3">▦</span> Pesanan
                </a>
                <a href="{{ route('payments.index') }}" @if(request()->routeIs('payments.*')) aria-current="page" @endif class="mt-1 flex items-center rounded-lg px-4 py-3 text-sm font-semibold {{ request()->routeIs('payments.*') ? 'bg-emerald-50 text-emerald-900' : 'text-stone-600 hover:bg-stone-50' }}">
                    <span class="mr-3">◈</span> Pembayaran & Piutang
                </a>
                <a href="{{ route('expenses.index') }}" @if(request()->routeIs('expenses.*') || request()->routeIs('expense-categories.*')) aria-current="page" @endif class="mt-1 flex items-center rounded-lg px-4 py-3 text-sm font-semibold {{ request()->routeIs('expenses.*') || request()->routeIs('expense-categories.*') ? 'bg-emerald-50 text-emerald-900' : 'text-stone-600 hover:bg-stone-50' }}">
                    <span class="mr-3">▤</span> Pengeluaran
                </a>
                <p class="px-4 pb-2 pt-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">Dalam pengembangan</p>
                @foreach (['Laporan'] as $item)
                    <p class="cursor-default rounded-lg px-4 py-2.5 text-sm text-stone-400" aria-disabled="true">{{ $item }}</p>
                @endforeach
            </nav>
        </aside>
        <div class="flex min-h-screen flex-col">
            <header class="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 md:px-9">
                <span class="text-sm text-stone-500">Administrasi internal</span>
                <div class="flex items-center gap-4">
                    <span class="hidden text-sm text-stone-700 sm:inline">{{ auth()->user()->name }}</span>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Keluar</button>
                    </form>
                </div>
            </header>
            <main class="w-full max-w-7xl flex-1 px-5 py-9 md:px-9">
                @if (session('success'))
                    <div role="status" class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{{ session('success') }}</div>
                @endif
                @yield('content')
            </main>
            <footer class="px-5 pb-6 text-xs text-stone-400 md:px-9">MFMS · Sistem lokal · Phase 3</footer>
        </div>
    </div>
</body>
</html>
