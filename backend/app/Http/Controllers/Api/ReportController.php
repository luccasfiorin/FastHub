<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OperationReport;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Relatório de um período (GET /reports?from=AAAA-MM-DD&to=AAAA-MM-DD, só gestor).
 *
 * Devolve o resumo do período, uma linha por dia, os pedidos por hora (quando o período
 * é um dia só), os itens/h de cada coletor e as divergências de bipagem.
 * Para comparar com o período anterior, a tela chama de novo com as datas anteriores.
 * Máximo de 90 dias por consulta.
 */
class ReportController extends Controller
{
    private const MAX_DIAS = 90;

    public function __invoke(Request $request, OperationReport $report): JsonResponse
    {
        $dados = $request->validate([
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ], [
            'to.after_or_equal' => 'A data final precisa ser igual ou depois da inicial.',
        ]);

        $de = CarbonImmutable::parse($dados['from'])->startOfDay();
        $ate = CarbonImmutable::parse($dados['to'])->endOfDay();

        if ((int) round($de->diffInDays($ate->startOfDay())) + 1 > self::MAX_DIAS) {
            return response()->json([
                'message' => 'Escolha no máximo '.self::MAX_DIAS.' dias.',
                'errors' => ['to' => ['Escolha no máximo '.self::MAX_DIAS.' dias.']],
            ], 422);
        }

        $fim = $ate->isFuture() ? CarbonImmutable::now() : $ate;
        $umDia = $de->isSameDay($ate);

        return response()->json([
            'from' => $de->toDateString(),
            'to' => $ate->toDateString(),
            'items_per_hour_target' => config('fasthub.items_per_hour_target'),
            'summary' => $report->summary($de, $fim),
            'days' => $report->daily($de, $fim),
            'hours' => $umDia ? $report->hourly($de) : null,
            'pickers' => $report->pickers($de, $fim),
            'occurrences' => $report->occurrences($de, $fim),
        ]);
    }
}
