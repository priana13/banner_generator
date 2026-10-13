import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowDown,
    ArrowUp,
    Bold,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEditorStore, useSelectedElement } from '@/lib/editor-store';
import { cn } from '@/lib/utils';
import type { ElementPatch } from '@/types';

const inputClass =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';

const ALIGNMENTS = [
    { value: 'left', label: 'Rata kiri', icon: AlignLeft },
    { value: 'center', label: 'Rata tengah', icon: AlignCenter },
    { value: 'right', label: 'Rata kanan', icon: AlignRight },
] as const;

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

export function PropertiesPanel({ fonts }: { fonts: string[] }) {
    const element = useSelectedElement();
    const canvas = useEditorStore((state) => state.document.canvas);
    const updateElement = useEditorStore((state) => state.updateElement);
    const reorderElement = useEditorStore((state) => state.reorderElement);
    const setCanvas = useEditorStore((state) => state.setCanvas);

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

    return (
        <>
            <div className="border-b border-slate-200 p-5">
                <h3 className="text-sm font-bold">Properti Elemen</h3>
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
                        <div className="flex gap-2">
                            <ToggleButton
                                active={element.fontStyle === 'bold'}
                                label="Tebal"
                                onClick={() =>
                                    update({
                                        fontStyle:
                                            element.fontStyle === 'bold'
                                                ? 'normal'
                                                : 'bold',
                                    })
                                }
                            >
                                <Bold className="size-4" />
                            </ToggleButton>
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
