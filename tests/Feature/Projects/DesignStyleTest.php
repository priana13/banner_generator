<?php

use App\Jobs\GenerateBannerJob;
use App\Models\GenerationJob;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function stylePayload(): array
{
    return [
        'name' => 'Ramadan saya', 'description' => 'Desain hangat untuk donasi Ramadan.',
        'text_instructions' => 'Use warm, concise donation copy.',
        'image_instructions' => 'Use soft gold lantern lighting and a clean subject.',
        'font' => 'Montserrat', 'ornaments' => ['ramadan_lantern', 'ramadan_moon_stars'],
    ];
}

beforeEach(function () {
    Storage::fake('local');
    $this->user = User::factory()->create();
    $this->project = Project::findOrFail($this->actingAs($this->user)->postJson(route('api.projects.store'), [
        'title' => 'Banner', 'canvas_width' => 1200, 'canvas_height' => 400,
    ])->json('project.id'));
    $this->styleBrief = ['prompt' => 'Donasi pangan untuk santri', 'width' => 1200, 'height' => 400, 'primary_color' => '#16a34a', 'style' => 'cutout'];
});

test('design styles include builtins and private custom styles that can be edited', function () {
    $style = $this->postJson(route('api.design-styles.store'), stylePayload())->assertCreated()->json();
    $this->getJson(route('api.design-styles.index'))->assertJsonCount(5, 'data')->assertJsonPath('data.0.key', 'builtin:ramadan');
    $this->postJson(route('api.design-styles.store'), stylePayload())->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->patchJson(route('api.design-styles.update', $style['id']), array_replace(stylePayload(), ['name' => 'Updated']))->assertOk()->assertJsonPath('name', 'Updated');
    $this->actingAs(User::factory()->create())->getJson(route('api.design-styles.index'))->assertJsonCount(4, 'data');
    $this->patchJson(route('api.design-styles.update', $style['id']), stylePayload())->assertForbidden();
    $this->deleteJson(route('api.design-styles.destroy', $style['id']))->assertForbidden();
    $this->postJson(route('api.projects.generate', $this->project), $this->styleBrief)->assertForbidden();
});

test('custom styles allow empty optional guidance', function () {
    $this->postJson(route('api.design-styles.store'), array_replace(stylePayload(), ['text_instructions' => '', 'image_instructions' => '', 'font' => null, 'ornaments' => []]))
        ->assertCreated()->assertJsonPath('text_instructions', '')->assertJsonPath('image_instructions', '');
});

test('style fonts, ornaments, and guidance limits are validated', function ($changes, $field) {
    $this->postJson(route('api.design-styles.store'), array_replace(stylePayload(), $changes))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    'font' => [['font' => 'unknown'], 'font'],
    'ornament' => [['ornaments' => ['unknown']], 'ornaments.0'],
    'duplicate ornament' => [['ornaments' => ['heart', 'heart']], 'ornaments.0'],
    'too many ornaments' => [['ornaments' => ['heart', 'leaf', 'rings', 'arch']], 'ornaments'],
    'guidance' => [['image_instructions' => str_repeat('a', 2001)], 'image_instructions'],
]);

test('selected styles apply fonts and editable ornaments and survive reload', function () {
    $this->postJson(route('api.projects.generate', $this->project), $this->styleBrief + ['design_style' => 'builtin:ramadan'])
        ->assertAccepted()->assertJsonPath('status', 'succeeded');
    $payload = $this->getJson(route('api.projects.show', $this->project))->assertOk()->json();
    $elements = collect($payload['document']['elements']);
    expect($elements->where('type', 'ornament')->pluck('ornamentId')->all())->toBe(['ramadan_lantern', 'ramadan_moon_stars', 'ramadan_pattern'])
        ->and($elements->where('type', 'text')->pluck('fontFamily')->unique()->all())->toBe(['Playfair Display'])
        ->and($payload['brief']['design_style'])->toBe('builtin:ramadan');
});

test('minimal styles remove default decoration', function () {
    $this->postJson(route('api.projects.generate', $this->project), $this->styleBrief + ['design_style' => 'builtin:minimal'])
        ->assertAccepted()->assertJsonPath('status', 'succeeded');
    expect(collect($this->project->refresh()->currentRevision->document_json['elements'])->where('type', 'ornament')->count())->toBe(0);
});

