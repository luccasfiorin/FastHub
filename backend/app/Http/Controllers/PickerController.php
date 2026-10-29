<?php

namespace App\Http\Controllers;

use App\Http\Requests\PickerRequest;
use App\Models\Order;
use App\Models\ScanEvent;
use App\Models\User;
use App\Services\PickerMetrics;
use Illuminate\Http\Request;

class PickerController extends Controller
{
    public function __construct(private PickerMetrics $metrics) {}

    /** Cards, contagens por status, indicadores do dia e alertas. */
    public function index()
    {
        [$start, $end] = $this->metrics->window('today');
        $hoje = $this->metrics->between($start, $end);

        $ontemInicio = $start->copy()->subDay();
        $ontem = $this->metrics->team($this->metrics->between($ontemInicio, $start));

        $cards = [];
        $contagens = ['all' => 0, 'active' => 0, 'paused' => 0, 'offline' => 0];

        $coletores = User::pickers()->orderBy('name')->get();
        foreach ($coletores as $coletor) {
            $card = $this->present($coletor, $hoje[$coletor->id] ?? null);
            $cards[] = $card;
            $contagens['all']++;
            $contagens[$card['status']]++;
        }

        $time = $this->metrics->team($hoje);

        // Diferença para ontem só existe se os dois dias têm itens/h.
        $diferenca = null;
        if ($time['items_per_hour'] !== null && $ontem['items_per_hour'] !== null) {
            $diferenca = round($time['items_per_hour'] - $ontem['items_per_hour'], 1);
        }
        $time['items_per_hour_delta'] = $diferenca;
        $time['idle_target_percent'] = config('fasthub.idle_target_percent');

        return response()->json([
            'pickers' => $cards,
            'counts' => $contagens,
            'summary' => $time,
            'open_orders' => Order::whereIn('status', ['pending', 'in_progress'])->count(),
            'alerts' => $this->alerts($start),
        ]);
    }

    public function ranking(Request $request)
    {
        $period = $request->validate(['period' => 'nullable|in:today,week,month'])['period'] ?? 'today';
        [$start, $end] = $this->metrics->window($period);
        $porColetor = $this->metrics->between($start, $end);

        $linhas = [];
        foreach (User::pickers()->get() as $coletor) {
            if (isset($porColetor[$coletor->id])) {
                $linhas[] = ['id' => $coletor->id, 'name' => $coletor->name] + $porColetor[$coletor->id];
            }
        }

        // Maior itens/h primeiro; quem não tem o dado vai para o fim.
        usort($linhas, function ($a, $b) {
            return ($b['items_per_hour'] ?? -1) <=> ($a['items_per_hour'] ?? -1);
        });

        return response()->json(['period' => $period, 'ranking' => $linhas]);
    }

    public function store(PickerRequest $request)
    {
        $data = $request->validated();
        $status = $data['work_status'] ?? 'offline';
        unset($data['work_status']);

        $picker = User::create($data + ['role' => 'picker']);
        $picker->setWorkStatus($status);

        return response()->json($this->present($picker->refresh()), 201);
    }

    public function update(PickerRequest $request, User $picker)
    {
        $this->ensurePicker($picker);
        $data = $request->validated();
        $status = $data['work_status'] ?? null;
        unset($data['work_status']);

        // Senha em branco significa "manter a atual".
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $picker->update($data);
        if ($status) {
            $picker->setWorkStatus($status);
        }

        return response()->json($this->present($picker->refresh()));
    }

    public function destroy(User $picker)
    {
        $this->ensurePicker($picker);

        if (Order::where('picker_id', $picker->id)->where('status', 'in_progress')->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir um coletor com pedido em andamento.',
            ], 409);
        }

        $picker->tokens()->delete();
        $picker->delete();

        return response()->json(['message' => 'Coletor excluído com sucesso.']);
    }

    /** O próprio coletor informa que está ativo, em pausa ou offline. */
    public function updateOwnStatus(Request $request)
    {
        $status = $request->validate(['status' => 'required|in:active,paused,offline'])['status'];

        $user = $request->user();
        $user->setWorkStatus($status);
        $user->update(['last_seen_at' => now()]);

        return response()->json($this->present($user->refresh()));
    }

    /** Só aceita ids de coletores; gestores dão 404 nestas rotas. */
    private function ensurePicker(User $user): void
    {
        abort_unless($user->role === 'picker', 404);
    }

    /** Monta os dados de um card de coletor. */
    private function present(User $p, ?array $metricas = null): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'email' => $p->email,
            'picker_type' => $p->picker_type,
            'operator_name' => $p->operator_name,
            'status' => $p->effectiveStatus(),
            'work_status' => $p->work_status,
            'is_demo' => $p->isDemo(),
            'current_order' => $this->currentOrder($p),
            'last_order' => $this->lastOrder($p),
            'metrics' => [
                'items_per_hour' => $metricas['items_per_hour'] ?? null,
                'accuracy' => $metricas['accuracy'] ?? null,
                'distance_km' => $metricas['distance_km'] ?? null,
            ],
        ];
    }

    /** Pedido em andamento do coletor, com o progresso calculado. Null se não houver. */
    private function currentOrder(User $p): ?array
    {
        $pedido = Order::where('picker_id', $p->id)
            ->where('status', 'in_progress')
            ->orderByDesc('started_at')
            ->first();

        if ($pedido === null) {
            return null;
        }

        $total = 0;
        $coletados = 0;
        foreach ($pedido->items as $item) {
            $total += $item->quantity;
            $coletados += $item->picked_quantity;
        }

        $progresso = 0;
        if ($total > 0) {
            $progresso = (int) round($coletados / $total * 100);
        }

        $temDivergencia = ScanEvent::where('order_id', $pedido->id)->where('type', 'mismatch')->exists();

        return [
            'number' => $pedido->order_number,
            'picked' => $coletados,
            'total' => $total,
            'progress' => $progresso,
            'has_mismatch' => $temDivergencia,
        ];
    }

    /** Último pedido concluído do coletor. Null se não houver. */
    private function lastOrder(User $p): ?array
    {
        $pedido = Order::where('picker_id', $p->id)
            ->where('status', 'completed')
            ->orderByDesc('completed_at')
            ->first();

        if ($pedido === null) {
            return null;
        }

        return [
            'number' => $pedido->order_number,
            'completed_at' => $pedido->completed_at?->toIso8601String(),
        ];
    }

    /** Divergências de bipagem desde o início do dia, as mais recentes primeiro. */
    private function alerts($desde): array
    {
        $eventos = ScanEvent::with(['picker', 'order'])
            ->where('type', 'mismatch')
            ->where('scanned_at', '>=', $desde)
            ->orderByDesc('scanned_at')
            ->limit(10)
            ->get();

        $alertas = [];
        foreach ($eventos as $evento) {
            $texto = 'Divergência';
            if ($evento->order) {
                $texto .= " no pedido {$evento->order->order_number}";
            }
            if ($evento->picker) {
                $texto .= " ({$evento->picker->name})";
            }

            $alertas[] = [
                'id' => $evento->id,
                'text' => $texto,
                'at' => $evento->scanned_at->toIso8601String(),
            ];
        }

        return $alertas;
    }
}
