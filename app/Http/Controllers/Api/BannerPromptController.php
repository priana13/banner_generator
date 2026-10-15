<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\Ai\AiProviderException;
use App\Services\Ai\BannerImagePrompt;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\GlobalAiSettings;
use App\Services\Ai\Providers\GeminiLayoutProvider;
use App\Services\Ai\Providers\OpenAiLayoutProvider;
use App\Services\Design\DesignStyles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class BannerPromptController extends Controller
{
    public function store(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('update', $project);
        $data = $request->validate([
            'concept' => ['required', 'string', 'max:1500'],
            'audience' => ['nullable', 'string', 'max:300'],
            'visual' => ['nullable', 'string', 'max:1000'],
            'headline' => ['nullable', 'string', 'max:200'],
            'cta' => ['nullable', 'string', 'max:100'],
            'layout' => ['required', 'in:left,right'],
            'include_text' => ['required', 'boolean'],
            'composition' => ['required', 'in:cutout,panel'],
            'width' => ['required', 'integer', 'between:50,4096'],
            'height' => ['required', 'integer', 'between:50,4096'],
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'color_theme' => ['nullable', 'array:name,primary,background,accent,text'],
            'color_theme.name' => ['required_with:color_theme', 'string', 'max:80'],
            'color_theme.primary' => ['required_with:color_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'color_theme.background' => ['required_with:color_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'color_theme.accent' => ['required_with:color_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'color_theme.text' => ['required_with:color_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'design_style' => ['nullable', 'string', 'max:100'],
        ]);
        $style = app(DesignStyles::class)->snapshot($request->user(), $data['design_style'] ?? null);
        app(GlobalAiSettings::class)->apply();
        $provider = match (config('banner.layout_provider')) {
            'openai' => new OpenAiLayoutProvider,
            'gemini' => new GeminiLayoutProvider,
            default => null,
        };
        if ($provider === null) {
            return response()->json(['message' => 'Pilih penyedia dan model teks AI di pengaturan AI Global untuk membuat prompt dengan AI.'], 422);
        }

        try {
            $result = $provider->generateWithPrompt(new DesignBrief(
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                $data['width'], $data['height'], $data['color'], $style,
            ), new BannerImagePrompt);
            $prompt = $result->spec['prompt'] ?? null;
            if (! is_string($prompt) || trim($prompt) === '' || mb_strlen($prompt) > config()->integer('banner.max_prompt_length')) {
                throw new AiProviderException('AI mengembalikan prompt kosong atau terlalu panjang. Silakan coba lagi.');
            }

            return response()->json(['prompt' => trim($prompt)]);
        } catch (AiProviderException $error) {
            return response()->json(['message' => $error->getMessage()], 502);
        }
    }
}
