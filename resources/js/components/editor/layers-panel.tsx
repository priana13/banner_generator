import {
    Circle,
    Eye,
    EyeOff,
    Image as ImageIcon,
    LoaderCircle,
    Lock,
    LockOpen,
    Plus,
    RectangleHorizontal,
    Sparkle,
    Square,
    Trash2,
    Type,
    Upload,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import {
    createCircle,
    createImage,
    createOrnament,
    createRect,
    createText,
} from '@/lib/editor-elements';
import { useEditorStore } from '@/lib/editor-store';
import {
    prepareImage,
    rasterizeSvg,
    uploadImage,
} from '@/lib/image-processing';
import { ORNAMENTS, ornamentUrl } from '@/lib/ornaments';
import { cn } from '@/lib/utils';
import {
    destroy as destroyOrnament,
    index as listOrnaments,
    store as storeOrnament,
} from '@/routes/api/ornaments';
import { use as ornamentUseRoute } from '@/routes/api/projects/ornaments';
import type { DesignElement, EditorAsset, UserOrnament } from '@/types';

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

/**
 * Built-in ornaments (recolorable vectors) and the user's own library of
 * uploaded ornament images.
 */
function OrnamentPicker({ projectId }: { projectId: number }) {
    const addElement = useEditorStore((state) => state.addElement);
    const [library, setLibrary] = useState<UserOrnament[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        api<{ data: UserOrnament[] }>(listOrnaments())
            .then(({ data }) => {
                if (!cancelled) {
                    setLibrary(data);
                }
            })
            .catch(() => {
                // The built-in ornaments still work without the library.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const state = () => useEditorStore.getState();

    const upload = async (file: File): Promise<void> => {
        setUploading(true);

        try {
            const isSvg =
                file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
            const form = new FormData();

            form.append(
                'file',
                await prepareImage(isSvg ? await rasterizeSvg(file) : file),
                file.name.replace(/\.svg$/i, '.png'),
            );

            const ornament = await api<UserOrnament>(storeOrnament(), form);

            setLibrary((current) => [ornament, ...current]);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setUploading(false);
        }
    };

    const place = async (ornament: UserOrnament): Promise<void> => {
        try {
            const asset = await api<EditorAsset>(
                ornamentUseRoute({
                    project: projectId,
                    ornament: ornament.id,
                }),
            );

            state().addAsset(asset);
            addElement({
                ...createImage(state().document.canvas, asset),
                name: `Ornamen: ${ornament.name}`,
            });
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const remove = async (ornament: UserOrnament): Promise<void> => {
        if (
            !window.confirm(
                `Hapus "${ornament.name}" dari pustaka? Desain yang sudah memakainya tidak berubah.`,
            )
        ) {
            return;
        }

        try {
            await api(destroyOrnament(ornament.id));
            setLibrary((current) =>
                current.filter((item) => item.id !== ornament.id),
            );
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const tileClass =
        'grid aspect-square place-items-center rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50';

    return (
        <>
            {(
                [
                    { label: 'Ramadan', theme: 'ramadan' },
                    { label: 'Ornamen umum', theme: undefined },
                ] as const
            ).map((group) => (
                <section
                    key={group.label}
                    aria-label={`Ornamen ${group.label}`}
                >
                    <div className="mt-4 text-xs font-semibold text-slate-600">
                        {group.label}
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                        {Object.entries(ORNAMENTS)
                            .filter(
                                ([, ornament]) =>
                                    ornament.theme === group.theme,
                            )
                            .map(([id, ornament]) => (
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
                                    className={tileClass}
                                >
                                    <img
                                        src={ornamentUrl(id, '#16a34a')}
                                        alt=""
                                        className="max-h-full max-w-full"
                                    />
                                </button>
                            ))}
                    </div>
                </section>
            ))}

            <div className="mt-4 text-xs font-semibold text-slate-600">
                Ornamen saya
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
                <label
                    title="Upload ornamen"
                    className={cn(
                        tileClass,
                        'cursor-pointer border-dashed border-slate-300 text-slate-500',
                    )}
                >
                    {uploading ? (
                        <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                        <Plus className="size-4" />
                    )}
                    <span className="sr-only">Upload ornamen</span>
                    <input
                        type="file"
                        accept="image/png,image/webp,image/svg+xml,image/jpeg,.svg"
                        className="hidden"
                        disabled={uploading}
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            event.target.value = '';

                            if (file) {
                                void upload(file);
                            }
                        }}
                    />
                </label>
                {library.map((ornament) => (
                    <div key={ornament.id} className="group relative">
                        <button
                            type="button"
                            title={ornament.name}
                            aria-label={`Tambah ornamen ${ornament.name}`}
                            onClick={() => void place(ornament)}
                            className={cn(tileClass, 'editor-checker w-full')}
                        >
                            <img
                                src={ornament.url}
                                alt=""
                                className="max-h-full max-w-full object-contain"
                            />
                        </button>
                        <button
                            type="button"
                            title="Hapus dari pustaka"
                            aria-label={`Hapus ornamen ${ornament.name}`}
                            onClick={() => void remove(ornament)}
                            className="absolute -top-1 -right-1 hidden rounded-full border border-slate-200 bg-white p-0.5 text-slate-500 group-focus-within:block group-hover:block hover:text-red-500"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Format: PNG atau WebP berlatar transparan (disarankan), atau SVG
                (otomatis diubah ke PNG). JPG bisa, tetapi tidak transparan.
                Gambar di atas 1600 px diperkecil otomatis.
            </p>
        </>
    );
}

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
            <OrnamentPicker projectId={projectId} />
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
