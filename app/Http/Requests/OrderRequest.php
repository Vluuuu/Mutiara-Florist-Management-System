<?php

namespace App\Http\Requests;

use App\Models\Customer;
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
}
