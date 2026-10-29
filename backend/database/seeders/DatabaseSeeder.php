<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Aisle;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Utilizadores
        User::create([
            'name' => 'Gestor do Armazém',
            'email' => 'gestor@fasthub.com',
            'password' => Hash::make('password123'),
            'role' => 'manager',
        ]);

        User::create([
            'name' => 'Coletor de Campo',
            'email' => 'coletor@fasthub.com',
            'password' => Hash::make('password123'),
            'role' => 'picker',
        ]);

        // Estrutura de Armazém para testes de pedidos
        $aisle = Aisle::create([
            'name' => 'Corredor A',
            'code' => 'A01',
        ]);

        Location::create([
            'code' => 'P01',
            'aisle_id' => $aisle->id,
        ]);

        Product::create([
            'name' => 'Caixa de Parafusos',
            'sku' => 'PAR-001',
            'barcode' => '9876543210123',
        ]);
    }
}