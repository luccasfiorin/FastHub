<?php

namespace Tests\Feature;

use App\Models\Aisle;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AisleLocationCrudTest extends TestCase
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

    public function test_guest_cannot_access(): void
    {
        $this->getJson('/api/aisles')->assertUnauthorized();
        $this->getJson('/api/locations')->assertUnauthorized();
    }

    public function test_manager_can_crud_aisles(): void
    {
        $this->actingAsRole('manager');

        $id = $this->postJson('/api/aisles', ['code' => 'A', 'name' => 'Corredor A'])
            ->assertCreated()
            ->assertJsonPath('code', 'A')
            ->json('id');

        $this->postJson('/api/aisles', ['code' => 'A'])->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->postJson('/api/aisles', [])->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->getJson('/api/aisles')->assertOk()->assertJsonCount(1)->assertJsonPath('0.locations_count', 0);
        $this->getJson("/api/aisles/{$id}")->assertOk()->assertJsonPath('name', 'Corredor A');

        $this->putJson("/api/aisles/{$id}", ['code' => 'A', 'name' => 'Secos'])->assertOk()->assertJsonPath('name', 'Secos');
        $this->patchJson("/api/aisles/{$id}", ['description' => 'Lado norte'])->assertOk()->assertJsonPath('code', 'A');

        $this->deleteJson("/api/aisles/{$id}")->assertOk();
        $this->assertDatabaseMissing('aisles', ['id' => $id]);
    }

    public function test_manager_can_crud_locations(): void
    {
        $this->actingAsRole('manager');
        $aisle = Aisle::create(['code' => 'B']);

        $payload = ['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '01', 'coord_x' => 10, 'coord_y' => 5];
        $id = $this->postJson('/api/locations', $payload)
            ->assertCreated()
            ->assertJsonPath('aisle.code', 'B')
            ->json('id');

        $this->postJson('/api/locations', $payload)->assertUnprocessable()->assertJsonValidationErrors('position');
        $this->postJson('/api/locations', ['aisle_id' => 999, 'shelf' => '1', 'position' => '02'])
            ->assertUnprocessable()->assertJsonValidationErrors('aisle_id');

        $this->getJson("/api/locations?aisle_id={$aisle->id}")->assertOk()->assertJsonCount(1);
        $this->patchJson("/api/locations/{$id}", ['coord_z' => 2.5])->assertOk()->assertJsonPath('coord_z', 2.5);

        // corredor com posição não pode ser excluído
        $this->deleteJson("/api/aisles/{$aisle->id}")->assertStatus(409);

        $this->deleteJson("/api/locations/{$id}")->assertOk();
        $this->assertDatabaseMissing('locations', ['id' => $id]);
    }

    public function test_picker_can_read_but_not_write(): void
    {
        $aisle = Aisle::create(['code' => 'C']);
        $location = Location::create(['aisle_id' => $aisle->id, 'shelf' => '1', 'position' => '01']);
        $this->actingAsRole('picker');

        $this->getJson('/api/aisles')->assertOk();
        $this->getJson("/api/locations/{$location->id}")->assertOk();

        $this->postJson('/api/aisles', ['code' => 'D'])->assertForbidden();
        $this->putJson("/api/aisles/{$aisle->id}", ['code' => 'X'])->assertForbidden();
        $this->deleteJson("/api/locations/{$location->id}")->assertForbidden();
    }
}
