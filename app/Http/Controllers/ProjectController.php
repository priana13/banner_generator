<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\Project;
use App\Models\ProjectCategory;
use App\Support\EditorPayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    /**
     * Show the project dashboard.
     */
    public function index(Request $request): Response
    {
        $filter = $request->validate([
            'category' => ['nullable', 'string', Rule::in([
                'uncategorized', ...$request->user()->projectCategories()->pluck('id')->map(fn ($id) => (string) $id)->all(),
            ])],
        ])['category'] ?? '';
        $categories = $request->user()->projectCategories()->withCount('projects')->orderBy('name')->get();
        $projects = $request->user()->projects()
            ->when($filter === 'uncategorized', fn ($query) => $query->whereNull('category_id'))
            ->when($filter !== '' && $filter !== 'uncategorized', fn ($query) => $query->where('category_id', $filter))
            ->with(['currentRevision', 'assets', 'category'])
            ->latest('updated_at')
            ->get()
            ->map(fn (Project $project): array => [
                'id' => $project->id,
                'title' => $project->title,
                'category_id' => $project->category_id,
                'category_name' => $project->category?->name,
                'status' => $project->status->value,
                'canvas_width' => $project->canvas_width,
                'canvas_height' => $project->canvas_height,
                'updated_at' => $project->updated_at?->toIso8601String(),
                'document' => $project->currentRevision?->document_json,
                'assets' => $project->assets->map(fn (Asset $asset) => $asset->toEditorArray())->all(),
            ]);

        return Inertia::render('dashboard', [
            'projects' => $projects,
            'categories' => $categories->map(fn (ProjectCategory $category) => [
                'id' => $category->id, 'name' => $category->name, 'projects_count' => $category->projects_count,
            ]),
            'categoryFilter' => $filter,
            'projectCounts' => [
                'all' => $request->user()->projects()->count(),
                'uncategorized' => $request->user()->projects()->whereNull('category_id')->count(),
            ],
        ]);
    }

    /**
     * Show the banner editor.
     */
    public function show(Project $project): Response
    {
        Gate::authorize('view', $project);

        return Inertia::render('projects/editor', [
            ...EditorPayload::for($project),
            'categories' => $project->user->projectCategories()->orderBy('name')->get(['id', 'name']),
            'fonts' => config()->array('banner.fonts'),
            'maxPromptLength' => config()->integer('banner.max_prompt_length'),
        ]);
    }
}
