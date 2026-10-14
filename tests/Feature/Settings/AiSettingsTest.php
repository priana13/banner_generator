<?php

use App\Models\AiSetting;
use App\Models\User;
use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\ImageProvider;
use App\Services\Ai\Contracts\LayoutProvider;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\ImageRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

function aiSettingsPayload(): array
{
    return [
        'layout_provider' => 'gemini', 'image_provider' => 'local',
        'gemini_image_model' => 'gemini-2.5-flash-image',
        'gemini_model' => 'gemini-2.5-flash', 'gemini_api_key' => 'gemini-secret',
        'openai_base_url' => 'https://api.openai.com/v1',
        'openai_layout_model' => 'gpt-4o-mini', 'openai_image_model' => 'gpt-image-1',
        'openai_api_key' => '',
    ];
}

test('AI settings require authentication', function () {
    $this->get('/settings/ai')->assertRedirect('/login');
    $this->put('/settings/ai', aiSettingsPayload())->assertRedirect('/login');
});

test('global AI settings retain their explicit singleton ID when first saved', function () {
    // MySQL returns 0 from lastInsertId for a non-auto-increment column.
    // Eloquent must retain the explicitly assigned ID rather than replacing it.
    expect((new AiSetting)->getIncrementing())->toBeFalse();
    $row = AiSetting::query()->firstOrCreate(['id' => 1], ['settings' => []]);
    expect($row->id)->toBe(1)
        ->and(AiSetting::query()->findOrFail($row->id)->id)->toBe(1);
});

test('global AI settings are encrypted and apply to another user without exposing keys', function () {
    $this->withoutVite();
    $this->actingAs(User::factory()->create())->put('/settings/ai', aiSettingsPayload())->assertRedirect('/settings/ai');
    expect(DB::table('ai_settings')->value('settings'))->not->toContain('gemini-secret');
    $this->actingAs(User::factory()->create())->get('/settings/ai')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('settings/ai')->where('settings.layout_provider', 'gemini')
        ->where('settings.gemini_api_key_configured', true)->missing('settings.gemini_api_key'));
    expect(app(LayoutProvider::class)->name())->toBe('gemini');
    $this->put('/settings/ai', array_replace(aiSettingsPayload(), ['gemini_api_key' => '']))->assertRedirect('/settings/ai');
    expect(AiSetting::find(1)->settings['gemini_api_key'])->toBe('gemini-secret');
});

test('AI settings reject missing credentials and invalid providers without flashing secrets', function () {
    $this->actingAs(User::factory()->create());
    config(['banner.gemini.api_key' => null]);
    $this->put('/settings/ai', array_replace(aiSettingsPayload(), ['gemini_api_key' => '']))->assertSessionHasErrors('gemini_api_key');
    $this->put('/settings/ai', array_replace(aiSettingsPayload(), ['layout_provider' => 'invalid']))
        ->assertSessionHasErrors('layout_provider')->assertSessionMissing('_old_input.gemini_api_key');
    expect(AiSetting::count())->toBe(0);
});

test('Gemini uses REST structured output with the API key in a header', function () {
    $this->actingAs(User::factory()->create())->put('/settings/ai', aiSettingsPayload());
    Http::preventStrayRequests();
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [
            ['thought' => true, 'text' => 'internal reasoning'],
            ['text' => '{"headline":"'], ['text' => 'Donasi Sekarang"}'],
        ]]]],
    ])]);
    $result = app(LayoutProvider::class)->generate(new DesignBrief('Donasi', 1200, 400, '#f97316'));
    expect($result->spec['headline'])->toBe('Donasi Sekarang');
    Http::assertSent(fn ($request) => $request->hasHeader('x-goog-api-key', 'gemini-secret')
        && ! str_contains($request->url(), 'gemini-secret')
        && $request['generationConfig']['responseMimeType'] === 'application/json'
        && isset($request['generationConfig']['responseJsonSchema']['properties']['headline'])
        && $request['contents'][0]['role'] === 'user');
});

