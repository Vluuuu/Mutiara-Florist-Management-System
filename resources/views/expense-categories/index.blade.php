@extends('layouts.app')

@section('title', 'Kategori Pengeluaran')

@section('content')
<div class="mb-8">
    <a href="{{ route('expenses.index') }}" class="text-sm text-emerald-800 hover:underline">← Kembali ke pengeluaran</a>
    <h1 class="mt-4 text-3xl font-semibold tracking-tight text-emerald-950">Kategori pengeluaran</h1>
    <p class="mt-2 text-sm text-stone-500">Kategori tidak dihapus. Kategori yang sudah tidak dipakai bisa dinonaktifkan tanpa mengubah riwayat biaya.</p>
</div>

@if ($errors->any())
    <div role="alert" class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p class="font-semibold">Kategori belum disimpan:</p>
        <ul class="mt-2 list-inside list-disc">
            @foreach ($errors->all() as $error) <li>{{ $error }}</li> @endforeach
        </ul>
    </div>
@endif

<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
    <section class="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div class="border-b border-stone-200 px-5 py-4"><h2 class="font-semibold text-emerald-950">Daftar kategori</h2></div>
        @if ($categories->isEmpty())
            <p class="px-5 py-10 text-sm text-stone-500">Belum ada kategori. Buat kategori pertama melalui form di samping.</p>
        @else
            <div class="divide-y divide-stone-100">
                @foreach ($categories as $category)
                    <div class="p-5">
                        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span class="text-xs font-medium text-stone-500">{{ $category->expenses_count }} pengeluaran tercatat</span>
                            <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $category->is_active ? 'bg-emerald-50 text-emerald-900' : 'bg-stone-100 text-stone-500' }}">{{ $category->is_active ? 'Aktif' : 'Nonaktif' }}</span>
                        </div>
                        <form method="POST" action="{{ route('expense-categories.update', $category) }}" class="flex flex-wrap items-end gap-2">
                            @csrf
                            @method('PUT')
                            <div class="min-w-[160px] flex-1">
                                <label for="category_name_{{ $category->id }}" class="mb-1 block text-xs font-medium text-stone-600">Nama kategori</label>
                                <input id="category_name_{{ $category->id }}" name="name" type="text" required minlength="2" maxlength="100" value="{{ $category->name }}" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                            </div>
                            <button type="submit" class="rounded-lg border border-stone-200 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">Simpan nama</button>
                        </form>
                        <form method="POST" action="{{ route('expense-categories.status', $category) }}" class="mt-3">
                            @csrf
                            <input type="hidden" name="is_active" value="{{ $category->is_active ? 0 : 1 }}">
                            <button type="submit" @if($category->is_active) onclick="return confirm('Nonaktifkan kategori ini? Pengeluaran yang sudah dicatat tetap ada.')" @endif class="text-xs font-semibold {{ $category->is_active ? 'text-red-700 hover:underline' : 'text-emerald-800 hover:underline' }}">
                                {{ $category->is_active ? 'Nonaktifkan kategori' : 'Aktifkan kembali' }}
                            </button>
                        </form>
                    </div>
                @endforeach
            </div>
        @endif
    </section>

    <section class="rounded-xl border border-stone-200 bg-white p-5 sm:p-7">
        <h2 class="text-base font-semibold text-emerald-950">Tambah kategori baru</h2>
        <p class="mt-2 text-xs leading-5 text-stone-500">Contoh: Bahan Bunga, Pengiriman/Kurir, Operasional, atau Sewa.</p>
        <form method="POST" action="{{ route('expense-categories.store') }}" class="mt-5 space-y-4">
            @csrf
            <div>
                <label for="new_category_name" class="mb-1.5 block text-sm font-medium text-stone-800">Nama kategori *</label>
                <input id="new_category_name" name="name" type="text" required minlength="2" maxlength="100" value="{{ old('name') }}" placeholder="Contoh: Pengiriman / Kurir" class="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none">
            </div>
            <button type="submit" class="rounded-lg bg-emerald-950 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Tambah kategori</button>
        </form>
    </section>
</div>
@endsection
