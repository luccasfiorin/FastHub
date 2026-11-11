<?php

namespace Tests\Feature;

use App\Models\Aisle;
use App\Models\Location;
use App\Models\Order;
use App\Models\PickerBreak;
use App\Models\Product;
use App\Models\ScanEvent;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** O seeder de exemplo gera um armazém coerente, com dados para todas as telas. */
class ArmazemSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_fills_every_screen(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(5, Aisle::count());
        $this->assertSame(95, Location::count());
        $this->assertSame(6, Product::where('requires_forklift', true)->count());
        $this->assertSame(0, Product::whereNull('location_id')->count());

        // Pedidos em todos os status.
        foreach (['pending', 'in_progress', 'completed', 'cancelled'] as $status) {
            $this->assertGreaterThan(0, Order::where('status', $status)->count(), "sem pedidos {$status}");
        }

        // Bipagens no histórico, com divergências, e nenhuma no futuro.
        $this->assertGreaterThan(1000, ScanEvent::where('type', 'ok')->count());
        $this->assertGreaterThan(0, ScanEvent::where('type', 'mismatch')->count());
        $this->assertSame(0, ScanEvent::where('scanned_at', '>', now())->count());

        // Itens coletados batem com o status do pedido.
        $concluido = Order::where('status', 'completed')->with('items')->first();
        $this->assertTrue($concluido->items->every(fn ($i) => $i->is_picked && $i->picked_quantity === $i->quantity));
        $this->assertSame(0, Order::where('status', 'pending')->whereHas('items', fn ($q) => $q->where('picked_quantity', '>', 0))->count());

        // Uma pausa em aberto (Bruna) e o painel com coletores em todos os estados.
        $this->assertSame(1, PickerBreak::whereNull('ended_at')->count());

        Sanctum::actingAs(User::firstWhere('email', 'gestor@fasthub.com'));
        $painel = $this->getJson('/api/pickers')->assertOk();
        $painel->assertJsonPath('counts.active', 3)
            ->assertJsonPath('counts.paused', 1)
            ->assertJsonPath('counts.offline', 1);
        $this->assertNotNull($painel->json('summary.items_per_hour'));
        $this->assertNotEmpty($painel->json('alerts'));

        // O coletor de teste do login tem pedidos na fila.
        Sanctum::actingAs(User::firstWhere('email', 'coletor@fasthub.com'));
        $this->getJson('/api/picker/orders')->assertOk()->assertJsonCount(2);
    }

    public function test_running_again_does_not_duplicate(): void
    {
        $this->seed(DatabaseSeeder::class);
        $pedidos = Order::count();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame($pedidos, Order::count());
        $this->assertSame(5, Aisle::count());
    }
}
