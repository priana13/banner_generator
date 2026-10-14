import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Copy,
    Trash2,
    Eraser,
    LoaderCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { removeBackground } from '@/lib/background-removal';
import { uploadImage } from '@/lib/image-processing';
import { useEditorStore, useSelectedElement } from '@/lib/editor-store';
import { cn } from '@/lib/utils';
import type {
    ElementFade,
    ElementPatch,
    FadeDirection,
    FontStyle,
    ImageElement,
    TextSpan,
} from '@/types';

const inputClass =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';

const ALIGNMENTS = [
    { value: 'left', label: 'Rata kiri', icon: AlignLeft },
    { value: 'center', label: 'Rata tengah', icon: AlignCenter },
    { value: 'right', label: 'Rata kanan', icon: AlignRight },
] as const;

const FONT_STYLES: { value: FontStyle; label: string }[] = [
    { value: 'normal', label: 'Regular' },
    { value: '600', label: 'SemiBold' },
    { value: 'bold', label: 'Bold' },
    { value: '800', label: 'ExtraBold' },
];

/**
 * Replace a photo with a version whose background was removed. The original
 * asset is kept, so the change can be undone.
 */
function RemoveBackgroundButton({
    projectId,
    element,
}: {
    projectId: number;
    element: ImageElement;
}) {
    const asset = useEditorStore((state) => state.assets[element.assetId]);
    const [working, setWorking] = useState(false);

    // Cutouts are done already; ornaments are artwork, not photos.
    if (!asset || asset.kind === 'cutout' || asset.kind === 'ornament') {
        return null;
    }

    const run = async (): Promise<void> => {
        setWorking(true);

        try {
            const photo = await (await fetch(asset.url)).blob();
            const cutout = await uploadImage(
                projectId,
                await removeBackground(photo),
                'cutout',
                'cutout.png',
            );

            // The cutout is cropped to its subject: fit it into the box
            // the photo occupied.
            const scale = Math.min(
                element.width / cutout.width,
                element.height / cutout.height,
            );
            const width = Math.round(cutout.width * scale);
            const height = Math.round(cutout.height * scale);

            useEditorStore.getState().updateElement(element.id, {
                assetId: cutout.id,
                x: Math.round(element.x + (element.width - width) / 2),
                y: Math.round(element.y + element.height - height),
                width,
                height,
            });
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setWorking(false);
        }
    };

    return (
        <div>
            <button
                type="button"
                disabled={working}
                onClick={() => void run()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 p-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
                {working ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                    <Eraser className="size-3.5" />
                )}
                {working ? 'Menghapus latar…' : 'Hapus latar foto'}
            </button>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Diproses di browser Anda; foto tidak dikirim ke pihak ketiga.
                Pemakaian pertama mengunduh model ±25 MB.
            </p>
        </div>
    );
}

const FADE_DIRECTIONS: {
    value: FadeDirection;
    label: string;
    icon: typeof ArrowUp;
}[] = [
    { value: 'left', label: 'Memudar ke kiri', icon: ArrowLeft },
    { value: 'right', label: 'Memudar ke kanan', icon: ArrowRight },
    { value: 'top', label: 'Memudar ke atas', icon: ArrowUp },
    { value: 'bottom', label: 'Memudar ke bawah', icon: ArrowDown },
];

/**
 * Transparency gradient: fade the element out towards one side, or soften
 * only its edges.
 */
