<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'expense_category_id' => [
                'required', 'integer',
                Rule::exists('expense_categories', 'id')->where('is_active', true),
            ],
            'expense_date' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'integer', 'min:1', 'max:1000000000000000'],
            'description' => ['required', 'string', 'min:3', 'max:2000'],
            'idempotency_key' => ['required', 'uuid'],
        ];
    }

    public function attributes(): array
    {
        return [
            'expense_category_id' => 'kategori biaya',
            'expense_date' => 'tanggal pengeluaran',
            'amount' => 'nominal pengeluaran',
            'description' => 'keterangan pengeluaran',
            'idempotency_key' => 'kunci transaksi',
        ];
    }

    public function messages(): array
    {
        return [
            'required' => ':Attribute wajib diisi.',
            'integer' => ':Attribute harus berupa angka Rupiah bulat.',
            'exists' => ':Attribute yang dipilih tidak aktif atau tidak ditemukan.',
            'date_format' => 'Format :attribute harus YYYY-MM-DD.',
            'min' => ':Attribute minimal :min.',
            'amount.min' => 'Nominal pengeluaran minimal Rp1.',
            'description.min' => 'Keterangan pengeluaran minimal :min karakter.',
            'max' => ':Attribute melebihi batas maksimal.',
            'string' => ':Attribute harus berupa teks.',
            'uuid' => ':Attribute tidak valid. Muat ulang halaman lalu coba lagi.',
        ];
    }
}
