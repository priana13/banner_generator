import { ImagePlus, LoaderCircle, RotateCcw, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { GenerationBrief } from '@/hooks/use-generation';
import { api, errorMessage } from '@/lib/api';
import { ACCENT_COLORS, CANVAS_PRESETS } from '@/lib/editor-elements';
import { useEditorStore } from '@/lib/editor-store';
import { cn } from '@/lib/utils';
import { store as uploadAsset } from '@/routes/api/projects/assets';
import type { EditorAsset } from '@/types';

type Generation = {
    busy: boolean;
    queued: boolean;
    failed: boolean;
    error: string | null;
    start: (brief: GenerationBrief) => Promise<void>;
    retry: () => Promise<void>;
    cancel: () => Promise<void>;
};

function BriefUpload({
    label,
    kind,
    projectId,
    asset,
    onChange,
}: {
    label: string;
    kind: 'upload' | 'logo';
    projectId: number;
    asset: EditorAsset | null;
    onChange: (asset: EditorAsset | null) => void;
}) {
    const [uploading, setUploading] = useState(false);

    const upload = async (file: File): Promise<void> => {
        const form = new FormData();

        form.append('file', file);
        form.append('kind', kind);
        setUploading(true);

        try {
            const uploaded = await api<EditorAsset>(
                uploadAsset(projectId),
                form,
            );

            useEditorStore.getState().addAsset(uploaded);
            onChange(uploaded);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setUploading(false);
        }
    };

    if (asset) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-1.5 text-xs">
                <img
                    src={asset.url}
                    alt=""
                    className="size-8 rounded object-cover"
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
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-2.5 text-xs text-slate-500 hover:bg-slate-50">
            {uploading ? (
                <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
                <ImagePlus className="size-3.5" />
            )}
            {label}
            <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
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
    );
}

export function GeneratorPanel({
    projectId,
    generation,
}: {
    projectId: number;
    generation: Generation;
}) {
    const canvas = useEditorStore((state) => state.document.canvas);
    const accent = useEditorStore((state) => state.accent);
    const setAccent = useEditorStore((state) => state.setAccent);
    const setCanvas = useEditorStore((state) => state.setCanvas);
    const [prompt, setPrompt] = useState('');
    const [photo, setPhoto] = useState<EditorAsset | null>(null);
    const [logo, setLogo] = useState<EditorAsset | null>(null);

    const size = `${canvas.width}x${canvas.height}`;
    const isPreset = CANVAS_PRESETS.some(
        (preset) => `${preset.width}x${preset.height}` === size,
    );

    return (
        <div className="border-b border-slate-200 p-5">
            <div className="mb-1 flex items-center gap-2">
                <Sparkles className="size-4 text-orange-500" />
                <h2 className="font-bold">AI Banner Generator</h2>
            </div>
            <p className="mb-4 text-xs text-slate-500">
                Jelaskan banner yang ingin Anda buat.
            </p>
            <textarea
                rows={5}
                value={prompt}
                maxLength={1000}
                onChange={(event) => setPrompt(event.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="Contoh: Banner donasi tebar pangan santri, warna oranye, foto santri di sebelah kanan..."
            />

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
            </div>

            <button
                type="button"
                disabled={generation.busy || prompt.trim().length < 5}
                onClick={() =>
                    void generation.start({
                        prompt: prompt.trim(),
                        photoAssetId: photo?.id ?? null,
                        logoAssetId: logo?.id ?? null,
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
