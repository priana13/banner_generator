import { Head, Link } from '@inertiajs/react';
import type Konva from 'konva';
import {
    ChevronDown,
    Download,
    LoaderCircle,
    Minus,
    Plus,
    Redo2,
    Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CanvasStage } from '@/components/editor/canvas-stage';
import { GeneratorPanel } from '@/components/editor/generator-panel';
import { ElementsPanel, LayersPanel } from '@/components/editor/layers-panel';
import ProjectCategorySelect from '@/components/project-category-select';
import { PropertiesPanel } from '@/components/editor/properties-panel';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAutosave } from '@/hooks/use-autosave';
import { useGeneration } from '@/hooks/use-generation';
import { api, errorMessage } from '@/lib/api';
import { exportBanner } from '@/lib/editor-export';
import type { ExportFormat } from '@/lib/editor-export';
import { saveDocument } from '@/lib/editor-persistence';
import { useEditorStore } from '@/lib/editor-store';
import type { SaveStatus } from '@/lib/editor-store';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { update as updateProject } from '@/routes/api/projects';
import type { EditorPayload, ProjectCategory } from '@/types';

type Props = EditorPayload & {
    fonts: string[];
    maxPromptLength: number;
    categories: ProjectCategory[];
};

const SAVE_LABELS: Record<SaveStatus, string> = {
    saved: 'Semua perubahan tersimpan',
    dirty: 'Perubahan belum disimpan',
    saving: 'Menyimpan…',
    error: 'Gagal menyimpan — coba lagi',
    conflict: 'Dokumen diubah di tempat lain — muat ulang',
};

const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
    { format: 'png', label: 'PNG' },
    { format: 'jpeg', label: 'JPG' },
    { format: 'webp', label: 'WebP' },
];

const toolbarButton =
    'rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40';

function isTyping(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
            target.isContentEditable)
    );
}

