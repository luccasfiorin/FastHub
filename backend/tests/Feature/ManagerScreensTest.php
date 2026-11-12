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
 * Rotas que alimentam as telas do gestor: Início (GET /dashboard), Relatórios (GET /reports),
 * divergências (GET /scan-events), Configurações (GET/PUT /settings) e usuários (/users).
 */
class ManagerScreensTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(string $role, string $email, string $tipo = 'foot'): User
    {
        return User::create([
            'name' => ucfirst($role), 'email' => $email, 'password' => 'password123',
            'role' => $role, 'picker_type' => $tipo,
        ]);
    }

    /** Pedido concluído hoje com 2 posições, uma bipagem ok por item e uma divergência. */
    private function pedidoConcluido(User $coletor): Order
    {
        $aisle = Aisle::firstOrCreate(['code' => 'A']);
        $p1 = Location::create(['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '01', 'coord_x' => 3, 'coord_y' => 10]);
        $p2 = Location::create(['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '02', 'coord_x' => 3, 'coord_y' => 2]);
        $produto = Product::create(['sku' => 'X', 'name' => 'Produto X', 'barcode_primary' => '789X', 'location_id' => $p1->id]);

        $inicio = now()->subMinutes(30);
        $pedido = Order::create([
            'order_number' => '9001', 'status' => 'completed', 'picker_id' => $coletor->id,
            'started_at' => $inicio, 'completed_at' => now()->subMinutes(5),
        ]);

        foreach ([$p1, $p2] as $i => $posicao) {
            $item = OrderItem::create([
                'order_id' => $pedido->id, 'product_id' => $produto->id, 'location_id' => $posicao->id,
                'quantity' => 1, 'unit_price' => 1, 'picked_quantity' => 1, 'is_picked' => true,
                'picked_at' => $inicio->copy()->addMinutes(5 + $i * 10),
            ]);
            ScanEvent::create([
                'picker_id' => $coletor->id, 'order_id' => $pedido->id, 'order_item_id' => $item->id,
                'type' => 'ok', 'scanned_at' => $inicio->copy()->addMinutes(5 + $i * 10),
            ]);
        }

        ScanEvent::create([
            'picker_id' => $coletor->id, 'order_id' => $pedido->id, 'order_item_id' => $pedido->items()->first()->id,
            'type' => 'mismatch', 'scanned_at' => $inicio->copy()->addMinutes(4),
        ]);

        return $pedido;
    }

    public function test_dashboard_and_reports_come_from_the_database(): void
    {
        $gestor = $this->usuario('manager', 'g@fasthub.test');
        $coletor = $this->usuario('picker', 'c@fasthub.test');
        $this->pedidoConcluido($coletor);
        Sanctum::actingAs($gestor);

        $this->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('today.orders', 1)
            ->assertJsonPath('today.mismatches', 1)
            ->assertJsonPath('latest_mismatch.order_number', '9001')
            ->assertJsonPath('latest_mismatch.status', 'resolved');

        $hoje = now()->toDateString();
        $resposta = $this->getJson("/api/reports?from={$hoje}&to={$hoje}")->assertOk()
            ->assertJsonPath('summary.orders', 1)
            ->assertJsonCount(1, 'days')
            ->assertJsonCount(1, 'occurrences')
            ->assertJsonPath('pickers.0.name', 'Picker');

        // Ordem da lista = rota otimizada aqui (só 2 posições no mesmo corredor): sem economia.
        $this->assertSame($resposta->json('summary.avg_list_order_m'), $resposta->json('summary.avg_optimized_m'));
        $this->assertNotNull($resposta->json('hours'));

        $this->getJson('/api/scan-events')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/scan-events?open=1')->assertOk()->assertJsonCount(0);
    }

    public function test_reports_validate_the_period(): void
    {
        Sanctum::actingAs($this->usuario('manager', 'g@fasthub.test'));

        $this->getJson('/api/reports?from=2026-11-10&to=2026-11-01')->assertStatus(422);
        $this->getJson('/api/reports?from='.now()->subDays(89)->toDateString().'&to='.now()->toDateString())->assertOk();
        $this->getJson('/api/reports?from='.now()->subDays(90)->toDateString().'&to='.now()->toDateString())->assertStatus(422);
    }

    public function test_picker_cannot_see_manager_screens(): void
    {
        Sanctum::actingAs($this->usuario('picker', 'c@fasthub.test'));

        $this->getJson('/api/dashboard')->assertForbidden();
        $this->getJson('/api/reports?from=2026-11-01&to=2026-11-01')->assertForbidden();
        $this->getJson('/api/users')->assertForbidden();
        $this->putJson('/api/settings', ['warehouse_name' => 'X'])->assertForbidden();
        $this->getJson('/api/settings')->assertOk();
    }

    public function test_settings_use_defaults_and_save(): void
    {
        Sanctum::actingAs($this->usuario('manager', 'g@fasthub.test'));

        $this->getJson('/api/settings')->assertOk()
            ->assertJsonPath('settings.levels_per_rack', 4)
            ->assertJsonPath('layout.aisles', 0);

        $this->putJson('/api/settings', ['warehouse_name' => 'Galpão 2', 'levels_per_rack' => 5, 'group_orders' => false])
            ->assertOk()
            ->assertJsonPath('settings.warehouse_name', 'Galpão 2')
            ->assertJsonPath('settings.levels_per_rack', 5)
            ->assertJsonPath('settings.group_orders', false);

        $this->getJson('/api/settings')->assertJsonPath('settings.warehouse_name', 'Galpão 2');
        $this->putJson('/api/settings', ['levels_per_rack' => 0])->assertStatus(422)->assertJsonValidationErrors('levels_per_rack');
    }

    public function test_users_crud_and_rules(): void
    {
        $gestor = $this->usuario('manager', 'g@fasthub.test');
        Sanctum::actingAs($gestor);

        $novo = $this->postJson('/api/users', [
            'name' => 'Nova', 'email' => 'Nova@Fasthub.test', 'password' => 'senha1234', 'profile' => 'forklift',
        ])->assertCreated()->assertJsonPath('profile', 'forklift')->assertJsonPath('email', 'nova@fasthub.test');

        $this->postJson('/api/users', ['name' => 'X', 'email' => 'nova@fasthub.test', 'password' => 'senha1234', 'profile' => 'picker'])
            ->assertStatus(422)->assertJsonValidationErrors('email');

        $id = $novo->json('id');
        $this->putJson("/api/users/{$id}", ['profile' => 'manager'])->assertOk()->assertJsonPath('profile', 'manager');
        $this->getJson('/api/users')->assertOk()->assertJsonCount(2);

        // Não mexe em si mesmo.
        $this->putJson("/api/users/{$gestor->id}", ['profile' => 'picker'])->assertStatus(409);
        $this->deleteJson("/api/users/{$gestor->id}")->assertStatus(409);

        // Coletor com pedido em andamento não sai.
        $coletor = $this->usuario('picker', 'c@fasthub.test');
        Order::create(['order_number' => '1', 'status' => 'in_progress', 'picker_id' => $coletor->id]);
        $this->deleteJson("/api/users/{$coletor->id}")->assertStatus(409);

        $this->deleteJson("/api/users/{$id}")->assertOk();
        $this->assertNull(User::find($id));
    }
}
