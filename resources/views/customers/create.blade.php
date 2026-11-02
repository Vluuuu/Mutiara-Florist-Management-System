@extends('layouts.app')

@section('title', 'Tambah Pelanggan')

@section('content')
<div class="mb-6">
    <a href="{{ route('customers.index') }}" class="text-sm text-emerald-800 hover:underline">← Kembali ke pelanggan</a>
    <h1 class="mt-4 text-3xl font-semibold tracking-tight text-emerald-950">Tambah pelanggan</h1>
    <p class="mt-2 text-sm text-stone-500">Nama wajib diisi. Telepon dan catatan bisa ditambahkan kemudian.</p>
</div>
<section class="max-w-2xl rounded-xl border border-stone-200 bg-white p-5 sm:p-8">
    @include('customers._form')
</section>
@endsection
