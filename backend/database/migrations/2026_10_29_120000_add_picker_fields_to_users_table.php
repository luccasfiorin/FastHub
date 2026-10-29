<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('picker_type', ['foot', 'forklift'])->default('foot')->after('role');
            $table->string('operator_name')->nullable()->after('picker_type');
            $table->enum('work_status', ['active', 'paused', 'offline'])->default('offline')->after('operator_name');
            $table->timestamp('last_seen_at')->nullable()->after('work_status');
            $table->string('job_title')->nullable()->after('last_seen_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['picker_type', 'operator_name', 'work_status', 'last_seen_at', 'job_title']);
        });
    }
};
