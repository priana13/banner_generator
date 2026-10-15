import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BannerPromptBuilder } from '@/components/editor/banner-prompt-builder';
import GeneratorSettings from '@/components/generator-settings';
import type { BannerStyle, DesignStyle } from '@/types';

export default function GeneratePrompt({
    maxPromptLength,
    designStyles,
}: {
    maxPromptLength: number;
    designStyles: DesignStyle[];
}) {
    const [settings, setSettings] = useState({
        width: 1200,
        height: 400,
        color: '#f97316',
    });
    const [style, setStyle] = useState<BannerStyle>('cutout');
    const [designStyle, setDesignStyle] = useState('');
    return (
        <>
            <Head title="Generate Prompt" />
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
                <div>
                    <h1 className="text-xl font-semibold">Generate Prompt</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Buat arahan banner dengan AI, simpan, dan duplikat untuk
                        kebutuhan berikutnya.
                    </p>
                </div>
                <GeneratorSettings value={settings} onChange={setSettings} />
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                        Mode komposisi
                        <select
                            value={style}
                            onChange={(event) =>
                                setStyle(event.target.value as BannerStyle)
                            }
                            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800"
                        >
                            <option value="cutout">Foto cutout</option>
                            <option value="panel">Panel warna</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium">
                        Gaya desain
                        <select
                            value={designStyle}
                            onChange={(event) =>
                                setDesignStyle(event.target.value)
                            }
                            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800"
                        >
                            <option value="">Otomatis — ikuti brief</option>
                            {designStyles.map((item) => (
                                <option key={item.key} value={item.key}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <BannerPromptBuilder
                    inline
                    width={settings.width}
                    height={settings.height}
                    color={settings.color}
                    composition={style}
                    designStyle={designStyle}
                    maxPromptLength={maxPromptLength}
                    disabled={false}
                    onPresetSaved={() => {}}
                    onRestore={(preset) => {
                        if (preset.primary_color)
                            setSettings((current) => ({
                                ...current,
                                color: preset.primary_color!,
                            }));
                        if (preset.style) setStyle(preset.style);
                        setDesignStyle(
                            designStyles.some(
                                (item) => item.key === preset.design_style,
                            )
                                ? preset.design_style!
                                : '',
                        );
                    }}
                    onApply={(prompt) => {
                        try {
                            sessionStorage.setItem(
                                'banner-image-draft',
                                JSON.stringify({ prompt, ...settings }),
                            );
                            router.visit('/generate-image');
                        } catch {
                            toast.error(
                                'Tidak dapat meneruskan prompt. Salin prompt lalu buka Generate Image.',
                            );
                        }
                    }}
                />
            </div>
        </>
    );
}
GeneratePrompt.layout = {
    breadcrumbs: [{ title: 'Generate Prompt', href: '/generate-prompt' }],
};
