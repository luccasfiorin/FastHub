<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Services\OperationReport;
use Illuminate\Http\JsonResponse;

/**
 * Indicadores do dia para a tela Início (GET /dashboard, só gestor).
 *
 * - today: resumo de hoje até agora (pedidos concluídos, s/item, acurácia, distâncias);
 * - yesterday: o mesmo de ontem até este mesmo horário, para comparar;
 * - orders_per_hour: pedidos concluídos por hora hoje;
 * - forklift_open_orders: pedidos abertos com item grande (rota da empilhadeira, RN04);
 * - latest_mismatch: a divergência de bipagem mais recente de hoje, ou null.
 * A lista de pedidos e os coletores vêm de GET /orders e GET /pickers.
 */
class DashboardController extends Controller
{
    public function __invoke(OperationReport $report): JsonResponse
    {
        $agora = now();
        $hoje = $agora->copy()->startOfDay();

        $ativos = User::pickers()->get()->filter(fn (User $u) => $u->effectiveStatus() === 'active')->count();

        $empilhadeira = Order::whereIn('status', ['pending', 'in_progress'])
            ->where(function ($q) {
                $q->where('requires_forklift', true)
                    ->orWhereHas('items.product', fn ($p) => $p->where('requires_forklift', true));
            })
            ->count();

        $divergencias = $report->occurrences($hoje, $agora, 1);

        return response()->json([
            'today' => $report->summary($hoje, $agora),
            'yesterday' => $report->summary($hoje->copy()->subDay(), $agora->copy()->subDay()),
            'in_progress' => Order::where('status', 'in_progress')->count(),
            'pending' => Order::where('status', 'pending')->count(),
            'active_pickers' => $ativos,
            'orders_per_hour' => $report->hourly($hoje),
            'forklift_open_orders' => $empilhadeira,
            'latest_mismatch' => $divergencias[0] ?? null,
        ]);
    }
}
