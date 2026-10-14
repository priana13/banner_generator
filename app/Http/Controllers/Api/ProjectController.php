<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\SaveDocumentRequest;
use App\Http\Requests\Projects\StoreProjectRequest;
use App\Models\DesignRevision;
use App\Models\Project;
use App\Services\Design\AssetStore;
use App\Services\Design\DesignDocuments;
use App\Services\Design\DocumentNormalizer;
use App\Services\Design\VersionConflictException;
use App\Support\EditorPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    /**
     * Create a project with an empty document.
     */
    public function store(StoreProjectRequest $request, DesignDocuments $documents): JsonResponse
    {
        $data = $request->validated();

        $project = DB::transaction(function () use ($request, $data, $documents): Project {
            $project = $request->user()->projects()->create($data);

            $documents->commit(
                $project,
                DocumentNormalizer::blank((int) $data['canvas_width'], (int) $data['canvas_height']),
                $request->user()->id,
            );

            return $project;
        });

        return response()->json(EditorPayload::for($project), 201);
    }

    /**
     * Get the document and assets of a project.
     */
    public function show(Project $project): JsonResponse
    {
        Gate::authorize('view', $project);

        return response()->json(EditorPayload::for($project));
    }

    /**
     * Rename a project.
     */
    public function update(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('update', $project);

        $project->update($request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'category_id' => ['sometimes', 'nullable', 'integer', Rule::exists('project_categories', 'id')->where('user_id', $request->user()->id)],
        ]));

        return response()->json(['title' => $project->title, 'category_id' => $project->category_id]);
    }

    /**
     * Save the document. The client sends the version it edited; a stale
     * version is rejected instead of silently overwriting newer work.
     */
    public function saveDocument(
        SaveDocumentRequest $request,
        Project $project,
        DesignDocuments $documents,
        DocumentNormalizer $normalizer,
    ): JsonResponse {
        Gate::authorize('update', $project);

        try {
            $revision = $documents->commit(
                $project,
                $normalizer->normalize($request->validated('document')),
                $request->user()->id,
                $request->integer('version'),
            );
        } catch (VersionConflictException $conflict) {
            return response()->json([
                'message' => 'Dokumen telah diubah di tempat lain.',
                'current_version' => $conflict->currentVersion,
            ], 409);
        }

        return response()->json(['version' => $revision->version]);
    }

    /**
     * List the revision history of a project.
     */
    public function revisions(Project $project): JsonResponse
    {
        Gate::authorize('view', $project);

        return response()->json([
            'data' => $project->revisions()
                ->latest('version')
                ->get(['id', 'version', 'created_by', 'created_at'])
                ->map(fn (DesignRevision $revision): array => [
                    'id' => $revision->id,
                    'version' => $revision->version,
                    'created_by' => $revision->created_by,
                    'created_at' => $revision->created_at?->toIso8601String(),
                ]),
        ]);
    }

    /**
     * Delete a project together with its stored files.
     */
    public function destroy(Project $project, AssetStore $assets): JsonResponse
    {
        Gate::authorize('delete', $project);

        $project->delete();
        $assets->disk()->deleteDirectory("projects/{$project->id}");

        return response()->json(status: 204);
    }
}
