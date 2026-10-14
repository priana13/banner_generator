<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->timestamps();
            $table->unique(['user_id', 'name']);
        });
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->constrained('project_categories')->nullOnDelete();
            $table->index(['user_id', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'category_id']);
            $table->dropConstrainedForeignId('category_id');
        });
        Schema::dropIfExists('project_categories');
    }
};
