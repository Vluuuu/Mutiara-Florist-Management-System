<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class OrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'customer_id' => [
                'required', 'integer',
                Rule::exists('customers', 'id')->whereNull('deleted_at'),
            ],
            'order_date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'change_reason' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.id' => ['nullable', 'integer', 'distinct', 'min:1'],
            'items.*.flower_type' => ['required', 'string', 'max:255'],
            'items.*.recipient' => ['required', 'string', 'max:255'],
            'items.*.sender_name' => ['required', 'string', 'max:255'],
            'items.*.delivery_date' => ['required', 'date_format:Y-m-d'],
            'items.*.delivery_location' => ['required', 'string', 'max:1000'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'items.*.unit_price' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'items.*.shipping_mode' => ['required', Rule::in(['INCLUDED', 'SEPARATE'])],
            'items.*.shipping_fee' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'items.*.fulfillment_status' => ['sometimes', Rule::in(['NEW', 'PROCESSING', 'READY', 'DELIVERED'])],
            'items.*.notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $items = $this->input('items');

            if (! is_array($items)) {
                return;
            }

            foreach ($items as $index => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $mode = $item['shipping_mode'] ?? null;
                $fee = $item['shipping_fee'] ?? null;

                if (! in_array($mode, ['INCLUDED', 'SEPARATE'], true)
                    || filter_var($fee, FILTER_VALIDATE_INT) === false) {
                    continue;
                }

                if ($mode === 'INCLUDED' && (int) $fee !== 0) {
                    $validator->errors()->add("items.{$index}.shipping_fee", 'Ongkir yang sudah termasuk harus bernilai Rp0.');
                }

                if ($mode === 'SEPARATE' && (int) $fee <= 0) {
                    $validator->errors()->add("items.{$index}.shipping_fee", 'Ongkir terpisah harus lebih dari Rp0.');
                }
            }
        });
    }

    public function attributes(): array
    {
        $attributes = [
            'customer_id' => 'pelanggan',
            'order_date' => 'tanggal pesanan',
            'notes' => 'catatan pesanan',
            'change_reason' => 'alasan perubahan',
            'items' => 'daftar rangkaian bunga',
            'items.*.id' => 'item pesanan',
            'items.*.flower_type' => 'jenis bunga',
            'items.*.recipient' => 'nama penerima',
            'items.*.sender_name' => 'nama pengirim ucapan',
            'items.*.delivery_date' => 'tanggal kirim',
            'items.*.delivery_location' => 'lokasi pengiriman',
            'items.*.quantity' => 'jumlah bunga',
            'items.*.unit_price' => 'harga satuan',
            'items.*.shipping_mode' => 'skema ongkos kirim',
            'items.*.shipping_fee' => 'biaya ongkir',
            'items.*.fulfillment_status' => 'status pengerjaan',
            'items.*.notes' => 'catatan item',
        ];

        $items = $this->input('items');
        if (is_array($items)) {
            $itemFields = [
                'id' => 'referensi item',
                'flower_type' => 'jenis bunga',
                'recipient' => 'nama penerima',
                'sender_name' => 'nama pengirim ucapan',
                'delivery_date' => 'tanggal kirim',
                'delivery_location' => 'lokasi pengiriman',
                'quantity' => 'jumlah bunga',
                'unit_price' => 'harga satuan',
                'shipping_mode' => 'skema ongkos kirim',
                'shipping_fee' => 'biaya ongkir',
                'fulfillment_status' => 'status pengerjaan',
                'notes' => 'catatan item',
            ];

            foreach (array_keys($items) as $index) {
                if (! is_int($index) && ! ctype_digit((string) $index)) {
                    continue;
                }
                $num = ((int) $index) + 1;
                foreach ($itemFields as $field => $label) {
                    $attributes["items.{$index}.{$field}"] = "Bunga #{$num} ({$label})";
                }
            }
        }

        return $attributes;
    }

    public function messages(): array
    {
        return [
            'required' => ':Attribute wajib diisi.',
            'array' => ':Attribute harus berupa daftar item.',
            'items.min' => 'Pesanan wajib memiliki minimal :min rangkaian bunga.',
            'items.max' => 'Pesanan maksimal terdiri dari :max rangkaian bunga.',
            'exists' => ':Attribute tidak ditemukan atau sudah tidak aktif.',
            'date_format' => 'Format :attribute harus YYYY-MM-DD.',
            'integer' => ':Attribute harus berupa angka bulat.',
            'string' => ':Attribute harus berupa teks.',
            'min' => ':Attribute minimal :min.',
            'max' => ':Attribute melebihi batas maksimal (:max).',
            'in' => ':Attribute yang dipilih tidak valid.',
            'distinct' => 'Terdapat duplikasi pada :attribute.',
        ];
    }
}