test('queued jobs snapshot styles before edits and deletions', function () {
    Queue::fake();
    $style = $this->postJson(route('api.design-styles.store'), stylePayload())->json();
    $this->postJson(route('api.projects.generate', $this->project), $this->styleBrief + [
        'design_style' => $style['key'], 'design_style_snapshot' => ['name' => 'tampered'],
    ])->assertAccepted();
    $this->patchJson(route('api.design-styles.update', $style['id']), array_replace(stylePayload(), ['text_instructions' => 'Updated guidance']))->assertOk();
    $this->deleteJson(route('api.design-styles.destroy', $style['id']))->assertNoContent();
    $snapshot = GenerationJob::sole()->request_json['design_style_snapshot'];
    expect($snapshot['name'])->toBe('Ramadan saya')->and($snapshot['text_instructions'])->toBe(stylePayload()['text_instructions']);
    $job = new GenerateBannerJob(GenerationJob::sole()->id);
    app()->call([$job, 'handle']);
    expect($this->project->refresh()->currentRevision->document_json['elements'])->not->toBeEmpty();
});

test('users cannot select another users custom style or nonexistent styles', function () {
    $other = User::factory()->create();
    $style = $other->designStyles()->create(stylePayload());
    $this->postJson(route('api.projects.generate', $this->project), $this->styleBrief + ['design_style' => 'custom:'.$style->id])
        ->assertUnprocessable()->assertJsonValidationErrors('design_style');
    $this->postJson(route('api.projects.generate', $this->project), $this->styleBrief + ['design_style' => 'builtin:missing'])
        ->assertUnprocessable()->assertJsonValidationErrors('design_style');
    expect(GenerationJob::count())->toBe(0);
});

test('both Gemini providers receive their own style guidance', function () {
    config(['banner.layout_provider' => 'gemini', 'banner.image_provider' => 'gemini', 'banner.gemini.api_key' => 'secret']);
    $style = $this->postJson(route('api.design-styles.store'), stylePayload())->json();
    $png = UploadedFile::fake()->image('generated.png', 64, 64)->getContent();
    Http::preventStrayRequests();
    Http::fake(['generativelanguage.googleapis.com/*' => function ($request) use ($png) {
        if (isset($request['generationConfig']['responseMimeType'])) {
            return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode([
                'headline' => 'Donasi pangan', 'description' => 'Mari berbagi.', 'cta' => 'Donasi',
                'layout' => 'visual-left', 'imagePrompt' => 'Donation program photo',
                'backgroundColor' => '#ffffff', 'textColor' => '#172554',
            ])]]]]]]);
        }

        return Http::response(['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'image/png', 'data' => base64_encode($png)]]]]]]]);
    }]);
    $this->postJson(route('api.projects.generate', $this->project), array_replace($this->styleBrief, ['style' => 'panel', 'design_style' => $style['key']]))
        ->assertAccepted()->assertJsonPath('status', 'succeeded');
    Http::assertSent(fn ($request) => isset($request['generationConfig']['responseMimeType'])
        && str_contains($request['contents'][0]['parts'][0]['text'], stylePayload()['text_instructions']));
    Http::assertSent(fn ($request) => isset($request['generationConfig']['responseModalities'])
        && str_contains($request['contents'][0]['parts'][0]['text'], stylePayload()['image_instructions'])
        && str_contains($request['contents'][0]['parts'][0]['text'], 'Absolutely no text'));
    $elements = collect($this->project->refresh()->currentRevision->document_json['elements']);
    expect($elements->where('type', 'text')->pluck('fontFamily')->unique()->all())->toBe(['Montserrat']);
    foreach ($elements->where('type', 'ornament') as $element) {
        expect($element['x'])->toBeLessThan(456);
    }
});

test('saved prompts retain the selected design style', function () {
    $this->postJson(route('api.prompt-presets.store'), ['name' => 'Ramadan', 'prompt' => 'Donasi pangan', 'design_style' => 'builtin:ramadan'])
        ->assertCreated()->assertJsonPath('design_style', 'builtin:ramadan');
});
