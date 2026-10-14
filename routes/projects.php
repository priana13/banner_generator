<?php

use App\Http\Controllers\Api\AssetController as ApiAssetController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\GenerationController;
use App\Http\Controllers\Api\OrnamentController;
use App\Http\Controllers\Api\ProjectController as ApiProjectController;
use App\Http\Controllers\Api\PromptPresetController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\ProjectController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [ProjectController::class, 'index'])->name('dashboard');
    Route::get('projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
    Route::get('assets/{asset}', [AssetController::class, 'show'])->name('assets.show');

    Route::get('ornaments/{ornament}', [OrnamentController::class, 'show'])->name('ornaments.show');

    // JSON endpoints used by the editor. They share the session guard and
    // CSRF protection of the web group; no API key ever reaches the browser.
    Route::prefix('api')->name('api.')->middleware('throttle:240,1')->group(function () {
        Route::post('projects', [ApiProjectController::class, 'store'])->name('projects.store');
        Route::get('projects/{project}', [ApiProjectController::class, 'show'])->name('projects.show');
        Route::patch('projects/{project}', [ApiProjectController::class, 'update'])->name('projects.update');
        Route::delete('projects/{project}', [ApiProjectController::class, 'destroy'])->name('projects.destroy');
        Route::patch('projects/{project}/document', [ApiProjectController::class, 'saveDocument'])->name('projects.document');
        Route::get('projects/{project}/revisions', [ApiProjectController::class, 'revisions'])->name('projects.revisions');
        Route::post('projects/{project}/assets', [ApiAssetController::class, 'store'])->name('projects.assets.store');
        Route::post('projects/{project}/export', [ExportController::class, 'store'])->name('projects.export');

        Route::get('ornaments', [OrnamentController::class, 'index'])->name('ornaments.index');
        Route::post('ornaments', [OrnamentController::class, 'store'])->name('ornaments.store');
        Route::delete('ornaments/{ornament}', [OrnamentController::class, 'destroy'])->name('ornaments.destroy');
        Route::post('projects/{project}/ornaments/{ornament}', [OrnamentController::class, 'use'])->name('projects.ornaments.use');

        Route::get('prompt-presets', [PromptPresetController::class, 'index'])->name('prompt-presets.index');
        Route::post('prompt-presets', [PromptPresetController::class, 'store'])->name('prompt-presets.store');
        Route::delete('prompt-presets/{promptPreset}', [PromptPresetController::class, 'destroy'])->name('prompt-presets.destroy');

        Route::post('projects/{project}/generate', [GenerationController::class, 'store'])
            ->middleware('throttle:generate')
            ->name('projects.generate');
        Route::get('generation-jobs/{generationJob}', [GenerationController::class, 'show'])->name('generation-jobs.show');
        Route::post('generation-jobs/{generationJob}/cancel', [GenerationController::class, 'cancel'])->name('generation-jobs.cancel');
        Route::post('generation-jobs/{generationJob}/retry', [GenerationController::class, 'retry'])
            ->middleware('throttle:generate')
            ->name('generation-jobs.retry');
    });
});
