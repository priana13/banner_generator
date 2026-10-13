<?php

namespace App\Models;

use App\Enums\GenerationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $project_id
 * @property int $user_id
 * @property string $provider
 * @property string $model
 * @property GenerationStatus $status
 * @property string|null $idempotency_key
 * @property array<string, mixed> $request_json
 * @property array<string, mixed>|null $result_json
 * @property string|null $error_message
 * @property float $cost_estimate
 * @property int $attempts
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Project $project
 */
#[Fillable([
    'user_id', 'provider', 'model', 'status', 'idempotency_key', 'request_json', 'result_json',
    'error_message', 'cost_estimate', 'attempts', 'started_at', 'finished_at',
])]
class GenerationJob extends Model
{
    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return array{id: int, project_id: int, status: string, error_message: string|null, provider: string, attempts: int, finished_at: string|null}
     */
    public function toStatusArray(): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'status' => $this->status->value,
            'error_message' => $this->error_message,
            'provider' => $this->provider,
            'attempts' => $this->attempts,
            'finished_at' => $this->finished_at?->toIso8601String(),
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
            'status' => GenerationStatus::class,
            'request_json' => 'array',
            'result_json' => 'array',
            'cost_estimate' => 'float',
            'attempts' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
