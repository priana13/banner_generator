<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('generators have independent authenticated pages', function () {
    $this->get('/generate-prompt')->assertRedirect('/login');
    $this->get('/generate-image')->assertRedirect('/login');
    $this->actingAs(User::factory()->create());
    $this->get('/generate-prompt')->assertOk()->assertInertia(fn (Assert $page) => $page->component('generators/prompt')->has('designStyles'));
    $this->get('/generate-image')->assertOk()->assertInertia(fn (Assert $page) => $page->component('generators/image')->has('maxPromptLength'));
});

test('standalone prompt generation needs no project', function () {
    $this->actingAs(User::factory()->create())->postJson('/api/banner-prompt', [
        'concept' => 'Donasi santri', 'layout' => 'right', 'include_text' => true,
        'composition' => 'cutout', 'width' => 1200, 'height' => 400, 'color' => '#f97316',
    ])->assertUnprocessable()->assertJsonPath('message', 'Pilih penyedia dan model teks AI di pengaturan AI Global untuk membuat prompt dengan AI.');
});
