@extends('layouts.app')

@section('title', 'Detail Pelanggan')

@section('content')
<div class="mb-8">
    <a href="{{ route('customers.index') }}" class="text-sm text-emerald-800 hover:underline">← Semua pelanggan</a>
    <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Detail pelanggan</p>
            <h1 class="break-words text-3xl font-semibold tracking-tight text-emerald-950">{{ $customer->name }}</h1>
        </div>
        <a href="{{ route('customers.edit', $customer) }}" class="rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Edit pelanggan</a>
    </div>
</div>

<div class="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
    <section class="rounded-xl border border-stone-200 bg-white p-6">
        <h2 class="text-base font-semibold text-stone-900">Informasi pelanggan</h2>
        <dl class="mt-5 divide-y divide-stone-100">
            <div class="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                <dt class="text-sm text-stone-500">Nama</dt>
                <dd class="break-words text-sm font-medium text-stone-900">{{ $customer->name }}</dd>
            </div>
            <div class="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                <dt class="text-sm text-stone-500">Telepon</dt>
                <dd class="break-words text-sm text-stone-900">{{ $customer->phone ?: 'Belum diisi' }}</dd>
            </div>
            <div class="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                <dt class="text-sm text-stone-500">Catatan</dt>
                <dd class="whitespace-pre-wrap break-words text-sm text-stone-900">{{ $customer->notes ?: 'Tidak ada catatan' }}</dd>
            </div>
            <div class="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                <dt class="text-sm text-stone-500">Tanggal ditambahkan</dt>
                <dd class="text-sm text-stone-900">{{ $customer->created_at->timezone('Asia/Jakarta')->format('d/m/Y H:i') }} WIB</dd>
            </div>
        </dl>
    </section>

    <aside class="space-y-5">
        <section class="rounded-xl border border-stone-200 bg-white p-6">
            <h2 class="text-sm font-medium text-stone-500">Total pesanan</h2>
            <p class="mt-3 text-3xl font-semibold text-emerald-950">{{ number_format($customer->orders_count, 0, ',', '.') }}</p>
            <p class="mt-3 text-xs leading-5 text-stone-500">Riwayat pesanan akan dapat dibuka setelah modul Pesanan tersedia.</p>
        </section>
        <section class="rounded-xl border border-stone-200 bg-white p-6">
            <h2 class="text-sm font-semibold text-stone-800">Arsip pelanggan</h2>
            @if ($customer->orders_count > 0)
                <p class="mt-2 text-sm leading-6 text-stone-500">Pelanggan ini memiliki riwayat pesanan sehingga tidak dapat diarsipkan.</p>
            @else
                <p class="mt-2 text-sm leading-6 text-stone-500">Arsip menyembunyikan pelanggan dari daftar. Catatan tidak dihapus permanen.</p>
                @error('customer') <p role="alert" class="mt-3 text-sm text-red-700">{{ $message }}</p> @enderror
                <form class="mt-4" method="POST" action="{{ route('customers.destroy', $customer) }}" onsubmit="return confirm('Arsipkan pelanggan ini? Data akan disembunyikan dari daftar.')">
                    @csrf
                    @method('DELETE')
                    <button type="submit" class="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Arsipkan pelanggan</button>
                </form>
            @endif
        </section>
    </aside>
</div>
@endsection
