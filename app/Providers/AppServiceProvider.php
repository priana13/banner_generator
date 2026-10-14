<?php

namespace App\Providers;

use App\Services\Ai\Contracts\ImageProvider;
use App\Services\Ai\Contracts\LayoutProvider;
use App\Services\Ai\GlobalAiSettings;
use App\Services\Ai\Providers\GeminiImageProvider;
use App\Services\Ai\Providers\GeminiLayoutProvider;
use App\Services\Ai\Providers\LocalImageProvider;
use App\Services\Ai\Providers\LocalLayoutProvider;
use App\Services\Ai\Providers\OpenAiImageProvider;
use App\Services\Ai\Providers\OpenAiLayoutProvider;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(LayoutProvider::class, function (): LayoutProvider {
            app(GlobalAiSettings::class)->apply();

            return match (config('banner.layout_provider')) {
                'gemini' => new GeminiLayoutProvider,
                'openai' => new OpenAiLayoutProvider,
                default => new LocalLayoutProvider,
            };
        });

        $this->app->bind(ImageProvider::class, function (): ImageProvider {
            app(GlobalAiSettings::class)->apply();

            return match (config('banner.image_provider')) {
                'gemini' => new GeminiImageProvider,
                'openai' => new OpenAiImageProvider,
                default => new LocalImageProvider,
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();
    }

    /**
     * Limit how often a user may start (or retry) an AI generation.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('generate', fn (Request $request) => Limit::perMinute(
            config()->integer('banner.generations_per_minute'),
        )->by($request->user()?->id ?: $request->ip()));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
