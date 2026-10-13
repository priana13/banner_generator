import { api, ApiError } from '@/lib/api';
import { useEditorStore } from '@/lib/editor-store';
import { document as documentRoute } from '@/routes/api/projects';

let inFlight: Promise<boolean> | null = null;

/**
 * Persist the current document if it has unsaved changes. Saves never
 * overlap: each one carries the version returned by the previous save, so
 * the server can reject writes based on a stale document.
 */
export async function saveDocument(projectId: number): Promise<boolean> {
    if (inFlight) {
        await inFlight;
    }

    const { document, savedDocument, version, saveStatus } =
        useEditorStore.getState();

    if (saveStatus === 'conflict') {
        return false;
    }

    if (document === savedDocument) {
        useEditorStore.getState().setSaveStatus('saved');

        return true;
    }

    useEditorStore.getState().setSaveStatus('saving');

    inFlight = api<{ version: number }>(documentRoute(projectId), {
        version,
        document,
    })
        .then((saved) => {
            useEditorStore.getState().markSaved(document, saved.version);

            return true;
        })
        .catch((error: unknown) => {
            useEditorStore
                .getState()
                .setSaveStatus(
                    error instanceof ApiError && error.status === 409
                        ? 'conflict'
                        : 'error',
                );

            return false;
        })
        .finally(() => {
            inFlight = null;
        });

    return inFlight;
}
