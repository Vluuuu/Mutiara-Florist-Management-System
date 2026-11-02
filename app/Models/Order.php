<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Order extends Model
{
    // Model relasi dasar. Penulisan order dilakukan oleh service validasi Phase 2 berikutnya.
    protected $guarded = ['*'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
