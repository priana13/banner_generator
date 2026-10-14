import { Copy, Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError, errorMessage } from '@/lib/api';
import { ORNAMENTS } from '@/lib/ornaments';
import type { DesignStyle } from '@/types';

type StyleForm = Pick<
    DesignStyle,
    | 'name'
    | 'description'
    | 'text_instructions'
    | 'image_instructions'
    | 'font'
    | 'ornaments'
>;
const blank: StyleForm = {
    name: '',
    description: '',
    text_instructions: '',
    image_instructions: '',
    font: null,
    ornaments: [],
};

export function DesignStyleManager({
    styles,
    fonts,
    onChange,
    onSelect,
    disabled,
}: {
    styles: DesignStyle[];
    fonts: string[];
    onChange: (styles: DesignStyle[]) => void;
    onSelect: (key: string) => void;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<number | null>(null);
    const [form, setForm] = useState<StyleForm>({ ...blank });
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [processing, setProcessing] = useState(false);
    const reset = () => {
        setEditing(null);
        setForm({ ...blank, ornaments: [] });
        setErrors({});
    };
    const reload = async () => {
        const response = await api<{ data: DesignStyle[] }>({
            url: '/api/design-styles',
            method: 'get',
        });
        onChange(response.data);
    };
    const load = (style: DesignStyle) => {
        setEditing(style.builtin ? null : style.id);
        setErrors({});
        setForm({
            name: style.builtin ? `${style.name} saya` : style.name,
            description: style.description,
            text_instructions: style.text_instructions,
            image_instructions: style.image_instructions,
            font: style.font,
            ornaments: [...style.ornaments],
        });
    };
    const save = async () => {
        setErrors({});
        setProcessing(true);
        try {
            const saved = await api<DesignStyle>(
                {
                    url: editing
                        ? `/api/design-styles/${editing}`
                        : '/api/design-styles',
                    method: editing ? 'patch' : 'post',
                },
                form,
            );
            await reload();
            onSelect(saved.key);
            setOpen(false);
            reset();
            toast.success('Gaya desain disimpan dan dipilih.');
        } catch (error) {
            if (error instanceof ApiError && error.status === 422)
                setErrors(
                    (error.data.errors ?? {}) as Record<string, string[]>,
                );
            else toast.error(errorMessage(error));
        } finally {
            setProcessing(false);
        }
    };
    const remove = async (style: DesignStyle) => {
        if (
            !window.confirm(
                `Hapus gaya "${style.name}"? Desain yang sudah dibuat tetap tersimpan.`,
            )
        )
            return;
        setProcessing(true);
        try {
            await api({
                url: `/api/design-styles/${style.id}`,
                method: 'delete',
            });
            await reload();
            if (editing === style.id) reset();
            toast.success('Gaya desain dihapus.');
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setProcessing(false);
        }
    };
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!processing) {
                    setOpen(value);
                    if (!value) reset();
                }
            }}
        >
            <DialogTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50"
                >
                    <Palette className="size-3.5" />
                    Kelola gaya desain
                </button>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Gaya desain</DialogTitle>
                    <DialogDescription>
                        Buat panduan yang bisa digunakan berulang untuk teks,
                        gambar, font, dan ornamen. Gaya kustom hanya tersedia di
                        akun Anda.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                    <div className="space-y-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={processing}
                            onClick={reset}
                        >
                            <Plus className="size-4" />
                            Gaya baru
                        </Button>
                        <div className="max-h-52 space-y-2 overflow-y-auto md:max-h-[55svh]">
                            {styles.map((style) => (
                                <div
                                    key={style.key}
                                    className="rounded-lg border p-3"
                                >
                                    <p
                                        className="truncate text-sm font-semibold"
                                        title={style.name}
                                    >
                                        {style.name}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {style.builtin
                                            ? 'Gaya bawaan'
                                            : 'Gaya saya'}
                                    </p>
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            disabled={processing}
                                            onClick={() => load(style)}
                                        >
                                            {style.builtin ? (
                                                <Copy className="size-3" />
                                            ) : (
                                                <Pencil className="size-3" />
                                            )}
                                            {style.builtin
                                                ? 'Salin & edit'
                                                : 'Edit'}
                                        </Button>
                                        {!style.builtin && (
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                disabled={processing}
                                                aria-label={`Hapus gaya ${style.name}`}
                                                onClick={() =>
                                                    void remove(style)
                                                }
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void save();
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="design-style-name">Nama gaya</Label>
                            <Input
                                id="design-style-name"
                                required
                                maxLength={80}
                                disabled={processing}
                                value={form.name}
                                placeholder="Contoh: Ramadan elegan"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        name: event.target.value,
                                    })
                                }
                            />
                            <InputError message={errors.name?.[0]} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="design-style-description">
                                Deskripsi singkat
                            </Label>
                            <Input
                                id="design-style-description"
                                maxLength={240}
                                disabled={processing}
                                value={form.description}
                                placeholder="Kapan gaya ini digunakan?"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        description: event.target.value,
                                    })
                                }
                            />
                            <InputError message={errors.description?.[0]} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="design-style-text">
                                Panduan teks dan layout
                            </Label>
                            <textarea
                                className="w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-50"
                                id="design-style-text"
                                rows={3}
                                maxLength={2000}
                                disabled={processing}
                                value={form.text_instructions}
                                placeholder="Contoh: Bahasa hangat, headline singkat, ajakan donasi yang sopan, latar terang."
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        text_instructions: event.target.value,
                                    })
                                }
                            />
                            <InputError
                                message={errors.text_instructions?.[0]}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="design-style-image">
                                Panduan gambar
                            </Label>
                            <textarea
                                className="w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-50"
                                id="design-style-image"
                                rows={3}
                                maxLength={2000}
                                disabled={processing}
                                value={form.image_instructions}
                                placeholder="Contoh: Foto natural, cahaya hangat, aksen lentera, subjek jelas, tanpa tulisan."
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        image_instructions: event.target.value,
                                    })
                                }
                            />
                            <InputError
                                message={errors.image_instructions?.[0]}
                            />
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Panduan melengkapi brief. Kata-kata dan warna yang
                            diminta dalam brief tetap diutamakan. Gambar dibuat
                            saat memakai mode Panel warna.
                        </p>
                        <div className="grid gap-2">
                            <Label htmlFor="design-style-font">Font</Label>
                            <select
                                id="design-style-font"
                                disabled={processing}
                                value={form.font ?? ''}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        font: event.target.value || null,
                                    })
                                }
                                className="rounded-md border bg-background p-2 text-sm"
                            >
                                <option value="">Ikuti mode komposisi</option>
                                {fonts.map((font) => (
                                    <option key={font}>{font}</option>
                                ))}
                            </select>
                            <InputError message={errors.font?.[0]} />
                        </div>
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium">
                                Ornamen otomatis ({form.ornaments.length}/3)
                            </legend>
                            <p className="text-xs text-muted-foreground">
                                Pilih maksimal 3 ornamen. Kosongkan untuk desain
                                tanpa ornamen.
                            </p>
                            <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3">
                                {Object.entries(ORNAMENTS).map(
                                    ([id, ornament]) => (
                                        <label
                                            key={id}
                                            className="flex items-start gap-2 text-xs"
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 accent-orange-600"
                                                checked={form.ornaments.includes(
                                                    id,
                                                )}
                                                disabled={
                                                    processing ||
                                                    (!form.ornaments.includes(
                                                        id,
                                                    ) &&
                                                        form.ornaments.length >=
                                                            3)
                                                }
                                                onChange={(event) =>
                                                    setForm({
                                                        ...form,
                                                        ornaments: event.target
                                                            .checked
                                                            ? [
                                                                  ...form.ornaments,
                                                                  id,
                                                              ]
                                                            : form.ornaments.filter(
                                                                  (value) =>
                                                                      value !==
                                                                      id,
                                                              ),
                                                    })
                                                }
                                            />
                                            {ornament.label}
                                        </label>
                                    ),
                                )}
                            </div>
                            <InputError
                                message={
                                    errors.ornaments?.[0] ??
                                    Object.entries(errors).find(([key]) =>
                                        key.startsWith('ornaments.'),
                                    )?.[1]?.[0]
                                }
                            />
                        </fieldset>
                        <Button
                            type="submit"
                            disabled={processing || !form.name.trim()}
                            className="w-full bg-orange-600 text-white hover:bg-orange-700"
                        >
                            {processing
                                ? 'Menyimpan…'
                                : editing
                                  ? 'Simpan perubahan & gunakan'
                                  : 'Simpan gaya & gunakan'}
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
