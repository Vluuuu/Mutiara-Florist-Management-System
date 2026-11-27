<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="data:,">
    <title>Masuk — Mutiara Florist Management System</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-10 text-stone-900 antialiased">
    <main class="w-full max-w-[420px]">
        <div class="mb-10 text-center">
            <span class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-emerald-950 text-2xl font-semibold text-white">M</span>
            <h1 class="text-2xl font-semibold tracking-tight text-emerald-950">Mutiara Florist</h1>
            <p class="mt-2 text-sm text-stone-500">Management System · Masuk untuk mengelola pesanan dan operasional</p>
        </div>
        <section class="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
            <h2 class="mb-6 text-lg font-semibold">Masuk ke dashboard</h2>
            @if (! empty($sessionNotice))
                <div role="alert" class="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-800">
                    {{ $sessionNotice }}
                </div>
            @endif
            <form method="POST" action="{{ route('login.store') }}" class="space-y-5">
                @csrf
                <input type="hidden" name="_mfms_runtime" value="{{ app(\App\Support\DemoAccessManager::class)->runtimeMode() }}">
                <div>
                    <label for="email" class="mb-2 block text-sm font-medium">Email admin</label>
                    <input id="email" name="email" type="email" value="{{ old('email') }}" required autofocus autocomplete="username" class="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" placeholder="admin@example.com">
                    @error('email') <p role="alert" class="mt-2 text-xs text-red-700">{{ $message }}</p> @enderror
                </div>
                <div>
                    <label for="password" class="mb-2 block text-sm font-medium">Password</label>
                    <input id="password" name="password" type="password" required autocomplete="current-password" class="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10">
                    @error('password') <p role="alert" class="mt-2 text-xs text-red-700">{{ $message }}</p> @enderror
                </div>
                <button type="submit" class="w-full rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Masuk</button>
            </form>
            <div class="mt-4 border-t border-stone-100 pt-4 text-center">
                <a href="{{ route('login') }}" class="text-xs font-medium text-emerald-800 hover:underline">
                    ← Beralih ke Tampilan Login Utama (React)
                </a>
            </div>
        </section>
        <p class="mt-6 text-center text-xs text-stone-500">Aplikasi internal · Tidak tersedia pendaftaran publik</p>
    </main>
</body>
</html>
