import { router } from '@inertiajs/react';
import { Folder, Pencil, Plus, Trash2 } from 'lucide-react';
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
import type { ProjectCategory } from '@/types';

export default function ProjectCategoryManager({
    categories,
    selected,
}: {
    categories: ProjectCategory[];
    selected: string;
}) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<ProjectCategory | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const reset = () => {
        setName('');
        setEditing(null);
        setError('');
    };
    const reload = () =>
        router.reload({ only: ['categories', 'projects', 'projectCounts'] });
    const save = async () => {
        setProcessing(true);
        setError('');
        try {
            await api(
                {
                    url: editing
                        ? `/api/project-categories/${editing.id}`
                        : '/api/project-categories',
                    method: editing ? 'patch' : 'post',
                },
                { name: name.trim() },
            );
            reset();
            reload();
            toast.success(
                editing ? 'Nama kategori diperbarui.' : 'Kategori ditambahkan.',
            );
        } catch (caught) {
            if (caught instanceof ApiError && caught.status === 422) {
                setError(
                    (caught.data.errors as Record<string, string[]> | undefined)
                        ?.name?.[0] ?? caught.message,
                );
            } else {
                toast.error(errorMessage(caught));
            }
        } finally {
            setProcessing(false);
        }
    };
    const remove = async (category: ProjectCategory) => {
        if (
            !window.confirm(
                `Hapus kategori "${category.name}"? Proyek di dalamnya tetap tersimpan dan menjadi tanpa kategori.`,
            )
        )
            return;
        setProcessing(true);
        try {
            await api({
                url: `/api/project-categories/${category.id}`,
                method: 'delete',
            });
            if (editing?.id === category.id) reset();
            if (selected === String(category.id))
                router.get('/dashboard', {}, { preserveScroll: true });
            else reload();
            toast.success('Kategori dihapus. Proyek tetap tersimpan.');
        } catch (caught) {
            toast.error(errorMessage(caught));
        } finally {
            setProcessing(false);
        }
    };
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                setOpen(value);
                if (!value) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Folder className="size-4" />
                    Kelola kategori
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kategori proyek</DialogTitle>
                    <DialogDescription>
                        Kelompokkan proyek sesuai kebutuhan. Kategori hanya
                        tersedia di akun Anda.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}
                >
                    <Label htmlFor="category-name">
                        {editing ? 'Ubah nama kategori' : 'Kategori baru'}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="category-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            maxLength={80}
                            placeholder="Contoh: Donasi, Promosi, Media sosial"
                            disabled={processing}
                        />
                        <Button
                            type="submit"
                            disabled={processing || !name.trim()}
                        >
                            {editing ? (
                                'Simpan'
                            ) : (
                                <>
                                    <Plus className="size-4" />
                                    Tambah
                                </>
                            )}
                        </Button>
                    </div>
                    <InputError message={error} />
                    {editing && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={processing}
                            onClick={reset}
                        >
                            Batal mengubah
                        </Button>
                    )}
                </form>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                    {categories.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            Belum ada kategori. Tambahkan kategori pertama Anda.
                        </p>
                    ) : (
                        categories.map((category) => (
                            <div
                                key={category.id}
                                className="flex items-center gap-2 rounded-lg border p-3"
                            >
                                <Folder className="size-4 shrink-0 text-orange-500" />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {category.name}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {category.projects_count ?? 0} proyek
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={processing}
                                    aria-label={`Ubah kategori ${category.name}`}
                                    onClick={() => {
                                        setEditing(category);
                                        setName(category.name);
                                        setError('');
                                    }}
                                >
                                    <Pencil className="size-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={processing}
                                    aria-label={`Hapus kategori ${category.name}`}
                                    onClick={() => void remove(category)}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
