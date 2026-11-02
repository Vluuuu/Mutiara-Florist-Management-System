@extends('layouts.app')

@section('title', 'Edit Pelanggan')

@section('content')
<div class="mb-6">
    <a href="{{ route('customers.show', $customer) }}" class="text-sm text-emerald-800 hover:underline">← Kembali ke detail pelanggan</a>
    <h1 class="mt-4 text-3xl font-semibold tracking-tight text-emerald-950">Edit pelanggan</h1>
    <p class="mt-2 text-sm text-stone-500">Perbarui informasi pelanggan tanpa mengubah pesanan yang pernah dicatat.</p>
</div>
<section class="max-w-2xl rounded-xl border border-stone-200 bg-white p-5 sm:p-8">
    @include('customers._form')
</section>
@endsection
