<?php

namespace Database\Seeders;

use App\Models\User;
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
    }
}