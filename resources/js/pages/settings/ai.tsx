import { Head, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Settings = {
    layout_provider: string;
    image_provider: string;
    gemini_model: string;
    gemini_image_model: string;
    openai_base_url: string;
    openai_layout_model: string;
    openai_image_model: string;
    gemini_api_key_configured: boolean;
    openai_api_key_configured: boolean;
};

export default function Ai({ settings }: { settings: Settings }) {
    const form = useForm({
        layout_provider: settings.layout_provider,
        image_provider: settings.image_provider,
        gemini_model: settings.gemini_model,
        gemini_image_model: settings.gemini_image_model,
        openai_base_url: settings.openai_base_url,
        openai_layout_model: settings.openai_layout_model,
        openai_image_model: settings.openai_image_model,
        gemini_api_key: '',
        openai_api_key: '',
    });
    const fields = [
        ['gemini_model', 'Model teks/layout Gemini'],
        ['gemini_image_model', 'Model gambar Gemini'],
        ['gemini_api_key', 'API key Gemini'],
        ['openai_base_url', 'Base URL OpenAI / OpenAI-compatible'],
        ['openai_layout_model', 'Model teks/layout OpenAI'],
        ['openai_image_model', 'Model gambar OpenAI'],
        ['openai_api_key', 'API key OpenAI'],
    ] as const;

    return (
        <>
            <Head title="AI Global" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Konfigurasi AI Global"
                    description="Pengaturan ini berlaku untuk semua pengguna dan generasi banner berikutnya."
                />
                <form
                    className="space-y-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put('/settings/ai', {
                            preserveScroll: true,
                            onSuccess: () =>
                                form.reset('gemini_api_key', 'openai_api_key'),
                        });
                    }}
                >
                    {(['layout_provider', 'image_provider'] as const).map(
                        (field) => (
                            <div className="grid gap-2" key={field}>
                                <Label htmlFor={field}>
                                    {field === 'layout_provider'
                                        ? 'Provider teks dan layout'
                                        : 'Provider gambar'}
                                </Label>
                                <select
                                    id={field}
                                    className="rounded-md border bg-background px-3 py-2 text-sm"
                                    value={form.data[field]}
                                    onChange={(event) =>
                                        form.setData(field, event.target.value)
                                    }
                                >
                                    <option value="local">
                                        Local (offline)
                                    </option>
                                    <option value="openai">
                                        OpenAI / OpenAI-compatible
                                    </option>
                                    <option value="gemini">
                                        Google Gemini
                                    </option>
                                </select>
                                <InputError message={form.errors[field]} />
                            </div>
                        ),
                    )}
                    <p className="text-sm text-muted-foreground">
                        Gemini untuk teks dan gambar menggunakan API key yang
                        sama. Pilih model teks dan model gambar secara terpisah.
                    </p>
                    {fields.map(([field, label]) => {
                        const secret =
                            field === 'gemini_api_key' ||
                            field === 'openai_api_key';
                        const configured =
                            secret && settings[`${field}_configured`];
                        return (
                            <div className="grid gap-2" key={field}>
                                <Label htmlFor={field}>{label}</Label>
                                <Input
                                    id={field}
                                    type={secret ? 'password' : 'text'}
                                    autoComplete={
                                        secret ? 'new-password' : 'off'
                                    }
                                    value={form.data[field]}
                                    onChange={(event) =>
                                        form.setData(field, event.target.value)
                                    }
                                    required={!secret}
                                    placeholder={
                                        secret
                                            ? configured
                                                ? 'Sudah tersimpan. Kosongkan untuk mempertahankan.'
                                                : 'Masukkan API key'
                                            : undefined
                                    }
                                />
                                {secret && (
                                    <p className="text-xs text-muted-foreground">
                                        {configured
                                            ? 'API key sudah dikonfigurasi.'
                                            : 'API key belum dikonfigurasi.'}{' '}
                                        Key disimpan terenkripsi; kosongkan
                                        untuk mempertahankan key sebelumnya.
                                    </p>
                                )}
                                <InputError message={form.errors[field]} />
                            </div>
                        );
                    })}
                    <a
                        className="text-sm underline"
                        href="https://aistudio.google.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Dapatkan API key di Google AI Studio
                    </a>
                    <div>
                        <Button disabled={form.processing}>
                            Simpan konfigurasi global
                        </Button>
                    </div>
                    {form.recentlySuccessful && (
                        <p role="status" className="text-sm">
                            Konfigurasi global berhasil disimpan.
                        </p>
                    )}
                </form>
            </div>
        </>
    );
}

Ai.layout = { breadcrumbs: [{ title: 'AI Global', href: '/settings/ai' }] };
