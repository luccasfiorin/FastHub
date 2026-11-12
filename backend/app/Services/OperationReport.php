<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ScanEvent;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Números da operação para o Dashboard (Início) e para a tela de Relatórios.
 * Tudo sai do banco: pedidos concluídos, bipagens (scan_events), pausas e rotas.
 *
 * Regras:
 * - pedidos separados: pedidos com status completed e completed_at no período;
 * - segundos por item: tempo ativo dos coletores (PickerMetrics) dividido pelos itens coletados;
 * - acurácia: bipagens ok dividido pelo total de bipagens;
 * - distância: rota do FastHub de cada pedido concluído (RouteService) comparada com o
 *   percurso na ordem da lista do pedido, sem otimização.
 */
class OperationReport
{
    public function __construct(
        private PickerMetrics $metrics,
        private RouteService $routes,
    ) {}

    /** Pedidos concluídos no período, já com o que a rota precisa. */
    public function completedOrders(CarbonInterface $start, CarbonInterface $end): Collection
    {
        return Order::query()
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$start, $end])
            ->with(['items.product:id,sku,name,requires_forklift', 'items.location.aisle:id,code,name'])
            ->get();
    }

    /**
     * Resumo de um período: pedidos, segundos por item, acurácia, divergências e distâncias.
     * Campos sem dado no período vêm como null.
     */
    public function summary(CarbonInterface $start, CarbonInterface $end, ?Collection $pedidos = null): array
    {
        $pedidos ??= $this->completedOrders($start, $end);

        $itens = 0;
        $segundos = 0;
        $ok = 0;
        $divergencias = 0;
        foreach ($this->byPicker($start, $end) as $m) {
            if ($m['active_seconds'] > 0) {
                $itens += $m['items'];
                $segundos += $m['active_seconds'];
            }
            $ok += $m['ok'];
            $divergencias += $m['mismatches'];
        }

        $distancias = $this->distances($pedidos);

        return [
            'orders' => $pedidos->count(),
            'seconds_per_item' => $itens > 0 ? round($segundos / $itens, 1) : null,
            'accuracy' => $ok + $divergencias > 0 ? round($ok / ($ok + $divergencias) * 100, 1) : null,
            'scans' => $ok + $divergencias,
            'mismatches' => $divergencias,
            ...$distancias,
        ];
    }

    /**
     * Métricas de cada coletor no período, somadas dia a dia. O PickerMetrics mede o tempo
     * ativo entre a primeira e a última bipagem; num período de vários dias isso incluiria
     * as noites, então cada dia é medido separado e depois somado.
     *
     * @return array<int, array{items: int, active_seconds: int, ok: int, mismatches: int}>
     */
    public function byPicker(CarbonInterface $start, CarbonInterface $end): array
    {
        $total = [];
        for ($dia = $start->copy()->startOfDay(); $dia->lte($end); $dia = $dia->copy()->addDay()) {
            $inicio = $dia->lt($start) ? $start : $dia;
            $fim = $dia->copy()->endOfDay();
            if ($fim->gt($end)) {
                $fim = $end;
            }

            foreach ($this->metrics->between($inicio, $fim) as $id => $m) {
                $total[$id] ??= ['items' => 0, 'active_seconds' => 0, 'ok' => 0, 'mismatches' => 0];
                $total[$id]['items'] += $m['items'];
                $total[$id]['active_seconds'] += $m['active_seconds'];
                $total[$id]['ok'] += $m['ok'];
                $total[$id]['mismatches'] += $m['mismatches'];
            }
        }

        return $total;
    }

    /**
     * Distância média por pedido (rota otimizada x ordem da lista) e o total economizado.
     */
    public function distances(Collection $pedidos): array
    {
        $otimizada = 0.0;
        $lista = 0.0;
        $contados = 0;

        foreach ($pedidos as $pedido) {
            $d = $this->routes->distances($pedido);
            if ($d['list_order_m'] <= 0) {
                continue;
            }
            $otimizada += $d['optimized_m'];
            $lista += $d['list_order_m'];
            $contados++;
        }

        if ($contados === 0) {
            return [
                'avg_optimized_m' => null,
                'avg_list_order_m' => null,
                'saved_km' => null,
                'saving_percent' => null,
            ];
        }

        return [
            'avg_optimized_m' => round($otimizada / $contados, 1),
            'avg_list_order_m' => round($lista / $contados, 1),
            'saved_km' => round(($lista - $otimizada) / 1000, 2),
            'saving_percent' => round((1 - $otimizada / $lista) * 100, 1),
        ];
    }

    /** Uma linha por dia do período, com o resumo de cada dia. */
    public function daily(CarbonInterface $from, CarbonInterface $to): array
    {
        $dias = [];
        for ($dia = $from->copy()->startOfDay(); $dia->lte($to); $dia = $dia->copy()->addDay()) {
            $fim = $dia->copy()->endOfDay();
            if ($fim->gt(now())) {
                $fim = now();
            }
            $dias[] = ['date' => $dia->toDateString()] + $this->summary($dia, $fim);
        }

        return $dias;
    }

    /**
     * Pedidos concluídos por hora num dia, da primeira hora com movimento até a última
     * (no dia de hoje, até a hora atual).
     *
     * @return list<array{hour: int, orders: int}>
     */
    public function hourly(CarbonInterface $day): array
    {
        $inicio = $day->copy()->startOfDay();
        $fim = $day->isToday() ? now() : $day->copy()->endOfDay();

        $porHora = [];
        foreach (Order::where('status', 'completed')->whereBetween('completed_at', [$inicio, $fim])->pluck('completed_at') as $quando) {
            $hora = (int) $quando->copy()->setTimezone(config('app.timezone'))->format('G');
            $porHora[$hora] = ($porHora[$hora] ?? 0) + 1;
        }

        if ($porHora === []) {
            return [];
        }

        $primeira = min(array_keys($porHora));
        $ultima = $day->isToday() ? (int) now()->format('G') : max(array_keys($porHora));

        $linhas = [];
        for ($h = $primeira; $h <= $ultima; $h++) {
            $linhas[] = ['hour' => $h, 'orders' => $porHora[$h] ?? 0];
        }

        return $linhas;
    }

    /** Itens por hora de cada coletor no período (só quem teve bipagem). */
    public function pickers(CarbonInterface $start, CarbonInterface $end): array
    {
        $porColetor = $this->byPicker($start, $end);
        $nomes = User::whereIn('id', array_keys($porColetor))->get(['id', 'name', 'picker_type'])->keyBy('id');

        $linhas = [];
        foreach ($porColetor as $id => $m) {
            $coletor = $nomes->get($id);
            if ($coletor === null || $m['active_seconds'] <= 0) {
                continue;
            }
            $bipagens = $m['ok'] + $m['mismatches'];
            $linhas[] = [
                'id' => $id,
                'name' => $coletor->name,
                'picker_type' => $coletor->picker_type,
                'items_per_hour' => round($m['items'] / ($m['active_seconds'] / 3600), 1),
                'items' => $m['items'],
                'accuracy' => $bipagens > 0 ? round($m['ok'] / $bipagens * 100, 1) : null,
            ];
        }

        usort($linhas, fn ($a, $b) => $b['items_per_hour'] <=> $a['items_per_hour']);

        return $linhas;
    }

    /**
     * Divergências de bipagem do período, as mais recentes primeiro.
     * Situação: "open" enquanto o pedido está aberto, "resolved" depois que foi concluído
     * e "cancelled" se o pedido foi cancelado.
     */
    public function occurrences(CarbonInterface $start, CarbonInterface $end, ?int $limit = null): array
    {
        return ScanEvent::query()
            ->where('type', 'mismatch')
            ->whereBetween('scanned_at', [$start, $end])
            ->with(['picker:id,name', 'order:id,order_number,status', 'orderItem.product:id,name,sku', 'orderItem.location.aisle:id,code'])
            ->orderByDesc('scanned_at')
            ->when($limit, fn ($q) => $q->limit($limit))
            ->get()
            ->map(fn (ScanEvent $e) => $this->occurrence($e))
            ->all();
    }

    public function occurrence(ScanEvent $e): array
    {
        $situacao = match ($e->order?->status) {
            'completed' => 'resolved',
            'cancelled' => 'cancelled',
            default => 'open',
        };

        return [
            'id' => $e->id,
            'at' => $e->scanned_at->toIso8601String(),
            'order_id' => $e->order_id,
            'order_number' => $e->order?->order_number,
            'picker' => $e->picker?->name,
            'product' => $e->orderItem?->product?->name,
            'location_id' => $e->orderItem?->location_id,
            'location' => $e->orderItem?->location?->code(),
            'status' => $situacao,
        ];
    }
}
