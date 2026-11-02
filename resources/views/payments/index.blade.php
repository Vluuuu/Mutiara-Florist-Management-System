@extends('layouts.app')

@section('title', 'Pembayaran & Piutang')

@section('content')
<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Keuangan</p>
        <h1 class="text-3xl font-semibold tracking-tight text-emerald-950">Pembayaran & Piutang</h1>
        <p class="mt-2 text-sm text-stone-500">Tagihan yang belum lunas. DP tidak wajib, pembayaran bisa dicatat kapan saja setelah order dibuat.</p>
    </div>
    <a href="{{ route('orders.index') }}" class="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Semua pesanan</a>
</div>

<div class="mb-6 rounded-xl border border-stone-200 bg-white p-6">
    <p class="text-sm font-medium text-stone-500">Total piutang saat ini{{ $search !== '' ? ' (hasil pencarian)' : '' }}</p>
    <p class="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">Rp{{ number_format($outstanding, 0, ',', '.') }}</p>
    <p class="mt-2 text-xs text-stone-500">Snapshot saldo yang masih harus dibayar, bukan pemasukan kas atau laporan piutang historis.</p>
</div>

<section class="overflow-hidden rounded-xl border border-stone-200 bg-white">
    <form action="{{ route('payments.index') }}" method="GET" role="search" class="flex flex-wrap items-end gap-3 border-b border-stone-200 p-4">
        <div class="w-full max-w-lg flex-1">
            <label for="q" class="mb-1.5 block text-xs font-semibold text-stone-600">Cari pelanggan atau nomor pesanan</label>
            <input type="search" id="q" name="q" maxlength="100" value="{{ $search }}" placeholder="Contoh: Papan ucapan atau MF-..." class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-800">
        </div>
        <button type="submit" class="rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Cari</button>
        @if ($search !== '')
            <a href="{{ route('payments.index') }}" class="rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-600">Reset</a>
        @endif
    </form>

    @if ($orders->isEmpty())
        <div class="px-5 py-14 text-center">
            <h2 class="font-semibold text-stone-800">Tidak ada piutang yang ditemukan</h2>
            <p class="mt-2 text-sm text-stone-500">Semua pesanan yang cocok sudah lunas, atau belum ada pesanan.</p>
        </div>
    @else
        <div class="overflow-x-auto">
            <table class="w-full min-w-[800px] text-left text-sm">
                <thead class="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                        <th class="px-5 py-3 font-semibold">Pesanan</th>
                        <th class="px-5 py-3 font-semibold">Pelanggan</th>
                        <th class="px-5 py-3 text-right font-semibold">Tagihan</th>
                        <th class="px-5 py-3 text-right font-semibold">Dibayar</th>
                        <th class="px-5 py-3 text-right font-semibold">Piutang</th>
                        <th class="px-5 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-stone-100">
                    @foreach ($orders as $order)
                        @php
                            $paid = (int) $order->paid_amount;
                            $remaining = (int) $order->total_amount - $paid;
                        @endphp
                        <tr class="hover:bg-stone-50">
                            <td class="px-5 py-4">
                                <span class="block font-semibold text-stone-900">{{ $order->order_number }}</span>
                                <span class="mt-1 block text-xs text-stone-500">{{ \Illuminate\Support\Carbon::parse($order->order_date)->format('d/m/Y') }}</span>
                            </td>
                            <td class="px-5 py-4 text-stone-700">{{ $order->customer_name }}</td>
                            <td class="px-5 py-4 text-right">Rp{{ number_format($order->total_amount, 0, ',', '.') }}</td>
                            <td class="px-5 py-4 text-right text-stone-600">Rp{{ number_format($paid, 0, ',', '.') }}</td>
                            <td class="px-5 py-4 text-right font-semibold text-emerald-950">Rp{{ number_format($remaining, 0, ',', '.') }}</td>
                            <td class="px-5 py-4 text-right">
                                <a href="{{ route('orders.show', $order->id) }}#pembayaran" class="font-semibold text-emerald-800 hover:underline">Catat bayar</a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        <div class="border-t border-stone-200 px-5 py-4">{{ $orders->links() }}</div>
    @endif
</section>
@endsection
