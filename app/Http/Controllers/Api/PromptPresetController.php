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
            'name' => ['required', 'string', 'max:80'],
            'prompt' => ['required', 'string', 'min:5', 'max:'.config()->integer('banner.max_prompt_length')],
            'primary_color' => ['nullable', 'string', 'regex:'.Color::HEX_PATTERN],
            'design_style' => ['nullable', 'string', Rule::in(array_column(app(DesignStyles::class)->available($request->user()), 'key'))],
            'style' => ['nullable', 'string', Rule::in(BannerComposer::STYLES)],
        ]);

        $presets = $request->user()->promptPresets();
        $exists = (clone $presets)->where('name', $data['name'])->exists();

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
