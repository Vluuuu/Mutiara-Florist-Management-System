@extends('layouts.app')

@section('title', 'Buat Pesanan')

@section('content')
<div class="mb-8">
    <a href="{{ route('orders.index') }}" class="text-sm text-emerald-800 hover:underline">← Kembali ke pesanan</a>
    <h1 class="mt-4 text-3xl font-semibold tracking-tight text-emerald-950">Buat pesanan bunga</h1>
    <p class="mt-2 text-sm text-stone-500">Satu pesanan dapat berisi beberapa bunga dengan tanggal dan lokasi kirim berbeda.</p>
</div>
@include('orders._form')
@endsection
