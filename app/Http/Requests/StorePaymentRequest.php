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
}
