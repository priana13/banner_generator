<?php

use App\Enums\GenerationStatus;
use App\Enums\ProjectStatus;
use App\Jobs\GenerateBannerJob;
use App\Models\GenerationJob;
use App\Models\Project;
use App\Models\User;
use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\LayoutProvider;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\LayoutResult;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');

    $this->user = User::factory()->create();
    $this->project = Project::findOrFail(
        $this->actingAs($this->user)
            ->postJson(route('api.projects.store'), ['title' => 'Banner', 'canvas_width' => 1200, 'canvas_height' => 400])
            ->json('project.id'),
    );
    $this->brief = [
        'prompt' => 'Banner website program Tebar Pangan untuk Santri, tombol Donasi Sekarang.',
        'primary_color' => '#f97316',
        'width' => 1200,
        'height' => 400,
    ];
});

function fakeLayout(Closure $generate): void
{
    app()->bind(LayoutProvider::class, fn () => new class($generate) implements LayoutProvider
    {
        public function __construct(private Closure $generate) {}

        public function name(): string
        {
            return 'fake';
        }

        public function model(): string
        {
            return 'fake-1';
        }

        public function generate(DesignBrief $brief): LayoutResult
        {
            return ($this->generate)($brief);
        }
    });
}

test('generating composes a layered document from the prompt', function () {
    $this->postJson(route('api.projects.generate', $this->project), $this->brief)
        ->assertAccepted()
        ->assertJsonPath('status', 'succeeded');

    $payload = $this->getJson(route('api.projects.show', $this->project))->assertOk()->json();
    $elements = collect($payload['document']['elements']);

    expect($payload['version'])->toBe(2)
        ->and($payload['project']['status'])->toBe('ready')
        ->and($elements->firstWhere('name', 'Judul utama')['type'])->toBe('text')
        ->and($elements->firstWhere('name', 'Tombol CTA')['text'])->toBe('Donasi Sekarang')
        ->and($elements->firstWhere('name', 'Visual AI')['type'])->toBe('image')
        ->and($elements->pluck('id')->unique()->count())->toBe($elements->count());

    // The AI image is a stored asset referenced by id, never a provider URL.
    $visual = $elements->firstWhere('name', 'Visual AI');
    $asset = collect($payload['assets'])->firstWhere('id', $visual['assetId']);

    expect($asset['kind'])->toBe('generated')
        ->and($asset['width'])->toBe((int) $visual['width'])
        ->and($asset['height'])->toBe(400);

    $this->get($asset['url'])->assertOk();
});

test('uploaded photo and logo become separate layers', function () {
    $upload = fn (string $kind) => $this->postJson(route('api.projects.assets.store', $this->project), [
        'file' => UploadedFile::fake()->image("{$kind}.png", 400, 300),
        'kind' => $kind,
    ])->json('id');

    $photo = $upload('upload');
    $logo = $upload('logo');

    $this->postJson(route('api.projects.generate', $this->project), [
        ...$this->brief, 'photo_asset_id' => $photo, 'logo_asset_id' => $logo,
    ])->assertAccepted();

    $elements = collect($this->project->refresh()->currentRevision->document_json['elements']);

    expect($elements->firstWhere('name', 'Foto')['assetId'])->toBe($photo)
        ->and($elements->firstWhere('name', 'Logo')['assetId'])->toBe($logo)
        ->and($elements->firstWhere('name', 'Latar AI')['locked'])->toBeTrue();
});

