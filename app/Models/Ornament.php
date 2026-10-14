<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A decorative image in a user's personal library. Using one in a project
 * copies it into that project's assets, so the library and the designs
 * can change independently.
 *
 * @property string $id
 * @property int $user_id
 * @property string $name
 * @property string $storage_key
 * @property string $mime_type
 * @property int $width
 * @property int $height
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'storage_key', 'mime_type', 'width', 'height'])]
class Ornament extends Model
{
    use HasUuids;

    /**
     * @return array{id: string, name: string, url: string, width: int, height: int}
     */
    public function toEditorArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'url' => route('ornaments.show', $this, absolute: false),
            'width' => $this->width,
            'height' => $this->height,
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
            'width' => 'integer',
            'height' => 'integer',
        ];
    }
}
