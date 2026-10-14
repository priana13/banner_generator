<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LibraryImage extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function toLibraryArray(): array
    {
        return [
            'id' => $this->id, 'name' => $this->name, 'kind' => $this->kind,
            'url' => route('library-images.show', $this, absolute: false),
            'width' => $this->width, 'height' => $this->height, 'bytes' => $this->bytes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    protected function casts(): array
    {
        return ['width' => 'integer', 'height' => 'integer', 'bytes' => 'integer'];
    }
}
