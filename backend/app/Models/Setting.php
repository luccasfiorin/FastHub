<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Configuração do sistema (chave e valor). Quem não foi salvo ainda usa o padrão
 * de config('fasthub.settings').
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    protected function casts(): array
    {
        return ['value' => 'json'];
    }

    /** Todas as configurações: padrão + o que está salvo no banco. */
    public static function allValues(): array
    {
        $salvas = static::query()->pluck('value', 'key')->all();

        return array_merge(config('fasthub.settings'), array_intersect_key($salvas, config('fasthub.settings')));
    }

    public static function value(string $key): mixed
    {
        return static::allValues()[$key] ?? null;
    }

    public static function put(array $valores): void
    {
        foreach ($valores as $key => $value) {
            static::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