function FadeControls({
    fade,
    onChange,
}: {
    fade: ElementFade | undefined;
    onChange: (fade: ElementFade | undefined) => void;
}) {
    const amount = fade?.amount ?? 0.4;

    return (
        <div className="space-y-3 border-t border-slate-200 pt-4">
            <Field label="Gradasi transparan">
                <select
                    value={fade?.type ?? 'none'}
                    onChange={(event) => {
                        const type = event.target.value;

                        onChange(
                            type === 'linear'
                                ? { type, direction: 'bottom', amount }
                                : type === 'edges'
                                  ? { type, amount }
                                  : undefined,
                        );
                    }}
                    className={inputClass}
                >
                    <option value="none">Tidak ada</option>
                    <option value="linear">Memudar ke satu sisi</option>
                    <option value="edges">Hanya bagian pinggir</option>
                </select>
            </Field>

            {fade?.type === 'linear' && (
                <div className="flex gap-2">
                    {FADE_DIRECTIONS.map((direction) => (
                        <ToggleButton
                            key={direction.value}
                            active={fade.direction === direction.value}
                            label={direction.label}
                            onClick={() =>
                                onChange({
                                    ...fade,
                                    direction: direction.value,
                                })
                            }
                        >
                            <direction.icon className="size-4" />
                        </ToggleButton>
                    ))}
                </div>
            )}

            {fade && (
                <Field
                    label={`${fade.type === 'edges' ? 'Kelembutan pinggir' : 'Panjang gradasi'} (${Math.round(fade.amount * 100)}%)`}
                >
                    <input
                        type="range"
                        min={5}
                        max={100}
                        value={Math.round(fade.amount * 100)}
                        onChange={(event) =>
                            onChange({
                                ...fade,
                                amount: Number(event.target.value) / 100,
                            })
                        }
                        className="mt-1 w-full accent-orange-500"
                    />
                </Field>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block text-xs font-semibold text-slate-500">
            {label}
            {children}
        </label>
    );
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <Field label={label}>
            <input
                type="color"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white p-1"
            />
        </Field>
    );
}

function ToggleButton({
    active,
    label,
    onClick,
    children,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'rounded-lg border p-2',
                active
                    ? 'border-orange-200 bg-orange-50 text-orange-600'
                    : 'border-slate-200 hover:bg-slate-50',
            )}
        >
            {children}
        </button>
    );
}

