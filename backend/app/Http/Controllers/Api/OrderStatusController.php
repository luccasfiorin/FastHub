<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Mudança de status do pedido.
 *
 * pending ──start──▶ in_progress ──complete──▶ completed
 *    │                    │
 *    └──────cancel────────┴──▶ cancelled
 *
 * - Iniciar: o coletor inicia um pedido dele ou um sem coletor (e fica com ele);
 *   o gestor pode iniciar qualquer pedido.
 * - Concluir: só com todos os itens coletados. Coletor dono do pedido ou gestor.
 * - Cancelar: só o gestor. Pedido concluído não pode ser cancelado.
 * Transição inválida para o status atual responde 409.
 */
class OrderStatusController extends Controller
{
    public function start(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();

        // Trava a linha: dois coletores não iniciam o mesmo pedido ao mesmo tempo.
        return DB::transaction(function () use ($order, $user) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if ($user->role === 'picker' && $order->picker_id !== null && (int) $order->picker_id !== (int) $user->id) {
                return $this->negado();
            }

            if ($order->status !== 'pending') {
                return $this->transicaoInvalida($order, 'iniciar');
            }

            $order->update([
                'status' => 'in_progress',
                'started_at' => now(),
                'picker_id' => $order->picker_id ?? ($user->role === 'picker' ? $user->id : null),
            ]);

            return $this->resposta($order);
        });
    }

    public function complete(Request $request, Order $order): JsonResponse
    {
        if (! $this->podeMexer($request->user(), $order)) {
            return $this->negado();
        }

        if ($order->status !== 'in_progress') {
            return $this->transicaoInvalida($order, 'concluir');
        }

        $faltando = $order->items()->where('is_picked', false)->count();
        if ($faltando > 0) {
            return response()->json([
                'message' => "Ainda falta coletar {$faltando} item(ns) deste pedido.",
                'pending_items' => $faltando,
            ], 422);
        }

        $order->update(['status' => 'completed', 'completed_at' => now()]);

        return $this->resposta($order);
    }

    public function cancel(Request $request, Order $order): JsonResponse
    {
        if ($request->user()->role !== 'manager') {
            return response()->json(['message' => 'Só o gestor pode cancelar pedidos.'], 403);
        }

        if (! in_array($order->status, ['pending', 'in_progress'], true)) {
            return $this->transicaoInvalida($order, 'cancelar');
        }

        $order->update(['status' => 'cancelled']);

        return $this->resposta($order);
    }

    /** Gestor mexe em qualquer pedido; coletor só nos atribuídos a ele. */
    private function podeMexer(User $user, Order $order): bool
    {
        return $user->role === 'manager' || (int) $order->picker_id === (int) $user->id;
    }

    private function negado(): JsonResponse
    {
        return response()->json(['message' => 'Acesso não autorizado para este pedido.'], 403);
    }

    private function transicaoInvalida(Order $order, string $acao): JsonResponse
    {
        $nomes = [
            'pending' => 'pendente',
            'in_progress' => 'em andamento',
            'completed' => 'concluído',
            'cancelled' => 'cancelado',
        ];

        return response()->json([
            'message' => "Não é possível {$acao} um pedido {$nomes[$order->status]}.",
            'status' => $order->status,
        ], 409);
    }

    private function resposta(Order $order): JsonResponse
    {
        return response()->json($order->fresh()->load('picker:id,name', 'items'));
    }
}
