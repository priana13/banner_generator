<?php

namespace App\Jobs;

use App\Enums\GenerationStatus;
use App\Enums\ProjectStatus;
use App\Models\Asset;
use App\Models\GenerationJob;
use App\Models\Project;
use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\ImageProvider;
use App\Services\Ai\Contracts\LayoutProvider;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\ImageRequest;
use App\Services\Design\AssetStore;
use App\Services\Design\BannerComposer;
use App\Services\Design\DesignDocuments;
use App\Services\Design\DesignSpecNormalizer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class GenerateBannerJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 240;

    public bool $failOnTimeout = true;

    public function __construct(public int $generationJobId) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [5, 20];
    }

    /**
     * Brief -> DesignSpec -> validate & normalize -> image -> asset -> document.
     */
    public function handle(
        LayoutProvider $layouts,
        ImageProvider $images,
        DesignSpecNormalizer $specs,
        BannerComposer $composer,
        AssetStore $assets,
        DesignDocuments $documents,
    ): void {
        $job = GenerationJob::with('project')->find($this->generationJobId);

        // Already handled (e.g. the queue redelivered a finished job).
        if ($job === null || ! $job->status->isActive()) {
            return;
        }

        $job->update([
            'status' => GenerationStatus::Running,
            'attempts' => $job->attempts + 1,
            'started_at' => now(),
            'error_message' => null,
        ]);

        $project = $job->project;
        $request = $job->request_json;
        $brief = new DesignBrief(
            (string) $request['prompt'],
            (int) $request['width'],
            (int) $request['height'],
            (string) $request['primary_color'],
            $request['design_style_snapshot'] ?? null,
        );

        $layout = $layouts->generate($brief);
        $spec = $specs->normalize($layout->spec, $brief);

        $photo = $this->asset($project, $request['photo_asset_id'] ?? null);
        $logo = $this->asset($project, $request['logo_asset_id'] ?? null);

        $style = $request['style'] ?? ($photo === null ? BannerComposer::STYLE_PANEL : BannerComposer::STYLE_CUTOUT);
        $generated = null;
        $image = null;

        if ($style === BannerComposer::STYLE_CUTOUT) {
            // A clean, light design built from the uploaded photo and
            // built-in ornaments: no image model is involved.
            $document = $composer->composeCutout($spec, $brief, $photo, $logo, $request['background_color'] ?? null);
        } else {
            // With an uploaded photo the AI paints the backdrop; otherwise it
            // produces the visual itself. Either way it is stored as its own asset.
            $box = $photo === null
                ? $composer->visualBox($brief->width, $brief->height, $spec['layout'])
                : ['width' => $brief->width, 'height' => $brief->height];
            $purpose = $photo === null ? ImageRequest::PURPOSE_VISUAL : ImageRequest::PURPOSE_BACKGROUND;

            $image = $images->generate(new ImageRequest(
                $spec['imagePrompt'], $box['width'], $box['height'], $brief->accentColor, $purpose,
                $brief->designStyle['image_instructions'] ?? '',
            ));

            $generated = $assets->store($project, $image->binary, Asset::KIND_GENERATED, [
                'provider' => $images->name(),
                'model' => $images->model(),
                'purpose' => $purpose,
                'generation_job_id' => $job->id,
            ]);

            $document = $composer->compose(
                $spec,
                $brief,
                visual: $photo === null ? $generated : null,
                background: $photo === null ? null : $generated,
                photo: $photo,
                logo: $logo,
            );
        }

        // The user may have cancelled while the providers were working: the
        // current design must then stay exactly as it is.
        if ($job->refresh()->status !== GenerationStatus::Running) {
            if ($generated !== null) {
                $assets->delete($generated);
            }

            return;
        }

        DB::transaction(function () use ($documents, $project, $document, $job, $spec, $generated, $layout, $image): void {
            $revision = $documents->commit($project, $document, $job->user_id);

            $project->update(['status' => ProjectStatus::Ready]);

            $job->update([
                'status' => GenerationStatus::Succeeded,
                'result_json' => ['spec' => $spec, 'asset_id' => $generated?->id, 'version' => $revision->version],
                'cost_estimate' => $layout->cost + ($image->cost ?? 0.0),
                'finished_at' => now(),
            ]);
        });
    }

    /**
     * Called once every attempt has been used up.
     */
    public function failed(?Throwable $exception): void
    {
        $job = GenerationJob::with('project')->find($this->generationJobId);

        if ($job === null || $job->status === GenerationStatus::Cancelled) {
            return;
        }

        if (! $exception instanceof AiProviderException) {
            Log::error('Banner generation failed.', ['generation_job_id' => $job->id, 'exception' => $exception]);
        }

        $job->update([
            'status' => GenerationStatus::Failed,
            'error_message' => $exception instanceof AiProviderException
                ? $exception->getMessage()
                : 'Terjadi kesalahan saat membuat banner. Silakan coba lagi.',
            'finished_at' => now(),
        ]);

        $job->project->update(['status' => ProjectStatus::Failed]);
    }

    private function asset(Project $project, mixed $id): ?Asset
    {
        return is_string($id) ? $project->assets()->find($id) : null;
    }
}