export function PropertiesPanel({
    fonts,
    projectId,
}: {
    fonts: string[];
    projectId: number;
}) {
    const element = useSelectedElement();
    const selectedIds = useEditorStore((state) => state.selectedIds);
    const duplicateSelected = useEditorStore(
        (state) => state.duplicateSelected,
    );
    const removeSelected = useEditorStore((state) => state.removeSelected);
    const canvas = useEditorStore((state) => state.document.canvas);
    const updateElement = useEditorStore((state) => state.updateElement);
    const reorderElement = useEditorStore((state) => state.reorderElement);
    const duplicateElement = useEditorStore((state) => state.duplicateElement);
    const setCanvas = useEditorStore((state) => state.setCanvas);
    const accent = useEditorStore((state) => state.accent);

    if (selectedIds.length > 1) {
        return (
            <div className="space-y-4 p-5">
                <h3 className="text-sm font-bold">
                    {selectedIds.length} elemen dipilih
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                    Shift+klik untuk menambah atau melepas pilihan. Seret salah
                    satu elemen untuk memindahkan bersama; gunakan gagang untuk
                    mengubah ukuran atau memutar. Layer terkunci tidak ikut
                    bergerak.
                </p>
                <button
                    type="button"
                    onClick={duplicateSelected}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 p-2 text-xs font-semibold text-orange-600 hover:bg-orange-50"
                >
                    <Copy className="size-4" />
                    Duplikat terpilih (Ctrl+D / ⌘D)
                </button>
                <button
                    type="button"
                    onClick={removeSelected}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 p-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                    <Trash2 className="size-4" />
                    Hapus terpilih
                </button>
            </div>
        );
    }
    if (!element) {
        return (
            <>
                <div className="border-b border-slate-200 p-5">
                    <h3 className="text-sm font-bold">Properti Canvas</h3>
                    <p className="mt-1 text-xs text-slate-400">
                        Pilih objek pada canvas untuk mengeditnya
                    </p>
                </div>
                <div className="space-y-4 p-5">
                    <ColorField
                        label="Warna latar"
                        value={canvas.backgroundColor}
                        onChange={(backgroundColor) =>
                            setCanvas({ backgroundColor }, 'canvas:background')
                        }
                    />
                    <p className="text-xs leading-relaxed text-slate-400">
                        Tips: semua elemen merupakan layer terpisah. Seret untuk
                        memindahkan, gunakan gagang untuk mengubah ukuran dan
                        memutar.
                    </p>
                </div>
            </>
        );
    }

    // Typing and slider drags collapse into one undo step per property.
    const update = (patch: ElementPatch): void =>
        updateElement(
            element.id,
            patch,
            `${element.id}:${Object.keys(patch).join(',')}`,
        );

    const hasText = element.type === 'text' || element.type === 'button';

    // Keep the plain text in sync: it is what search, previews and the
    // server-side layout read.
    const setSpans = (spans: TextSpan[]): void =>
        update({ spans, text: spans.map((span) => span.text).join(' ') });

    return (
        <>
            <div className="border-b border-slate-200 p-5">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">Properti Elemen</h3>
                    <button
                        type="button"
                        onClick={() => duplicateElement(element.id)}
                        title="Duplikat elemen (Ctrl+D / ⌘D)"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-50"
                    >
                        <Copy className="size-3.5" />
                        Duplikat
                    </button>
                </div>
                <input
                    value={element.name}
                    maxLength={80}
                    aria-label="Nama layer"
                    onChange={(event) => update({ name: event.target.value })}
                    className="mt-1 w-full bg-transparent text-xs text-slate-500 outline-none focus:text-slate-800"
                />
            </div>
            <div className="space-y-4 p-5">
                {hasText && (
                    <>
                        {element.type === 'text' && element.spans?.length ? (
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-slate-500">
                                    Teks per warna
                                </span>
                                {element.spans.map((span, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            value={span.text}
                                            maxLength={500}
                                            aria-label={`Teks bagian ${index + 1}`}
                                            onChange={(event) =>
                                                setSpans(
                                                    element.spans?.map(
                                                        (item, at) =>
                                                            at === index
                                                                ? {
                                                                      ...item,
                                                                      text: event
                                                                          .target
                                                                          .value,
                                                                  }
                                                                : item,
                                                    ) ?? [],
                                                )
                                            }
                                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-sm"
                                        />
                                        <input
                                            type="color"
                                            value={span.fill}
                                            aria-label={`Warna bagian ${index + 1}`}
                                            onChange={(event) =>
                                                setSpans(
                                                    element.spans?.map(
                                                        (item, at) =>
                                                            at === index
                                                                ? {
                                                                      ...item,
                                                                      fill: event
                                                                          .target
                                                                          .value,
                                                                  }
                                                                : item,
                                                    ) ?? [],
                                                )
                                            }
                                            className="h-9 w-10 shrink-0 rounded-lg border border-slate-200 bg-white p-1"
                                        />
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => update({ spans: undefined })}
                                    className="text-xs text-slate-500 underline"
                                >
                                    Jadikan satu warna
                                </button>
                            </div>
                        ) : (
                            <>
                                <Field label="Teks">
                                    <textarea
                                        rows={3}
                                        value={element.text}
                                        maxLength={2000}
                                        onChange={(event) =>
                                            update({ text: event.target.value })
                                        }
                                        className={inputClass}
                                    />
                                </Field>
                                {element.type === 'text' &&
                                    element.text.trim().includes(' ') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const words = element.text
                                                    .trim()
                                                    .split(/\s+/);
                                                const last = words.pop() ?? '';

                                                setSpans([
                                                    {
                                                        text: words.join(' '),
                                                        fill: accent,
                                                    },
                                                    {
                                                        text: last,
                                                        fill: element.fill,
                                                    },
                                                ]);
                                            }}
                                            className="-mt-2 block text-xs text-slate-500 underline"
                                        >
                                            Bagi menjadi dua warna
                                        </button>
                                    )}
                            </>
                        )}
                        <Field label="Font">
                            <select
                                value={element.fontFamily}
                                onChange={(event) =>
                                    update({ fontFamily: event.target.value })
                                }
                                className={inputClass}
                            >
                                {fonts.map((font) => (
                                    <option key={font} value={font}>
                                        {font}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Ukuran font">
                                <input
                                    type="number"
                                    min={4}
                                    max={1000}
                                    value={element.fontSize}
                                    onChange={(event) => {
                                        const fontSize = Number(
                                            event.target.value,
                                        );

                                        if (fontSize >= 4 && fontSize <= 1000) {
                                            update({ fontSize });
                                        }
                                    }}
                                    className={inputClass}
                                />
                            </Field>
                            <ColorField
                                label="Warna teks"
                                value={
                                    element.type === 'button'
                                        ? element.textColor
                                        : element.fill
                                }
                                onChange={(color) =>
                                    update(
                                        element.type === 'button'
                                            ? { textColor: color }
                                            : { fill: color },
                                    )
                                }
                            />
                        </div>
                        <Field label="Ketebalan">
                            <select
                                value={element.fontStyle}
                                onChange={(event) =>
                                    update({
                                        fontStyle: event.target
                                            .value as FontStyle,
                                    })
                                }
                                className={inputClass}
                            >
                                {FONT_STYLES.map((style) => (
                                    <option
                                        key={style.value}
                                        value={style.value}
                                    >
                                        {style.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="flex gap-2">
                            {element.type === 'text' &&
                                ALIGNMENTS.map((alignment) => (
                                    <ToggleButton
                                        key={alignment.value}
                                        active={
                                            element.align === alignment.value
                                        }
                                        label={alignment.label}
                                        onClick={() =>
                                            update({ align: alignment.value })
                                        }
                                    >
                                        <alignment.icon className="size-4" />
                                    </ToggleButton>
                                ))}
                        </div>
                    </>
                )}

                {element.type === 'image' && (
                    <RemoveBackgroundButton
                        projectId={projectId}
                        element={element}
                    />
                )}

                {element.type !== 'text' && element.type !== 'image' && (
                    <ColorField
                        label="Warna elemen"
                        value={element.fill}
                        onChange={(fill) => update({ fill })}
                    />
                )}

                {(element.type === 'rect' || element.type === 'button') && (
                    <Field label={`Sudut membulat (${element.cornerRadius})`}>
                        <input
                            type="range"
                            min={0}
                            max={Math.round(
                                Math.min(element.width, element.height) / 2,
                            )}
                            value={element.cornerRadius}
                            onChange={(event) =>
                                update({
                                    cornerRadius: Number(event.target.value),
                                })
                            }
                            className="mt-1 w-full accent-orange-500"
                        />
                    </Field>
                )}

                <Field
                    label={`Opasitas (${Math.round(element.opacity * 100)}%)`}
                >
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(element.opacity * 100)}
                        onChange={(event) =>
                            update({
                                opacity: Number(event.target.value) / 100,
                            })
                        }
                        className="mt-1 w-full accent-orange-500"
                    />
                </Field>

                {element.type !== 'text' && element.type !== 'button' && (
                    <FadeControls
                        fade={element.fade}
                        onChange={(fade) =>
                            updateElement(
                                element.id,
                                { fade },
                                `${element.id}:fade`,
                            )
                        }
                    />
                )}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => reorderElement(element.id, 'forward')}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 p-2 text-xs hover:bg-slate-50"
                    >
                        Ke depan <ArrowUp className="size-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => reorderElement(element.id, 'backward')}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 p-2 text-xs hover:bg-slate-50"
                    >
                        Ke belakang <ArrowDown className="size-3" />
                    </button>
                </div>

                {element.locked && (
                    <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-400">
                        Layer ini dikunci. Buka kunci di panel Layer untuk
                        memindahkannya di canvas.
                    </p>
                )}
            </div>
        </>
    );
}
