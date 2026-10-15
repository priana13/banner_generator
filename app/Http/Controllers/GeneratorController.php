<?php

namespace App\Http\Controllers;

use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\ImageProvider;
use App\Services\Ai\ImageRequest;
use App\Services\Design\DesignStyles;
use App\Services\Design\ImageLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GeneratorController extends Controller
{
    public function prompt(Request $request): Response
    {
        return Inertia::render('generators/prompt', [
            'maxPromptLength' => config()->integer('banner.max_prompt_length'),
            'designStyles' => app(DesignStyles::class)->available($request->user()),
        ]);
    }

    public function image(): Response
    {
        return Inertia::render('generators/image', ['maxPromptLength' => config()->integer('banner.max_prompt_length')]);
    }

    public function generateImage(Request $request, ImageProvider $provider, ImageLibrary $library): JsonResponse
    {
        $data = $request->validate([
            'prompt' => ['required', 'string', 'min:5', 'max:'.config()->integer('banner.max_prompt_length')],
            'width' => ['required', 'integer', 'between:50,4096'],
            'height' => ['required', 'integer', 'between:50,4096'],
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
        if ($provider->name() === 'local') {
            return response()->json(['message' => 'Pilih penyedia dan model gambar di pengaturan AI Global.'], 422);
        }
        try {
            $image = $provider->generate(new ImageRequest(
                $data['prompt'], $data['width'], $data['height'], $data['color'], ImageRequest::PURPOSE_BANNER,
            ));
            $saved = $library->generated($request->user()->id, $image->binary, 'Banner AI '.now()->format('Ymd-His'));

            return response()->json($saved->toLibraryArray(), 201);
        } catch (AiProviderException $error) {
            return response()->json(['message' => $error->getMessage()], 502);
        }
    }
}
