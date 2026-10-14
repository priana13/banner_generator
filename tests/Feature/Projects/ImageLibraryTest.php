<?php

use App\Models\Asset;
use App\Models\LibraryImage;
use App\Models\Project;
use App\Models\User;
use App\Services\Design\AssetStore;
use App\Services\Design\ImageLibrary;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function libraryProject(User $user): Project
{
    $id = test()->actingAs($user)->postJson(route('api.projects.store'), [
        'title' => 'Library project', 'canvas_width' => 1200, 'canvas_height' => 400,
    ])->assertCreated()->json('project.id');

    return Project::findOrFail($id);
}

beforeEach(function () {
    Storage::fake('local');
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('image library requires authentication and lists only the owners images', function () {
    $image = $this->postJson(route('api.library-images.store'), ['file' => UploadedFile::fake()->image('portrait.png', 64, 64)])
        ->assertCreated()->json();
    $this->getJson(route('api.library-images.index'))->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);
    $this->get($image['url'])->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
    $this->actingAs(User::factory()->create());
    $this->getJson(route('api.library-images.index'))->assertJsonCount(0, 'data');
    $this->get($image['url'])->assertForbidden();
    $this->deleteJson(route('api.library-images.destroy', $image['id']))->assertForbidden();
    auth()->logout();
    $this->get('/assets')->assertRedirect('/login');
    $this->getJson(route('api.library-images.index'))->assertUnauthorized();
});

test('image library page can be opened', function () {
    $this->withoutVite();
    $this->get('/assets')->assertOk()->assertInertia(fn ($page) => $page->component('assets/index'));
});

test('project uploads are remembered and identical uploads reuse a private library entry', function () {
    $project = libraryProject($this->user);
    $file = UploadedFile::fake()->image('photo.png', 64, 64);
    $this->postJson(route('api.projects.assets.store', $project), ['file' => $file])->assertCreated();
    $first = LibraryImage::sole();
    $this->postJson(route('api.library-images.store'), ['file' => $file])->assertCreated()->assertJsonPath('id', $first->id);
    expect(LibraryImage::count())->toBe(1);
    $this->actingAs(User::factory()->create())->postJson(route('api.library-images.store'), ['file' => $file])->assertCreated();
    expect(LibraryImage::count())->toBe(2);
});

test('library images can be reused and project copies survive deletion of the library original', function () {
    $project = libraryProject($this->user);
    $image = $this->postJson(route('api.library-images.store'), ['file' => UploadedFile::fake()->image('logo.png', 64, 64)])->assertCreated()->json();
    $asset = $this->postJson(route('api.projects.library-images.use', [$project, $image['id']]), ['kind' => 'logo'])
        ->assertOk()->assertJsonPath('kind', 'logo')->json();
    $this->postJson(route('api.projects.library-images.use', [$project, $image['id']]), ['kind' => 'logo'])
        ->assertJsonPath('id', $asset['id']);
    expect($project->assets()->count())->toBe(1);
    $source = LibraryImage::findOrFail($image['id']);
    $copy = Asset::findOrFail($asset['id']);
    expect($copy->storage_key)->not->toBe($source->storage_key);
    $this->deleteJson(route('api.library-images.destroy', $source))->assertNoContent();
    Storage::disk('local')->assertMissing($source->storage_key);
    $this->get($asset['url'])->assertOk();
    $this->getJson(route('api.projects.show', $project))->assertJsonCount(1, 'assets');
    expect(app(ImageLibrary::class)->syncExisting())->toBe(0);
});

test('library originals survive deletion of the source project', function () {
    $project = libraryProject($this->user);
    $this->postJson(route('api.projects.assets.store', $project), ['file' => UploadedFile::fake()->image('source.png', 64, 64)])->assertCreated();
    $source = LibraryImage::sole();
    $this->deleteJson(route('api.projects.destroy', $project))->assertNoContent();
    $this->get($source->toLibraryArray()['url'])->assertOk();
    expect(LibraryImage::count())->toBe(1);
});

test('existing project uploads are imported exactly once and generated images are excluded', function () {
    $project = libraryProject($this->user);
    $assets = app(AssetStore::class);
    $assets->storeUpload($project, UploadedFile::fake()->image('legacy.png', 64, 64), 'upload');
    $assets->store($project, UploadedFile::fake()->image('ai.png', 48, 48)->getContent(), 'generated');
    expect(app(ImageLibrary::class)->syncExisting())->toBe(1)
        ->and(app(ImageLibrary::class)->syncExisting())->toBe(0)
        ->and(LibraryImage::sole()->name)->toBe('legacy.png');
});

test('foreign library images and foreign projects cannot be used', function () {
    $project = libraryProject($this->user);
    $ownImage = $this->postJson(route('api.library-images.store'), ['file' => UploadedFile::fake()->image('own.png', 64, 64)])->json();
    $other = User::factory()->create();
    $otherProject = libraryProject($other);
    $foreign = $this->postJson(route('api.library-images.store'), ['file' => UploadedFile::fake()->image('foreign.png', 80, 80)])->json();
    $this->actingAs($this->user);
    $this->postJson(route('api.projects.library-images.use', [$project, $foreign['id']]))->assertForbidden();
    $this->postJson(route('api.projects.library-images.use', [$otherProject, $ownImage['id']]))->assertForbidden();
    expect($project->assets()->count())->toBe(0);
});

test('library rejects SVGs and invalid usage kinds', function () {
    $this->postJson(route('api.library-images.store'), ['file' => UploadedFile::fake()->createWithContent('bad.svg', '<svg><script/></svg>')])
        ->assertUnprocessable()->assertJsonValidationErrors('file');
    $project = libraryProject($this->user);
    $image = $this->postJson(route('api.library-images.store'), ['file' => UploadedFile::fake()->image('good.png', 64, 64)])->json();
    $this->postJson(route('api.projects.library-images.use', [$project, $image['id']]), ['kind' => 'generated'])
        ->assertUnprocessable()->assertJsonValidationErrors('kind');
});

test('library searches and paginates images', function () {
    for ($index = 0; $index < 25; $index++) {
        $this->postJson(route('api.library-images.store'), ['file' => UploadedFile::fake()->image("photo-{$index}.png", 32 + $index, 32)])
            ->assertCreated();
    }
    $this->getJson(route('api.library-images.index'))->assertJsonCount(24, 'data')->assertJsonPath('meta.last_page', 2)->assertJsonPath('meta.total', 25);
    $this->getJson(route('api.library-images.index', ['page' => 2]))->assertJsonCount(1, 'data');
    $this->getJson(route('api.library-images.index', ['search' => 'photo-24']))->assertJsonCount(1, 'data');
    $this->getJson(route('api.library-images.index', ['kind' => 'logo']))->assertJsonCount(0, 'data');
});

test('uploaded ornament images are also available in the asset library', function () {
    $this->postJson(route('api.ornaments.store'), ['file' => UploadedFile::fake()->image('lantern.png', 64, 96)])->assertCreated();
    $image = LibraryImage::sole();
    $this->getJson(route('api.library-images.index'))->assertJsonCount(1, 'data');
    $this->deleteJson(route('api.library-images.destroy', $image))->assertNoContent();
    expect(app(ImageLibrary::class)->syncExisting())->toBe(0);
});
