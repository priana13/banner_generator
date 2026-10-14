<?php

use App\Models\User;

test('prompts can be saved, listed, replaced and deleted', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $id = $this->postJson(route('api.prompt-presets.store'), [
        'name' => 'Hero NGO', 'prompt' => 'Banner hero sedekah pangan santri', 'primary_color' => '#65b32e', 'style' => 'cutout',
    ])->assertCreated()->json('id');

    // Saving under the same name updates instead of duplicating.
    $this->postJson(route('api.prompt-presets.store'), ['name' => 'Hero NGO', 'prompt' => 'Banner hero versi dua'])
        ->assertOk()
        ->assertJsonPath('id', $id);

    $this->getJson(route('api.prompt-presets.index'))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.prompt', 'Banner hero versi dua');

    $this->deleteJson(route('api.prompt-presets.destroy', $id))->assertNoContent();
    expect($user->promptPresets()->count())->toBe(0);
});

test('saved prompts are private to their owner', function () {
    $owner = User::factory()->create();
    $id = $this->actingAs($owner)
        ->postJson(route('api.prompt-presets.store'), ['name' => 'Rahasia', 'prompt' => 'Banner internal yayasan'])
        ->json('id');

    $this->actingAs(User::factory()->create());

    $this->getJson(route('api.prompt-presets.index'))->assertJsonCount(0, 'data');
    $this->deleteJson(route('api.prompt-presets.destroy', $id))->assertForbidden();
});

test('prompt presets are validated and limited', function () {
    config(['banner.max_prompt_presets' => 1]);
    $this->actingAs(User::factory()->create());

    $this->postJson(route('api.prompt-presets.store'), ['name' => '', 'prompt' => 'x'])->assertJsonValidationErrors(['name', 'prompt']);
    $this->postJson(route('api.prompt-presets.store'), ['name' => 'A', 'prompt' => 'Banner pertama'])->assertCreated();
    $this->postJson(route('api.prompt-presets.store'), ['name' => 'B', 'prompt' => 'Banner kedua'])->assertUnprocessable();
});
