<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Intervalo em que o coletor ficou em pausa. ended_at nulo = pausa em aberto.
 */
#[Fillable(['picker_id', 'started_at', 'ended_at'])]
class PickerBreak extends Model
{
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }
}
