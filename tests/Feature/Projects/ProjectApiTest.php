<?php

use App\Models\Project;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
});

function createProject(User $user, int $width = 1200, int $height = 400): Project
{
    $id = test()->actingAs($user)
        ->postJson(route('api.projects.store'), [
            'title' => 'Tebar Pangan',
            'canvas_width' => $width,
            'canvas_height' => $height,
        ])
        ->assertCreated()
        ->json('project.id');

    return Project::findOrFail($id);
}

/**
 * @return array<string, mixed>
 */
function sampleDocument(array $elements = []): array
{
    return [
        'schemaVersion' => 1,
        'canvas' => ['width' => 1200, 'height' => 400, 'backgroundColor' => '#FFFFFF'],
        'elements' => $elements ?: [[
            'id' => 'title-1', 'type' => 'text', 'name' => 'Judul', 'text' => 'Tebar Pangan untuk Santri',
            'x' => 64, 'y' => 78, 'width' => 560, 'height' => 120,
            'fontFamily' => 'Inter', 'fontSize' => 46, 'fill' => '#1F2937', 'rotation' => 0,
        ]],
    ];
}

test('guests cannot use the project api', function () {
    $this->postJson(route('api.projects.store'), [])->assertUnauthorized();
});

test('a project is created with an empty first revision', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('api.projects.store'), ['title' => 'Promo', 'canvas_width' => 1200, 'canvas_height' => 400])
        ->assertCreated()
        ->assertJsonPath('version', 1)
        ->assertJsonPath('document.canvas.width', 1200)
        ->assertJsonPath('document.elements', []);

    expect($user->projects()->count())->toBe(1);
});

test('canvas size is validated', function () {
    $this->actingAs(User::factory()->create())
        ->postJson(route('api.projects.store'), ['title' => 'Promo', 'canvas_width' => 20, 'canvas_height' => 90000])
        ->assertJsonValidationErrors(['canvas_width', 'canvas_height']);
});

test('the dashboard lists only the projects of the current user', function () {
    $user = User::factory()->create();
    createProject($user);
    createProject(User::factory()->create());

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('dashboard')->has('projects', 1));
});

test('a saved document is returned unchanged after reload', function () {
    $user = User::factory()->create();
    $project = createProject($user);

    $this->patchJson(route('api.projects.document', $project), ['version' => 1, 'document' => sampleDocument()])
        ->assertOk()
        ->assertJsonPath('version', 2);

    $this->getJson(route('api.projects.show', $project))
        ->assertOk()
        ->assertJsonPath('version', 2)
        ->assertJsonPath('document.elements.0.id', 'title-1')
        ->assertJsonPath('document.elements.0.text', 'Tebar Pangan untuk Santri')
        ->assertJsonPath('document.elements.0.fontSize', 46)
        ->assertJsonPath('document.elements.0.visible', true);

    $this->get(route('projects.show', $project))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('projects/editor')->where('version', 2));
});

test('saving with a stale version is rejected', function () {
    $user = User::factory()->create();
    $project = createProject($user);

    $this->patchJson(route('api.projects.document', $project), ['version' => 1, 'document' => sampleDocument()])->assertOk();

    $this->patchJson(route('api.projects.document', $project), ['version' => 1, 'document' => sampleDocument()])
        ->assertConflict()
        ->assertJsonPath('current_version', 2);

    expect($project->revisions()->count())->toBe(2);
});

test('invalid documents are rejected', function (array $element) {
    $user = User::factory()->create();
    $project = createProject($user);

    $this->patchJson(route('api.projects.document', $project), [
        'version' => 1,
        'document' => sampleDocument([$element + [
            'id' => 'el-1', 'type' => 'rect', 'x' => 0, 'y' => 0, 'width' => 10, 'height' => 10,
        ]]),
    ])->assertUnprocessable();

    expect($project->revisions()->count())->toBe(1);
})->with([
    'unknown type' => [['type' => 'script']],
    'bad color' => [['fill' => 'url(javascript:alert(1))']],
    'unknown font' => [['type' => 'text', 'fontFamily' => 'Comic Sans']],
    'absurd size' => [['width' => 9_000_000]],
    'image without asset' => [['type' => 'image']],
    'asset of another project' => [['type' => 'image', 'assetId' => '00000000-0000-4000-8000-000000000000']],
]);

