<?php

use App\Services\Ai\ImageRequest;
use App\Services\Ai\ImageTools;
use App\Services\Ai\Providers\GeminiImageProvider;
use App\Services\Ai\Providers\OpenAiImageProvider;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

test('standalone image generation preserves banner copy instructions', function (string $provider) {
    Http::preventStrayRequests();
    config(['banner.openai.api_key' => 'test', 'banner.gemini.api_key' => 'test', 'banner.openai.base_url' => 'https://api.openai.com/v1']);
    $binary = ImageTools::encode(ImageTools::canvas(100, 100), 'image/png');
    Http::fake(['*' => Http::response($provider === 'openai'
        ? ['data' => [['b64_json' => base64_encode($binary)]]]
        : ['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'image/png', 'data' => base64_encode($binary)]]]]]]])]);
    $client = $provider === 'openai' ? new OpenAiImageProvider : new GeminiImageProvider;
    $image = $client->generate(new ImageRequest('Headline persis: Donasi Santri', 200, 100, '#ff6600', ImageRequest::PURPOSE_BANNER));
    expect(getimagesizefromstring($image->binary)[0])->toBe(200);
    Http::assertSent(function ($request) use ($provider) {
        $prompt = $provider === 'openai' ? $request['prompt'] : $request['contents'][0]['parts'][0]['text'];

        return str_contains($prompt, 'Donasi Santri') && str_contains($prompt, 'complete website banner')
            && ! str_contains($prompt, 'Absolutely no text');
    });
})->with(['openai', 'gemini']);
