<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property int $user_id
 * @property int $project_id
 * @property string $kind
 * @property string $storage_key
 * @property string $mime_type
 * @property int $width
 * @property int $height
 * @property array<string, mixed>|null $metadata_json
 * @property Carbon|null $created_at
 */
#[Fillable(['user_id', 'kind', 'storage_key', 'mime_type', 'width', 'height', 'metadata_json'])]
class Asset extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    public const KIND_UPLOAD = 'upload';

    public const KIND_LOGO = 'logo';

    /** A photo whose background was removed (transparent PNG). */
    public const KIND_CUTOUT = 'cutout';

    public const KIND_GENERATED = 'generated';

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * The representation sent to the editor. Assets are private, so the URL
     * always points at the authorized same-origin route (never a provider URL).
     *
     * @return array{id: string, kind: string, url: string, width: int, height: int, name: string|null}
     */
    public function toEditorArray(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'url' => route('assets.show', $this, absolute: false),
            'width' => $this->width,
            'height' => $this->height,
            'name' => $this->metadata_json['original_name'] ?? null,
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
            'metadata_json' => 'array',
        ];
    }
}
