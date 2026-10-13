<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\Project;
use App\Support\EditorPayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    /**
     * Show the project dashboard.
     */
    public function index(Request $request): Response
    {
        $projects = $request->user()->projects()
            ->with(['currentRevision', 'assets'])
            ->latest('updated_at')
            ->get()
            ->map(fn (Project $project): array => [
                'id' => $project->id,
                'title' => $project->title,
                'status' => $project->status->value,
                'canvas_width' => $project->canvas_width,
                'canvas_height' => $project->canvas_height,
                'updated_at' => $project->updated_at?->toIso8601String(),
                'document' => $project->currentRevision?->document_json,
                'assets' => $project->assets->map(fn (Asset $asset) => $asset->toEditorArray())->all(),
            ]);

        return Inertia::render('dashboard', ['projects' => $projects]);
    }

    /**
     * Show the banner editor.
     */
    public function show(Project $project): Response
    {
        Gate::authorize('view', $project);

        return Inertia::render('projects/editor', [
            ...EditorPayload::for($project),
            'fonts' => config()->array('banner.fonts'),
        ]);
    }
}
