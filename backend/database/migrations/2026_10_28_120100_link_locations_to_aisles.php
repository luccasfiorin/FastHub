<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Troca a coluna de texto "aisle" por uma chave estrangeira para "aisles".
     * Corredores já usados em posições existentes são criados automaticamente.
     */
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->foreignId('aisle_id')->nullable()->after('id')->constrained('aisles')->restrictOnDelete();
        });

        $now = now();
        foreach (DB::table('locations')->distinct()->pluck('aisle') as $code) {
            $aisleId = DB::table('aisles')->where('code', $code)->value('id')
                ?? DB::table('aisles')->insertGetId(['code' => $code, 'created_at' => $now, 'updated_at' => $now]);

            DB::table('locations')->where('aisle', $code)->update(['aisle_id' => $aisleId]);
        }

        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn('aisle');
            $table->unique(['aisle_id', 'shelf', 'position']);
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->string('aisle')->default('')->after('id');
        });

        foreach (DB::table('aisles')->get() as $aisle) {
            DB::table('locations')->where('aisle_id', $aisle->id)->update(['aisle' => $aisle->code]);
        }

        Schema::table('locations', function (Blueprint $table) {
            $table->dropUnique(['aisle_id', 'shelf', 'position']);
            $table->dropConstrainedForeignId('aisle_id');
        });
    }
};
