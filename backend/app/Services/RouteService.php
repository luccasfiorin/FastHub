<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Collection;

/**
 * Calcula a rota de coleta de um pedido (RF04 / RNF04).
 *
 * Recebe o pedido e devolve a ordem das posições a visitar, saindo da expedição
 * e voltando para ela, junto com as distâncias e o caminho pronto para desenhar no mapa.
 *
 * Regras:
 * - Cada parada é uma posição (locations) com coord_x e coord_y em metros.
 *   Itens do mesmo pedido na mesma posição viram uma parada só.
 * - O coletor anda pelos corredores, então a distância entre dois pontos é
 *   |dx| + |dy| (distância de Manhattan), não a linha reta.
 * - As paradas já coletadas ficam primeiro, na ordem em que foram coletadas (picked_at).
 * - As que faltam são ordenadas pelo vizinho mais próximo, a partir da última
 *   coletada (ou da expedição, se o pedido ainda não começou), e depois melhoradas
 *   com 2-opt, que desfaz cruzamentos sem piorar a rota.
 * - A rota sempre termina voltando para a expedição.
 * - RN04: itens grandes (produto com requires_forklift) saem da rota a pé e
 *   formam uma rota própria, calculada com as mesmas regras, em forklift_route.
 *   Os campos de topo da resposta continuam sendo a rota a pé.
 *
 * Desempenho (RNF04): 5 consultas fixas ao banco (pedido, itens, produtos, posições e
 * corredores, com eager loading), qualquer que seja o tamanho do pedido, e o
 * cálculo é O(n²) no vizinho mais próximo, com 2-opt limitado a MAX_2OPT_PASSES
 * passadas. Pedidos de dezenas de paradas ficam bem abaixo de 1 ms de CPU.
 *
 * Expedição: ainda não existe no banco. O ponto vem de config('fasthub.dock')
 * (FASTHUB_DOCK_X / FASTHUB_DOCK_Y no .env); o padrão é a origem (0, 0) da planta,
 * igual ao frontend.
 *
 * Exposto em GET /api/orders/{order}/route (OrderController@route).
 */
class RouteService
{
    /** Limite de passadas do 2-opt, para o tempo de resposta ficar previsível. */
    private const MAX_2OPT_PASSES = 50;

    /**
     * Calcula a rota do pedido.
     *
     * @return array{
     *     order_id: int,
     *     order_number: string,
     *     status: string,
     *     dock: array{x: float, y: float},
     *     type: 'foot',
     *     stops: list<array>,
     *     picked_stops: int,
     *     total_stops: int,
     *     next_stop: ?int,
     *     total_distance_m: float,
     *     remaining_distance_m: float,
     *     return_to_dock_m: float,
     *     path: list<array{x: float, y: float}>,
     *     forklift_route: ?array,
     *     unlocated_items: list<array>
     * }
     *
     * forklift_route tem os mesmos campos da rota a pé (type, stops, next_stop, distâncias, path)
     * e é null quando o pedido não tem itens grandes.
     */
    public function forOrder(Order $order): array
    {
        $order->loadMissing([
            'items.product:id,sku,name,requires_forklift',
            'items.location.aisle:id,code,name',
        ]);

        $dock = $this->dock();
        $concluido = $order->status === 'completed';

        [$comPosicao, $semPosicao] = $order->items->partition(fn (OrderItem $item) => $item->location !== null);

        // RN04: itens grandes (produto com requires_forklift) saem da rota a pé e formam uma rota própria.
        [$grandes, $aPe] = $comPosicao->partition(fn (OrderItem $item) => $this->ehGrande($item));

        $rotaGrandes = null;
        if ($grandes->isNotEmpty()) {
            $rotaGrandes = ['type' => 'forklift'] + $this->calcularRota($grandes, $dock, $concluido);
        }

        return [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'dock' => $dock,
            // Os campos de topo continuam sendo a rota a pé (mesmo formato de antes).
            'type' => 'foot',
            ...$this->calcularRota($aPe, $dock, $concluido),
            'forklift_route' => $rotaGrandes,
            'unlocated_items' => $semPosicao->map(fn (OrderItem $item) => $this->item($item))->values()->all(),
        ];
    }

