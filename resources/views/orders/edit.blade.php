@extends('layouts.app')

@section('title', 'Edit Pesanan')

@section('content')
<div class="mb-8">
    <a href="{{ route('orders.show', $order) }}" class="text-sm text-emerald-800 hover:underline">← Kembali ke detail pesanan</a>
    <h1 class="mt-4 text-3xl font-semibold tracking-tight text-emerald-950">Edit pesanan</h1>
    <p class="mt-2 text-sm text-stone-500">{{ $order->order_number }} · Item yang sudah diproses tidak bisa dihapus, dan total tagihan tidak boleh kurang dari pembayaran tercatat.</p>
</div>
@include('orders._form')
@endsection
