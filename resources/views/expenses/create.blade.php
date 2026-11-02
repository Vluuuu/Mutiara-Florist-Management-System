@extends('layouts.app')

@section('title', 'Catat Pengeluaran')

@section('content')
<div class="mb-7">
    <a href="{{ route('expenses.index') }}" class="text-sm text-emerald-800 hover:underline">← Kembali ke pengeluaran</a>
    <h1 class="mt-4 text-3xl font-semibold tracking-tight text-emerald-950">Catat pengeluaran</h1>
    <p class="mt-2 text-sm text-stone-500">Catat hanya biaya yang benar-benar sudah dibayar oleh florist.</p>
</div>

<section class="max-w-2xl rounded-xl border border-stone-200 bg-white p-5 sm:p-8">
    @if ($categories->isEmpty())
        <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Belum ada kategori biaya aktif. <a class="font-semibold underline" href="{{ route('expense-categories.index') }}">Buat atau aktifkan kategori</a> untuk mulai mencatat pengeluaran.
        </div>
    @else
        @if ($errors->any())
            <div role="alert" class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p class="font-semibold">Pengeluaran belum disimpan:</p>
                <ul class="mt-2 list-inside list-disc">
                    @foreach ($errors->all() as $error) <li>{{ $error }}</li> @endforeach
                </ul>
            </div>
        @endif
        <form method="POST" action="{{ route('expenses.store') }}" class="space-y-5">
            @csrf
            <input type="hidden" name="idempotency_key" value="{{ old('idempotency_key', $newExpenseKey) }}">
            <div>
                <label for="expense_category_id" class="mb-1.5 block text-sm font-medium text-stone-800">Kategori biaya *</label>
                <select id="expense_category_id" name="expense_category_id" required class="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none">
                    <option value="">Pilih kategori</option>
                    @foreach ($categories as $category)
                        <option value="{{ $category->id }}" @selected((string) old('expense_category_id') === (string) $category->id)>{{ $category->name }}</option>
                    @endforeach
                </select>
                <a href="{{ route('expense-categories.index') }}" class="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline">Kelola kategori</a>
            </div>
            <div class="grid gap-5 sm:grid-cols-2">
                <div>
                    <label for="expense_date" class="mb-1.5 block text-sm font-medium text-stone-800">Tanggal dibayar *</label>
                    <input id="expense_date" name="expense_date" type="date" required value="{{ old('expense_date', now()->toDateString()) }}" class="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none">
                </div>
                <div>
                    <label for="amount" class="mb-1.5 block text-sm font-medium text-stone-800">Jumlah pengeluaran (Rp) *</label>
                    <input id="amount" name="amount" type="number" min="1" max="1000000000000000" step="1" required value="{{ old('amount') }}" placeholder="Contoh: 55000" class="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none">
                </div>
            </div>
            <div>
                <label for="description" class="mb-1.5 block text-sm font-medium text-stone-800">Keterangan pengeluaran *</label>
                <textarea id="description" name="description" minlength="3" maxlength="2000" rows="4" required placeholder="Contoh: Ongkir ke kurir untuk papan bunga, dibayar tunai" class="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none">{{ old('description') }}</textarea>
                <p class="mt-1.5 text-xs text-stone-500">Ongkir yang dibayar ke kurir merupakan biaya aktual. Jangan otomatis menyamakan nominalnya dengan ongkir yang ditagih pelanggan.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-5">
                <button type="submit" class="rounded-lg bg-emerald-950 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Simpan pengeluaran</button>
                <a href="{{ route('expenses.index') }}" class="rounded-lg border border-stone-200 px-5 py-3 text-sm font-medium text-stone-600">Batal</a>
            </div>
            <p class="text-xs leading-5 text-stone-500">Pengeluaran yang salah input tidak dapat dihapus. Koreksinya melalui void dengan alasan, kemudian catat ulang jika diperlukan.</p>
        </form>
    @endif
</section>
@endsection
