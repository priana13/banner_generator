import {
    Circle,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Lock,
    LockOpen,
    RectangleHorizontal,
    Sparkle,
    Square,
    Trash2,
    Type,
    Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import {
    createCircle,
    createImage,
    createOrnament,
    createRect,
    createText,
} from '@/lib/editor-elements';
import { useEditorStore } from '@/lib/editor-store';
import { uploadImage } from '@/lib/image-processing';
import { ORNAMENTS, ornamentUrl } from '@/lib/ornaments';
import { cn } from '@/lib/utils';
import type { DesignElement } from '@/types';

const TYPE_ICONS = {
    text: Type,
    button: RectangleHorizontal,
    rect: Square,
    circle: Circle,
    image: ImageIcon,
    ornament: Sparkle,
} satisfies Record<DesignElement['type'], unknown>;

const toolClass =
    'flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-slate-200 p-3 text-xs hover:bg-slate-50';

export function ElementsPanel({ projectId }: { projectId: number }) {
    const addElement = useEditorStore((state) => state.addElement);

    const state = () => useEditorStore.getState();

    const addImage = async (file: File): Promise<void> => {
        try {
            const asset = await uploadImage(
                projectId,
                file,
                'upload',
                file.name,
            );

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
                                void addImage(file);
                            }
                        }}
                    />
                </label>
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-600">
                Ornamen
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
                {Object.entries(ORNAMENTS).map(([id, ornament]) => (
                    <button
                        key={id}
                        type="button"
                        title={ornament.label}
                        aria-label={`Tambah ornamen ${ornament.label}`}
                        onClick={() =>
                            addElement(
                                createOrnament(
                                    state().document.canvas,
                                    id,
                                    state().accent,
                                ),
                            )
                        }
                        className="grid aspect-square place-items-center rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                    >
                        <img
                            src={ornamentUrl(id, '#16a34a')}
                            alt=""
                            className="max-h-full max-w-full"
                        />
                    </button>
                ))}
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
