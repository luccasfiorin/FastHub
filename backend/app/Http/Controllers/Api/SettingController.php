<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Aisle;
use App\Models\Location;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Configurações do armazém e das regras de rota.
 *
 * GET /settings (qualquer usuário logado): valores salvos (ou o padrão de config/fasthub.php)
 * e, em "layout", o tamanho da planta contado no banco (corredores e posições cadastrados).
 * PUT /settings (só gestor): salva os campos enviados.
 */
class SettingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json($this->resposta());
    }

    public function update(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'warehouse_name' => 'sometimes|required|string|max:120',
            'levels_per_rack' => 'sometimes|required|integer|min:1|max:10',
            'level_height_m' => 'sometimes|required|numeric|gt:0|max:5',
            'dock_position' => 'sometimes|required|in:left,right,back',
            'forklift_height_m' => 'sometimes|required|numeric|gt:0|max:20',
            'forklift_weight_kg' => 'sometimes|required|numeric|gt:0|max:2000',
            'max_items_per_route' => 'sometimes|required|integer|min:1|max:500',
            'group_orders' => 'sometimes|required|boolean',
            'orders_per_group' => 'sometimes|required|integer|min:2|max:20',
        ], [
            'warehouse_name.required' => 'Informe o nome do armazém.',
            'levels_per_rack.*' => 'Use de 1 a 10 níveis.',
            'level_height_m.*' => 'Informe uma altura entre 0 e 5 m.',
            'forklift_height_m.*' => 'Informe uma altura válida em metros.',
            'forklift_weight_kg.*' => 'Informe um peso válido em kg.',
            'max_items_per_route.*' => 'Use de 1 a 500 itens.',
            'orders_per_group.*' => 'Use de 2 a 20 pedidos por grupo.',
        ]);

        Setting::put($dados);

        return response()->json($this->resposta());
    }

    private function resposta(): array
    {
        $maiorCorredor = Location::query()
            ->select('aisle_id', DB::raw('count(*) as total'))
            ->groupBy('aisle_id')
            ->get()
            ->max('total');

        return [
            'settings' => Setting::allValues(),
            'layout' => [
                'aisles' => Aisle::count(),
                'locations' => Location::count(),
                'max_locations_per_aisle' => (int) ($maiorCorredor ?? 0),
            ],
        ];
    }
}