test('copy always fits inside the canvas', function (int $width, int $height) {
    fakeLayout(fn () => new LayoutResult([
        'label' => 'Program berbagi kebaikan untuk seluruh santri',
        'headline' => 'Tebar Pangan Bergizi untuk Para Santri Penghafal Al-Quran di Seluruh Nusantara',
        'description' => str_repeat('Bersama hadirkan pangan bergizi. ', 5),
        'cta' => 'Donasi Sekarang Juga',
    ]));

    $this->postJson(route('api.projects.generate', $this->project), [...$this->brief, 'width' => $width, 'height' => $height])
        ->assertAccepted()
        ->assertJsonPath('status', 'succeeded');

    $document = $this->project->refresh()->currentRevision->document_json;

    foreach ($document['elements'] as $element) {
        expect($element['x'])->toBeGreaterThanOrEqual(0)
            ->and($element['y'])->toBeGreaterThanOrEqual(0)
            ->and($element['x'] + $element['width'])->toBeLessThanOrEqual($width)
            ->and($element['y'] + $element['height'])->toBeLessThanOrEqual($height);
    }
})->with([[1200, 400], [1920, 600], [1080, 1080], [1080, 1350], [728, 90]]);

test('untrusted ai output is validated before it is used', function () {
    fakeLayout(fn () => new LayoutResult([
        'headline' => '<script>alert(1)</script>Judul <b>Aman</b>',
        'cta' => "Donasi\nSekarang",
        'layout' => 'absolute; top: 0',
        'backgroundColor' => 'javascript:alert(1)',
        'textColor' => '#ffffff',
    ]));

    $this->postJson(route('api.projects.generate', $this->project), $this->brief)->assertAccepted();

    $document = $this->project->refresh()->currentRevision->document_json;
    $headline = collect($document['elements'])->firstWhere('name', 'Judul utama');

    expect($headline['text'])->toBe('alert(1)Judul Aman')
        ->and($document['canvas']['backgroundColor'])->toMatch('/^#[0-9a-f]{6}$/')
        ->and($headline['fill'])->toBe('#172554');
});

test('a failed job reports its error and can be retried without duplicating anything', function () {
    $healthy = false;

    fakeLayout(function () use (&$healthy) {
        if (! $healthy) {
            throw new AiProviderException('Penyedia AI sedang membatasi permintaan.');
        }

        return new LayoutResult(['headline' => 'Berhasil', 'cta' => 'Donasi']);
    });

    // The sync queue rethrows after marking the job as failed.
    $this->postJson(route('api.projects.generate', $this->project), $this->brief)->assertServerError();

    $job = GenerationJob::sole();

    $this->getJson(route('api.generation-jobs.show', $job))
        ->assertOk()
        ->assertJsonPath('status', 'failed')
        ->assertJsonPath('error_message', 'Penyedia AI sedang membatasi permintaan.');

    expect($this->project->refresh()->status)->toBe(ProjectStatus::Failed)
        ->and($this->project->revisions()->count())->toBe(1);

    $healthy = true;

    $this->postJson(route('api.generation-jobs.retry', $job))
        ->assertAccepted()
        ->assertJsonPath('id', $job->id)
        ->assertJsonPath('status', 'succeeded');

    expect(GenerationJob::count())->toBe(1)
        ->and(Project::count())->toBe(1)
        ->and($this->project->refresh()->status)->toBe(ProjectStatus::Ready)
        ->and($this->project->revisions()->count())->toBe(2);
});

test('unexpected errors are not leaked to the user', function () {
    fakeLayout(fn () => throw new RuntimeException('SQLSTATE secret detail'));

    $this->postJson(route('api.projects.generate', $this->project), $this->brief)->assertServerError();

    expect(GenerationJob::sole()->error_message)->not->toContain('SQLSTATE');
});

test('repeated generate requests return the job that is already in progress', function () {
    Queue::fake();

    $first = $this->postJson(route('api.projects.generate', $this->project), [...$this->brief, 'idempotency_key' => 'abc'])
        ->assertAccepted()
        ->assertJsonPath('status', 'queued')
        ->json('id');

    $this->postJson(route('api.projects.generate', $this->project), [...$this->brief, 'idempotency_key' => 'abc'])
        ->assertOk()
        ->assertJsonPath('id', $first);

    $this->postJson(route('api.projects.generate', $this->project), $this->brief)
        ->assertOk()
        ->assertJsonPath('id', $first);

    expect(GenerationJob::count())->toBe(1);
    Queue::assertPushed(GenerateBannerJob::class, 1);
});

