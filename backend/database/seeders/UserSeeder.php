<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
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