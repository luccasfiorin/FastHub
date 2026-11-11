<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Usuários de login de teste e o armazém de exemplo completo.
     *
     * Rodar num banco limpo:  php artisan migrate:fresh --seed
     * (a senha de todos os usuários de teste é password123)
     */
    public function run(): void
    {
        User::updateOrCreate(['email' => 'gestor@fasthub.com'], [
            'name' => 'Gestor do Armazém',
            'password' => Hash::make('password123'),
            'role' => 'manager',
            'job_title' => 'Gestor de estoque',
        ]);

        User::updateOrCreate(['email' => 'coletor@fasthub.com'], [
            'name' => 'Coletor de Campo',
            'password' => Hash::make('password123'),
            'role' => 'picker',
            'picker_type' => 'foot',
            'work_status' => 'offline',
        ]);

        $this->call(ArmazemSeeder::class);
    }
}
