import { create } from 'zustand';
import type {
    DesignCanvas,
    DesignDocument,
    DesignElement,
    EditorAsset,
    ElementPatch,
} from '@/types';

const HISTORY_LIMIT = 50;
const COALESCE_MS = 800;

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

type EditorState = {
    /** The project currently loaded into the store. */
    projectId: number | null;
    document: DesignDocument;
    /** The document as last persisted, and the server version it has. */
    savedDocument: DesignDocument;
    version: number;
    saveStatus: SaveStatus;
    assets: Record<string, EditorAsset>;
    selectedId: string | null;
    past: DesignDocument[];
    future: DesignDocument[];
    accent: string;
    zoom: number;

    load: (
        projectId: number,
        document: DesignDocument,
        assets: EditorAsset[],
        version: number,
    ) => void;
    applyGenerated: (
        document: DesignDocument,
        assets: EditorAsset[],
        version: number,
    ) => void;
    markSaved: (document: DesignDocument, version: number) => void;
    setSaveStatus: (status: SaveStatus) => void;
    select: (id: string | null) => void;
    addAsset: (asset: EditorAsset) => void;
    addElement: (element: DesignElement) => void;
    updateElement: (
        id: string,
        patch: ElementPatch,
        coalesceKey?: string,
    ) => void;
    removeElement: (id: string) => void;
    reorderElement: (id: string, direction: 'forward' | 'backward') => void;
    setCanvas: (patch: Partial<DesignCanvas>, coalesceKey?: string) => void;
    undo: () => void;
    redo: () => void;
    /**
     * Change the brand color. By default the current design follows:
     * everything drawn in the old color (or its dark shade) is recolored.
     */
    setAccent: (accent: string, recolor?: boolean) => void;
    setZoom: (zoom: number) => void;
};

const emptyDocument: DesignDocument = {
    schemaVersion: 1,
    canvas: { width: 1200, height: 400, backgroundColor: '#ffffff' },
    elements: [],
};

/**
 * The deep shade generated designs pair with the brand color. Mirrors
 * `Color::mix($accent, '#000000', 0.45)` in BannerComposer.
 */
