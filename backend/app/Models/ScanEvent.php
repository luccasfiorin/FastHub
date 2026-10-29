<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Uma bipagem do coletor: "ok" (confere com o pedido) ou "mismatch" (divergência).
 */
#[Fillable(['picker_id', 'order_id', 'order_item_id', 'type', 'scanned_at'])]
class ScanEvent extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['scanned_at' => 'datetime'];
    }

    public function picker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'picker_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
