<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ornaments', function (Blueprint $table) {
            // Retain the source marker after a library image is deleted,
            // so a later sync does not recreate an intentionally removed item.
            $table->uuid('library_image_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('ornaments', fn (Blueprint $table) => $table->dropColumn('library_image_id'));
    }
};