export function darkShade(hex: string): string {
    return (
        '#' +
        [1, 3, 5]
            .map((at) =>
                Math.round(parseInt(hex.slice(at, at + 2), 16) * 0.55)
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('')
    );
}

function indexAssets(assets: EditorAsset[]): Record<string, EditorAsset> {
    return Object.fromEntries(assets.map((asset) => [asset.id, asset]));
}

// Rapid edits of the same property (typing, dragging a slider) collapse
// into a single undo step.
let lastCoalesceKey: string | null = null;
let lastChangeAt = 0;

export const useEditorStore = create<EditorState>((set, get) => {
    /** Apply a document change and record it for undo. */
    const commit = (document: DesignDocument, coalesceKey?: string): void => {
        const now = Date.now();
        const coalesce =
            coalesceKey !== undefined &&
            coalesceKey === lastCoalesceKey &&
            now - lastChangeAt < COALESCE_MS;

        lastCoalesceKey = coalesceKey ?? null;
        lastChangeAt = now;

        set((state) => ({
            document,
            past: coalesce
                ? state.past
                : [...state.past, state.document].slice(-HISTORY_LIMIT),
            future: [],
        }));
    };

    const mapElements = (
        map: (elements: DesignElement[]) => DesignElement[],
        coalesceKey?: string,
    ): void => {
        const { document } = get();

        commit({ ...document, elements: map(document.elements) }, coalesceKey);
    };

    return {
        projectId: null,
        document: emptyDocument,
        savedDocument: emptyDocument,
        version: 0,
        saveStatus: 'saved',
        assets: {},
        selectedId: null,
        past: [],
        future: [],
        accent: '#f97316',
        zoom: 1,

        load: (projectId, document, assets, version) => {
            lastCoalesceKey = null;
            set({
                projectId,
                document,
                savedDocument: document,
                version,
                saveStatus: 'saved',
                assets: indexAssets(assets),
                selectedId: null,
                past: [],
                future: [],
            });
        },

        // A generated document is already stored server-side, but stays
        // undoable so the previous design is one Ctrl+Z away.
        applyGenerated: (document, assets, version) => {
            commit(document);
            set({
                savedDocument: document,
                version,
                saveStatus: 'saved',
                assets: indexAssets(assets),
                selectedId: null,
            });
        },

        markSaved: (document, version) =>
            set((state) => ({
                savedDocument: document,
                version,
                saveStatus: state.document === document ? 'saved' : 'dirty',
            })),

        setSaveStatus: (saveStatus) => set({ saveStatus }),

        select: (selectedId) => set({ selectedId }),

        addAsset: (asset) =>
            set((state) => ({
                assets: { ...state.assets, [asset.id]: asset },
            })),

        addElement: (element) => {
            mapElements((elements) => [...elements, element]);
            set({ selectedId: element.id });
        },

        updateElement: (id, patch, coalesceKey) =>
            mapElements(
                (elements) =>
                    elements.map((element) =>
                        element.id === id
                            ? ({ ...element, ...patch } as DesignElement)
                            : element,
                    ),
                coalesceKey,
            ),

        removeElement: (id) => {
            mapElements((elements) =>
                elements.filter((element) => element.id !== id),
            );
            set((state) => ({
                selectedId: state.selectedId === id ? null : state.selectedId,
            }));
        },

        reorderElement: (id, direction) => {
            const { elements } = get().document;
            const from = elements.findIndex((element) => element.id === id);
            const to = direction === 'forward' ? from + 1 : from - 1;

            if (from < 0 || to < 0 || to >= elements.length) {
                return;
            }

            mapElements((current) => {
                const next = [...current];
                [next[from], next[to]] = [next[to], next[from]];

                return next;
            });
        },

        setCanvas: (patch, coalesceKey) => {
            const { document } = get();

            commit(
                { ...document, canvas: { ...document.canvas, ...patch } },
                coalesceKey,
            );
        },

        undo: () => {
            const { past, future, document, selectedId } = get();
            const previous = past.at(-1);

            if (!previous) {
                return;
            }

            lastCoalesceKey = null;
            set({
                document: previous,
                past: past.slice(0, -1),
                future: [document, ...future],
                selectedId: previous.elements.some((el) => el.id === selectedId)
                    ? selectedId
                    : null,
            });
        },

        redo: () => {
            const { past, future, document, selectedId } = get();
            const next = future.at(0);

            if (!next) {
                return;
            }

            lastCoalesceKey = null;
            set({
                document: next,
                past: [...past, document],
                future: future.slice(1),
                selectedId: next.elements.some((el) => el.id === selectedId)
                    ? selectedId
                    : null,
            });
        },

        setAccent: (accent, recolor = true) => {
            const { accent: previous, document } = get();

            set({ accent });

            if (!recolor || accent.toLowerCase() === previous.toLowerCase()) {
                return;
            }

            const swaps = new Map([
                [previous.toLowerCase(), accent.toLowerCase()],
                [darkShade(previous), darkShade(accent)],
            ]);
            const swap = (color: string): string =>
                swaps.get(color.toLowerCase()) ?? color;
            let changed = false;

            const elements = document.elements.map((element) => {
                const next = { ...element } as DesignElement;

                if ('fill' in next) {
                    next.fill = swap(next.fill);
                }

                if (next.type === 'button') {
                    next.textColor = swap(next.textColor);
                }

                if (next.type === 'text' && next.spans) {
                    next.spans = next.spans.map((span) => ({
                        ...span,
                        fill: swap(span.fill),
                    }));
                }

                if (JSON.stringify(next) === JSON.stringify(element)) {
                    return element;
                }

                changed = true;

                return next;
            });

            if (changed) {
                // Dragging through the color picker is one undo step.
                commit({ ...document, elements }, 'accent');
            }
        },

        setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.1, zoom)) }),
    };
});

export function useSelectedElement(): DesignElement | null {
    return useEditorStore(
        (state) =>
            state.document.elements.find(
                (element) => element.id === state.selectedId,
            ) ?? null,
    );
}