    /**
     * Distância total do pedido em duas versões, para medir o ganho da roteirização:
     * - optimized_m: a rota do FastHub (a pé + empilhadeira), saindo e voltando à expedição;
     * - list_order_m: o mesmo percurso visitando as posições na ordem em que os itens
     *   aparecem no pedido, como numa lista de papel sem ordenação.
     *
     * @return array{optimized_m: float, list_order_m: float}
     */
    public function distances(Order $order): array
    {
        $rota = $this->forOrder($order);
        $otimizada = $rota['total_distance_m'] + ($rota['forklift_route']['total_distance_m'] ?? 0);

        $dock = $this->dock();
        $comPosicao = $order->items->filter(fn (OrderItem $item) => $item->location !== null)->sortBy('id');
        [$grandes, $aPe] = $comPosicao->partition(fn (OrderItem $item) => $this->ehGrande($item));

        $lista = 0.0;
        foreach ([$aPe, $grandes] as $grupo) {
            $pontos = $grupo->unique('location_id')
                ->map(fn (OrderItem $item) => ['x' => (float) $item->location->coord_x, 'y' => (float) $item->location->coord_y])
                ->values()
                ->all();
            $lista += $this->percurso($dock, $pontos);
        }

        return ['optimized_m' => round($otimizada, 2), 'list_order_m' => round($lista, 2)];
    }

    /** Distância de expedição → pontos na ordem dada → expedição. Sem pontos, zero. */
    private function percurso(array $dock, array $pontos): float
    {
        if ($pontos === []) {
            return 0.0;
        }

        $total = 0.0;
        $anterior = $dock;
        foreach ($pontos as $ponto) {
            $total += $this->distancia($anterior, $ponto);
            $anterior = $ponto;
        }

        return $total + $this->distancia($anterior, $dock);
    }

    /**
     * Calcula uma rota (a pé ou de empilhadeira) para um grupo de itens, saindo e voltando à expedição.
     */
    private function calcularRota(Collection $itens, array $dock, bool $concluido): array
    {
        $paradas = $this->agruparPorPosicao($itens);

        // 1. Coletadas primeiro, na ordem em que foram coletadas.
        $feitas = array_values(array_filter($paradas, fn ($p) => $p['picked']));
        usort($feitas, fn ($a, $b) => $a['picked_at_ts'] <=> $b['picked_at_ts']);

        // 2. As que faltam: vizinho mais próximo + 2-opt, a partir do ponto atual.
        $faltam = array_values(array_filter($paradas, fn ($p) => ! $p['picked']));
        $inicio = $feitas ? end($feitas)['point'] : $dock;
        $faltam = $this->vizinhoMaisProximo($inicio, $faltam);
        $faltam = $this->doisOpt($inicio, $dock, $faltam);

        $ordem = array_merge($feitas, $faltam);

        // 3. Distâncias e numeração.
        $total = 0.0;
        $restante = 0.0;
        $anterior = $dock;
        $stops = [];

        foreach ($ordem as $i => $parada) {
            $trecho = $this->distancia($anterior, $parada['point']);
            $total += $trecho;
            if (! $parada['picked']) {
                $restante += $trecho;
            }

            unset($parada['picked_at_ts']);
            $parada['sequence'] = $i + 1;
            $parada['distance_from_previous_m'] = round($trecho, 2);
            $stops[] = $parada;

            $anterior = $parada['point'];
        }

        // Rota sem paradas não sai da expedição.
        $volta = $stops === [] ? 0.0 : $this->distancia($anterior, $dock);
        $total += $volta;
        $restante += $volta;

        // Nada faltando, nada a percorrer.
        if ($faltam === []) {
            $restante = 0.0;
        }

        $proxima = null;
        if (! $concluido && $faltam !== []) {
            $proxima = count($feitas) + 1;
        }

        return [
            'stops' => $stops,
            'picked_stops' => count($feitas),
            'total_stops' => count($stops),
            'next_stop' => $proxima,
            'total_distance_m' => round($total, 2),
            'remaining_distance_m' => round($restante, 2),
            'return_to_dock_m' => round($volta, 2),
            'path' => $stops === [] ? [] : $this->caminho($dock, array_column($stops, 'point')),
        ];
    }

    /** Item grande = produto marcado como requires_forklift (RN04). */
    private function ehGrande(OrderItem $item): bool
    {
        return (bool) $item->product?->requires_forklift;
    }

    /** Distância pelos corredores (Manhattan), em metros. */
    public function distancia(array $a, array $b): float
    {
        return abs($a['x'] - $b['x']) + abs($a['y'] - $b['y']);
    }

    /** Ponto da expedição. Sem configuração, fica na origem da planta. */
    private function dock(): array
    {
        return [
            'x' => (float) config('fasthub.dock.x', 0),
            'y' => (float) config('fasthub.dock.y', 0),
        ];
    }

