@extends('layouts.app')

@section('title', 'Pelanggan')

@section('content')
<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Direktori</p>
        <h1 class="text-3xl font-semibold tracking-tight text-emerald-950">Pelanggan</h1>
        <p class="mt-2 text-sm text-stone-500">Cari dan kelola data pemesan bunga.</p>
    </div>
    <a href="{{ route('customers.create') }}" class="inline-flex items-center rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">+ Tambah pelanggan</a>
</div>

<section class="overflow-hidden rounded-xl border border-stone-200 bg-white">
    <form method="GET" action="{{ route('customers.index') }}" role="search" class="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end">
        <div class="w-full sm:max-w-md">
            <label for="q" class="mb-1.5 block text-xs font-semibold text-stone-600">Cari nama atau nomor telepon</label>
            <input id="q" name="q" type="search" maxlength="100" value="{{ $search }}" placeholder="Contoh: Bu Ani atau 0812..." class="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10">
            @error('q') <p class="mt-1 text-xs text-red-700">{{ $message }}</p> @enderror
        </div>
        <div class="flex gap-2">
            <button type="submit" class="rounded-lg border border-emerald-900 bg-emerald-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900">Cari</button>
            @if ($search !== '')
                <a href="{{ route('customers.index') }}" class="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">Reset</a>
            @endif
        </div>
    </form>

    @if ($customers->isEmpty())
        <div class="px-6 py-16 text-center">
            <h2 class="text-base font-semibold text-stone-800">{{ $search !== '' ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan' }}</h2>
            <p class="mt-2 text-sm text-stone-500">{{ $search !== '' ? 'Coba kata kunci lain atau reset pencarian.' : 'Tambahkan pelanggan pertama untuk mulai mencatat pesanan.' }}</p>
            @if ($search === '')
                <a href="{{ route('customers.create') }}" class="mt-5 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4">Tambah pelanggan</a>
            @endif
        </div>
    @else
        <div class="overflow-x-auto">
            <table class="w-full min-w-[620px] text-left text-sm">
                <thead class="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                        <th scope="col" class="px-5 py-3 font-semibold">Nama pelanggan</th>
                        <th scope="col" class="px-5 py-3 font-semibold">Telepon</th>
                        <th scope="col" class="px-5 py-3 font-semibold">Pesanan</th>
                        <th scope="col" class="px-5 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-stone-100">
                    @foreach ($customers as $customer)
                        <tr class="hover:bg-stone-50">
                            <td class="px-5 py-4 font-medium text-stone-900">{{ $customer->name }}</td>
                            <td class="px-5 py-4 text-stone-600">{{ $customer->phone ?: '—' }}</td>
                            <td class="px-5 py-4 text-stone-600">{{ number_format($customer->orders_count, 0, ',', '.') }}</td>
                            <td class="px-5 py-4 text-right">
                                <a href="{{ route('customers.show', $customer) }}" class="font-medium text-emerald-800 hover:underline">Lihat</a>
                                <a href="{{ route('customers.edit', $customer) }}" class="ml-4 font-medium text-stone-600 hover:underline">Edit</a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        <div class="border-t border-stone-200 px-5 py-4">{{ $customers->links() }}</div>
    @endif
</section>
@endsection
