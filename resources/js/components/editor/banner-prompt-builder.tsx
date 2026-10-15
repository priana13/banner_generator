import { Copy, LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { BANNER_COLOR_THEMES } from '@/lib/banner-color-themes';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

type Props = {
    projectId: number;
    width: number;
    height: number;
    color: string;
    designStyle?: string;
    composition: 'cutout' | 'panel';
    maxPromptLength: number;
    disabled: boolean;
    onApply: (prompt: string) => void;
};

const fieldClass =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800';

export function BannerPromptBuilder(props: Props) {
    const [open, setOpen] = useState(false);
    const [concept, setConcept] = useState('');
    const [audience, setAudience] = useState('');
    const [headline, setHeadline] = useState('');
    const [cta, setCta] = useState('');
    const [visual, setVisual] = useState('');
    const [themeId, setThemeId] = useState('');
    const theme = BANNER_COLOR_THEMES.find((item) => item.id === themeId);
    const [layout, setLayout] = useState('right');
    const [includeText, setIncludeText] = useState(true);
    const [result, setResult] = useState('');

    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        if (generating) return;
        setGenerating(true);
        setError(null);
        try {
            const data = await api<{ prompt: string }>(
                {
                    url: `/api/projects/${props.projectId}/banner-prompt`,
                    method: 'post',
                },
                {
                    concept: concept.trim(),
                    audience,
                    visual,
                    headline: includeText ? headline : '',
                    cta: includeText ? cta : '',
                    layout,
                    include_text: includeText,
                    composition: props.composition,
                    width: props.width,
                    height: props.height,
                    color: theme?.primary ?? props.color,
                    color_theme: theme
                        ? {
                              name: theme.name,
                              primary: theme.primary,
                              background: theme.background,
                              accent: theme.accent,
                              text: theme.text,
                          }
                        : null,
                    design_style: props.designStyle || null,
                },
            );
            setResult(data.prompt);
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setGenerating(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(result);
            toast.success('Prompt disalin.');
        } catch {
            toast.error(
                'Gagal menyalin. Pilih dan salin teks prompt secara manual.',
            );
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!generating) setOpen(value);
            }}
        >
            <DialogTrigger asChild>
                <button
                    type="button"
                    disabled={props.disabled}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                >
                    <Sparkles className="size-3.5" />
                    Buat prompt gambar banner
                </button>
            </DialogTrigger>
            <DialogContent
                className="max-h-[90vh] overflow-y-auto bg-white text-slate-800 sm:max-w-2xl"
                style={{ colorScheme: 'light' }}
            >
                <DialogTitle>Pembuat prompt gambar banner web</DialogTitle>
                <DialogDescription>
                    AI mengembangkan detail banner menggunakan model teks di
                    pengaturan AI Global. Ukuran, warna, dan gaya mengikuti
                    pengaturan editor saat prompt dibuat.
                </DialogDescription>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void generate();
                    }}
                    className="space-y-3"
                >
                    <fieldset disabled={generating} className="space-y-3">
                        <label className="block text-xs font-semibold">
                            Konsep / produk / tujuan *
                            <textarea
                                required
                                maxLength={1500}
                                rows={3}
                                value={concept}
                                onChange={(event) =>
                                    setConcept(event.target.value)
                                }
                                placeholder="Contoh: kampanye donasi pangan untuk santri selama Ramadan"
                                className={fieldClass}
                            />
                        </label>
                        <label className="block text-xs font-semibold">
                            Target audiens
                            <input
                                maxLength={300}
                                value={audience}
                                onChange={(event) =>
                                    setAudience(event.target.value)
                                }
                                placeholder="Contoh: donatur muda dan keluarga"
                                className={fieldClass}
                            />
                        </label>
                        <label className="block text-xs font-semibold">
                            Arahan visual
                            <textarea
                                maxLength={1000}
                                rows={2}
                                value={visual}
                                onChange={(event) =>
                                    setVisual(event.target.value)
                                }
                                placeholder="Contoh: santri tersenyum membawa paket pangan, suasana hangat"
                                className={fieldClass}
                            />
                        </label>
                        <label className="block text-xs font-semibold">
                            Tema warna
                            <select
                                value={themeId}
                                onChange={(event) =>
                                    setThemeId(event.target.value)
                                }
                                className={fieldClass}
                            >
                                <option value="">
                                    Ikuti warna utama editor
                                </option>
                                {BANNER_COLOR_THEMES.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {theme && (
                            <div
                                className="grid grid-cols-4 gap-2"
                                aria-label={`Palet ${theme.name}`}
                            >
                                {(
                                    [
                                        ['Utama', theme.primary],
                                        ['Latar', theme.background],
                                        ['Aksen', theme.accent],
                                        ['Teks', theme.text],
                                    ] as const
                                ).map(([label, color]) => (
                                    <div
                                        key={label}
                                        className="text-center text-[10px] text-slate-600"
                                    >
                                        <div
                                            className="mb-1 h-7 rounded border border-slate-200"
                                            style={{ backgroundColor: color }}
                                        />
                                        <div>{label}</div>
                                        <div>{color}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className="block text-xs font-semibold">
                            Posisi visual
                            <select
                                value={layout}
                                onChange={(event) =>
                                    setLayout(event.target.value)
                                }
                                className={fieldClass}
                            >
                                <option value="right">
                                    Visual kanan, teks kiri
                                </option>
                                <option value="left">
                                    Visual kiri, teks kanan
                                </option>
                            </select>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={includeText}
                                onChange={(event) =>
                                    setIncludeText(event.target.checked)
                                }
                            />
                            Sertakan teks dan CTA dalam gambar
                        </label>
                        {includeText && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="text-xs font-semibold">
                                    Headline (opsional)
                                    <input
                                        maxLength={200}
                                        value={headline}
                                        onChange={(event) =>
                                            setHeadline(event.target.value)
                                        }
                                        className={fieldClass}
                                    />
                                </label>
                                <label className="text-xs font-semibold">
                                    Tombol CTA (opsional)
                                    <input
                                        maxLength={100}
                                        value={cta}
                                        onChange={(event) =>
                                            setCta(event.target.value)
                                        }
                                        className={fieldClass}
                                    />
                                </label>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={generating || !concept.trim()}
                            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                            {generating && (
                                <LoaderCircle className="mr-2 inline size-4 animate-spin" />
                            )}
                            {generating
                                ? 'AI sedang membuat prompt…'
                                : 'Generate prompt dengan AI'}
                        </button>
                    </fieldset>
                </form>
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
                {result && (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                        <label className="block text-xs font-semibold">
                            Hasil prompt (bisa diedit)
                            <textarea
                                rows={10}
                                value={result}
                                onChange={(event) =>
                                    setResult(event.target.value)
                                }
                                className={fieldClass}
                            />
                        </label>
                        <p className="text-xs text-slate-500">
                            Salin untuk generator gambar pilihan Anda, atau
                            gunakan sebagai brief di editor. Generate ulang
                            setelah mengubah detail di atas.
                        </p>
                        {result.length > props.maxPromptLength && (
                            <p role="alert" className="text-xs text-red-600">
                                Prompt melebihi batas brief{' '}
                                {props.maxPromptLength} karakter. Pendekkan
                                sebelum digunakan.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={generating || !result.trim()}
                                onClick={() => void copy()}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                            >
                                <Copy className="size-4" />
                                Salin prompt
                            </button>
                            <button
                                type="button"
                                disabled={
                                    props.disabled ||
                                    generating ||
                                    !result.trim() ||
                                    result.length > props.maxPromptLength
                                }
                                onClick={() => {
                                    props.onApply(result.trim());
                                    setOpen(false);
                                    toast.success(
                                        'Prompt dimasukkan ke brief banner.',
                                    );
                                }}
                                className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Gunakan sebagai brief
                            </button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
