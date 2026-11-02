@extends('layouts.app')

@section('title', 'Pesanan')

@section('content')
<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Pencatatan bunga</p>
        <h1 class="text-3xl font-semibold tracking-tight text-emerald-950">Pesanan</h1>
        <p class="mt-2 text-sm text-stone-500">Pantau pesanan, jadwal pengerjaan, dan tagihan tanpa menyamakan nilai pesanan dengan uang masuk.</p>
    </div>
    <a href="{{ route('orders.create') }}" class="rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">+ Buat pesanan</a>
</div>

<section class="overflow-hidden rounded-xl border border-stone-200 bg-white">
    <form method="GET" action="{{ route('orders.index') }}" class="flex flex-wrap items-end gap-3 border-b border-stone-200 p-4">
        <div class="min-w-[210px] flex-1">
            <label for="q" class="mb-1.5 block text-xs font-semibold text-stone-600">Nomor pesanan atau pelanggan</label>
            <input id="q" name="q" type="search" maxlength="100" value="{{ $search }}" placeholder="Cari pesanan..." class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
        </div>
        <div class="w-full sm:w-48">
            <label for="status" class="mb-1.5 block text-xs font-semibold text-stone-600">Status pengerjaan</label>
            <select id="status" name="status" class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                <option value="">Semua status</option>
                @foreach (['NEW' => 'Baru', 'PROCESSING' => 'Diproses', 'READY' => 'Siap kirim', 'COMPLETED' => 'Selesai'] as $value => $label)
                    <option value="{{ $value }}" @selected($status === $value)>{{ $label }}</option>
                @endforeach
            </select>
        </div>
        <button type="submit" class="rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-medium text-white">Terapkan</button>
        @if ($search !== '' || $status !== '')
            <a href="{{ route('orders.index') }}" class="rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50">Reset</a>
        @endif
    </form>

    @if ($orders->isEmpty())
        <div class="px-5 py-16 text-center">
            <p class="font-semibold text-stone-800">{{ $search !== '' || $status !== '' ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan' }}</p>
            <p class="mt-2 text-sm text-stone-500">{{ $search !== '' || $status !== '' ? 'Coba ubah filter.' : 'Mulai dengan membuat pesanan dari pelanggan yang sudah tercatat.' }}</p>
        </div>
    @else
        <div class="overflow-x-auto">
            <table class="w-full min-w-[860px] text-left text-sm">
                <thead class="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                        <th class="px-5 py-3 font-semibold">Pesanan</th>
                        <th class="px-5 py-3 font-semibold">Pelanggan</th>
                        <th class="px-5 py-3 font-semibold">Pengerjaan</th>
                        <th class="px-5 py-3 text-right font-semibold">Tagihan</th>
                        <th class="px-5 py-3 font-semibold">Pembayaran</th>
                        <th class="px-5 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-stone-100">
                    @foreach ($orders as $order)
                        @php
                            $paid = (int) ($order->paid_amount ?? 0);
                            $paymentStatus = $paid === 0 ? 'Belum bayar' : ($paid >= $order->total_amount ? 'Lunas' : 'Sebagian');
                        @endphp
                        <tr class="hover:bg-stone-50">
                            <td class="px-5 py-4">
                                <span class="block font-semibold text-stone-900">{{ $order->order_number }}</span>
                                <span class="mt-1 block text-xs text-stone-500">{{ $order->order_date->format('d/m/Y') }} · {{ $order->items_count }} bunga</span>
                            </td>
                            <td class="px-5 py-4 text-stone-700">{{ $order->customer->name }}</td>
                            <td class="px-5 py-4">
                                <span class="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">{{ ['NEW' => 'Baru', 'PROCESSING' => 'Diproses', 'READY' => 'Siap kirim', 'COMPLETED' => 'Selesai'][$order->status] ?? $order->status }}</span>
                            </td>
                            <td class="px-5 py-4 text-right font-semibold text-emerald-950">Rp{{ number_format($order->total_amount, 0, ',', '.') }}</td>
                            <td class="px-5 py-4 text-stone-600">{{ $paymentStatus }}</td>
                            <td class="px-5 py-4 text-right"><a href="{{ route('orders.show', $order) }}" class="font-semibold text-emerald-800 hover:underline">Lihat</a></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        <div class="border-t border-stone-200 px-5 py-4">{{ $orders->links() }}</div>
    @endif
</section>
@endsection
