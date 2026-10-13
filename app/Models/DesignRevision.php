<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $project_id
 * @property int $version
 * @property array<string, mixed> $document_json
 * @property int|null $created_by
 * @property Carbon|null $created_at
 */
#[Fillable(['version', 'document_json', 'created_by'])]
class DesignRevision extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'document_json' => 'array',
        ];
    }
}
