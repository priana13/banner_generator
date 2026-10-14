<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'description', 'text_instructions', 'image_instructions', 'font', 'ornaments'])]
class DesignStyle extends Model
{
    protected function casts(): array
    {
        return ['ornaments' => 'array'];
    }

    public function toEditorArray(): array
    {
        return [
            'id' => $this->id, 'key' => 'custom:'.$this->id, 'builtin' => false,
            'name' => $this->name, 'description' => $this->description ?? '',
            'text_instructions' => $this->text_instructions,
            'image_instructions' => $this->image_instructions,
            'font' => $this->font, 'ornaments' => $this->ornaments,
        ];
    }
}
