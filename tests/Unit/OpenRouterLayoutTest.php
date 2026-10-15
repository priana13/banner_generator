<?php

use App\Services\Ai\AiProviderException;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\Providers\OpenAiLayoutProvider;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    config([
        'banner.openai.api_key' => 'sk-router-secret',
        'banner.openai.base_url' => 'https://openrouter.ai/api/v1/',
        'banner.openai.layout_model' => 'vendor/layout-model',
    ]);
    Http::preventStrayRequests();
});

test('openrouter layouts request text without requiring structured output support', function () {
    Http::fake(['openrouter.ai/*' => Http::response([
        'choices' => [['message' => ['content' => '```json {"headline":"Donasi"} ```']]],
    ])]);

    $result = (new OpenAiLayoutProvider)->generate(new DesignBrief('Donasi', 1200, 400, '#ff6600'));

    expect($result->spec['headline'])->toBe('Donasi');
    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
        && $request['modalities'] === ['text'] && ! isset($request['response_format']));
});

test('openrouter errors explain rejection without leaking keys or raw upstream responses', function () {
    Http::fake(['openrouter.ai/*' => Http::response(['error' => [
        'message' => 'Invalid model ID sk-router-secret',
        'metadata' => ['raw' => 'private upstream request'],
    ]], 400)]);

    try {
        (new OpenAiLayoutProvider)->generate(new DesignBrief('Donasi', 1200, 400, '#ff6600'));
        $this->fail('Expected a provider error.');
    } catch (AiProviderException $exception) {
        expect($exception->getMessage())->toContain('OpenRouter', 'Invalid model ID', 'AI Global')
            ->not->toContain('sk-router-secret', 'private upstream request');
    }

    Http::assertSentCount(1);
});
