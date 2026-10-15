import { Head, Link } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import GeneratorSettings from '@/components/generator-settings';
import { api, errorMessage } from '@/lib/api';
import type { LibraryImage, PromptPreset } from '@/types';

export default function GenerateImage({
    maxPromptLength,
}: {
    maxPromptLength: number;
}) {
    const [settings, setSettings] = useState({
        width: 1200,
        height: 400,
        color: '#f97316',
    });
    const [prompt, setPrompt] = useState('');
    const [presets, setPresets] = useState<PromptPreset[]>([]);
    const [busy, setBusy] = useState(false);
    const [image, setImage] = useState<LibraryImage | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        try {
            const draft = JSON.parse(
                sessionStorage.getItem('banner-image-draft') ?? 'null',
            );
            if (draft && typeof draft.prompt === 'string') {
                setPrompt(draft.prompt.slice(0, maxPromptLength));
                if (
                    Number.isInteger(draft.width) &&
                    draft.width >= 50 &&
                    draft.width <= 4096 &&
                    Number.isInteger(draft.height) &&
                    draft.height >= 50 &&
                    draft.height <= 4096 &&
                    /^#[0-9a-f]{6}$/i.test(draft.color)
                )
                    setSettings({
                        width: draft.width,
                        height: draft.height,
                        color: draft.color,
                    });
            }
        } catch {
            /* A copied prompt can still be pasted manually. */
        }
        api<{ data: PromptPreset[] }>({
            url: '/api/prompt-presets',
            method: 'get',
        })
            .then(({ data }) => setPresets(data))
            .catch(() =>
                setError(
                    'Gagal memuat prompt tersimpan. Anda tetap bisa menempelkan prompt.',
                ),
            );
    }, [maxPromptLength]);
    const generate = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const result = await api<LibraryImage>(
                { url: '/api/generate-image', method: 'post' },
                { prompt: prompt.trim(), ...settings },
            );
            setImage(result);
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            <Head title="Generate Image" />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
                <div>
                    <h1 className="text-xl font-semibold">Generate Image</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Buat gambar dari prompt menggunakan model gambar di AI
                        Global. Hasil otomatis disimpan ke Aset.
                    </p>
                </div>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void generate();
                    }}
                    className="space-y-4"
                >
                    <fieldset disabled={busy} className="space-y-4">
                        <GeneratorSettings
                            value={settings}
                            onChange={setSettings}
                        />
                        <label className="block text-sm font-medium">
                            Gunakan prompt tersimpan
                            <select
                                defaultValue=""
                                onChange={(event) => {
                                    const selected = presets.find(
                                        (item) =>
                                            item.id ===
                                            Number(event.target.value),
                                    );
                                    if (selected) {
                                        setPrompt(selected.prompt);
                                        if (selected.primary_color)
                                            setSettings((current) => ({
                                                ...current,
                                                color: selected.primary_color!,
                                            }));
                                    }
                                }}
                                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800"
                            >
                                <option value="">Pilih prompt…</option>
                                {presets.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-sm font-medium">
                            Prompt gambar
                            <textarea
                                required
                                minLength={5}
                                maxLength={maxPromptLength}
                                rows={10}
                                value={prompt}
                                onChange={(event) =>
                                    setPrompt(event.target.value)
                                }
                                placeholder="Tempel prompt gambar atau buat melalui menu Generate Prompt."
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-800"
                            />
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="submit"
                                disabled={
                                    busy ||
                                    prompt.trim().length < 5 ||
                                    prompt.length > maxPromptLength
                                }
                                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
                            >
                                {busy && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                {busy ? 'Membuat gambar…' : 'Generate Image'}
                            </button>
                            <Link
                                href="/generate-prompt"
                                className="text-sm underline"
                            >
                                Buat prompt dengan AI
                            </Link>
                        </div>
                    </fieldset>
                </form>
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
                {image && (
                    <div className="space-y-3 rounded-xl border p-4">
                        <h2 className="font-semibold">
                            Gambar terakhir — tersimpan di Aset
                        </h2>
                        <img
                            src={image.url}
                            alt={image.name}
                            className="h-auto w-full rounded-lg"
                        />
                        <div className="flex gap-4 text-sm">
                            <a
                                href={image.url}
                                download={`${image.name}.jpg`}
                                className="underline"
                            >
                                Unduh gambar
                            </a>
                            <Link href="/assets" className="underline">
                                Buka Aset
                            </Link>
                            <Link href="/dashboard" className="underline">
                                Buka proyek banner
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
GenerateImage.layout = {
    breadcrumbs: [{ title: 'Generate Image', href: '/generate-image' }],
};
