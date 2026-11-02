@extends('layouts.app')

@section('title', 'Pengeluaran')

@section('content')
<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Keuangan usaha</p>
        <h1 class="text-3xl font-semibold tracking-tight text-emerald-950">Pengeluaran</h1>
        <p class="mt-2 text-sm text-stone-500">Catat uang yang benar-benar keluar untuk operasional florist. Nilai pesanan tidak berubah.</p>
    </div>
    <div class="flex flex-wrap gap-2">
        <a href="{{ route('expense-categories.index') }}" class="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Kategori biaya</a>
        <a href="{{ route('expenses.create') }}" class="rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">+ Catat pengeluaran</a>
    </div>
</div>

<div class="mb-6 rounded-xl border border-stone-200 bg-white p-6">
    <p class="text-sm font-medium text-stone-500">Total pengeluaran POSTED{{ ($search !== '' || $categoryId !== '' || $status !== '' || $from !== '' || $to !== '') ? ' sesuai filter' : '' }}</p>
    <p class="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">Rp{{ number_format($postedTotal, 0, ',', '.') }}</p>
    <p class="mt-2 text-xs text-stone-500">VOIDED tidak dihitung. Jumlah ini adalah kas keluar tercatat, bukan perhitungan laba bersih.</p>
</div>

<section class="overflow-hidden rounded-xl border border-stone-200 bg-white">
    <form action="{{ route('expenses.index') }}" method="GET" class="grid gap-3 border-b border-stone-200 p-4 sm:grid-cols-2 xl:grid-cols-6">
        <div class="sm:col-span-2">
            <label for="q" class="mb-1 block text-xs font-semibold text-stone-600">Cari keterangan</label>
            <input id="q" type="search" name="q" maxlength="100" value="{{ $search }}" placeholder="Contoh: ongkir kurir" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
        </div>
        <div>
            <label for="category_id" class="mb-1 block text-xs font-semibold text-stone-600">Kategori</label>
            <select id="category_id" name="category_id" class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                <option value="">Semua kategori</option>
                @foreach ($categories as $category)
                    <option value="{{ $category->id }}" @selected((string) $categoryId === (string) $category->id)>{{ $category->name }}</option>
                @endforeach
            </select>
        </div>
        <div>
            <label for="status" class="mb-1 block text-xs font-semibold text-stone-600">Status</label>
            <select id="status" name="status" class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                <option value="">Semua status</option>
                <option value="POSTED" @selected($status === 'POSTED')>Tercatat</option>
                <option value="VOIDED" @selected($status === 'VOIDED')>VOIDED</option>
            </select>
        </div>
        <div>
            <label for="from" class="mb-1 block text-xs font-semibold text-stone-600">Tanggal dari</label>
            <input id="from" type="date" name="from" value="{{ $from }}" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
        </div>
        <div>
            <label for="to" class="mb-1 block text-xs font-semibold text-stone-600">Sampai</label>
            <input id="to" type="date" name="to" value="{{ $to }}" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-6">
            <button type="submit" class="rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Terapkan filter</button>
            <a href="{{ route('expenses.index') }}" class="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">Reset</a>
        </div>
        @if ($errors->any())
            <p role="alert" class="text-sm text-red-700 sm:col-span-2 xl:col-span-6">{{ $errors->first() }}</p>
        @endif
    </form>

    @if ($expenses->isEmpty())
        <div class="px-6 py-14 text-center">
            <h2 class="font-semibold text-stone-800">Tidak ada pengeluaran yang ditemukan</h2>
            <p class="mt-2 text-sm text-stone-500">Mulai catat pengeluaran atau ubah filter pencarian.</p>
        </div>
    @else
        <div class="overflow-x-auto">
            <table class="w-full min-w-[920px] text-left text-sm">
                <thead class="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                        <th class="px-5 py-3 font-semibold">Tanggal</th>
                        <th class="px-5 py-3 font-semibold">Kategori</th>
                        <th class="px-5 py-3 font-semibold">Keterangan</th>
                        <th class="px-5 py-3 text-right font-semibold">Nominal</th>
                        <th class="px-5 py-3 font-semibold">Status</th>
                        <th class="px-5 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-stone-100">
                    @foreach ($expenses as $expense)
                        <tr class="align-top hover:bg-stone-50">
                            <td class="whitespace-nowrap px-5 py-4 text-stone-600">{{ $expense->expense_date->format('d/m/Y') }}</td>
                            <td class="px-5 py-4 font-medium text-stone-800">{{ $expense->category?->name ?? 'Kategori tidak tersedia' }}</td>
                            <td class="max-w-xs px-5 py-4">
                                <span class="whitespace-pre-wrap break-words text-stone-800">{{ $expense->description }}</span>
                                <span class="mt-1 block text-xs text-stone-400">Dicatat oleh {{ $expense->recordedBy?->name ?? 'Operator' }}</span>
                                @if ($expense->status === 'VOIDED')
                                    <div class="mt-2 rounded-lg bg-stone-100 p-2 text-xs text-stone-600">
                                        <span class="font-semibold">Alasan void:</span> {{ $expense->void_reason }}
                                    </div>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-5 py-4 text-right font-semibold text-emerald-950">Rp{{ number_format($expense->amount, 0, ',', '.') }}</td>
                            <td class="px-5 py-4">
                                <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $expense->status === 'POSTED' ? 'bg-emerald-50 text-emerald-900' : 'bg-stone-100 text-stone-600' }}">{{ $expense->status === 'POSTED' ? 'Tercatat' : 'VOIDED' }}</span>
                            </td>
                            <td class="px-5 py-4 text-right">
                                @if ($expense->status === 'POSTED')
                                    <details class="min-w-[200px] text-left">
                                        <summary class="cursor-pointer text-xs font-medium text-red-700">Koreksi catatan</summary>
                                        <p class="mt-2 text-xs text-stone-500">Void bukan pengembalian uang.</p>
                                        <form method="POST" action="{{ route('expenses.void', $expense) }}" class="mt-2 space-y-2">
                                            @csrf
                                            <label for="void_reason_{{ $expense->id }}" class="block text-xs font-semibold text-stone-700">Alasan (min. 10 karakter)</label>
                                            <textarea id="void_reason_{{ $expense->id }}" name="void_reason" minlength="10" maxlength="1000" required rows="2" class="w-full rounded-lg border border-stone-300 px-2 py-2 text-xs"></textarea>
                                            <button type="submit" onclick="return confirm('Void pengeluaran ini? Riwayat tetap tersimpan.')" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Void pencatatan</button>
                                        </form>
                                    </details>
                                @else
                                    <span class="text-xs text-stone-400">{{ $expense->voided_at?->timezone('Asia/Jakarta')->format('d/m/Y H:i') }} WIB</span>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        <div class="border-t border-stone-200 px-5 py-4">{{ $expenses->links() }}</div>
    @endif
</section>
@endsection
