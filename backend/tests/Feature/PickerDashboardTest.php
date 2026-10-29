<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Aisle;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PickerBreak;
use App\Models\Product;
use App\Models\ScanEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PickerDashboardTest extends TestCase
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

    private function payload(array $extra = []): array
    {
        return $extra + [
            'name' => 'Ana P.',
            'email' => 'ana@fasthub.test',
            'password' => 'password123',
            'picker_type' => 'foot',
        ];
    }

    public function test_guest_and_picker_cannot_manage_pickers(): void
    {
        $this->getJson('/api/pickers')->assertUnauthorized();

        $this->actingAsRole('picker');
        $this->getJson('/api/pickers')->assertForbidden();
        $this->postJson('/api/pickers', $this->payload())->assertForbidden();
    }

    public function test_manager_can_crud_pickers(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson('/api/pickers', $this->payload(['work_status' => 'active']))
            ->assertCreated()
            ->assertJsonPath('name', 'Ana P.')
            ->assertJsonPath('status', 'active')
            ->json('id');

        $this->assertDatabaseHas('users', ['id' => $id, 'role' => 'picker']);

        $this->postJson('/api/pickers', $this->payload())->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/pickers', [])->assertUnprocessable()->assertJsonValidationErrors(['name', 'email', 'password']);

        $this->putJson("/api/pickers/{$id}", ['name' => 'Ana Paula', 'picker_type' => 'forklift', 'operator_name' => 'Marcos T.'])
            ->assertOk()
            ->assertJsonPath('name', 'Ana Paula')
            ->assertJsonPath('picker_type', 'forklift')
            ->assertJsonPath('operator_name', 'Marcos T.');

        $this->getJson('/api/pickers')->assertOk()
            ->assertJsonPath('counts.all', 1)
            ->assertJsonPath('counts.active', 1)
            ->assertJsonPath('pickers.0.name', 'Ana Paula');

        $this->deleteJson("/api/pickers/{$id}")->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $id]);
        $this->getJson('/api/pickers')->assertJsonPath('counts.all', 0);
    }

    public function test_cannot_touch_a_manager_through_pickers_routes(): void
    {
        $manager = $this->actingAsRole('manager');

        $this->putJson("/api/pickers/{$manager->id}", ['name' => 'X'])->assertNotFound();
        $this->deleteJson("/api/pickers/{$manager->id}")->assertNotFound();
    }

    public function test_cannot_delete_picker_with_order_in_progress(): void
    {
        $this->actingAsRole('manager');
        $picker = User::create(['name' => 'João R.', 'email' => 'j@fasthub.test', 'password' => 'password123', 'role' => 'picker']);
        Order::create(['order_number' => '#1', 'status' => 'in_progress', 'picker_id' => $picker->id]);

        $this->deleteJson("/api/pickers/{$picker->id}")->assertStatus(409);
        $this->assertDatabaseHas('users', ['id' => $picker->id]);
    }

    public function test_empty_database_returns_null_metrics(): void
    {
        $this->actingAsRole('manager');

        $this->getJson('/api/pickers')->assertOk()
            ->assertJsonPath('summary.items_per_hour', null)
            ->assertJsonPath('summary.accuracy', null)
            ->assertJsonPath('summary.idle_percent', null)
            ->assertJsonPath('summary.distance_km', 0)
            ->assertJsonPath('open_orders', 0);

        $this->getJson('/api/pickers/ranking?period=week')->assertOk()->assertJsonCount(0, 'ranking');
        $this->getJson('/api/pickers/ranking?period=ano')->assertUnprocessable();
    }

    public function test_metrics_progress_and_ranking_from_real_rows(): void
    {
        $this->travelTo(now()->setTime(15, 0));
        $this->actingAsRole('manager');
        $picker = User::create(['name' => 'Ana P.', 'email' => 'a@fasthub.test', 'password' => 'password123', 'role' => 'picker', 'work_status' => 'active']);

        $aisle = Aisle::create(['code' => 'A']);
        $near = Location::create(['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '1', 'coord_x' => 0, 'coord_y' => 0]);
        $far = Location::create(['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '2', 'coord_x' => 30, 'coord_y' => 40]);
        $product = Product::create(['sku' => 'S1', 'name' => 'P', 'barcode_primary' => 'B1']);

        $order = Order::create([
            'order_number' => '#4822', 'status' => 'in_progress', 'picker_id' => $picker->id,
            'started_at' => now()->subHour(),
        ]);

        // 10 unidades: 5 bipadas. Primeira bipagem há 2h, última há 1h, com 30 min de pausa no meio.
        $first = OrderItem::create(['order_id' => $order->id, 'product_id' => $product->id, 'location_id' => $near->id, 'quantity' => 5, 'picked_quantity' => 3, 'picked_at' => now()->subHours(2)]);
        $second = OrderItem::create(['order_id' => $order->id, 'product_id' => $product->id, 'location_id' => $far->id, 'quantity' => 5, 'picked_quantity' => 2, 'picked_at' => now()->subHour()]);

        ScanEvent::create(['picker_id' => $picker->id, 'order_id' => $order->id, 'order_item_id' => $first->id, 'type' => 'ok', 'scanned_at' => now()->subHours(2)]);
        ScanEvent::create(['picker_id' => $picker->id, 'order_id' => $order->id, 'order_item_id' => $second->id, 'type' => 'ok', 'scanned_at' => now()->subHour()]);
        ScanEvent::create(['picker_id' => $picker->id, 'order_id' => $order->id, 'order_item_id' => $second->id, 'type' => 'ok', 'scanned_at' => now()->subHour()->addSecond()]);
        ScanEvent::create(['picker_id' => $picker->id, 'order_id' => $order->id, 'type' => 'mismatch', 'scanned_at' => now()->subMinutes(30)]);
        PickerBreak::create(['picker_id' => $picker->id, 'started_at' => now()->subMinutes(100), 'ended_at' => now()->subMinutes(70)]);

        $response = $this->getJson('/api/pickers')->assertOk();

        $response->assertJsonPath('pickers.0.current_order.number', '#4822')
            ->assertJsonPath('pickers.0.current_order.picked', 5)
            ->assertJsonPath('pickers.0.current_order.total', 10)
            ->assertJsonPath('pickers.0.current_order.progress', 50)
            ->assertJsonPath('pickers.0.current_order.has_mismatch', true)
            ->assertJsonPath('open_orders', 1)
            ->assertJsonPath('summary.distance_km', 0.05)
            ->assertJsonPath('summary.mismatches', 1)
            ->assertJsonCount(1, 'alerts');

        // 3 de 4 bipagens ok = 75%.
        $this->assertEquals(75.0, $response->json('summary.accuracy'));
        // Bipagens de -2h a -30min (1h30), com 30 min de pausa: 1h ativa, 5 itens = 5 itens/h.
        $this->assertEquals(5.0, $response->json('pickers.0.metrics.items_per_hour'));
        $this->assertEquals(33.3, $response->json('summary.idle_percent'));

        $this->getJson('/api/pickers/ranking')->assertOk()
            ->assertJsonPath('ranking.0.name', 'Ana P.')
            ->assertJsonPath('ranking.0.items', 5);
    }

    public function test_picker_updates_own_status_and_records_break(): void
    {
        $picker = $this->actingAsRole('picker');

        $this->postJson('/api/picker/status', ['status' => 'paused'])->assertOk()->assertJsonPath('status', 'paused');
        $this->assertDatabaseHas('picker_breaks', ['picker_id' => $picker->id, 'ended_at' => null]);

        $this->postJson('/api/picker/status', ['status' => 'active'])->assertOk();
        $this->assertDatabaseMissing('picker_breaks', ['picker_id' => $picker->id, 'ended_at' => null]);

        $this->postJson('/api/picker/status', ['status' => 'x'])->assertUnprocessable();
    }

    public function test_stale_last_seen_makes_picker_offline(): void
    {
        $this->actingAsRole('manager');
        User::create([
            'name' => 'Carlos M.', 'email' => 'c@fasthub.test', 'password' => 'password123', 'role' => 'picker',
            'work_status' => 'active', 'last_seen_at' => now()->subMinutes(30),
        ]);

        $this->getJson('/api/pickers')->assertJsonPath('pickers.0.status', 'offline')->assertJsonPath('counts.offline', 1);
    }
}
