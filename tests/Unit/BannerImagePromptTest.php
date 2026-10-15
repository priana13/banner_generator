<?php

use App\Services\Ai\AiProviderException;
use App\Services\Ai\BannerImagePrompt;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\Providers\GeminiLayoutProvider;
use App\Services\Ai\Providers\OpenAiLayoutProvider;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

test('AI providers use banner prompt instructions and schema instead of layout instructions', function (string $provider) {
    Http::preventStrayRequests();
    config([
        'banner.openai.api_key' => 'test', 'banner.gemini.api_key' => 'test',
        'banner.openai.base_url' => 'https://api.openai.com/v1',
    ]);
    $answer = '{"prompt":"Banner profesional hasil AI."}';
    Http::fake(['*' => Http::response($provider === 'openai'
        ? ['choices' => [['message' => ['content' => $answer]]]]
        : ['candidates' => [['content' => ['parts' => [['text' => $answer]]]]]])]);
    $client = $provider === 'openai' ? new OpenAiLayoutProvider : new GeminiLayoutProvider;
    $result = $client->generateWithPrompt(new DesignBrief('Donasi santri', 1200, 400, '#ff6600'), new BannerImagePrompt);
    expect($result->spec['prompt'])->toBe('Banner profesional hasil AI.');
    Http::assertSent(function ($request) use ($provider) {
        $instructions = $provider === 'openai' ? $request['messages'][0]['content'] : $request['systemInstruction']['parts'][0]['text'];
        $schema = $provider === 'openai' ? $request['response_format']['json_schema']['schema'] : $request['generationConfig']['responseJsonSchema'];

        return str_contains($instructions, 'art director') && str_contains($instructions, 'prohibit all text')
            && $schema['required'] === ['prompt'];
    });
})->with(['openai', 'gemini']);

test('temporary provider outage is retried and recovers', function () {
    config(['banner.openai.api_key' => 'test', 'banner.openai.base_url' => 'https://api.openai.com/v1']);
    Http::preventStrayRequests();
    Http::fakeSequence()->push(['error' => ['message' => 'Unavailable']], 503)
        ->push(['choices' => [['message' => ['content' => '{"prompt":"Recovered AI prompt"}']]]]);
    $result = (new OpenAiLayoutProvider)->generateWithPrompt(new DesignBrief('Donasi', 1200, 400, '#ff6600'), new BannerImagePrompt);
    expect($result->spec['prompt'])->toBe('Recovered AI prompt');
    Http::assertSentCount(2);
});

test('persistent outage stops retrying and explains next steps', function () {
    config(['banner.openai.api_key' => 'secret-key', 'banner.openai.base_url' => 'https://api.openai.com/v1']);
    Http::fake(['*' => Http::response(['error' => ['message' => 'private secret-key']], 503)]);
    try {
        (new OpenAiLayoutProvider)->generateWithPrompt(new DesignBrief('Donasi', 1200, 400, '#ff6600'), new BannerImagePrompt);
        $this->fail('Expected provider error');
    } catch (AiProviderException $error) {
        expect($error->getMessage())->toContain('HTTP 503', 'Percobaan ulang otomatis', 'AI Global')->not->toContain('secret-key', 'private');
    }
    Http::assertSentCount(2);
});

test('credential rejection is not retried', function () {
    config(['banner.openai.api_key' => 'test', 'banner.openai.base_url' => 'https://api.openai.com/v1']);
    Http::fake(['*' => Http::response([], 401)]);
    try {
        (new OpenAiLayoutProvider)->generateWithPrompt(new DesignBrief('Donasi', 1200, 400, '#ff6600'), new BannerImagePrompt);
        $this->fail('Expected provider error');
    } catch (AiProviderException $error) {
        expect($error->getMessage())->toContain('Kredensial');
    }
    Http::assertSentCount(1);
});
