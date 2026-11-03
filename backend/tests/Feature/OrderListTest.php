<?php

namespace Tests\Feature;

use App\Models\Aisle;
use App\Models\Location;
use App\Models\Order;
use App\Models\Product;
use App\Models\ScanEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderListTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsRole(string $role): User
    {
        $user = User::create([
            'name' => ucfirst($role),
            'email' => "{$role}@fasthub.test",
            'password' => 'password123',
            'role' => $role,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function criarPedido(string $numero, string $status, ?User $coletor = null): Order
    {
        $aisle = Aisle::firstOrCreate(['code' => 'A'], ['name' => 'Corredor A']);
        $location = Location::firstOrCreate(
            ['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '3'],
            ['coord_x' => 4, 'coord_y' => 6],
        );
        $product = Product::firstOrCreate(
            ['sku' => 'CAF-001'],
            ['name' => 'Cafeteira', 'barcode_primary' => '7890000000001'],
        );

        $order = Order::create([
            'order_number' => $numero,
            'status' => $status,
            'picker_id' => $coletor?->id,
        ]);
        $order->items()->create([
            'product_id' => $product->id,
            'location_id' => $location->id,
            'quantity' => 2,
            'unit_price' => 10,
        ]);

        return $order;
    }

    public function test_guest_and_picker_cannot_list_orders(): void
    {
        $this->getJson('/api/orders')->assertUnauthorized();

        $this->actingAsRole('picker');
        $this->getJson('/api/orders')->assertForbidden();
    }

    public function test_manager_lists_orders_with_items_location_and_picker(): void
    {
        $this->actingAsRole('manager');
        $coletor = User::create([
            'name' => 'Ana P.',
            'email' => 'ana@fasthub.test',
            'password' => 'password123',
            'role' => 'picker',
        ]);
        $pedido = $this->criarPedido('4822', 'in_progress', $coletor);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.order_number', '4822')
            ->assertJsonPath('0.picker.name', 'Ana P.')
            ->assertJsonPath('0.has_mismatch', false)
            ->assertJsonPath('0.items.0.product.name', 'Cafeteira')
            ->assertJsonPath('0.items.0.location.aisle.code', 'A')
            ->assertJsonPath('0.items.0.location.coord_x', 4.0)
            ->assertJsonPath('0.items.0.picked_quantity', 0);

        ScanEvent::create([
            'picker_id' => $coletor->id,
            'order_id' => $pedido->id,
            'type' => 'mismatch',
            'scanned_at' => now(),
        ]);

        $this->getJson('/api/orders')->assertJsonPath('0.has_mismatch', true);
    }

    public function test_manager_can_filter_orders_by_status(): void
    {
        $this->actingAsRole('manager');
        $this->criarPedido('4820', 'completed');
        $this->criarPedido('4827', 'pending');

        $this->getJson('/api/orders?status=pending')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.order_number', '4827');
    }
}
