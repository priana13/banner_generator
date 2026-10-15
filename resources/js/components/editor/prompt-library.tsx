import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { PromptPreset } from '@/types';

export function PromptLibrary({
    prompt,
    settings,
    disabled,
    maxPromptLength,
    onLoad,
    onSaved,
}: {
    prompt: string;
    settings: Pick<
        PromptPreset,
        'primary_color' | 'style' | 'design_style' | 'builder'
    >;
    disabled: boolean;
    maxPromptLength: number;
    onLoad: (preset: PromptPreset) => void;
    onSaved: (preset: PromptPreset) => void;
}) {
    const [presets, setPresets] = useState<PromptPreset[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const refresh = async () => {
        setLoading(true);
        try {
            const data = await api<{ data: PromptPreset[] }>({
                url: '/api/prompt-presets',
                method: 'get',
            });
            setPresets(data.data);
            setError(null);
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void refresh();
    }, []);

    const duplicate = () => {
        const original = presets.find((item) => item.id === selected);
        if (!original) return;
        // Copy the current edits as well as the original settings into a new draft.
        let suffix = 1;
        let next: string;
        do {
            next = `${original.name.slice(0, 60)} — Salinan ${suffix++}`;
        } while (presets.some((item) => item.name === next));
        setSelected(null);
        setName(next);
        setError(null);
        toast.success(
            'Draf salinan dibuat. Sesuaikan lalu simpan dengan nama baru.',
        );
    };

    const save = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const original = presets.find((item) => item.id === selected);
        try {
            const saved = await api<PromptPreset>(
                { url: '/api/prompt-presets', method: 'post' },
                {
                    ...settings,
                    name: name.trim(),
                    prompt: prompt.trim(),
                    create_only: !original || original.name !== name.trim(),
                },
            );
            setPresets((current) =>
                [...current.filter((item) => item.id !== saved.id), saved].sort(
                    (a, b) => a.name.localeCompare(b.name),
                ),
            );
            setSelected(saved.id);
            setName(saved.name);
            onSaved(saved);
            toast.success('Prompt dan isian form disimpan.');
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <fieldset
            disabled={disabled || busy || loading}
            className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
            <legend className="px-1 text-sm font-semibold">
                Pustaka prompt
            </legend>
            <label className="block text-xs font-semibold">
                Prompt tersimpan
                <select
                    value={selected ?? ''}
                    onChange={(event) => {
                        const preset = presets.find(
                            (item) => item.id === Number(event.target.value),
                        );
                        setSelected(preset?.id ?? null);
                        setName(preset?.name ?? '');
                        setError(null);
                        if (preset) onLoad(preset);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                >
                    <option value="">
                        {loading ? 'Memuat…' : 'Simpan sebagai prompt baru'}
                    </option>
                    {presets.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block text-xs font-semibold">
                Nama prompt
                <input
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Contoh: Kampanye Ramadan"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                />
            </label>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={
                        !name.trim() ||
                        prompt.trim().length < 5 ||
                        prompt.length > maxPromptLength ||
                        busy ||
                        loading
                    }
                    onClick={() => void save()}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                    {busy ? 'Menyimpan…' : 'Simpan prompt'}
                </button>
                <button
                    type="button"
                    disabled={selected === null}
                    onClick={duplicate}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                    Duplikat untuk kebutuhan lain
                </button>
            </div>
            <p className="text-xs text-slate-500">
                Memuat prompt akan mengganti isian form. Simpan perubahan lebih
                dulu. Duplikat membuat draf baru; edit dan simpan untuk
                menyimpan salinannya.
            </p>
            {error && (
                <div role="alert" className="text-xs text-red-600">
                    {error}{' '}
                    <button
                        type="button"
                        onClick={() => void refresh()}
                        className="underline"
                    >
                        Muat ulang pustaka
                    </button>
                </div>
            )}
        </fieldset>
    );
}