test('the daily generation quota is enforced', function () {
    config(['banner.daily_generation_quota' => 1]);

    $this->postJson(route('api.projects.generate', $this->project), $this->brief)->assertAccepted();
    $this->postJson(route('api.projects.generate', $this->project), $this->brief)->assertTooManyRequests();
});

test('other users cannot read or retry a generation job', function () {
    $this->postJson(route('api.projects.generate', $this->project), $this->brief)->assertAccepted();
    $job = GenerationJob::sole();

    $this->actingAs(User::factory()->create());

    $this->getJson(route('api.generation-jobs.show', $job))->assertForbidden();
    $this->postJson(route('api.generation-jobs.retry', $job))->assertForbidden();
});

test('the openai adapters produce a document without exposing the api key', function () {
    config([
        'banner.layout_provider' => 'openai',
        'banner.image_provider' => 'openai',
        'banner.openai.api_key' => 'sk-test',
    ]);

    $png = UploadedFile::fake()->image('ai.png', 1536, 1024)->getContent();

    Http::preventStrayRequests();
    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => json_encode([
                'label' => 'Program Kebaikan', 'headline' => 'Tebar Pangan untuk Santri',
                'description' => 'Bersama hadirkan pangan bergizi.', 'cta' => 'Donasi Sekarang',
                'layout' => 'visual-left', 'backgroundColor' => '#FFF7ED', 'textColor' => '#172554',
                'imagePrompt' => 'Students sharing a meal',
            ])]]],
            'usage' => ['prompt_tokens' => 1000, 'completion_tokens' => 1000],
        ]),
        '*/images/generations' => Http::response(['data' => [['b64_json' => base64_encode($png)]]]),
    ]);

    $this->postJson(route('api.projects.generate', $this->project), $this->brief)
        ->assertAccepted()
        ->assertJsonPath('status', 'succeeded')
        ->assertJsonPath('provider', 'openai');

    $job = GenerationJob::sole();
    $document = $this->project->refresh()->currentRevision->document_json;
    $visual = collect($document['elements'])->firstWhere('name', 'Visual AI');

    expect($job->status)->toBe(GenerationStatus::Succeeded)
        ->and($job->cost_estimate)->toBeGreaterThan(0.04)
        ->and($document['canvas']['backgroundColor'])->toBe('#fff7ed')
        ->and($visual['x'])->toBe(0)
        ->and($visual['width'])->toBe(456);

    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer sk-test'));
});

test('a missing api key fails the job with a clear message', function () {
    config(['banner.layout_provider' => 'openai', 'banner.openai.api_key' => null]);

    $this->postJson(route('api.projects.generate', $this->project), $this->brief)->assertServerError();

    expect(GenerationJob::sole()->error_message)->toContain('OPENAI_API_KEY');
});

test('openai-compatible routers without structured output still work', function () {
    config([
        'banner.layout_provider' => 'openai',
        'banner.openai.api_key' => 'sk-router',
        'banner.openai.base_url' => 'https://router.test/v1/',
        'banner.openai.layout_model' => 'cc/some-model',
    ]);

    Http::preventStrayRequests();
    Http::fake([
        'https://router.test/v1/chat/completions' => Http::sequence()
            ->push(['error' => ['message' => 'response_format is not supported']], 400)
            ->push(['choices' => [['message' => [
                'content' => "Berikut hasilnya:\n```json\n{\"headline\": \"Tebar Pangan\", \"cta\": \"Donasi\", \"layout\": \"visual-left\"}\n```",
            ]]]]),
    ]);

    $this->postJson(route('api.projects.generate', $this->project), $this->brief)
        ->assertAccepted()
        ->assertJsonPath('status', 'succeeded');

    $elements = collect($this->project->refresh()->currentRevision->document_json['elements']);

    expect($elements->firstWhere('name', 'Judul utama')['text'])->toBe('Tebar Pangan')
        ->and($elements->firstWhere('name', 'Visual AI')['x'])->toBe(0);

    Http::assertSentCount(2);
    Http::assertSent(fn ($request) => $request['model'] === 'cc/some-model' && ! isset($request['response_format']));
});
