import {
    BookmarkPlus,
    Download,
    ImagePlus,
    LoaderCircle,
    RotateCcw,
    Sparkles,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ImageLibraryPicker from '@/components/image-library-picker';
import { useLibraryImage } from '@/lib/image-library';
import { DesignStyleManager } from '@/components/editor/design-style-manager';
import type { GenerationBrief } from '@/hooks/use-generation';
import { api, errorMessage } from '@/lib/api';
import { removeBackground } from '@/lib/background-removal';
import { ACCENT_COLORS, CANVAS_PRESETS } from '@/lib/editor-elements';
import { useEditorStore } from '@/lib/editor-store';
import { uploadImage } from '@/lib/image-processing';
import { cn } from '@/lib/utils';
import {
    destroy as destroyPreset,
    index as listPresets,
    store as storePreset,
} from '@/routes/api/prompt-presets';
import type {
    BannerStyle,
    EditorAsset,
    EditorPayload,
    LibraryImage,
    DesignStyle,
    PromptPreset,
} from '@/types';

type Generation = {
    busy: boolean;
    queued: boolean;
    failed: boolean;
    error: string | null;
    start: (brief: GenerationBrief) => Promise<void>;
    retry: () => Promise<void>;
    cancel: () => Promise<void>;
};

const STYLES: { value: BannerStyle; label: string }[] = [
    { value: 'cutout', label: 'Foto cutout — latar terang & ornamen' },
    { value: 'panel', label: 'Panel warna — dengan gambar AI' },
];

const HEX = /^#[0-9a-f]{6}$/i;

const iconButton =
    'rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40';

function isStyle(value: unknown): value is BannerStyle {
    return value === 'cutout' || value === 'panel';
}

function download(content: string, filename: string): void {
    const link = document.createElement('a');

    link.href = URL.createObjectURL(
        new Blob([content], { type: 'application/json' }),
    );
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function BriefUpload({
    label,
    kind,
    projectId,
    asset,
    removeBg = false,
    onChange,
}: {
    label: string;
    kind: 'upload' | 'logo';
    projectId: number;
    asset: EditorAsset | null;
    /** Cut the subject out of its background before uploading. */
    removeBg?: boolean;
    onChange: (asset: EditorAsset | null) => void;
}) {
    const [status, setStatus] = useState<string | null>(null);

    const choose = async (image: LibraryImage): Promise<void> => {
        try {
            if (removeBg && kind === 'upload' && image.kind !== 'cutout') {
                setStatus('Menghapus latar…');
                const response = await fetch(image.url, {
                    credentials: 'same-origin',
                });
                if (!response.ok)
                    throw new Error('Gagal membaca gambar dari pustaka.');
                const cutout = await removeBackground(await response.blob());
                onChange(
                    await uploadImage(
                        projectId,
                        cutout,
                        'cutout',
                        image.name.replace(/\.[^.]+$/, '') + '.png',
                    ),
                );
            } else {
                setStatus('Menambahkan gambar…');
                onChange(
                    await useLibraryImage(
                        projectId,
                        image,
                        kind === 'logo'
                            ? 'logo'
                            : image.kind === 'cutout'
                              ? 'cutout'
                              : 'upload',
                    ),
                );
            }
        } finally {
            setStatus(null);
        }
    };

    if (asset) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-1.5 text-xs">
                <img
                    src={asset.url}
                    alt=""
                    className="editor-checker size-8 rounded object-contain"
                />
                <span className="min-w-0 flex-1 truncate">
                    {asset.name ?? label}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="rounded p-1 text-slate-400 hover:text-red-500"
                    aria-label={`Hapus ${label}`}
                >
                    <X className="size-3.5" />
                </button>
            </div>
        );
    }

    return (
        <ImageLibraryPicker title={label} uploadKind={kind} onChoose={choose}>
            <button
                type="button"
                disabled={status !== null}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-2.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
                {status ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                    <ImagePlus className="size-3.5" />
                )}
                {status ?? label}
            </button>
        </ImageLibraryPicker>
    );
}

