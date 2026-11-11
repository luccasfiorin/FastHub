<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\ScanEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Bipagem do coletor (POST /scan-events).
 *
 * Corpo: order_item_id (obrigatório), barcode (código lido, opcional) e quantity (padrão 1).
 * - O item tem que ser de um pedido em andamento atribuído ao coletor.
 * - Código lido diferente do barcode_primary do produto: grava a bipagem como divergência
 *   (mismatch), não conta o item e responde 422.
 * - Código certo: grava a bipagem "ok", soma em picked_quantity e, quando chega na quantidade
 *   do pedido, marca o item como coletado (is_picked + picked_at).
 * - Não deixa coletar mais do que o pedido pede.
 */
class ScanEventController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'order_item_id' => 'required|integer|exists:order_items,id',
            'barcode' => 'nullable|string|max:255',
            'quantity' => 'nullable|integer|min:1',
        ]);
        $quantidade = $dados['quantity'] ?? 1;
        $coletor = $request->user();

        return DB::transaction(function () use ($dados, $quantidade, $coletor) {
            // Trava o item: duas bipagens ao mesmo tempo não passam da quantidade do pedido.
            $item = OrderItem::with(['order', 'product'])->lockForUpdate()->findOrFail($dados['order_item_id']);
            $pedido = $item->order;

            if ((int) $pedido->picker_id !== (int) $coletor->id) {
                return response()->json(['message' => 'Este item não é de um pedido seu.'], 403);
            }

            if ($pedido->status !== 'in_progress') {
                return response()->json([
                    'message' => 'Inicie o pedido antes de bipar os itens.',
                    'status' => $pedido->status,
                ], 409);
            }

            $codigo = $dados['barcode'] ?? null;
            if ($codigo !== null && $codigo !== $item->product?->barcode_primary) {
                $evento = $this->registrar($coletor->id, $item, 'mismatch');

                return response()->json([
                    'message' => 'Código lido não confere com o produto do item.',
                    'scan_event' => $evento,
                    'item' => $item->fresh(),
                ], 422);
            }

            $restante = $item->quantity - $item->picked_quantity;
            if ($quantidade > $restante) {
                return response()->json([
                    'message' => $restante === 0
                        ? 'Este item já foi totalmente coletado.'
                        : "Faltam só {$restante} unidade(s) deste item.",
                    'remaining' => $restante,
                ], 422);
            }

            $evento = $this->registrar($coletor->id, $item, 'ok');

            $coletado = $item->picked_quantity + $quantidade;
            $item->update([
                'picked_quantity' => $coletado,
                'is_picked' => $coletado >= $item->quantity,
                'picked_at' => $evento->scanned_at,
            ]);
            $coletor->update(['last_seen_at' => now()]);

            $faltando = $pedido->items()->where('is_picked', false)->count();

            return response()->json([
                'scan_event' => $evento,
                'item' => $item->fresh(),
                'order_pending_items' => $faltando,
            ], 201);
        });
    }

    private function registrar(int $coletorId, OrderItem $item, string $tipo): ScanEvent
    {
        return ScanEvent::create([
            'picker_id' => $coletorId,
            'order_id' => $item->order_id,
            'order_item_id' => $item->id,
            'type' => $tipo,
            'scanned_at' => now(),
        ]);
    }
}
