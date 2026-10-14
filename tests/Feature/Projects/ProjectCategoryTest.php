<?php

use App\Models\Project;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function categorizedProject(User $user, ?int $categoryId = null): Project
{
    $id = test()->actingAs($user)->postJson(route('api.projects.store'), [
        'title' => 'Banner kategori', 'canvas_width' => 1200, 'canvas_height' => 400,
        'category_id' => $categoryId,
    ])->assertCreated()->json('project.id');

    return Project::findOrFail($id);
}

test('categories can be created and renamed with unique names per user', function () {
    $user = User::factory()->create();
    $response = $this->actingAs($user)->postJson(route('api.project-categories.store'), ['name' => 'Donasi'])->assertCreated();
    $id = $response->json('id');
    $this->postJson(route('api.project-categories.store'), ['name' => 'Donasi'])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->patchJson(route('api.project-categories.update', $id), ['name' => 'Donasi'])->assertOk();
    $this->patchJson(route('api.project-categories.update', $id), ['name' => 'Ramadan'])->assertOk()->assertJsonPath('name', 'Ramadan');
    $this->actingAs(User::factory()->create())->postJson(route('api.project-categories.store'), ['name' => 'Ramadan'])->assertCreated();
});

test('category names cannot be blank or excessively long', function ($name) {
    $this->actingAs(User::factory()->create())->postJson(route('api.project-categories.store'), ['name' => $name])
        ->assertUnprocessable()->assertJsonValidationErrors('name');
})->with(['', '   ', str_repeat('a', 81)]);

test('users cannot change or assign categories belonging to another user', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $category = $other->projectCategories()->create(['name' => 'Private']);
    $project = categorizedProject($owner);
    $this->patchJson(route('api.project-categories.update', $category), ['name' => 'Changed'])->assertForbidden();
    $this->deleteJson(route('api.project-categories.destroy', $category))->assertForbidden();
    $this->patchJson(route('api.projects.update', $project), ['category_id' => $category->id])->assertUnprocessable()->assertJsonValidationErrors('category_id');
    $this->postJson(route('api.projects.store'), ['title' => 'Invalid', 'canvas_width' => 1200, 'canvas_height' => 400, 'category_id' => $category->id])->assertUnprocessable();
    $this->getJson(route('dashboard', ['category' => $category->id]))->assertUnprocessable();
    expect($project->refresh()->category_id)->toBeNull();
});

test('project categories survive reload and can be changed or cleared without changing the design', function () {
    $user = User::factory()->create();
    $first = $user->projectCategories()->create(['name' => 'Donasi']);
    $second = $user->projectCategories()->create(['name' => 'Promosi']);
    $project = categorizedProject($user, $first->id);
    $revision = $project->current_revision_id;
    $this->getJson(route('api.projects.show', $project))->assertJsonPath('project.category_id', $first->id);
    $this->patchJson(route('api.projects.update', $project), ['title' => 'Renamed'])->assertOk();
    expect($project->refresh()->category_id)->toBe($first->id);
    $this->patchJson(route('api.projects.update', $project), ['category_id' => $second->id])->assertOk()->assertJsonPath('category_id', $second->id);
    $this->patchJson(route('api.projects.update', $project), ['category_id' => null])->assertOk()->assertJsonPath('category_id', null);
    expect($project->refresh()->title)->toBe('Renamed')->and($project->current_revision_id)->toBe($revision);
});

test('dashboard category filters and counts only include the users own projects', function () {
    $this->withoutVite();
    $user = User::factory()->create();
    $category = $user->projectCategories()->create(['name' => 'Donasi']);
    $other = User::factory()->create();
    $otherCategory = $other->projectCategories()->create(['name' => 'Hidden']);
    categorizedProject($other, $otherCategory->id);
    $categorized = categorizedProject($user, $category->id);
    $uncategorized = categorizedProject($user);
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->has('projects', 2)->has('categories', 1)->where('categories.0.name', 'Donasi')
        ->where('categories.0.projects_count', 1)->where('projectCounts.all', 2)->where('projectCounts.uncategorized', 1));
    $this->get(route('dashboard', ['category' => $category->id]))->assertInertia(fn (Assert $page) => $page
        ->has('projects', 1)->where('projects.0.id', $categorized->id)->where('categoryFilter', (string) $category->id));
    $this->get(route('dashboard', ['category' => 'uncategorized']))->assertInertia(fn (Assert $page) => $page
        ->has('projects', 1)->where('projects.0.id', $uncategorized->id));
    $this->get(route('projects.show', $categorized))->assertInertia(fn (Assert $page) => $page
        ->where('project.category_id', $category->id)->has('categories', 1)->where('categories.0.id', $category->id));
});

test('deleting a category preserves projects and moves them to uncategorized', function () {
    $user = User::factory()->create();
    $category = $user->projectCategories()->create(['name' => 'Donasi']);
    $project = categorizedProject($user, $category->id);
    $revision = $project->current_revision_id;
    $this->deleteJson(route('api.project-categories.destroy', $category))->assertNoContent();
    expect($project->refresh()->category_id)->toBeNull()->and($project->current_revision_id)->toBe($revision);
    $this->getJson(route('api.projects.show', $project))->assertOk();
});

test('category endpoints require authentication and reject nonexistent category IDs', function () {
    $this->postJson(route('api.project-categories.store'), ['name' => 'Test'])->assertUnauthorized();
    $user = User::factory()->create();
    $project = categorizedProject($user);
    $this->patchJson(route('api.projects.update', $project), ['category_id' => 999])->assertUnprocessable()->assertJsonValidationErrors('category_id');
});
