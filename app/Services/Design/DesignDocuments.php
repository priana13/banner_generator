<?php

namespace App\Services\Design;

use App\Models\DesignRevision;
use App\Models\Project;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class DesignDocuments
{
    /**
     * Store a new revision of the project's document.
     *
     * When $expectedVersion is given the write only succeeds if it still is
     * the latest version (optimistic concurrency).
     *
     * @param  array{schemaVersion: int, canvas: array{width: int, height: int, backgroundColor: string}, elements: list<array<string, mixed>>}  $document
     *
     * @throws VersionConflictException
     */
    public function commit(Project $project, array $document, ?int $userId, ?int $expectedVersion = null): DesignRevision
    {
        try {
            return DB::transaction(function () use ($project, $document, $userId, $expectedVersion): DesignRevision {
                $current = (int) $project->revisions()->lockForUpdate()->max('version');

                if ($expectedVersion !== null && $expectedVersion !== $current) {
                    throw new VersionConflictException($current);
                }

                $revision = $project->revisions()->create([
                    'version' => $current + 1,
                    'document_json' => $document,
                    'created_by' => $userId,
                ]);

                $project->update([
                    'current_revision_id' => $revision->id,
                    'canvas_width' => $document['canvas']['width'],
                    'canvas_height' => $document['canvas']['height'],
                ]);

                $project->revisions()
                    ->where('version', '<=', $revision->version - config()->integer('banner.max_revisions'))
                    ->delete();

                return $revision;
            });
        } catch (UniqueConstraintViolationException) {
            // Two writers raced for the same version number.
            throw new VersionConflictException((int) $project->revisions()->max('version'));
        }
    }
}
