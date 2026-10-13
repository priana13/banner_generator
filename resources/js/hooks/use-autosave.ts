import { useEffect } from 'react';
import { saveDocument } from '@/lib/editor-persistence';
import { useEditorStore } from '@/lib/editor-store';

const AUTOSAVE_DELAY_MS = 1500;

/**
 * Save the document shortly after the user stops editing, and warn before
 * the page is closed with unsaved changes.
 */
export function useAutosave(projectId: number): void {
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const unsubscribe = useEditorStore.subscribe((state, previous) => {
            if (state.document === previous.document) {
                return;
            }

            clearTimeout(timer);

            if (state.document === state.savedDocument) {
                if (state.saveStatus === 'dirty') {
                    state.setSaveStatus('saved');
                }

                return;
            }

            if (state.saveStatus !== 'conflict') {
                state.setSaveStatus('dirty');
                timer = setTimeout(
                    () => void saveDocument(projectId),
                    AUTOSAVE_DELAY_MS,
                );
            }
        });

        const warn = (event: BeforeUnloadEvent): void => {
            const { document, savedDocument } = useEditorStore.getState();

            if (document !== savedDocument) {
                event.preventDefault();
            }
        };

        window.addEventListener('beforeunload', warn);

        return () => {
            clearTimeout(timer);
            unsubscribe();
            window.removeEventListener('beforeunload', warn);
        };
    }, [projectId]);
}