    /**
     * Junta os itens que estão na mesma posição numa parada só.
     * A parada conta como coletada quando todos os itens dela foram coletados.
     */
    private function agruparPorPosicao(Collection $itens): array
    {
        $paradas = [];

        foreach ($itens->groupBy('location_id') as $locationId => $doLugar) {
            $location = $doLugar->first()->location;
            $coletada = $doLugar->every(fn (OrderItem $item) => $item->is_picked);

            $coletadaEm = null;
            if ($coletada) {
                // A parada foi concluída quando o último item dela foi coletado.
                $coletadaEm = $doLugar->pluck('picked_at')->filter()->max();
            }

            $paradas[] = [
                'location_id' => (int) $locationId,
                'code' => $this->codigo($location),
                'aisle' => $location->aisle?->code,
                'shelf' => $location->shelf,
                'position' => $location->position,
                'point' => ['x' => (float) $location->coord_x, 'y' => (float) $location->coord_y],
                'picked' => $coletada,
                'picked_at' => $coletadaEm?->toIso8601String(),
                // Coletada sem picked_at vai para o começo, mantendo a ordem estável.
                'picked_at_ts' => $coletadaEm?->getTimestamp() ?? 0,
                'items' => $doLugar->map(fn (OrderItem $item) => $this->item($item))->values()->all(),
            ];
        }

        // Ordem fixa antes do cálculo: o mesmo pedido sempre gera a mesma rota.
        usort($paradas, fn ($a, $b) => $a['location_id'] <=> $b['location_id']);

        return $paradas;
    }

    /** Ordena as paradas pelo vizinho mais próximo a partir de $inicio. */
    private function vizinhoMaisProximo(array $inicio, array $faltam): array
    {
        $ordenadas = [];
        $atual = $inicio;

        while ($faltam !== []) {
            $maisPerto = 0;
            $menor = $this->distancia($atual, $faltam[0]['point']);

            for ($i = 1, $n = count($faltam); $i < $n; $i++) {
                $d = $this->distancia($atual, $faltam[$i]['point']);
                if ($d < $menor) {
                    $menor = $d;
                    $maisPerto = $i;
                }
            }

            $proxima = array_splice($faltam, $maisPerto, 1)[0];
            $ordenadas[] = $proxima;
            $atual = $proxima['point'];
        }

        return $ordenadas;
    }

    /**
     * Melhora a ordem com 2-opt: inverte trechos da rota sempre que isso a encurta.
     * O ponto de partida ($inicio) e a volta à expedição ($dock) ficam fixos.
     */
    private function doisOpt(array $inicio, array $dock, array $paradas): array
    {
        $n = count($paradas);
        if ($n < 3) {
            return $paradas;
        }

        for ($passada = 0; $passada < self::MAX_2OPT_PASSES; $passada++) {
            $melhorou = false;

            // pontos[0] = início, pontos[1..n] = paradas, pontos[n+1] = expedição
            for ($i = 1; $i < $n; $i++) {
                for ($j = $i + 1; $j <= $n; $j++) {
                    $a = $i === 1 ? $inicio : $paradas[$i - 2]['point'];
                    $b = $paradas[$i - 1]['point'];
                    $c = $paradas[$j - 1]['point'];
                    $d = $j === $n ? $dock : $paradas[$j]['point'];

                    $atual = $this->distancia($a, $b) + $this->distancia($c, $d);
                    $trocado = $this->distancia($a, $c) + $this->distancia($b, $d);

                    if ($trocado < $atual - 1e-9) {
                        // inverte paradas[i-1 .. j-1]
                        $trecho = array_reverse(array_slice($paradas, $i - 1, $j - $i + 1));
                        array_splice($paradas, $i - 1, $j - $i + 1, $trecho);
                        $melhorou = true;
                    }
                }
            }

            if (! $melhorou) {
                break;
            }
        }

        return $paradas;
    }

    /**
     * Caminho para desenhar no mapa: expedição → paradas → expedição, andando
     * primeiro na horizontal e depois na vertical (como pelos corredores, igual ao MapaRota.jsx).
     */
    private function caminho(array $dock, array $pontos): array
    {
        $sequencia = array_merge([$dock], $pontos, [$dock]);
        $linha = [$dock];

        for ($i = 1, $n = count($sequencia); $i < $n; $i++) {
            $a = $sequencia[$i - 1];
            $b = $sequencia[$i];

            if ($a['x'] !== $b['x'] && $a['y'] !== $b['y']) {
                $linha[] = ['x' => $b['x'], 'y' => $a['y']];
            }
            if ($b !== end($linha)) {
                $linha[] = $b;
            }
        }

        return $linha;
    }

    /** Código legível da posição, ex.: "A-1-01" (corredor-prateleira-posição). */
    private function codigo($location): string
    {
        return implode('-', array_filter([
            $location->aisle?->code,
            $location->shelf,
            $location->position,
        ], fn ($parte) => $parte !== null && $parte !== ''));
    }

    private function item(OrderItem $item): array
    {
        return [
            'order_item_id' => $item->id,
            'product_id' => $item->product_id,
            'sku' => $item->product?->sku,
            'name' => $item->product?->name,
            'quantity' => $item->quantity,
            'picked_quantity' => $item->picked_quantity,
            'is_picked' => (bool) $item->is_picked,
            'requires_forklift' => $this->ehGrande($item),
        ];
    }
}
