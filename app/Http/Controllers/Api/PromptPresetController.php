<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PromptPreset;
use App\Services\Design\BannerComposer;
use App\Services\Design\Color;
use App\Services\Design\DesignStyles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromptPresetController extends Controller
{
    /**
     * List the prompts the user saved.
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->promptPresets()
                ->orderBy('name')
                ->get()
                ->map(fn (PromptPreset $preset) => $preset->toEditorArray()),
        ]);
    }

    /**
     * Save a prompt. Saving under an existing name replaces that preset.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', ...($request->boolean('create_only') ? [Rule::unique('prompt_presets', 'name')->where('user_id', $request->user()->id)] : [])],
            'create_only' => ['sometimes', 'boolean'],
            'builder' => ['nullable', 'array:concept,audience,headline,cta,visual,theme_id,layout,include_text'],
            'builder.concept' => ['nullable', 'string', 'max:1500'],
            'builder.audience' => ['nullable', 'string', 'max:300'],
            'builder.headline' => ['nullable', 'string', 'max:200'],
            'builder.cta' => ['nullable', 'string', 'max:100'],
            'builder.visual' => ['nullable', 'string', 'max:1000'],
            'builder.theme_id' => ['nullable', 'string', 'max:80'],
            'builder.layout' => ['nullable', 'in:left,right'],
            'builder.include_text' => ['sometimes', 'boolean'],
            'prompt' => ['required', 'string', 'min:5', 'max:'.config()->integer('banner.max_prompt_length')],
            'primary_color' => ['nullable', 'string', 'regex:'.Color::HEX_PATTERN],
            'design_style' => ['nullable', 'string', Rule::in(array_column(app(DesignStyles::class)->available($request->user()), 'key'))],
            'style' => ['nullable', 'string', Rule::in(BannerComposer::STYLES)],
        ]);

        $presets = $request->user()->promptPresets();
        $existing = (clone $presets)->where('name', $data['name'])->first();
        $exists = $existing !== null;

        if (! $exists && $presets->count() >= config()->integer('banner.max_prompt_presets')) {
            return response()->json(['message' => 'Jumlah prompt tersimpan sudah mencapai batas.'], 422);
        }

        $preset = $request->user()->promptPresets()->updateOrCreate(
            ['name' => $data['name']],
            [
                'prompt' => $data['prompt'],
                'settings_json' => [
                    'primary_color' => $data['primary_color'] ?? null,
                    'style' => $data['style'] ?? null,
                    'design_style' => $data['design_style'] ?? null,
                    'builder' => $data['builder'] ?? $existing?->settings_json['builder'] ?? null,
                ],
            ],
        );

        return response()->json($preset->toEditorArray(), $exists ? 200 : 201);
    }

    /**
     * Delete a saved prompt.
     */
    public function destroy(Request $request, PromptPreset $promptPreset): JsonResponse
    {
        abort_unless($promptPreset->user_id === $request->user()->id, 403);

        $promptPreset->delete();

        return response()->json(status: 204);
    }
}
