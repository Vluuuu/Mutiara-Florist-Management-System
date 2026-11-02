@extends('layouts.app')

@section('title', 'Dashboard')

@section('content')
    <div class="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Ringkasan usaha</p>
            <h1 class="text-3xl font-semibold tracking-tight text-emerald-950">Dashboard</h1>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Data kumulatif sejak awal pencatatan. Nilai pesanan dan uang yang sudah diterima ditampilkan terpisah.</p>
        </div>
        <span class="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600">Phase 2 · Pesanan</span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @foreach ([
            ['label' => 'Total pesanan', 'value' => number_format($stats['orders'], 0, ',', '.'), 'prefix' => '', 'hint' => 'Jumlah order tercatat'],
            ['label' => 'Nilai pesanan', 'value' => number_format($stats['billed'], 0, ',', '.'), 'prefix' => 'Rp', 'hint' => 'Termasuk ongkir terpisah'],
            ['label' => 'Uang diterima', 'value' => number_format($stats['received'], 0, ',', '.'), 'prefix' => 'Rp', 'hint' => 'Pembayaran yang telah dicatat'],
            ['label' => 'Piutang saat ini', 'value' => number_format($stats['outstanding'], 0, ',', '.'), 'prefix' => 'Rp', 'hint' => 'Sisa tagihan semua pesanan'],
            ['label' => 'Pengeluaran kas', 'value' => number_format($stats['expenses'], 0, ',', '.'), 'prefix' => 'Rp', 'hint' => 'Pengeluaran yang tercatat'],
            ['label' => 'Selisih kas sederhana', 'value' => number_format($stats['cash_flow'], 0, ',', '.'), 'prefix' => 'Rp', 'hint' => 'Bukan laba bersih akuntansi'],
        ] as $metric)
            <article class="rounded-xl border border-stone-200 bg-white p-5">
                <p class="text-sm font-medium text-stone-500">{{ $metric['label'] }}</p>
                <p class="mt-5 break-words text-2xl font-semibold tracking-tight text-emerald-950">{{ $metric['prefix'] }}{{ $metric['value'] }}</p>
                <p class="mt-3 text-xs text-stone-400">{{ $metric['hint'] }}</p>
            </article>
        @endforeach
    </div>

    <section class="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 class="text-base font-semibold text-emerald-950">Pengembangan berikutnya</h2>
        <p class="mt-2 text-sm leading-6 text-stone-600">Modul Pelanggan dan Pesanan multi-item sudah tersedia. Pencatatan pembayaran, pengeluaran, ekspor laporan, serta backup masih dikembangkan. Gunakan data fiktif sampai pengujian dan backup selesai.</p>
    </section>
@endsection
