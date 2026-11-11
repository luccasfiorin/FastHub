<?php

namespace Tests\Feature;

use App\Models\Aisle;
use App\Models\Location;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ScanEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Fluxo do pedido: iniciar, bipar os itens (POST /scan-events), concluir e cancelar,
 * e a lista de pedidos do coletor (GET /picker/orders).
 */
class OrderFlowTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(string $role, string $email): User
    {
        return User::create(['name' => ucfirst($role), 'email' => $email, 'password' => 'password123', 'role' => $role]);
    }

    /** Pedido com 2 itens: 2 unidades do produto A e 1 do produto B. */
    private function pedido(?User $coletor, string $status = 'pending', string $numero = '#100'): Order
    {
        $aisle = Aisle::firstOrCreate(['code' => 'A']);
        $posicao = Location::firstOrCreate(['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '01']);
        $a = Product::firstOrCreate(['sku' => 'A'], ['name' => 'Produto A', 'barcode_primary' => '789A']);
        $b = Product::firstOrCreate(['sku' => 'B'], ['name' => 'Produto B', 'barcode_primary' => '789B']);

        $pedido = Order::create(['order_number' => $numero, 'status' => $status, 'picker_id' => $coletor?->id]);
        foreach ([[$a, 2], [$b, 1]] as [$produto, $qtd]) {
            OrderItem::create([
                'order_id' => $pedido->id, 'product_id' => $produto->id, 'location_id' => $posicao->id,
                'quantity' => $qtd, 'unit_price' => 1,
            ]);
        }

        return $pedido;
    }

    public function test_picker_runs_the_whole_flow(): void
    {
        $coletor = $this->usuario('picker', 'c@fasthub.test');
        $pedido = $this->pedido($coletor);
        [$itemA, $itemB] = $pedido->items;
        Sanctum::actingAs($coletor);

        // Bipar antes de iniciar não vale.
        $this->postJson('/api/scan-events', ['order_item_id' => $itemA->id])->assertStatus(409);

        $this->postJson("/api/orders/{$pedido->id}/start")->assertOk()
            ->assertJsonPath('status', 'in_progress');
        $this->assertNotNull($pedido->fresh()->started_at);

        // Concluir com item faltando: 422.
        $this->postJson("/api/orders/{$pedido->id}/complete")->assertStatus(422)
            ->assertJsonPath('pending_items', 2);

        // 1ª unidade do item A: conta, mas o item ainda não está coletado.
        $this->postJson('/api/scan-events', ['order_item_id' => $itemA->id, 'barcode' => '789A'])
            ->assertCreated()
            ->assertJsonPath('scan_event.type', 'ok')
            ->assertJsonPath('item.picked_quantity', 1)
            ->assertJsonPath('item.is_picked', false);

        // Código errado: divergência gravada, item não muda.
        $this->postJson('/api/scan-events', ['order_item_id' => $itemA->id, 'barcode' => '789B'])
            ->assertStatus(422)
            ->assertJsonPath('scan_event.type', 'mismatch')
            ->assertJsonPath('item.picked_quantity', 1);

        // 2ª unidade: item A coletado.
        $this->postJson('/api/scan-events', ['order_item_id' => $itemA->id, 'barcode' => '789A'])
            ->assertCreated()
            ->assertJsonPath('item.is_picked', true)
            ->assertJsonPath('order_pending_items', 1);
        $this->assertNotNull($itemA->fresh()->picked_at);

        // Mais do que o pedido pede: 422.
        $this->postJson('/api/scan-events', ['order_item_id' => $itemA->id])->assertStatus(422);

        $this->postJson('/api/scan-events', ['order_item_id' => $itemB->id, 'quantity' => 1])
            ->assertCreated()
            ->assertJsonPath('order_pending_items', 0);

        $this->postJson("/api/orders/{$pedido->id}/complete")->assertOk()
            ->assertJsonPath('status', 'completed');
        $this->assertNotNull($pedido->fresh()->completed_at);

        $this->assertSame(3, ScanEvent::where('type', 'ok')->count());
        $this->assertSame(1, ScanEvent::where('type', 'mismatch')->count());

        // Concluído não volta: nem iniciar de novo, nem cancelar.
        $this->postJson("/api/orders/{$pedido->id}/start")->assertStatus(409);
        Sanctum::actingAs($this->usuario('manager', 'g@fasthub.test'));
        $this->postJson("/api/orders/{$pedido->id}/cancel")->assertStatus(409);
    }

    public function test_picker_takes_an_unassigned_order_when_starting(): void
    {
        $coletor = $this->usuario('picker', 'c@fasthub.test');
        $pedido = $this->pedido(null);
        Sanctum::actingAs($coletor);

        $this->postJson("/api/orders/{$pedido->id}/start")->assertOk()
            ->assertJsonPath('picker_id', $coletor->id);
    }

    public function test_picker_cannot_touch_someone_elses_order(): void
    {
        $dono = $this->usuario('picker', 'dono@fasthub.test');
        $outro = $this->usuario('picker', 'outro@fasthub.test');
        $pedido = $this->pedido($dono, 'in_progress');
        Sanctum::actingAs($outro);

        $this->postJson("/api/orders/{$pedido->id}/complete")->assertForbidden();
        $this->postJson('/api/scan-events', ['order_item_id' => $pedido->items[0]->id])->assertForbidden();

        $pendente = $this->pedido($dono, 'pending', '#101');
        $this->postJson("/api/orders/{$pendente->id}/start")->assertForbidden();
    }

    public function test_only_manager_cancels_and_only_open_orders(): void
    {
        $coletor = $this->usuario('picker', 'c@fasthub.test');
        $pedido = $this->pedido($coletor, 'in_progress');

        Sanctum::actingAs($coletor);
        $this->postJson("/api/orders/{$pedido->id}/cancel")->assertForbidden();

        Sanctum::actingAs($this->usuario('manager', 'g@fasthub.test'));
        $this->postJson("/api/orders/{$pedido->id}/cancel")->assertOk()->assertJsonPath('status', 'cancelled');
        $this->postJson("/api/orders/{$pedido->id}/cancel")->assertStatus(409);
        $this->postJson("/api/orders/{$pedido->id}/start")->assertStatus(409);
    }

    public function test_manager_cannot_scan(): void
    {
        $pedido = $this->pedido($this->usuario('picker', 'c@fasthub.test'), 'in_progress');
        Sanctum::actingAs($this->usuario('manager', 'g@fasthub.test'));

        $this->postJson('/api/scan-events', ['order_item_id' => $pedido->items[0]->id])->assertForbidden();
        $this->getJson('/api/picker/orders')->assertForbidden();
    }

    public function test_picker_lists_only_own_orders(): void
    {
        $coletor = $this->usuario('picker', 'c@fasthub.test');
        $outro = $this->usuario('picker', 'o@fasthub.test');

        $this->pedido($coletor, 'pending', '#1');
        $andamento = $this->pedido($coletor, 'in_progress', '#2');
        $this->pedido($coletor, 'completed', '#3');
        $this->pedido($outro, 'pending', '#4');

        $item = $andamento->items[0];
        $item->update(['picked_quantity' => 2, 'is_picked' => true]);

        Sanctum::actingAs($coletor);

        // Padrão: só os abertos, o em andamento primeiro.
        $this->getJson('/api/picker/orders')->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.order_number', '#2')
            ->assertJsonPath('0.progress.picked', 2)
            ->assertJsonPath('0.progress.total', 3)
            ->assertJsonPath('0.progress.percent', 67)
            ->assertJsonPath('0.progress.pending_items', 1)
            ->assertJsonPath('0.items.0.product.sku', 'A')
            ->assertJsonPath('0.items.0.location.aisle.code', 'A')
            ->assertJsonPath('1.order_number', '#1');

        $this->getJson('/api/picker/orders?status=completed')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.order_number', '#3');
        $this->getJson('/api/picker/orders?status=all')->assertOk()->assertJsonCount(3);
        $this->getJson('/api/picker/orders?status=xyz')->assertUnprocessable();
    }
}
