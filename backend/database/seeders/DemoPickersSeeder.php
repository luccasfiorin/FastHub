<?php

namespace Database\Seeders;

use App\Models\Aisle;
use App\Models\Location;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PickerBreak;
use App\Models\Product;
use App\Models\ScanEvent;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Dados de DEMONSTRAÇÃO inspirados no layout de referência (1 coletor de teste que exercita pedidos, bipagens, divergência e pausa). Não faz parte do DatabaseSeeder.
 * Todo usuário criado aqui tem e-mail @demo.fasthub e aparece com a etiqueta "Demo" no painel.
 *
 * Rodar:  php artisan db:seed --class=DemoPickersSeeder
 * Limpar: php artisan tinker --execute 'App\Models\User::where("email","like","%@demo.fasthub")->delete();'
 */
class DemoPickersSeeder extends Seeder
{
    private User $picker;

    private $relogio;

    private int $passo = 0;

    public function run(): void
    {
        $locations = $this->locations();
        $product = Product::firstOrCreate(
            ['sku' => 'DEMO-001'],
            ['name' => 'Produto demonstração', 'barcode_primary' => 'DEMO-0000000001'],
        );

        // done_* = pedidos já concluídos hoje; now_* = pedido em andamento.
        $team = [
            ['name' => 'Teste Demo', 'slug' => 'teste', 'type' => 'foot', 'status' => 'active', 'rate' => 80, 'done_orders' => 5, 'done_items' => 120, 'now' => ['#9001', 20, 12], 'mismatches' => 1, 'break' => true],
        ];

        foreach ($team as $row) {
            $picker = User::updateOrCreate(['email' => "{$row['slug']}@demo.fasthub"], [
                'name' => $row['name'],
                'password' => 'password123',
                'role' => 'picker',
                'picker_type' => $row['type'],
                'operator_name' => $row['operator'] ?? null,
                'work_status' => $row['status'],
            ]);

            if ($row['status'] === 'paused') {
                PickerBreak::firstOrCreate(['picker_id' => $picker->id, 'ended_at' => null], ['started_at' => now()->subMinutes(12)]);
            }

            $current = $row['now'];
            $totalScans = $row['done_items'] + ($current[2] ?? 0);
            // Janela escolhida para que itens/h ≈ rate (sem contar o ruído de arredondamento).
            $windowSeconds = $row['rate'] > 0 && $totalScans > 0 ? (int) ($totalScans / $row['rate'] * 3600) : 0;
            $step = $totalScans > 1 ? $windowSeconds / ($totalScans - 1) : 0;

            // Estado usado por registrarBipagem(): horário da próxima bipagem e intervalo entre elas.
            $this->picker = $picker;
            $this->relogio = now()->subSeconds($windowSeconds + 60);
            $this->passo = (int) $step;

            // Pedidos concluídos: itens divididos entre eles, quantidade 4 por linha.
            for ($i = 0; $i < $row['done_orders']; $i++) {
                $qty = intdiv($row['done_items'], $row['done_orders']) + ($i < $row['done_items'] % $row['done_orders'] ? 1 : 0);
                $order = Order::updateOrCreate(['order_number' => "DEMO-{$row['slug']}-{$i}"], [
                    'status' => 'completed',
                    'picker_id' => $picker->id,
                    'started_at' => now()->subHours(3),
                    'completed_at' => now()->subMinutes(10 + ($row['done_orders'] - $i) * 15),
                ]);
                $order->items()->delete();
                $this->fillOrder($order, $product, $locations, $qty, $qty);
            }

            if ($current) {
                [$number, $total, $picked] = $current;
                $order = Order::updateOrCreate(['order_number' => $number], [
                    'status' => 'in_progress',
                    'picker_id' => $picker->id,
                    'requires_forklift' => $row['type'] === 'forklift',
                    'started_at' => now()->subMinutes(20),
                    'completed_at' => null,
                ]);
                $order->items()->delete();
                $this->fillOrder($order, $product, $locations, $total, $picked);
            } elseif ($row['done_orders'] > 0) {
                // Offline: o último pedido concluído aparece como "Último pedido #4821".
                Order::where('order_number', "DEMO-{$row['slug']}-".($row['done_orders'] - 1))
                    ->update(['order_number' => '#4821']);
            }

            if (! empty($row['break'])) {
                // Pausa já encerrada, para alimentar o indicador de tempo ocioso.
                PickerBreak::create(['picker_id' => $picker->id, 'started_at' => now()->subMinutes(50), 'ended_at' => now()->subMinutes(35)]);
            }

            for ($i = 0; $i < $row['mismatches']; $i++) {
                ScanEvent::create([
                    'picker_id' => $picker->id,
                    'order_id' => Order::where('picker_id', $picker->id)->latest('id')->value('id'),
                    'type' => 'mismatch',
                    'scanned_at' => now()->subMinutes(3 + $i * 5),
                ]);
            }
        }
    }

    /** Grava uma bipagem ok no horário atual do relógio e avança o relógio. Devolve o horário usado. */
    private function registrarBipagem(Order $order, OrderItem $item)
    {
        $horario = $this->relogio->copy();

        ScanEvent::create([
            'picker_id' => $this->picker->id,
            'order_id' => $order->id,
            'order_item_id' => $item->id,
            'type' => 'ok',
            'scanned_at' => $horario,
        ]);

        $this->relogio = $horario->copy()->addSeconds($this->passo);

        return $horario;
    }

    /** Cria as linhas do pedido (4 unidades por linha) e bipa as $picked primeiras unidades. */
    private function fillOrder(Order $order, Product $product, array $locations, int $total, int $picked): void
    {
        $remaining = $total;
        $toPick = $picked;
        $line = 0;

        while ($remaining > 0) {
            $quantity = min(4, $remaining);
            $pickedHere = min($quantity, $toPick);
            $item = OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'location_id' => $locations[$line % count($locations)]->id,
                'quantity' => $quantity,
                'picked_quantity' => $pickedHere,
                'is_picked' => $pickedHere === $quantity,
            ]);

            $lastScan = null;
            for ($u = 0; $u < $pickedHere; $u++) {
                $lastScan = $this->registrarBipagem($order, $item);
            }
            if ($lastScan) {
                $item->update(['picked_at' => $lastScan]);
            }

            $remaining -= $quantity;
            $toPick -= $pickedHere;
            $line++;
        }
    }

    /** @return array<int, Location> */
    private function locations(): array
    {
        $aisle = Aisle::firstOrCreate(['code' => 'DEMO'], ['name' => 'Corredor demonstração']);
        $locations = [];

        foreach (range(0, 7) as $i) {
            $locations[] = Location::firstOrCreate(
                ['aisle_id' => $aisle->id, 'shelf' => (string) intdiv($i, 4), 'position' => (string) ($i % 4)],
                ['coord_x' => ($i % 4) * 6, 'coord_y' => intdiv($i, 4) * 15],
            );
        }

        return $locations;
    }
}