export function GeneratorPanel({
    projectId,
    generation,
    brief,
    maxPromptLength,
    fonts,
}: {
    projectId: number;
    generation: Generation;
    brief: EditorPayload['brief'];
    maxPromptLength: number;
    fonts: string[];
}) {
    const canvas = useEditorStore((state) => state.document.canvas);
    const accent = useEditorStore((state) => state.accent);
    const setAccent = useEditorStore((state) => state.setAccent);
    const setCanvas = useEditorStore((state) => state.setCanvas);
    const [prompt, setPrompt] = useState(brief?.prompt ?? '');
    const [designStyles, setDesignStyles] = useState<DesignStyle[]>([]);
    const [designStyle, setDesignStyle] = useState(brief?.design_style ?? '');
    const [styleLoadError, setStyleLoadError] = useState(false);
    const [style, setStyle] = useState<BannerStyle>(brief?.style ?? 'cutout');
    const [photo, setPhoto] = useState<EditorAsset | null>(null);
    const [logo, setLogo] = useState<EditorAsset | null>(null);
    const [removeBg, setRemoveBg] = useState(true);
    const [presets, setPresets] = useState<PromptPreset[]>([]);
    const [presetId, setPresetId] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        api<{ data: PromptPreset[] }>(listPresets())
            .then(({ data }) => {
                if (!cancelled) {
                    setPresets(data);
                }
            })
            .catch(() => {
                // Saved prompts are a convenience; the editor works without.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const updateDesignStyles = (data: DesignStyle[]) => {
        setDesignStyles(data);
        setDesignStyle((current) =>
            data.some((item) => item.key === current) ? current : '',
        );
    };
    useEffect(() => {
        let cancelled = false;
        api<{ data: DesignStyle[] }>({
            url: '/api/design-styles',
            method: 'get',
        })
            .then(({ data }) => {
                if (!cancelled) {
                    setDesignStyles(data);
                    setDesignStyle((current) =>
                        data.some((item) => item.key === current)
                            ? current
                            : '',
                    );
                }
            })
            .catch(() => {
                if (!cancelled) setStyleLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);
    const selectedDesignStyle = designStyles.find(
        (item) => item.key === designStyle,
    );

    const size = `${canvas.width}x${canvas.height}`;
    const isPreset = CANVAS_PRESETS.some(
        (preset) => `${preset.width}x${preset.height}` === size,
    );
    const selectedPreset = presets.find((preset) => preset.id === presetId);
    const hasPrompt = prompt.trim().length >= 5;

    /** Load a saved or imported brief into the form. */
    const applyBrief = (values: {
        prompt: string;
        primary_color?: unknown;
        style?: unknown;
        design_style?: unknown;
        width?: unknown;
        height?: unknown;
    }): void => {
        setPrompt(values.prompt.slice(0, maxPromptLength));

        if (
            typeof values.primary_color === 'string' &&
            HEX.test(values.primary_color)
        ) {
            setAccent(values.primary_color);
        }

        if (isStyle(values.style)) {
            setStyle(values.style);
        }

        if ('design_style' in values) {
            setDesignStyle(
                typeof values.design_style === 'string' &&
                    designStyles.some(
                        (item) => item.key === values.design_style,
                    )
                    ? values.design_style
                    : '',
            );
        }

        const width = Number(values.width);
        const height = Number(values.height);

        if (
            Number.isInteger(width) &&
            Number.isInteger(height) &&
            width >= 50 &&
            width <= 4096 &&
            height >= 50 &&
            height <= 4096 &&
            (width !== canvas.width || height !== canvas.height)
        ) {
            setCanvas({ width, height });
        }
    };

    const savePreset = async (): Promise<void> => {
        const name = window
            .prompt('Simpan prompt dengan nama:', selectedPreset?.name ?? '')
            ?.trim();

        if (!name) {
            return;
        }

        try {
            const saved = await api<PromptPreset>(storePreset(), {
                name,
                prompt: prompt.trim(),
                primary_color: accent,
                style,
                design_style: designStyle || null,
            });

            setPresets((current) =>
                [...current.filter((item) => item.id !== saved.id), saved].sort(
                    (a, b) => a.name.localeCompare(b.name),
                ),
            );
            setPresetId(saved.id);
            toast.success('Prompt disimpan.');
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const deletePreset = async (): Promise<void> => {
        if (
            !selectedPreset ||
            !window.confirm(`Hapus prompt "${selectedPreset.name}"?`)
        ) {
            return;
        }

        try {
            await api(destroyPreset(selectedPreset.id));
            setPresets((current) =>
                current.filter((item) => item.id !== selectedPreset.id),
            );
            setPresetId(null);
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const exportPrompt = (): void => {
        const name = selectedPreset?.name ?? 'prompt-banner';

        download(
            JSON.stringify(
                {
                    app: 'bannerai-prompt',
                    version: 1,
                    name,
                    prompt: prompt.trim(),
                    primary_color: accent,
                    style,
                    design_style: designStyle || null,
                    width: canvas.width,
                    height: canvas.height,
                },
                null,
                2,
            ),
            `${
                name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '') || 'prompt'
            }.json`,
        );
    };

    const importPrompt = async (file: File): Promise<void> => {
        const text = await file.text();

        try {
            const parsed: unknown = JSON.parse(text);

            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'prompt' in parsed &&
                typeof parsed.prompt === 'string'
            ) {
                applyBrief(parsed as { prompt: string });
                setPresetId(null);
                toast.success('Prompt diimpor.');

                return;
            }

            toast.error('Berkas tidak berisi prompt.');
        } catch {
            // Not JSON: treat the file as the prompt text itself.
            applyBrief({ prompt: text.trim() });
            setPresetId(null);
        }
    };

    return (
        <div className="border-b border-slate-200 p-5">
            <div className="mb-1 flex items-center gap-2">
                <Sparkles className="size-4 text-orange-500" />
                <h2 className="font-bold">AI Banner Generator</h2>
            </div>
            <p className="mb-4 text-xs text-slate-500">
                Jelaskan banner yang ingin Anda buat. Teks dan warna yang Anda
                tulis persis akan dipakai apa adanya.
            </p>
            <textarea
                rows={6}
                value={prompt}
                maxLength={maxPromptLength}
                onChange={(event) => setPrompt(event.target.value)}
                className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                placeholder={
                    'Contoh: Banner hero NGO "Sedekah Pangan Santri".\nHeadline: "Sedekah Pangan Santri"\nSubheadline: "Bantu Penuhi Kebutuhan Pangan Para Penghafal Al-Qur\'an"\nTombol CTA: "Sedekah Sekarang"'
                }
            />

            <div className="mt-2 flex items-center gap-1.5">
                <select
                    value={presetId ?? ''}
                    aria-label="Prompt tersimpan"
                    onChange={(event) => {
                        const preset = presets.find(
                            (item) => item.id === Number(event.target.value),
                        );

                        setPresetId(preset?.id ?? null);

                        if (preset) {
                            applyBrief(preset);
                        }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-xs"
                >
                    <option value="">
                        {presets.length
                            ? 'Prompt tersimpan…'
                            : 'Belum ada prompt tersimpan'}
                    </option>
                    {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                            {preset.name}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    title="Simpan prompt"
                    aria-label="Simpan prompt"
                    disabled={!hasPrompt}
                    onClick={() => void savePreset()}
                    className={iconButton}
                >
                    <BookmarkPlus className="size-3.5" />
                </button>
                {selectedPreset && (
                    <button
                        type="button"
                        title="Hapus prompt tersimpan"
                        aria-label="Hapus prompt tersimpan"
                        onClick={() => void deletePreset()}
                        className={iconButton}
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    title="Export prompt ke berkas"
                    aria-label="Export prompt"
                    disabled={!hasPrompt}
                    onClick={exportPrompt}
                    className={iconButton}
                >
                    <Download className="size-3.5" />
                </button>
                <label
                    title="Import prompt dari berkas"
                    className={cn(iconButton, 'cursor-pointer')}
                >
                    <Upload className="size-3.5" />
                    <span className="sr-only">Import prompt</span>
                    <input
                        type="file"
                        accept=".json,.txt,.md,application/json,text/plain"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            event.target.value = '';

                            if (file) {
                                void importPrompt(file);
                            }
                        }}
                    />
                </label>
            </div>

            <div className="mt-4">
                <label
                    htmlFor="design-style"
                    className="text-xs font-semibold text-slate-600"
                >
                    Gaya desain
                </label>
                <select
                    id="design-style"
                    value={designStyle}
                    disabled={generation.busy}
                    onChange={(event) => setDesignStyle(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                >
                    <option value="">Otomatis — ikuti brief</option>
                    <optgroup label="Gaya bawaan">
                        {designStyles
                            .filter((item) => item.builtin)
                            .map((item) => (
                                <option key={item.key} value={item.key}>
                                    {item.name}
                                </option>
                            ))}
                    </optgroup>
                    <optgroup label="Gaya saya">
                        {designStyles
                            .filter((item) => !item.builtin)
                            .map((item) => (
                                <option key={item.key} value={item.key}>
                                    {item.name}
                                </option>
                            ))}
                    </optgroup>
                </select>
                {selectedDesignStyle && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {selectedDesignStyle.description ||
                            'Panduan teks, gambar, dan dekorasi kustom.'}
                    </p>
                )}
                {styleLoadError && (
                    <p role="status" className="mt-2 text-xs text-red-600">
                        Gagal memuat gaya. Muat ulang halaman untuk mencoba
                        lagi.
                    </p>
                )}
                <DesignStyleManager
                    styles={designStyles}
                    fonts={fonts}
                    onChange={updateDesignStyles}
                    onSelect={setDesignStyle}
                    disabled={generation.busy}
                />
            </div>

            <div className="mt-4">
                <label
                    htmlFor="banner-style"
                    className="text-xs font-semibold text-slate-600"
                >
                    Mode komposisi
                </label>
                <select
                    id="banner-style"
                    value={style}
                    onChange={(event) => {
                        if (isStyle(event.target.value)) {
                            setStyle(event.target.value);
                        }
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                >
                    {STYLES.map((item) => (
                        <option key={item.value} value={item.value}>
                            {item.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mt-4">
                <label
                    htmlFor="canvas-size"
                    className="text-xs font-semibold text-slate-600"
                >
                    Ukuran canvas
                </label>
                <select
                    id="canvas-size"
                    value={size}
                    onChange={(event) => {
                        const [width, height] = event.target.value
                            .split('x')
                            .map(Number);

                        setCanvas({ width, height });
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                >
                    {!isPreset && (
                        <option value={size}>
                            Kustom — {canvas.width} × {canvas.height}
                        </option>
                    )}
                    {CANVAS_PRESETS.map((preset) => (
                        <option
                            key={preset.label}
                            value={`${preset.width}x${preset.height}`}
                        >
                            {preset.label} — {preset.width} × {preset.height}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mt-4">
                <span className="text-xs font-semibold text-slate-600">
                    Warna utama
                </span>
                <div className="mt-2 flex items-center gap-2">
                    {ACCENT_COLORS.map((color) => (
                        <button
                            key={color.value}
                            type="button"
                            title={color.name}
                            aria-label={color.name}
                            onClick={() => setAccent(color.value)}
                            style={{ backgroundColor: color.value }}
                            className={cn(
                                'size-8 rounded-full',
                                accent === color.value &&
                                    'ring-2 ring-orange-500 ring-offset-2',
                            )}
                        />
                    ))}
                    <input
                        type="color"
                        value={accent}
                        title="Pilih warna"
                        onChange={(event) => setAccent(event.target.value)}
                        className="h-8 w-9 cursor-pointer rounded"
                    />
                </div>
            </div>

            <div className="mt-4">
                <span className="text-xs font-semibold text-slate-600">
                    Foto &amp; logo (opsional)
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <BriefUpload
                        label="Foto"
                        kind="upload"
                        projectId={projectId}
                        asset={photo}
                        removeBg={removeBg}
                        onChange={setPhoto}
                    />
                    <BriefUpload
                        label="Logo"
                        kind="logo"
                        projectId={projectId}
                        asset={logo}
                        onChange={setLogo}
                    />
                </div>
                <label className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                    <input
                        type="checkbox"
                        checked={removeBg}
                        onChange={(event) => setRemoveBg(event.target.checked)}
                        className="mt-0.5 accent-orange-500"
                    />
                    <span>
                        Hapus latar foto otomatis (diproses di browser, foto
                        tidak dikirim ke pihak ketiga)
                    </span>
                </label>
            </div>

            <button
                type="button"
                disabled={generation.busy || !hasPrompt}
                onClick={() =>
                    void generation.start({
                        prompt: prompt.trim(),
                        photoAssetId: photo?.id ?? null,
                        logoAssetId: logo?.id ?? null,
                        style,
                        designStyle: designStyle || null,
                    })
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 font-bold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {generation.busy ? (
                    <LoaderCircle className="size-4 animate-spin" />
                ) : (
                    <Sparkles className="size-4" />
                )}
                {generation.busy ? 'Membuat banner…' : 'Generate Banner'}
            </button>

            {generation.error && !generation.busy && (
                <div
                    role="alert"
                    className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                >
                    <p>{generation.error}</p>
                    {generation.failed && (
                        <button
                            type="button"
                            onClick={() => void generation.retry()}
                            className="mt-2 inline-flex items-center gap-1 font-semibold underline"
                        >
                            <RotateCcw className="size-3" />
                            Coba lagi
                        </button>
                    )}
                </div>
            )}

            <p className="mt-2 text-[11px] text-slate-400">
                Hasil generate menggantikan desain saat ini. Gunakan Undo untuk
                kembali.
            </p>
        </div>
    );
}
