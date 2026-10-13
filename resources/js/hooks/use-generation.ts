import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { uid } from '@/lib/editor-elements';
import { saveDocument } from '@/lib/editor-persistence';
import { useEditorStore } from '@/lib/editor-store';
import {
    cancel as cancelRoute,
    retry as retryRoute,
    show as jobRoute,
} from '@/routes/api/generation-jobs';
import { generate, show as projectRoute } from '@/routes/api/projects';
import type { EditorPayload, GenerationJob } from '@/types';

const POLL_INTERVAL_MS = 1500;

export type GenerationBrief = {
    prompt: string;
    photoAssetId: string | null;
    logoAssetId: string | null;
};

function isActive(job: GenerationJob | null): boolean {
    return job?.status === 'queued' || job?.status === 'running';
}

/**
 * Start, follow and retry AI generation jobs for a project. The job runs on
 * the server queue; this only polls its status and loads the result.
 */
export function useGeneration(
    projectId: number,
    initialJob: GenerationJob | null,
) {
    // A job that finished before the page was opened needs no attention.
    const [job, setJob] = useState<GenerationJob | null>(
        initialJob?.status === 'succeeded' || initialJob?.status === 'cancelled'
            ? null
            : initialJob,
    );
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const jobId = job?.id;
    const polling = isActive(job);

    useEffect(() => {
        if (!polling || jobId === undefined) {
            return;
        }

        let cancelled = false;

        const timer = setInterval(() => {
            void (async () => {
                try {
                    const latest = await api<GenerationJob>(jobRoute(jobId));

                    if (cancelled || isActive(latest)) {
                        return;
                    }

                    if (latest.status === 'succeeded') {
                        const payload = await api<EditorPayload>(
                            projectRoute(projectId),
                        );

                        if (cancelled) {
                            return;
                        }

                        useEditorStore
                            .getState()
                            .applyGenerated(
                                payload.document,
                                payload.assets,
                                payload.version,
                            );
                        toast.success('Banner berhasil dibuat.');
                    }

                    setJob(latest);
                } catch {
                    // Transient network errors: keep polling.
                }
            })();
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [polling, jobId, projectId]);

    const run = async (
        request: () => Promise<GenerationJob>,
    ): Promise<void> => {
        setStarting(true);
        setError(null);

        try {
            // Generation builds on the server copy, so flush local edits first.
            if (!(await saveDocument(projectId))) {
                throw new Error(
                    'Perubahan belum tersimpan. Simpan dokumen lalu coba lagi.',
                );
            }

            setJob(await request());
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setStarting(false);
        }
    };

    const start = (brief: GenerationBrief): Promise<void> =>
        run(() => {
            const { document, accent } = useEditorStore.getState();

            return api<GenerationJob>(generate(projectId), {
                prompt: brief.prompt,
                primary_color: accent,
                width: document.canvas.width,
                height: document.canvas.height,
                photo_asset_id: brief.photoAssetId,
                logo_asset_id: brief.logoAssetId,
                idempotency_key: uid(),
            });
        });

    const retry = (): Promise<void> =>
        run(() => api<GenerationJob>(retryRoute(job?.id ?? 0)));

    const cancel = async (): Promise<void> => {
        if (!job || !polling) {
            return;
        }

        try {
            const latest = await api<GenerationJob>(cancelRoute(job.id));

            // It may have finished a moment before the request arrived;
            // polling then picks up the result as usual.
            if (latest.status === 'cancelled') {
                setJob(null);
                toast.info('Generate dibatalkan.');
            }
        } catch (caught) {
            toast.error(errorMessage(caught));
        }
    };

    return {
        busy: starting || polling,
        /** Waiting for a queue worker to pick the job up. */
        queued: job?.status === 'queued',
        cancel,
        failed: job?.status === 'failed',
        error: error ?? (job?.status === 'failed' ? job.error_message : null),
        start,
        retry,
    };
}