test('unknown properties are stripped from a saved document', function () {
    $user = User::factory()->create();
    $project = createProject($user);

    $this->patchJson(route('api.projects.document', $project), [
        'version' => 1,
        'document' => sampleDocument([[
            'id' => 'el-1', 'type' => 'rect', 'x' => 0, 'y' => 0, 'width' => 10, 'height' => 10,
            'fill' => '#FF0000', 'onClick' => 'alert(1)',
        ]]),
    ])->assertOk();

    $element = $project->refresh()->currentRevision->document_json['elements'][0];

    expect($element)->not->toHaveKey('onClick')
        ->and($element['fill'])->toBe('#ff0000');
});

test('revision history is listed and capped', function () {
    config(['banner.max_revisions' => 3]);

    $user = User::factory()->create();
    $project = createProject($user);

    foreach (range(1, 5) as $version) {
        $this->patchJson(route('api.projects.document', $project), ['version' => $version, 'document' => sampleDocument()])->assertOk();
    }

    $this->getJson(route('api.projects.revisions', $project))
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.version', 6);
});

test('images can be uploaded and are served only to their owner', function () {
    $user = User::factory()->create();
    $project = createProject($user);

    $asset = $this->postJson(route('api.projects.assets.store', $project), [
        'file' => UploadedFile::fake()->image('santri.jpg', 640, 480),
        'kind' => 'upload',
    ])->assertCreated()->assertJsonPath('width', 640)->assertJsonPath('height', 480)->json();

    $this->get($asset['url'])->assertOk()->assertHeader('Content-Type', 'image/jpeg');

    $this->actingAs(User::factory()->create())->get($asset['url'])->assertForbidden();
});

test('svg and non-image uploads are rejected', function (UploadedFile $file) {
    $user = User::factory()->create();
    $project = createProject($user);

    $this->postJson(route('api.projects.assets.store', $project), ['file' => $file])
        ->assertJsonValidationErrors('file');
})->with([
    'svg' => [fn () => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    'disguised script' => [fn () => UploadedFile::fake()->createWithContent('photo.png', '<?php echo 1;')],
]);

test('users cannot access projects of other users', function () {
    $project = createProject(User::factory()->create());

    $this->actingAs(User::factory()->create());

    $this->get(route('projects.show', $project))->assertForbidden();
    $this->getJson(route('api.projects.show', $project))->assertForbidden();
    $this->patchJson(route('api.projects.update', $project), ['title' => 'Hacked'])->assertForbidden();
    $this->patchJson(route('api.projects.document', $project), ['version' => 1, 'document' => sampleDocument()])->assertForbidden();
    $this->getJson(route('api.projects.revisions', $project))->assertForbidden();
    $this->postJson(route('api.projects.assets.store', $project), ['file' => UploadedFile::fake()->image('a.png')])->assertForbidden();
    $this->postJson(route('api.projects.generate', $project), [
        'prompt' => 'Banner donasi', 'primary_color' => '#f97316', 'width' => 1200, 'height' => 400,
    ])->assertForbidden();
    $this->deleteJson(route('api.projects.destroy', $project))->assertForbidden();

    expect($project->refresh()->title)->toBe('Tebar Pangan');
});

test('a project can be renamed and deleted', function () {
    $user = User::factory()->create();
    $project = createProject($user);

    $this->patchJson(route('api.projects.update', $project), ['title' => 'Judul Baru'])->assertOk();
    expect($project->refresh()->title)->toBe('Judul Baru');

    $this->deleteJson(route('api.projects.destroy', $project))->assertNoContent();
    expect(Project::count())->toBe(0);
});

test('the rendered canvas can be exported as webp and jpeg', function (string $format, string $mime) {
    $user = User::factory()->create();
    $project = createProject($user);

    $response = $this->post(route('api.projects.export', $project), [
        'format' => $format,
        'image' => UploadedFile::fake()->image('canvas.png', 1200, 400),
    ])->assertOk()->assertHeader('Content-Type', $mime);

    $info = getimagesizefromstring($response->getContent());

    expect($info['mime'])->toBe($mime)
        ->and($info[0])->toBe(1200)
        ->and($info[1])->toBe(400);
})->with([['webp', 'image/webp'], ['jpeg', 'image/jpeg']]);
