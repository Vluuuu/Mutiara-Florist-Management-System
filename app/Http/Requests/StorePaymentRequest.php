<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'payment_date' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'integer', 'min:1', 'max:1000000000000000'],
            'method' => ['required', Rule::in(['CASH', 'TRANSFER', 'QRIS', 'OTHER'])],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'idempotency_key' => ['required', 'uuid'],
        ];
    }

    public function attributes(): array
    {
        return [
            'payment_date' => 'tanggal pembayaran',
            'amount' => 'nominal pembayaran',
            'method' => 'metode pembayaran',
            'reference' => 'nomor referensi',
            'notes' => 'catatan pembayaran',
            'idempotency_key' => 'kunci transaksi',
        ];
    }

    public function messages(): array
    {
        return [
            'required' => ':Attribute wajib diisi.',
            'date_format' => 'Format :attribute harus YYYY-MM-DD.',
            'integer' => ':Attribute harus berupa angka Rupiah bulat.',
            'min' => ':Attribute minimal :min.',
            'max' => ':Attribute melebihi batas maksimal.',
            'in' => ':Attribute yang dipilih tidak valid.',
            'string' => ':Attribute harus berupa teks.',
            'uuid' => ':Attribute tidak valid. Muat ulang halaman lalu coba lagi.',
        ];
    }
}
