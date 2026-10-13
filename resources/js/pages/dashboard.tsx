import { Head, Link, router } from '@inertiajs/react';
import { ImageOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { DocumentPreview } from '@/components/document-preview';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError, errorMessage } from '@/lib/api';
import { CANVAS_PRESETS } from '@/lib/editor-elements';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { destroy, store } from '@/routes/api/projects';
import { show } from '@/routes/projects';
import type { EditorPayload, ProjectStatus, ProjectSummary } from '@/types';

const STATUS_LABELS: Record<ProjectStatus, string> = {
    draft: 'Draf',
    generating: 'Sedang dibuat',
    ready: 'Siap',
    failed: 'Generate gagal',
};

function NewProjectDialog() {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [width, setWidth] = useState<number>(CANVAS_PRESETS[0].width);
    const [height, setHeight] = useState<number>(CANVAS_PRESETS[0].height);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [processing, setProcessing] = useState(false);

    const submit = async (event: FormEvent): Promise<void> => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            const created = await api<EditorPayload>(store(), {
                title: title.trim() || 'Banner tanpa judul',
                canvas_width: width,
                canvas_height: height,
            });

            router.visit(show(created.project.id));
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) {
                setErrors(
                    (error.data.errors ?? {}) as Record<string, string[]>,
                );
            } else {
                toast.error(errorMessage(error));
            }

            setProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-orange-500 text-white hover:bg-orange-600">
                    <Plus />
                    Banner baru
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={(event) => void submit(event)}>
                    <DialogHeader>
                        <DialogTitle>Buat banner baru</DialogTitle>
                        <DialogDescription>
                            Pilih ukuran canvas. Brief dan desain diisi di
                            editor.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-5">
                        <div className="grid gap-2">
                            <Label htmlFor="project-title">Nama proyek</Label>
                            <Input
                                id="project-title"
                                value={title}
                                maxLength={120}
                                autoFocus
                                placeholder="Contoh: Tebar Pangan untuk Santri"
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                            />
                            <InputError message={errors.title?.[0]} />
                        </div>

                        <div className="grid gap-2">
                            <Label>Ukuran</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {CANVAS_PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => {
                                            setWidth(preset.width);
                                            setHeight(preset.height);
                                        }}
                                        className={cn(
                                            'rounded-lg border p-3 text-left text-sm',
                                            width === preset.width &&
                                                height === preset.height
                                                ? 'border-orange-400 bg-orange-500/10'
                                                : 'hover:bg-accent',
                                        )}
                                    >
                                        <div className="font-medium">
                                            {preset.label}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {preset.width} × {preset.height}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="canvas-width">Lebar (px)</Label>
                                <Input
                                    id="canvas-width"
                                    type="number"
                                    min={50}
                                    max={4096}
                                    required
                                    value={width}
                                    onChange={(event) =>
                                        setWidth(Number(event.target.value))
                                    }
                                />
                                <InputError
                                    message={errors.canvas_width?.[0]}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="canvas-height">
                                    Tinggi (px)
                                </Label>
                                <Input
                                    id="canvas-height"
                                    type="number"
                                    min={50}
                                    max={4096}
                                    required
                                    value={height}
                                    onChange={(event) =>
                                        setHeight(Number(event.target.value))
                                    }
                                />
                                <InputError
                                    message={errors.canvas_height?.[0]}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="bg-orange-500 text-white hover:bg-orange-600"
                        >
                            Buat &amp; buka editor
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
    const remove = async (): Promise<void> => {
        if (!window.confirm(`Hapus proyek "${project.title}"?`)) {
            return;
        }

        try {
            await api(destroy(project.id));
            router.reload({ only: ['projects'] });
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const isEmpty = !project.document || project.document.elements.length === 0;

    return (
        <div className="group relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-card dark:border-sidebar-border">
            <Link
                href={show(project.id)}
                className="block"
                aria-label={`Buka ${project.title}`}
            >
                <div className="grid aspect-video place-items-center bg-muted p-3">
                    {isEmpty || !project.document ? (
                        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                            <ImageOff className="size-6" />
                            Belum ada desain
                        </div>
                    ) : (
                        <DocumentPreview
                            document={project.document}
                            assets={project.assets}
                            className="max-h-full max-w-full shadow-sm"
                        />
                    )}
                </div>
                <div className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                            {project.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {project.canvas_width} × {project.canvas_height}
                            {project.updated_at &&
                                ` · ${new Date(project.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        </div>
                    </div>
                    <Badge
                        variant={
                            project.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                        }
                        className="shrink-0"
                    >
                        {STATUS_LABELS[project.status]}
                    </Badge>
                </div>
            </Link>
            <Button
                variant="secondary"
                size="icon"
                aria-label={`Hapus ${project.title}`}
                onClick={() => void remove()}
                className="absolute top-2 right-2 size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
                <Trash2 />
            </Button>
        </div>
    );
}

export default function Dashboard({
    projects,
}: {
    projects: ProjectSummary[];
}) {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-semibold">Proyek banner</h1>
                        <p className="text-sm text-muted-foreground">
                            Buat banner dari brief, lalu edit setiap layer di
                            editor.
                        </p>
                    </div>
                    <NewProjectDialog />
                </div>

                {projects.length === 0 ? (
                    <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-sidebar-border/70 p-10 text-center dark:border-sidebar-border">
                        <div>
                            <p className="font-medium">Belum ada proyek</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Klik “Banner baru” untuk membuat banner pertama
                                Anda.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {projects.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
