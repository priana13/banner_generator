<?php

namespace App\Http\Controllers\Api;

use App\Enums\GenerationStatus;
use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\GenerateBannerRequest;
use App\Jobs\GenerateBannerJob;
use App\Models\GenerationJob;
use App\Models\Project;
use App\Services\Ai\Contracts\LayoutProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class GenerationController extends Controller
{
    /**
     * Queue a banner generation for the project.
     */
    public function store(GenerateBannerRequest $request, Project $project, LayoutProvider $layouts): JsonResponse
    {
        Gate::authorize('update', $project);

        $data = $request->validated();
        $key = $data['idempotency_key'] ?? null;

        // A repeated request (double click, client retry) or a project that
        // is already generating gets the existing job back, not a new one.
        $existing = $project->generationJobs()
            ->where(fn ($query) => $query
                ->whereIn('status', [GenerationStatus::Queued, GenerationStatus::Running])
                ->when($key, fn ($query) => $query->orWhere('idempotency_key', $key)))
            ->latest('id')
            ->first();

        if ($existing !== null) {
            return response()->json($existing->toStatusArray());
        }

        $usedToday = GenerationJob::where('user_id', $request->user()->id)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();

        if ($usedToday >= config()->integer('banner.daily_generation_quota')) {
            return response()->json([
                'message' => 'Kuota generate harian Anda sudah habis. Silakan coba lagi besok.',
            ], 429);
        }

        $job = $project->generationJobs()->create([
            'user_id' => $request->user()->id,
            'provider' => $layouts->name(),
            'model' => $layouts->model(),
            'status' => GenerationStatus::Queued,
            'idempotency_key' => $key,
            'request_json' => collect($data)->except('idempotency_key')->all(),
        ]);

        $project->update(['status' => ProjectStatus::Generating]);

        GenerateBannerJob::dispatch($job->id);

        return response()->json($job->refresh()->toStatusArray(), 202);
    }

    /**
     * Get the status (and error, if any) of a generation job.
     */
    public function show(GenerationJob $generationJob): JsonResponse
    {
        Gate::authorize('view', $generationJob->project);

        return response()->json($generationJob->toStatusArray());
    }

    /**
     * Cancel a job that is still queued or running. A worker that already
     * picked it up discards its result instead of replacing the design.
     */
    public function cancel(GenerationJob $generationJob): JsonResponse
    {
        Gate::authorize('update', $generationJob->project);

        if ($generationJob->status->isActive()) {
            $generationJob->update([
                'status' => GenerationStatus::Cancelled,
                'finished_at' => now(),
            ]);

            $generationJob->project->update(['status' => ProjectStatus::Ready]);
        }

        return response()->json($generationJob->toStatusArray());
    }

    /**
     * Re-run a failed job in place. No new project or job is created.
     */
    public function retry(GenerationJob $generationJob): JsonResponse
    {
        Gate::authorize('update', $generationJob->project);

        if ($generationJob->status !== GenerationStatus::Failed) {
            return response()->json($generationJob->toStatusArray());
        }

        $generationJob->update([
            'status' => GenerationStatus::Queued,
            'error_message' => null,
            'finished_at' => null,
        ]);

        $generationJob->project->update(['status' => ProjectStatus::Generating]);

        GenerateBannerJob::dispatch($generationJob->id);

        return response()->json($generationJob->refresh()->toStatusArray(), 202);
    }
}
