<?php

use App\Models\Project;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');

    $this->user = User::factory()->create();
    $this->project = Project::findOrFail(
        $this->actingAs($this->user)
            ->postJson(route('api.projects.store'), ['title' => 'Banner', 'canvas_width' => 1200, 'canvas_height' => 400])
            ->json('project.id'),
    );
});

test('the built-in ornament list matches the artwork shipped to the browser', function () {
    preg_match_all('/^    (\w+): \{\s*label: \'[^\']*\',\s*width: (\d+),\s*height: (\d+)/m', file_get_contents(resource_path('js/lib/ornaments.ts')), $matches, PREG_SET_ORDER);

    $shipped = collect($matches)->mapWithKeys(fn ($match) => [$match[1] => [(int) $match[2], (int) $match[3]]])->all();

    expect($shipped)->toEqual(config('banner.ornaments'))
        ->and(count($shipped))->toBeGreaterThanOrEqual(19);
});

test('every built-in ornament can be saved in a document', function () {
    $elements = collect(config('banner.ornaments'))->keys()->map(fn ($id, $index) => [
        'id' => "ornament-{$index}", 'type' => 'ornament', 'ornamentId' => $id, 'fill' => '#16a34a',
        'x' => 0, 'y' => 0, 'width' => 100, 'height' => 100,
    ])->all();

    $this->patchJson(route('api.projects.document', $this->project), [
        'version' => 1,
        'document' => ['schemaVersion' => 1, 'canvas' => ['width' => 1200, 'height' => 400, 'backgroundColor' => '#ffffff'], 'elements' => $elements],
    ])->assertOk();
});

test('a user can upload an ornament, use it in projects and delete it', function () {
    $ornament = $this->postJson(route('api.ornaments.store'), [
        'file' => UploadedFile::fake()->image('daun-emas.png', 300, 200),
    ])->assertCreated()->assertJsonPath('name', 'daun-emas')->assertJsonPath('width', 300)->json();

    $this->getJson(route('api.ornaments.index'))->assertJsonCount(1, 'data');
    $this->get($ornament['url'])->assertOk()->assertHeader('Content-Type', 'image/png');

    // Using it copies it into the project once, however often it is added.
    $asset = $this->postJson(route('api.projects.ornaments.use', [$this->project, $ornament['id']]))
        ->assertOk()->assertJsonPath('kind', 'ornament')->json();
    $this->postJson(route('api.projects.ornaments.use', [$this->project, $ornament['id']]))
        ->assertJsonPath('id', $asset['id']);

    expect($this->project->assets()->count())->toBe(1);

    $this->patchJson(route('api.projects.document', $this->project), [
        'version' => 1,
        'document' => [
            'schemaVersion' => 1,
            'canvas' => ['width' => 1200, 'height' => 400, 'backgroundColor' => '#ffffff'],
            'elements' => [[
                'id' => 'o-1', 'type' => 'image', 'assetId' => $asset['id'], 'x' => 0, 'y' => 0, 'width' => 300, 'height' => 200,
            ]],
        ],
    ])->assertOk();

    // Deleting from the library leaves the design's own copy intact.
    $this->deleteJson(route('api.ornaments.destroy', $ornament['id']))->assertNoContent();
    $this->getJson(route('api.ornaments.index'))->assertJsonCount(0, 'data');
    $this->get($asset['url'])->assertOk();
});

test('svg and oversized ornament libraries are rejected', function () {
    $this->postJson(route('api.ornaments.store'), [
        'file' => UploadedFile::fake()->createWithContent('ornamen.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    ])->assertJsonValidationErrors('file');

    config(['banner.max_user_ornaments' => 1]);

    $this->postJson(route('api.ornaments.store'), ['file' => UploadedFile::fake()->image('a.png')])->assertCreated();
    $this->postJson(route('api.ornaments.store'), ['file' => UploadedFile::fake()->image('b.png')])->assertUnprocessable();
});

test('ornaments are private to their owner', function () {
    $ornament = $this->postJson(route('api.ornaments.store'), ['file' => UploadedFile::fake()->image('a.png')])->json();

    $other = User::factory()->create();
    $otherProject = Project::findOrFail(
        $this->actingAs($other)
            ->postJson(route('api.projects.store'), ['title' => 'Lain', 'canvas_width' => 1200, 'canvas_height' => 400])
            ->json('project.id'),
    );

    $this->getJson(route('api.ornaments.index'))->assertJsonCount(0, 'data');
    $this->get($ornament['url'])->assertForbidden();
    $this->postJson(route('api.projects.ornaments.use', [$otherProject, $ornament['id']]))->assertForbidden();
    $this->postJson(route('api.projects.ornaments.use', [$this->project, $ornament['id']]))->assertForbidden();
    $this->deleteJson(route('api.ornaments.destroy', $ornament['id']))->assertForbidden();
});
