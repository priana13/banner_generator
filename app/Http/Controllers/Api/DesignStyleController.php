<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DesignStyle;
use App\Services\Design\DesignStyles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DesignStyleController extends Controller
{
    public function index(Request $request, DesignStyles $styles): JsonResponse
    {
        return response()->json(['data' => $styles->available($request->user())]);
    }

    public function store(Request $request): JsonResponse
    {
        $style = $request->user()->designStyles()->create($this->validateStyle($request));

        return response()->json($style->toEditorArray(), 201);
    }

    public function update(Request $request, DesignStyle $designStyle): JsonResponse
    {
        abort_unless($designStyle->user_id === $request->user()->id, 403);
        $designStyle->update($this->validateStyle($request, $designStyle));

        return response()->json($designStyle->toEditorArray());
    }

    public function destroy(Request $request, DesignStyle $designStyle): JsonResponse
    {
        abort_unless($designStyle->user_id === $request->user()->id, 403);
        $designStyle->delete();

        return response()->json(status: 204);
    }

    private function validateStyle(Request $request, ?DesignStyle $style = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('design_styles')->where('user_id', $request->user()->id)->ignore($style?->id)],
            'description' => ['nullable', 'string', 'max:240'],
            'text_instructions' => ['present', 'nullable', 'string', 'max:2000'],
            'image_instructions' => ['present', 'nullable', 'string', 'max:2000'],
            'font' => ['nullable', 'string', Rule::in(config()->array('banner.fonts'))],
            'ornaments' => ['present', 'array', 'max:3'],
            'ornaments.*' => ['required', 'string', 'distinct', Rule::in(array_keys(config()->array('banner.ornaments')))],
        ], ['name.unique' => 'Nama gaya ini sudah digunakan.']);
        $data['text_instructions'] ??= '';
        $data['image_instructions'] ??= '';

        return $data;
    }
}