test('Gemini reports safe errors for quota and blocked responses', function () {
    config(['banner.layout_provider' => 'gemini', 'banner.gemini.api_key' => 'secret']);
    Http::fake(['*' => Http::sequence()->push(['error' => ['message' => 'secret']], 429)->push(['promptFeedback' => ['blockReason' => 'SAFETY']])]);
    expect(fn () => app(LayoutProvider::class)->generate(new DesignBrief('Test', 1200, 400, '#f97316')))
        ->toThrow(AiProviderException::class, 'kuota');
    expect(fn () => app(LayoutProvider::class)->generate(new DesignBrief('Test', 1200, 400, '#f97316')))
        ->toThrow(AiProviderException::class, 'diblokir');
});

test('Gemini images use the shared global key and are resized to the banner target', function () {
    $this->actingAs(User::factory()->create())->put('/settings/ai', array_replace(aiSettingsPayload(), [
        'layout_provider' => 'local', 'image_provider' => 'gemini',
    ]))->assertSessionHasNoErrors();
    $png = UploadedFile::fake()->image('generated.png', 64, 64)->getContent();
    Http::preventStrayRequests();
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [
            ['text' => 'Here is your image'],
            ['thought' => true, 'inlineData' => ['mimeType' => 'image/png', 'data' => 'ignored']],
            ['inlineData' => ['mimeType' => 'image/png', 'data' => base64_encode($png)]],
        ]]]],
    ])]);
    $provider = app(ImageProvider::class);
    $result = $provider->generate(new ImageRequest('Food donation', 300, 100, '#f97316', 'background'));
    expect($provider->name())->toBe('gemini')
        ->and($result->mimeType)->toBe('image/jpeg')
        ->and(getimagesizefromstring($result->binary)[0])->toBe(300)
        ->and(getimagesizefromstring($result->binary)[1])->toBe(100);
    Http::assertSent(fn ($request) => $request->hasHeader('x-goog-api-key', 'gemini-secret')
        && str_ends_with($request->url(), '/gemini-2.5-flash-image:generateContent')
        && $request['generationConfig']['responseModalities'] === ['TEXT', 'IMAGE']
        && $request['generationConfig']['imageConfig']['aspectRatio'] === '16:9'
        && str_contains($request['contents'][0]['parts'][0]['text'], 'low-contrast'));
});

test('Gemini image settings require credentials even with a local layout provider', function () {
    config(['banner.gemini.api_key' => null]);
    $this->actingAs(User::factory()->create())->put('/settings/ai', array_replace(aiSettingsPayload(), [
        'layout_provider' => 'local', 'image_provider' => 'gemini', 'gemini_api_key' => '',
    ]))->assertSessionHasErrors('gemini_api_key');
    expect(AiSetting::count())->toBe(0);
});

test('Gemini image model names are validated', function () {
    $this->actingAs(User::factory()->create())->put('/settings/ai', array_replace(aiSettingsPayload(), [
        'image_provider' => 'gemini', 'gemini_image_model' => '../invalid?key=secret',
    ]))->assertSessionHasErrors('gemini_image_model');
});

test('Gemini image failures never expose provider response secrets', function ($payload, $status, $message) {
    config(['banner.image_provider' => 'gemini', 'banner.gemini.api_key' => 'secret']);
    Http::fake(['*' => Http::response($payload, $status)]);
    expect(fn () => app(ImageProvider::class)->generate(
        new ImageRequest('Test', 100, 100, '#f97316', 'visual'),
    ))->toThrow(AiProviderException::class, $message);
})->with([
    'quota' => [['error' => ['message' => 'secret']], 429, 'kuota'],
    'credentials' => [['error' => ['message' => 'secret']], 403, 'Kredensial'],
    'model' => [['error' => ['message' => 'secret']], 404, 'nama model'],
    'blocked' => [['promptFeedback' => ['blockReason' => 'SAFETY']], 200, 'diblokir'],
    'text only' => [['candidates' => [['content' => ['parts' => [['text' => 'secret']]]]]], 200, 'tidak mengembalikan gambar'],
    'invalid base64' => [['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'image/png', 'data' => '!!!']]]]]]], 200, 'data gambar'],
    'invalid image' => [['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'image/png', 'data' => base64_encode('not an image')]]]]]]], 200, 'tidak dapat dibaca'],
    'unsupported format' => [['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'text/html', 'data' => base64_encode('secret')]]]]]]], 200, 'format gambar'],
]);
