<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('picker_breaks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('picker_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['picker_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('picker_breaks');
    }
};
