<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A brief the user saved to reuse in later generations.
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $prompt
 * @property array<string, mixed>|null $settings_json
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'prompt', 'settings_json'])]
class PromptPreset extends Model
{
    /**
     * @return array{id: int, name: string, prompt: string, primary_color: string|null, style: string|null}
     */
    public function toEditorArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'prompt' => $this->prompt,
            'primary_color' => $this->settings_json['primary_color'] ?? null,
            'style' => $this->settings_json['style'] ?? null,
            'design_style' => $this->settings_json['design_style'] ?? null,
        ];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings_json' => 'array',
        ];
    }
}
