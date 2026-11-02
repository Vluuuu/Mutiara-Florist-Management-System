@extends('layouts.app')

@section('title', 'Detail Pesanan')

@section('content')
<div class="mb-7">
    <a href="{{ route('orders.index') }}" class="text-sm text-emerald-800 hover:underline">← Kembali ke daftar pesanan</a>
    <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Detail pesanan</p>
            <h1 class="break-all text-2xl font-semibold tracking-tight text-emerald-950 sm:text-3xl">{{ $order->order_number }}</h1>
            <p class="mt-2 text-sm text-stone-500">{{ $order->customer->name }} · Pesan {{ $order->order_date->format('d/m/Y') }}</p>
        </div>
        <a href="{{ route('orders.edit', $order) }}" class="rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Edit pesanan</a>
    </div>
</div>

@php
    $flowerTotal = $order->items->sum(fn ($item) => $item->quantity * $item->unit_price);
    $shippingTotal = $order->items->sum(fn ($item) => $item->shipping_mode === 'SEPARATE' ? $item->shipping_fee : 0);
    $paymentStatus = $received === 0 ? 'Belum dibayar' : ($received >= $order->total_amount ? 'Lunas' : 'Sebagian');
@endphp

<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    @foreach ([
        ['name' => 'Total tagihan', 'value' => 'Rp'.number_format($order->total_amount, 0, ',', '.')],
        ['name' => 'Uang diterima', 'value' => 'Rp'.number_format($received, 0, ',', '.')],
        ['name' => 'Sisa tagihan', 'value' => 'Rp'.number_format(max($order->total_amount - $received, 0), 0, ',', '.')],
        ['name' => 'Status pembayaran', 'value' => $paymentStatus],
    ] as $stat)
        <section class="rounded-xl border border-stone-200 bg-white px-5 py-5">
            <p class="text-xs font-medium text-stone-500">{{ $stat['name'] }}</p>
            <p class="mt-3 break-words text-lg font-semibold text-emerald-950">{{ $stat['value'] }}</p>
        </section>
    @endforeach
</div>

<div class="mb-7 rounded-xl border border-stone-200 bg-white p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold text-stone-800">Pengerjaan pesanan</h2>
        <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">{{ ['NEW' => 'Baru', 'PROCESSING' => 'Diproses', 'READY' => 'Siap kirim', 'COMPLETED' => 'Selesai'][$order->status] ?? $order->status }}</span>
    </div>
    <p class="mt-2 text-xs text-stone-500">Status pengerjaan terpisah dari pembayaran. Pesanan selesai hanya jika semua bunga telah dikirim.</p>
    @if ($order->notes)
        <p class="mt-4 whitespace-pre-wrap break-words text-sm text-stone-700">{{ $order->notes }}</p>
    @endif
</div>

<div class="space-y-4">
    @foreach ($order->items as $item)
        <section class="rounded-xl border border-stone-200 bg-white p-5 sm:p-7">
            <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-widest text-emerald-800">Bunga {{ $loop->iteration }}</p>
                    <h2 class="mt-2 text-lg font-semibold text-stone-900">{{ $item->flower_type }}</h2>
                </div>
                <span class="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">{{ ['NEW' => 'Baru', 'PROCESSING' => 'Diproses', 'READY' => 'Siap kirim', 'DELIVERED' => 'Terkirim'][$item->fulfillment_status] ?? $item->fulfillment_status }}</span>
            </div>
            <dl class="grid gap-5 text-sm sm:grid-cols-2">
                <div><dt class="text-stone-500">Untuk / penerima</dt><dd class="mt-1 break-words font-medium">{{ $item->recipient }}</dd></div>
                <div><dt class="text-stone-500">Dari / pengirim</dt><dd class="mt-1 break-words font-medium">{{ $item->sender_name }}</dd></div>
                <div><dt class="text-stone-500">Tanggal kirim</dt><dd class="mt-1 font-medium">{{ $item->delivery_date->format('d/m/Y') }}</dd></div>
                <div><dt class="text-stone-500">Jumlah</dt><dd class="mt-1 font-medium">{{ number_format($item->quantity, 0, ',', '.') }} buah</dd></div>
                <div class="sm:col-span-2"><dt class="text-stone-500">Lokasi pengiriman</dt><dd class="mt-1 whitespace-pre-wrap break-words font-medium">{{ $item->delivery_location }}</dd></div>
                @if ($item->notes)
                    <div class="sm:col-span-2"><dt class="text-stone-500">Catatan</dt><dd class="mt-1 whitespace-pre-wrap break-words">{{ $item->notes }}</dd></div>
                @endif
            </dl>
            <div class="mt-5 space-y-2 rounded-lg bg-stone-50 px-4 py-4 text-sm">
                <div class="flex justify-between gap-4"><span class="text-stone-500">Bunga ({{ $item->quantity }} × Rp{{ number_format($item->unit_price, 0, ',', '.') }})</span><strong>Rp{{ number_format($item->quantity * $item->unit_price, 0, ',', '.') }}</strong></div>
                <div class="flex justify-between gap-4"><span class="text-stone-500">Ongkir {{ $item->shipping_mode === 'INCLUDED' ? '(termasuk)' : '(terpisah)' }}</span><strong>Rp{{ number_format($item->shipping_mode === 'SEPARATE' ? $item->shipping_fee : 0, 0, ',', '.') }}</strong></div>
            </div>
        </section>
    @endforeach
</div>

<section class="mt-6 rounded-xl border border-stone-200 bg-white p-6">
    <h2 class="font-semibold text-emerald-950">Rincian nilai pesanan</h2>
    <dl class="mt-4 space-y-3 text-sm">
        <div class="flex justify-between gap-3"><dt class="text-stone-500">Total nilai bunga</dt><dd class="font-medium">Rp{{ number_format($flowerTotal, 0, ',', '.') }}</dd></div>
        <div class="flex justify-between gap-3"><dt class="text-stone-500">Total ongkir tambahan</dt><dd class="font-medium">Rp{{ number_format($shippingTotal, 0, ',', '.') }}</dd></div>
        <div class="flex justify-between gap-3 border-t border-stone-200 pt-3 text-lg font-semibold"><dt>Total tagihan</dt><dd>Rp{{ number_format($order->total_amount, 0, ',', '.') }}</dd></div>
    </dl>
    <p class="mt-4 text-xs leading-5 text-stone-500">Pembayaran hanya dihitung jika status POSTED. Koreksi pencatatan (VOIDED) tidak berarti uang dikembalikan.</p>
</section>
@include('orders._payments')
@endsection
