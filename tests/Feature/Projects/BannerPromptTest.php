<?php

use App\Models\AiSetting;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->user = User::factory()->create();
    $this->projectId = $this->actingAs($this->user)->postJson(route('api.projects.store'), [
        'title' => 'Banner', 'canvas_width' => 1200, 'canvas_height' => 400,
    ])->json('project.id');
    $this->endpoint = route('api.projects.banner-prompt', $this->projectId);
    $this->input = [
        'concept' => 'Donasi pangan santri', 'audience' => 'Keluarga',
        'visual' => 'Santri membawa pangan', 'headline' => 'Bantu Santri', 'cta' => 'Donasi',
        'layout' => 'right', 'include_text' => true, 'composition' => 'cutout',
        'width' => 1200, 'height' => 400, 'color' => '#f97316',
    ];
});

test('prompt uses saved global text provider and sends art direction to AI', function () {
    AiSetting::create(['id' => 1, 'settings' => [
        'layout_provider' => 'openai', 'openai_api_key' => 'test-key',
        'openai_layout_model' => 'test-model', 'openai_base_url' => 'https://openrouter.ai/api/v1',
    ]]);
    Http::fake(['openrouter.ai/*' => Http::response([
        'choices' => [['message' => ['content' => json_encode(['prompt' => 'Banner hasil arahan AI.'])]]],
    ])]);
    $this->postJson($this->endpoint, $this->input)->assertOk()->assertJsonPath('prompt', 'Banner hasil arahan AI.');
    Http::assertSent(fn ($request) => $request['model'] === 'test-model'
        && $request['modalities'] === ['text']
        && str_contains($request['messages'][0]['content'], 'art director')
        && str_contains($request['messages'][1]['content'], 'Bantu Santri'));
});

test('prompt supports Gemini and no-text input', function () {
    config(['banner.layout_provider' => 'gemini', 'banner.gemini.api_key' => 'test']);
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => '{"prompt":"Gambar tanpa teks hasil AI."}']]]]],
    ])]);
    $this->postJson($this->endpoint, [...$this->input, 'include_text' => false])
        ->assertOk()->assertJsonPath('prompt', 'Gambar tanpa teks hasil AI.');
    Http::assertSent(fn ($request) => str_contains($request['contents'][0]['parts'][0]['text'], '"include_text":false')
        && $request['generationConfig']['responseJsonSchema']['required'] === ['prompt']);
});

test('local mode explicitly requires AI configuration', function () {
    $this->postJson($this->endpoint, $this->input)->assertUnprocessable();
    Http::assertNothingSent();
});

test('prompt rejects invalid inputs before contacting AI', function () {
    $this->postJson($this->endpoint, [...$this->input, 'concept' => '', 'width' => 0, 'color' => 'bad'])
        ->assertUnprocessable()->assertJsonValidationErrors(['concept', 'width', 'color']);
    Http::assertNothingSent();
});

test('prompt enforces project ownership and authentication', function () {
    $this->actingAs(User::factory()->create())->postJson($this->endpoint, $this->input)->assertForbidden();
    auth()->forgetGuards();
    $this->postJson($this->endpoint, $this->input)->assertUnauthorized();
    Http::assertNothingSent();
});

test('provider failures and invalid AI output are returned as errors', function ($response) {
    config(['banner.layout_provider' => 'openai', 'banner.openai.api_key' => 'test']);
    Http::fake(['*' => $response]);
    $this->postJson($this->endpoint, $this->input)->assertStatus(502)->assertJsonStructure(['message']);
})->with([
    'rate limited' => fn () => Http::response(['error' => ['message' => 'Rate limited']], 429),
    'empty prompt' => fn () => Http::response(['choices' => [['message' => ['content' => '{"prompt":""}']]]]),
    'invalid JSON' => fn () => Http::response(['choices' => [['message' => ['content' => 'not JSON']]]]),
    'oversized prompt' => fn () => Http::response(['choices' => [['message' => ['content' => json_encode(['prompt' => str_repeat('x', 6001)])]]]]),
]);
