<?php

namespace App\Support;

use App\Models\Asset;
use App\Models\Project;
use App\Services\Design\DocumentNormalizer;

final class EditorPayload
{
    /**
     * Everything the editor needs to open a project: the latest document,
     * its version, the project's assets and the most recent generation job.
     *
     * @return array<string, mixed>
     */
    public static function for(Project $project): array
    {
        $revision = $project->currentRevision()->first();
        $job = $project->generationJobs()->latest('id')->first();

        return [
            'project' => [
                'id' => $project->id,
                'title' => $project->title,
                'status' => $project->status->value,
            ],
            'document' => $revision->document_json
                ?? DocumentNormalizer::blank($project->canvas_width, $project->canvas_height),
            'version' => $revision->version ?? 0,
            'assets' => $project->assets()->get()->map(fn (Asset $asset) => $asset->toEditorArray())->all(),
            'job' => $job?->toStatusArray(),
        ];
    }
}
