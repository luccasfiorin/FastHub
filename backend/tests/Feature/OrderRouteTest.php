<?php

namespace Tests\Feature;

use App\Models\Aisle;
use App\Models\Location;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderRouteTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(string $role, string $email): User
    {
        return User::create([
            'name' => ucfirst($role),
            'email' => $email,
            'password' => 'password123',
            'role' => $role,
        ]);
    }

    private function posicao(string $position, float $x, float $y): Location
    {
        $aisle = Aisle::firstOrCreate(['code' => 'A'], ['name' => 'Corredor A']);

        return Location::create([
            'aisle_id' => $aisle->id,
            'shelf' => '1',
            'position' => $position,
            'coord_x' => $x,
            'coord_y' => $y,
        ]);
    }

    private function produto(string $sku, bool $grande = false): Product
    {
        return Product::create([
            'sku' => $sku,
            'name' => "Produto {$sku}",
            'barcode_primary' => "789{$sku}",
            'requires_forklift' => $grande,
        ]);
    }

    /**
     * Pedido com 3 posições fora de ordem: (10,0), (2,0), (5,0).
     * Saindo da expedição (0,0), a melhor ordem é 2 → 5 → 10 e volta: 20 m.
     */
    private function pedido(?User $coletor = null): array
    {
        $longe = $this->posicao('03', 10, 0);
        $perto = $this->posicao('01', 2, 0);
        $meio = $this->posicao('02', 5, 0);

        $order = Order::create(['order_number' => 'ORD-ROTA', 'status' => 'pending', 'picker_id' => $coletor?->id]);
        foreach ([$longe, $perto, $meio] as $i => $location) {
            $order->items()->create([
                'product_id' => $this->produto("P{$i}")->id,
                'location_id' => $location->id,
                'quantity' => 1,
                'unit_price' => 0,
            ]);
        }

        return [$order, $perto, $meio, $longe];
    }

    public function test_guest_cannot_see_route(): void
    {
        [$order] = $this->pedido();

        $this->getJson("/api/orders/{$order->id}/route")->assertUnauthorized();
    }

    public function test_manager_gets_route_leaving_and_returning_to_dock(): void
    {
        [$order, $perto, $meio, $longe] = $this->pedido();
        Sanctum::actingAs($this->usuario('manager', 'gestor@fasthub.test'));

        $res = $this->getJson("/api/orders/{$order->id}/route")->assertOk();

        $this->assertSame([$perto->id, $meio->id, $longe->id], array_column($res->json('stops'), 'location_id'));
        $res->assertJsonPath('stops.0.sequence', 1)
            ->assertJsonPath('stops.0.code', 'A-1-01')
            ->assertJsonPath('dock.x', 0)
            ->assertJsonPath('total_distance_m', 20)
            ->assertJsonPath('remaining_distance_m', 20)
            ->assertJsonPath('return_to_dock_m', 10)
            ->assertJsonPath('next_stop', 1)
            ->assertJsonPath('total_stops', 3);

        // caminho começa e termina na expedição
        $path = $res->json('path');
        $this->assertEquals(['x' => 0, 'y' => 0], $path[0]);
        $this->assertEquals(['x' => 0, 'y' => 0], end($path));
    }

    public function test_picked_stops_come_first_in_pick_order(): void
    {
        [$order, $perto, $meio, $longe] = $this->pedido();
        Sanctum::actingAs($this->usuario('manager', 'gestor@fasthub.test'));

        // o coletor já pegou o item mais longe primeiro
        $order->items()->where('location_id', $longe->id)
            ->update(['is_picked' => true, 'picked_quantity' => 1, 'picked_at' => now()]);

        $res = $this->getJson("/api/orders/{$order->id}/route")->assertOk();

        // 10 → depois o mais perto de 10 (5) → 2 → volta
        $this->assertSame([$longe->id, $meio->id, $perto->id], array_column($res->json('stops'), 'location_id'));
        $res->assertJsonPath('stops.0.picked', true)
            ->assertJsonPath('picked_stops', 1)
            ->assertJsonPath('next_stop', 2)
            ->assertJsonPath('total_distance_m', 20)
            ->assertJsonPath('remaining_distance_m', 10);
    }

    public function test_items_in_same_location_become_one_stop(): void
    {
        [$order, $perto] = $this->pedido();
        Sanctum::actingAs($this->usuario('manager', 'gestor@fasthub.test'));

        $order->items()->create([
            'product_id' => $this->produto('EXTRA')->id,
            'location_id' => $perto->id,
            'quantity' => 2,
            'unit_price' => 0,
        ]);

        $res = $this->getJson("/api/orders/{$order->id}/route")->assertOk();

        $res->assertJsonPath('total_stops', 3)->assertJsonCount(2, 'stops.0.items');
    }

    public function test_order_without_large_items_has_no_forklift_route(): void
    {
        [$order] = $this->pedido();
        Sanctum::actingAs($this->usuario('manager', 'gestor@fasthub.test'));

        $this->getJson("/api/orders/{$order->id}/route")
            ->assertOk()
            ->assertJsonPath('type', 'foot')
            ->assertJsonPath('forklift_route', null);
    }

    /** RN04: itens grandes saem da rota a pé e formam uma rota própria. */
    public function test_large_items_get_their_own_route(): void
    {
        [$order, $perto, $meio, $longe] = $this->pedido();
        Sanctum::actingAs($this->usuario('manager', 'gestor@fasthub.test'));

        // dois itens grandes: um numa posição nova (8,0) e outro na mesma posição de um item a pé (5,0)
        $grandeLonge = $this->posicao('04', 8, 0);
        $order->items()->create(['product_id' => $this->produto('G1', true)->id, 'location_id' => $grandeLonge->id, 'quantity' => 1, 'unit_price' => 0]);
        $order->items()->create(['product_id' => $this->produto('G2', true)->id, 'location_id' => $meio->id, 'quantity' => 1, 'unit_price' => 0]);

        $res = $this->getJson("/api/orders/{$order->id}/route")->assertOk();

        // rota a pé continua igual: 2 → 5 → 10 → volta = 20 m, sem nenhum item grande
        $this->assertSame([$perto->id, $meio->id, $longe->id], array_column($res->json('stops'), 'location_id'));
        $res->assertJsonPath('total_distance_m', 20)->assertJsonCount(1, 'stops.1.items');
        $this->assertNotContains(true, array_column(array_merge(...array_column($res->json('stops'), 'items')), 'requires_forklift'));

        // rota da empilhadeira: 5 → 8 → volta = 16 m, só com os itens grandes
        $res->assertJsonPath('forklift_route.type', 'forklift')
            ->assertJsonPath('forklift_route.total_stops', 2)
            ->assertJsonPath('forklift_route.next_stop', 1)
            ->assertJsonPath('forklift_route.total_distance_m', 16)
            ->assertJsonPath('forklift_route.stops.0.items.0.requires_forklift', true);
        $this->assertSame([$meio->id, $grandeLonge->id], array_column($res->json('forklift_route.stops'), 'location_id'));
    }

    public function test_order_with_only_large_items_has_empty_foot_route(): void
    {
        $order = Order::create(['order_number' => 'ORD-GRANDE', 'status' => 'pending']);
        $order->items()->create([
            'product_id' => $this->produto('G1', true)->id,
            'location_id' => $this->posicao('01', 3, 4)->id,
            'quantity' => 1,
            'unit_price' => 0,
        ]);
        Sanctum::actingAs($this->usuario('manager', 'gestor@fasthub.test'));

        $this->getJson("/api/orders/{$order->id}/route")
            ->assertOk()
            ->assertJsonPath('total_stops', 0)
            ->assertJsonPath('next_stop', null)
            ->assertJsonPath('total_distance_m', 0)
            ->assertJsonPath('path', [])
            ->assertJsonPath('forklift_route.total_stops', 1)
            ->assertJsonPath('forklift_route.total_distance_m', 14);
    }

    public function test_picker_sees_only_own_order(): void
    {
        $dono = $this->usuario('picker', 'dono@fasthub.test');
        $outro = $this->usuario('picker', 'outro@fasthub.test');
        [$order] = $this->pedido($dono);

        Sanctum::actingAs($outro);
        $this->getJson("/api/orders/{$order->id}/route")->assertForbidden();

        Sanctum::actingAs($dono);
        $this->getJson("/api/orders/{$order->id}/route")->assertOk()->assertJsonPath('order_number', 'ORD-ROTA');
    }

    public function test_unknown_order_returns_404(): void
    {
        Sanctum::actingAs($this->usuario('manager', 'gestor@fasthub.test'));

        $this->getJson('/api/orders/999/route')->assertNotFound();
    }
}
