<?php

namespace App\Models;

use App\Enums\ProjectStatus;
use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $category_id
 * @property string $title
 * @property ProjectStatus $status
 * @property int $canvas_width
 * @property int $canvas_height
 * @property int|null $current_revision_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read DesignRevision|null $currentRevision
 * @property-read Collection<int, Asset> $assets
 */
#[Fillable(['category_id', 'title', 'status', 'canvas_width', 'canvas_height', 'current_revision_id'])]
class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'draft',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<DesignRevision, $this>
     */
    public function currentRevision(): BelongsTo
    {
        return $this->belongsTo(DesignRevision::class, 'current_revision_id');
    }

    /**
     * @return HasMany<DesignRevision, $this>
     */
    public function revisions(): HasMany
    {
        return $this->hasMany(DesignRevision::class);
    }

    /**
     * @return HasMany<Asset, $this>
     */
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    /**
     * @return HasMany<GenerationJob, $this>
     */
    public function generationJobs(): HasMany
    {
        return $this->hasMany(GenerationJob::class);
    }

    /** @return BelongsTo<ProjectCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ProjectCategory::class, 'category_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category_id' => 'integer',
            'status' => ProjectStatus::class,
            'canvas_width' => 'integer',
            'canvas_height' => 'integer',
        ];
    }
}
