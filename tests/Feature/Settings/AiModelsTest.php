<?php

use App\Models\AiSetting;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
});

function saveCatalogSettings(array $overrides = []): void
{
    AiSetting::create(['id' => 1, 'settings' => array_replace([
        'openai_base_url' => 'https://api.deepseek.com',
        'openai_api_key' => 'catalog-secret',
        'gemini_api_key' => 'gemini-secret',
    ], $overrides)]);
}

test('model discovery requires authentication and a supported provider', function () {
    $this->postJson('/settings/ai/models', ['provider' => 'openai'])->assertUnauthorized();
    $this->actingAs(User::factory()->create())->postJson('/settings/ai/models', ['provider' => 'local'])
        ->assertUnprocessable()->assertJsonValidationErrors('provider');
    Http::assertNothingSent();
});

test('model discovery uses saved deepseek credentials and never writes settings', function () {
    saveCatalogSettings();
    $before = AiSetting::find(1)->settings;
    Http::fake(['https://api.deepseek.com/models' => Http::response(['data' => [
        ['id' => 'deepseek-v4-pro', 'name' => 'DeepSeek Pro', 'output_modalities' => ['text']],
        ['id' => 'deepseek-flash', 'name' => 'DeepSeek Flash', 'output_modalities' => ['text']],
        ['id' => 'deepseek-flash'],
    ]])]);
    $response = $this->actingAs(User::factory()->create())->postJson('/settings/ai/models', [
        'provider' => 'openai', 'openai_base_url' => 'https://ignored.test', 'openai_api_key' => 'ignored',
    ])->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(2, 'models')->assertJsonPath('source', 'api.deepseek.com')
        ->assertJsonPath('models.0.id', 'deepseek-flash')->assertJsonPath('models.0.kind', 'layout');
    expect($response->getContent())->not->toContain('catalog-secret')
        ->and(AiSetting::find(1)->settings)->toBe($before);
    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer catalog-secret'));
});

test('gemini discovery reads every page and separates generateContent image candidates from other APIs', function () {
    saveCatalogSettings();
    Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
        ->push(['models' => [
            ['name' => 'models/gemini-text', 'displayName' => 'Gemini Text', 'supportedGenerationMethods' => ['generateContent']],
            ['name' => 'models/embedding-001', 'supportedGenerationMethods' => ['embedContent']],
        ], 'nextPageToken' => 'page-two'])
        ->push(['models' => [
            ['name' => 'models/gemini-flash-image', 'description' => 'An image model', 'supportedGenerationMethods' => ['generateContent']],
            ['name' => 'models/imagen-4', 'supportedGenerationMethods' => ['predict']],
        ]])]);
    $this->actingAs(User::factory()->create())->postJson('/settings/ai/models', ['provider' => 'gemini'])
        ->assertOk()->assertJsonCount(4, 'models')
        ->assertJsonPath('models.0.kind', 'other')->assertJsonPath('models.1.kind', 'image')
        ->assertJsonPath('models.2.kind', 'layout')->assertJsonPath('models.3.kind', 'other');
    Http::assertSentCount(2);
    Http::assertSent(fn ($request) => $request->hasHeader('x-goog-api-key', 'gemini-secret')
        && ($request['pageToken'] ?? null) === 'page-two' && ! str_contains($request->url(), 'gemini-secret'));
});

test('openai catalog distinguishes known image and other models without claiming unknown capabilities', function () {
    saveCatalogSettings(['openai_base_url' => 'https://api.openai.com/v1/']);
    Http::fake(['https://api.openai.com/v1/models' => Http::response(['data' => [
        ['id' => 'gpt-image-1'], ['id' => 'text-embedding-3-small'], ['id' => 'custom-model'],
    ]])]);
    $this->actingAs(User::factory()->create())->postJson('/settings/ai/models', ['provider' => 'openai'])
        ->assertOk()->assertJsonPath('models.0.kind', 'unknown')
        ->assertJsonPath('models.1.kind', 'image')->assertJsonPath('models.2.kind', 'other');
});

test('missing catalog credentials fail before any outgoing request', function () {
    config(['banner.gemini.api_key' => null]);
    $this->actingAs(User::factory()->create())->postJson('/settings/ai/models', ['provider' => 'gemini'])
        ->assertUnprocessable()->assertJsonPath('message', 'API key belum dikonfigurasi. Simpan API key di pengaturan AI Global terlebih dahulu.');
    Http::assertNothingSent();
});

test('catalog errors do not expose provider responses or credentials', function ($status) {
    saveCatalogSettings();
    Http::fake(['*' => Http::response(['error' => ['message' => 'catalog-secret sensitive body']], $status)]);
    $response = $this->actingAs(User::factory()->create())->postJson('/settings/ai/models', ['provider' => 'openai'])
        ->assertUnprocessable()->assertJsonStructure(['message']);
    expect($response->getContent())->not->toContain('catalog-secret')->not->toContain('sensitive body');
})->with([400, 401, 403, 404, 429, 500, 302]);

test('catalog rejects malformed provider responses and safely reports timeouts', function () {
    saveCatalogSettings();
    Http::fake(['*' => Http::response(['unexpected' => 'catalog-secret'])]);
    $this->actingAs(User::factory()->create())->postJson('/settings/ai/models', ['provider' => 'openai'])
        ->assertUnprocessable()->assertJsonPath('message', 'Format daftar model dari layanan AI tidak dapat dibaca. Periksa Base URL layanan Anda.');
    Http::fake(fn () => throw new ConnectionException('catalog-secret'));
    $this->postJson('/settings/ai/models', ['provider' => 'openai'])->assertUnprocessable()
        ->assertJsonPath('message', 'Tidak dapat mengambil daftar model (koneksi atau timeout). Silakan coba lagi.');
});
