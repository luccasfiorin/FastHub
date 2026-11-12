<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Posição do armazém (corredor + prateleira + posição).
 */
#[Fillable(['aisle_id', 'shelf', 'position', 'coord_x', 'coord_y', 'coord_z'])]
class Location extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'coord_x' => 'float',
            'coord_y' => 'float',
            'coord_z' => 'float',
        ];
    }

    public function aisle(): BelongsTo
    {
        return $this->belongsTo(Aisle::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /** Código mostrado nas telas: corredor-prateleira-posição (ex.: B-2-14), igual ao da rota. */
    public function code(): string
    {
        return implode('-', array_filter(
            [$this->aisle?->code, $this->shelf, $this->position],
            fn ($parte) => $parte !== null && $parte !== '',
        ));
    }
}
