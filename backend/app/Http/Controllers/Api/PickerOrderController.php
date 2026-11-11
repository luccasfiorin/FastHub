<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pedidos do coletor logado (GET /picker/orders).
 *
 * Sem filtro, traz os abertos (pending e in_progress), o em andamento primeiro.
 * ?status=pending|in_progress|completed|cancelled filtra por um status; ?status=all traz todos.
 * Cada pedido vem com os itens (produto e posição com corredor) e o progresso em unidades.
 */
class PickerOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->validate([
            'status' => 'nullable|in:pending,in_progress,completed,cancelled,all',
        ])['status'] ?? null;

        $pedidos = Order::query()
            ->where('picker_id', $request->user()->id)
            ->when($status === null, fn ($q) => $q->whereIn('status', ['pending', 'in_progress']))
            ->when($status !== null && $status !== 'all', fn ($q) => $q->where('status', $status))
            ->with(['items.product:id,sku,name,barcode_primary,requires_forklift', 'items.location.aisle:id,code,name'])
            ->orderByRaw("case when status = 'in_progress' then 0 else 1 end")
            ->orderBy('id')
            ->get()
            ->map(function (Order $pedido) {
                $total = $pedido->items->sum('quantity');
                $coletados = $pedido->items->sum('picked_quantity');

                return $pedido->toArray() + [
                    'progress' => [
                        'picked' => $coletados,
                        'total' => $total,
                        'percent' => $total > 0 ? (int) round($coletados / $total * 100) : 0,
                        'pending_items' => $pedido->items->where('is_picked', false)->count(),
                    ],
                ];
            });

        return response()->json($pedidos);
    }
}