export default function Editor({
    project,
    document: initialDocument,
    version,
    assets,
    job,
    brief,
    fonts,
    maxPromptLength,
    categories,
}: Props) {
    const stageRef = useRef<Konva.Stage>(null);
    const workAreaRef = useRef<HTMLDivElement>(null);
    const [title, setTitle] = useState(project.title);
    const [savedTitle, setSavedTitle] = useState(project.title);
    const [categoryId, setCategoryId] = useState(project.category_id);
    const [savingCategory, setSavingCategory] = useState(false);
    const [exporting, setExporting] = useState(false);

    const loaded = useEditorStore((state) => state.projectId === project.id);
    const canvas = useEditorStore((state) => state.document.canvas);
    const zoom = useEditorStore((state) => state.zoom);
    const setZoom = useEditorStore((state) => state.setZoom);
    const saveStatus = useEditorStore((state) => state.saveStatus);
    const canUndo = useEditorStore((state) => state.past.length > 0);
    const canRedo = useEditorStore((state) => state.future.length > 0);
    const undo = useEditorStore((state) => state.undo);
    const redo = useEditorStore((state) => state.redo);

    const generation = useGeneration(project.id, job);

    useAutosave(project.id);

    useEffect(() => {
        useEditorStore
            .getState()
            .load(project.id, initialDocument, assets, version);

        if (brief?.primary_color) {
            // Only restores the picker; the saved design keeps its colors.
            useEditorStore.getState().setAccent(brief.primary_color, false);
        }

        // The server props are only the starting point; afterwards the
        // store owns the document.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id]);

    // Fit the banner into the work area whenever its size changes.
    useEffect(() => {
        const area = workAreaRef.current;

        if (!area || !loaded) {
            return;
        }

        setZoom(
            Math.min(
                1,
                (area.clientWidth - 56) / canvas.width,
                (area.clientHeight - 56) / canvas.height,
            ),
        );
    }, [loaded, canvas.width, canvas.height, setZoom]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (isTyping(event.target)) {
                return;
            }

            const state = useEditorStore.getState();
            const modifier = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();

            if (modifier && key === 'z') {
                event.preventDefault();

                if (event.shiftKey) {
                    state.redo();
                } else {
                    state.undo();
                }
            } else if (modifier && key === 'y') {
                event.preventDefault();
                state.redo();
            } else if (modifier && key === 's') {
                event.preventDefault();
                void saveDocument(project.id);
            } else if (
                (event.key === 'Delete' || event.key === 'Backspace') &&
                state.selectedId
            ) {
                event.preventDefault();
                state.removeElement(state.selectedId);
            } else if (event.key === 'Escape') {
                state.select(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [project.id]);

    const renameProject = async (): Promise<void> => {
        const next = title.trim();

        if (next === '' || next === savedTitle) {
            setTitle(savedTitle);

            return;
        }

        try {
            await api(updateProject(project.id), { title: next });
            setSavedTitle(next);
            setTitle(next);
        } catch (error) {
            toast.error(errorMessage(error));
            setTitle(savedTitle);
        }
    };

    const changeCategory = async (next: number | null): Promise<void> => {
        setSavingCategory(true);
        try {
            await api(updateProject(project.id), { category_id: next });
            setCategoryId(next);
            toast.success('Kategori proyek disimpan.');
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSavingCategory(false);
        }
    };

    const runExport = async (format: ExportFormat): Promise<void> => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        setExporting(true);

        try {
            await exportBanner(stage, project.id, savedTitle, format);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setExporting(false);
        }
    };

    const zoomPercent = Math.round(zoom * 100);

    return (
        <div
            className="flex h-screen min-h-[650px] flex-col bg-slate-100 text-slate-800"
            style={{ fontFamily: 'Inter, sans-serif', colorScheme: 'light' }}
        >
            <Head title={savedTitle} />

            <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
                <div className="flex min-w-0 items-center gap-3">
                    <Link
                        href={dashboard()}
                        className="flex items-center gap-3"
                        title="Kembali ke dashboard"
                    >
                        <div className="grid size-10 place-items-center rounded-xl bg-orange-500 text-xl font-extrabold text-white">
                            B
                        </div>
                        <div>
                            <div className="text-lg font-extrabold tracking-tight">
                                Banner
                                <span className="text-orange-500">AI</span>
                            </div>
                            <div className="-mt-1 text-[10px] text-slate-400">
                                AI Design Studio
                            </div>
                        </div>
                    </Link>
                    <span className="mx-2 hidden h-7 border-l border-slate-200 md:block" />
                    <div className="hidden w-64 space-y-1 md:block">
                        <input
                            value={title}
                            maxLength={120}
                            aria-label="Nama proyek"
                            onChange={(event) => setTitle(event.target.value)}
                            onBlur={() => void renameProject()}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.currentTarget.blur();
                                }
                            }}
                            className="w-full bg-transparent text-sm font-semibold outline-none"
                        />
                        <ProjectCategorySelect
                            categories={categories}
                            value={categoryId}
                            onChange={(value) => void changeCategory(value)}
                            disabled={savingCategory}
                            className="h-7 text-xs"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        role="status"
                        className={cn(
                            'hidden text-xs sm:block',
                            saveStatus === 'error' || saveStatus === 'conflict'
                                ? 'text-red-600'
                                : 'text-slate-400',
                        )}
                    >
                        {SAVE_LABELS[saveStatus]}
                    </span>
                    {saveStatus === 'conflict' ? (
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                            Muat ulang
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={
                                saveStatus === 'saved' ||
                                saveStatus === 'saving'
                            }
                            onClick={() => void saveDocument(project.id)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                        >
                            Simpan
                        </button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                disabled={exporting}
                                className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
                            >
                                {exporting ? (
                                    <LoaderCircle className="size-4 animate-spin" />
                                ) : (
                                    <Download className="size-4" />
                                )}
                                Export
                                <ChevronDown className="size-3.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {EXPORT_FORMATS.map(({ format, label }) => (
                                <DropdownMenuItem
                                    key={format}
                                    onSelect={() => void runExport(format)}
                                >
                                    {label} — {canvas.width} × {canvas.height}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <div className="flex min-h-0 flex-1 overflow-hidden">
                <aside className="flex w-[310px] shrink-0 [scrollbar-width:thin] flex-col overflow-y-auto border-r border-slate-200 bg-white">
                    <GeneratorPanel
                        projectId={project.id}
                        generation={generation}
                        brief={brief}
                        maxPromptLength={maxPromptLength}
                    />
                    <ElementsPanel projectId={project.id} />
                    <LayersPanel />
                </aside>

                <main className="flex min-w-0 flex-1 flex-col">
                    <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-5">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                title="Undo (Ctrl+Z)"
                                aria-label="Undo"
                                disabled={!canUndo}
                                onClick={undo}
                                className={toolbarButton}
                            >
                                <Undo2 className="size-4" />
                            </button>
                            <button
                                type="button"
                                title="Redo (Ctrl+Shift+Z)"
                                aria-label="Redo"
                                disabled={!canRedo}
                                onClick={redo}
                                className={toolbarButton}
                            >
                                <Redo2 className="size-4" />
                            </button>
                            <span className="hidden text-xs text-slate-400 sm:inline">
                                Klik objek untuk mengedit • Seret untuk
                                memindahkan
                            </span>
                        </div>
                        <div className="text-xs text-slate-500">
                            {canvas.width} × {canvas.height}
                            <span className="ml-3">{zoomPercent}%</span>
                        </div>
                    </div>

                    <div className="relative min-h-0 flex-1">
                        <div
                            ref={workAreaRef}
                            className="editor-checker flex size-full overflow-auto p-7"
                        >
                            {loaded && (
                                <div className="m-auto shrink-0 bg-white shadow-[0_16px_55px_#1725541c]">
                                    <CanvasStage
                                        stageRef={stageRef}
                                        fonts={fonts}
                                    />
                                </div>
                            )}
                        </div>
                        {generation.busy && (
                            <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[1px]">
                                <div className="max-w-sm rounded-xl bg-white px-5 py-4 text-sm shadow-lg">
                                    <div className="flex items-center gap-3 font-semibold">
                                        <LoaderCircle className="size-5 shrink-0 animate-spin text-orange-500" />
                                        {generation.queued
                                            ? 'Menunggu antrean…'
                                            : 'AI sedang menyusun banner Anda…'}
                                    </div>
                                    {generation.queued && (
                                        <p className="mt-2 text-xs text-slate-500">
                                            Jika ini berlangsung lama, queue
                                            worker di server kemungkinan belum
                                            berjalan.
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void generation.cancel()}
                                        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                                    >
                                        Batalkan
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex h-12 shrink-0 items-center justify-center gap-3 border-t border-slate-200 bg-white text-xs text-slate-500">
                        <button
                            type="button"
                            aria-label="Perkecil"
                            onClick={() => setZoom(zoom - 0.1)}
                            className="rounded border border-slate-200 px-2 py-1"
                        >
                            <Minus className="size-3" />
                        </button>
                        <input
                            type="range"
                            min={10}
                            max={200}
                            value={zoomPercent}
                            aria-label="Zoom"
                            onChange={(event) =>
                                setZoom(Number(event.target.value) / 100)
                            }
                            className="w-32 accent-orange-500"
                        />
                        <button
                            type="button"
                            aria-label="Perbesar"
                            onClick={() => setZoom(zoom + 0.1)}
                            className="rounded border border-slate-200 px-2 py-1"
                        >
                            <Plus className="size-3" />
                        </button>
                        <span className="w-9">{zoomPercent}%</span>
                    </div>
                </main>

                <aside className="hidden w-[275px] shrink-0 [scrollbar-width:thin] overflow-y-auto border-l border-slate-200 bg-white lg:block">
                    <PropertiesPanel fonts={fonts} projectId={project.id} />
                </aside>
            </div>
        </div>
    );
}
