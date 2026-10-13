import {
    Circle,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Lock,
    LockOpen,
    RectangleHorizontal,
    Square,
    Trash2,
    Type,
    Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import {
    createCircle,
    createImage,
    createRect,
    createText,
} from '@/lib/editor-elements';
import { useEditorStore } from '@/lib/editor-store';
import { cn } from '@/lib/utils';
import { store as uploadAsset } from '@/routes/api/projects/assets';
import type { DesignElement, EditorAsset } from '@/types';

const TYPE_ICONS = {
    text: Type,
    button: RectangleHorizontal,
    rect: Square,
    circle: Circle,
    image: ImageIcon,
} satisfies Record<DesignElement['type'], unknown>;

const toolClass =
    'flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-slate-200 p-3 text-xs hover:bg-slate-50';

export function ElementsPanel({ projectId }: { projectId: number }) {
    const addElement = useEditorStore((state) => state.addElement);

    const state = () => useEditorStore.getState();

    const uploadImage = async (file: File): Promise<void> => {
        const form = new FormData();

        form.append('file', file);
        form.append('kind', 'upload');

        try {
            const asset = await api<EditorAsset>(uploadAsset(projectId), form);

            state().addAsset(asset);
            addElement(createImage(state().document.canvas, asset));
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    return (
        <div className="border-b border-slate-200 p-5">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold">Tambahkan elemen</h3>
                <span className="text-xs text-slate-400">Editable</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    className={toolClass}
                    onClick={() =>
                        addElement(createText(state().document.canvas))
                    }
                >
                    <Type className="size-4" />
                    Teks
                </button>
                <button
                    type="button"
                    className={toolClass}
                    onClick={() =>
                        addElement(
                            createRect(state().document.canvas, state().accent),
                        )
                    }
                >
                    <Square className="size-4" />
                    Bentuk
                </button>
                <button
                    type="button"
                    className={toolClass}
                    onClick={() =>
                        addElement(
                            createCircle(
                                state().document.canvas,
                                state().accent,
                            ),
                        )
                    }
                >
                    <Circle className="size-4" />
                    Lingkaran
                </button>
                <label className={toolClass}>
                    <Upload className="size-4" />
                    Upload Foto
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            event.target.value = '';

                            if (file) {
                                void uploadImage(file);
                            }
                        }}
                    />
                </label>
            </div>
        </div>
    );
}

export function LayersPanel() {
    const elements = useEditorStore((state) => state.document.elements);
    const selectedId = useEditorStore((state) => state.selectedId);
    const select = useEditorStore((state) => state.select);
    const updateElement = useEditorStore((state) => state.updateElement);
    const removeElement = useEditorStore((state) => state.removeElement);

    return (
        <div className="p-5">
            <div className="mb-3 flex justify-between">
                <h3 className="text-sm font-bold">Layer</h3>
                <button
                    type="button"
                    disabled={!selectedId}
                    onClick={() => selectedId && removeElement(selectedId)}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline disabled:opacity-40"
                >
                    <Trash2 className="size-3" />
                    Hapus terpilih
                </button>
            </div>
            {elements.length === 0 && (
                <p className="text-xs text-slate-400">
                    Belum ada layer. Generate banner atau tambahkan elemen.
                </p>
            )}
            <ul className="space-y-1 text-xs">
                {/* Topmost layer first, like the stacking order on canvas. */}
                {[...elements].reverse().map((element) => {
                    const Icon = TYPE_ICONS[element.type];

                    return (
                        <li
                            key={element.id}
                            className={cn(
                                'flex items-center rounded-lg border',
                                element.id === selectedId
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-slate-100 hover:bg-orange-50',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => select(element.id)}
                                className={cn(
                                    'flex min-w-0 flex-1 items-center gap-2 p-2.5 text-left',
                                    !element.visible && 'opacity-50',
                                )}
                            >
                                <Icon className="size-3.5 shrink-0 text-slate-500" />
                                <span className="truncate">{element.name}</span>
                            </button>
                            <button
                                type="button"
                                title={element.locked ? 'Buka kunci' : 'Kunci'}
                                aria-label={
                                    element.locked ? 'Buka kunci' : 'Kunci'
                                }
                                onClick={() =>
                                    updateElement(element.id, {
                                        locked: !element.locked,
                                    })
                                }
                                className="p-1.5 text-slate-400 hover:text-slate-700"
                            >
                                {element.locked ? (
                                    <Lock className="size-3.5 text-orange-500" />
                                ) : (
                                    <LockOpen className="size-3.5" />
                                )}
                            </button>
                            <button
                                type="button"
                                title={
                                    element.visible
                                        ? 'Sembunyikan'
                                        : 'Tampilkan'
                                }
                                aria-label={
                                    element.visible
                                        ? 'Sembunyikan'
                                        : 'Tampilkan'
                                }
                                onClick={() =>
                                    updateElement(element.id, {
                                        visible: !element.visible,
                                    })
                                }
                                className="p-1.5 pr-2.5 text-slate-400 hover:text-slate-700"
                            >
                                {element.visible ? (
                                    <Eye className="size-3.5" />
                                ) : (
                                    <EyeOff className="size-3.5" />
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
