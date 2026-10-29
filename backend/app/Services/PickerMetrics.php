<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PickerBreak;
use App\Models\ScanEvent;

/**
 * Calcula as métricas dos coletores a partir do banco.
 *
 * Regras adotadas (confirmar com a Telecontrol):
 * - itens: soma de picked_quantity dos itens coletados no período;
 * - tempo ativo: tempo entre a primeira e a última bipagem, menos as pausas;
 * - itens/h: itens dividido pelo tempo ativo em horas (precisa de bipagens);
 * - acurácia: bipagens ok dividido pelo total de bipagens;
 * - tempo ocioso: tempo em pausa dividido pelo tempo entre a primeira e a última bipagem;
 * - distância: soma da distância em linha reta entre as posições coletadas em
 *   sequência no mesmo pedido (coord_x e coord_y em metros).
 */
class PickerMetrics
{
    /** Devolve [início, fim] do período: today, week ou month. */
    public function window(string $period): array
    {
        $now = now();

        if ($period === 'week') {
            return [$now->copy()->startOfWeek(), $now];
        }
        if ($period === 'month') {
            return [$now->copy()->startOfMonth(), $now];
        }

        return [$now->copy()->startOfDay(), $now];
    }

    /** Devolve um array com as métricas de cada coletor, indexado pelo id dele. */
    public function between($start, $end): array
    {
        $dados = [];

        // 1. Bipagens: conta ok e divergências e guarda a primeira e a última.
        $bipagens = ScanEvent::whereNotNull('picker_id')
            ->whereBetween('scanned_at', [$start, $end])
            ->orderBy('scanned_at')
            ->get();

        foreach ($bipagens as $bipagem) {
            $id = $bipagem->picker_id;
            $this->garantir($dados, $id);

            if ($bipagem->type === 'ok') {
                $dados[$id]['ok']++;
            } else {
                $dados[$id]['divergencias']++;
            }

            if ($dados[$id]['primeira'] === null) {
                $dados[$id]['primeira'] = $bipagem->scanned_at->timestamp;
            }
            $dados[$id]['ultima'] = $bipagem->scanned_at->timestamp;
        }

        // 2. Pedidos concluídos no período.
        $pedidos = Order::where('status', 'completed')
            ->whereNotNull('picker_id')
            ->whereBetween('completed_at', [$start, $end])
            ->get();

        foreach ($pedidos as $pedido) {
            $this->garantir($dados, $pedido->picker_id);
            $dados[$pedido->picker_id]['pedidos']++;
        }

        // 3. Itens coletados: soma as quantidades e a distância entre posições.
        $itens = OrderItem::with(['order', 'location'])
            ->whereBetween('picked_at', [$start, $end])
            ->orderBy('order_id')
            ->orderBy('picked_at')
            ->get();

        $anterior = null;
        foreach ($itens as $item) {
            $id = $item->order->picker_id;
            if ($id === null) {
                continue;
            }
            $this->garantir($dados, $id);
            $dados[$id]['itens'] += $item->picked_quantity;

            if ($item->location === null) {
                continue;
            }

            // Só soma a distância se o item anterior era do mesmo pedido.
            if ($anterior !== null && $anterior->order_id === $item->order_id) {
                $dx = $item->location->coord_x - $anterior->location->coord_x;
                $dy = $item->location->coord_y - $anterior->location->coord_y;
                $dados[$id]['metros'] += sqrt($dx * $dx + $dy * $dy);
            }
            $anterior = $item;
        }

        // 4. Pausas que aconteceram entre a primeira e a última bipagem.
        $agora = now()->timestamp;
        $pausas = PickerBreak::where('started_at', '<=', $end)->get();

        foreach ($pausas as $pausa) {
            $id = $pausa->picker_id;
            if (! isset($dados[$id]) || $dados[$id]['primeira'] === null) {
                continue;
            }

            $inicio = max($pausa->started_at->timestamp, $dados[$id]['primeira']);
            $fim = $pausa->ended_at ? $pausa->ended_at->timestamp : $agora;
            $fim = min($fim, $dados[$id]['ultima']);

            if ($fim > $inicio) {
                $dados[$id]['pausa'] += $fim - $inicio;
            }
        }

        // 5. Com tudo somado, calcula os valores finais de cada coletor.
        $resultado = [];
        foreach ($dados as $id => $d) {
            $intervalo = 0;
            if ($d['primeira'] !== null) {
                $intervalo = $d['ultima'] - $d['primeira'];
            }
            $ativo = $intervalo - $d['pausa'];
            $totalBipagens = $d['ok'] + $d['divergencias'];

            $itensPorHora = null;
            if ($ativo > 0) {
                $itensPorHora = round($d['itens'] / ($ativo / 3600), 1);
            }

            $acuracia = null;
            if ($totalBipagens > 0) {
                $acuracia = round($d['ok'] / $totalBipagens * 100, 1);
            }

            $resultado[$id] = [
                'orders' => $d['pedidos'],
                'items' => $d['itens'],
                'ok' => $d['ok'],
                'mismatches' => $d['divergencias'],
                'items_per_hour' => $itensPorHora,
                'accuracy' => $acuracia,
                'distance_km' => round($d['metros'] / 1000, 2),
                'span_seconds' => $intervalo,
                'break_seconds' => $d['pausa'],
                'active_seconds' => max(0, $ativo),
            ];
        }

        return $resultado;
    }

    /** Soma as métricas de todos os coletores. Campo sem dados vem como null. */
    public function team(array $porColetor): array
    {
        $itens = 0;
        $segundosAtivos = 0;
        $intervalo = 0;
        $pausa = 0;
        $ok = 0;
        $divergencias = 0;
        $km = 0;

        foreach ($porColetor as $m) {
            if ($m['active_seconds'] > 0) {
                $itens += $m['items'];
                $segundosAtivos += $m['active_seconds'];
            }
            $intervalo += $m['span_seconds'];
            $pausa += $m['break_seconds'];
            $ok += $m['ok'];
            $divergencias += $m['mismatches'];
            $km += $m['distance_km'];
        }

        $itensPorHora = null;
        if ($segundosAtivos > 0) {
            $itensPorHora = round($itens / ($segundosAtivos / 3600), 1);
        }

        $acuracia = null;
        if ($ok + $divergencias > 0) {
            $acuracia = round($ok / ($ok + $divergencias) * 100, 1);
        }

        $ociosidade = null;
        if ($intervalo > 0) {
            $ociosidade = round($pausa / $intervalo * 100, 1);
        }

        return [
            'items_per_hour' => $itensPorHora,
            'accuracy' => $acuracia,
            'mismatches' => $divergencias,
            'idle_percent' => $ociosidade,
            'distance_km' => round($km, 2),
        ];
    }

    /** Cria a linha zerada do coletor se ela ainda não existir. */
    private function garantir(array &$dados, int $id): void
    {
        if (! isset($dados[$id])) {
            $dados[$id] = [
                'ok' => 0,
                'divergencias' => 0,
                'primeira' => null,
                'ultima' => null,
                'pedidos' => 0,
                'itens' => 0,
                'metros' => 0,
                'pausa' => 0,
            ];
        }
    }
}
