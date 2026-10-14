import {
    ChevronLeft,
    ChevronRight,
    ImagePlus,
    LoaderCircle,
    Search,
    Trash2,
    Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { uploadLibraryImage } from '@/lib/image-library';
import type { LibraryImage } from '@/types';

type ImageList = {
    data: LibraryImage[];
    meta: { current_page: number; last_page: number; total: number };
};
const LABELS = { upload: 'Gambar', logo: 'Logo', cutout: 'Tanpa latar' };

export default function ImageLibraryBrowser({
    onChoose,
    onBusyChange,
    uploadKind = 'upload',
}: {
    onChoose?: (image: LibraryImage) => Promise<void>;
    onBusyChange?: (busy: boolean) => void;
    uploadKind?: LibraryImage['kind'];
}) {
    const [images, setImages] = useState<LibraryImage[]>([]);
    const [meta, setMeta] = useState<ImageList['meta']>({
        current_page: 1,
        last_page: 1,
        total: 0,
    });
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState('');
    const [page, setPage] = useState(1);
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<LibraryImage | null>(null);
    const busy = (value: boolean) => {
        setProcessing(value);
        onBusyChange?.(value);
    };
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        const params = new URLSearchParams({ page: String(page) });
        if (query) params.set('search', query);
        if (kind) params.set('kind', kind);
        api<ImageList>({ url: `/api/library-images?${params}`, method: 'get' })
            .then((result) => {
                if (!cancelled) {
                    setImages(result.data);
                    setMeta(result.meta);
                }
            })
            .catch((caught) => {
                if (!cancelled) setError(errorMessage(caught));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [page, query, kind, refresh]);
    const choose = async (image: LibraryImage) => {
        if (!onChoose) {
            setPreview(image);
            return;
        }
        busy(true);
        try {
            await onChoose(image);
        } catch (caught) {
            toast.error(errorMessage(caught));
        } finally {
            busy(false);
        }
    };
    const upload = async (files: File[]) => {
        busy(true);
        try {
            for (const file of files) {
                const image = await uploadLibraryImage(file, uploadKind);
                if (onChoose) await onChoose(image);
            }
            setSearch('');
            setQuery('');
            setKind('');
            setPage(1);
            setRefresh((value) => value + 1);
            if (!onChoose) toast.success('Gambar tersimpan di pustaka aset.');
        } catch (caught) {
            toast.error(errorMessage(caught));
            setRefresh((value) => value + 1);
        } finally {
            busy(false);
        }
    };
    const remove = async (image: LibraryImage) => {
        if (
            !window.confirm(
                `Hapus "${image.name}" dari pustaka? Gambar di proyek yang sudah memakainya tetap tersimpan.`,
            )
        )
            return;
        busy(true);
        try {
            await api({
                url: `/api/library-images/${image.id}`,
                method: 'delete',
            });
            if (images.length === 1 && page > 1) setPage(page - 1);
            else setRefresh((value) => value + 1);
            toast.success('Gambar dihapus dari pustaka.');
        } catch (caught) {
            toast.error(errorMessage(caught));
        } finally {
            busy(false);
        }
    };
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <form
                    className="flex min-w-0 flex-1 gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setQuery(search.trim());
                        setPage(1);
                    }}
                >
                    <Input
                        aria-label="Cari gambar"
                        maxLength={120}
                        disabled={processing}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Cari nama gambar…"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        variant="outline"
                        disabled={processing}
                        aria-label="Cari"
                    >
                        <Search className="size-4" />
                    </Button>
                </form>
                <select
                    aria-label="Jenis gambar"
                    disabled={processing}
                    value={kind}
                    onChange={(event) => {
                        setKind(event.target.value);
                        setPage(1);
                    }}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    <option value="">Semua gambar</option>
                    <option value="upload">Gambar</option>
                    <option value="logo">Logo</option>
                    <option value="cutout">Tanpa latar</option>
                </select>
                <label
                    className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 ${processing ? 'pointer-events-none opacity-50' : ''}`}
                >
                    {processing ? (
                        <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                        <Upload className="size-4" />
                    )}
                    Upload baru
                    <input
                        type="file"
                        aria-label="Upload gambar baru"
                        accept="image/jpeg,image/png,image/webp"
                        multiple={!onChoose}
                        disabled={processing}
                        className="sr-only"
                        onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            event.target.value = '';
                            if (files.length) void upload(files);
                        }}
                    />
                </label>
            </div>
            <p className="text-xs text-muted-foreground">
                {processing
                    ? 'Memproses gambar…'
                    : `${meta.total} gambar · JPG, PNG, WebP · Gambar besar diperkecil otomatis.`}
            </p>
            {error ? (
                <div
                    role="alert"
                    className="rounded-lg border p-5 text-center text-sm"
                >
                    <p>{error}</p>
                    <Button
                        variant="outline"
                        className="mt-3"
                        onClick={() => setRefresh((value) => value + 1)}
                    >
                        Coba lagi
                    </Button>
                </div>
            ) : loading ? (
                <div
                    role="status"
                    className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                    <LoaderCircle className="size-4 animate-spin" />
                    Memuat gambar…
                </div>
            ) : images.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center">
                    <ImagePlus className="mx-auto mb-3 size-8 text-muted-foreground" />
                    <p className="font-semibold">
                        {query || kind
                            ? 'Tidak ada gambar yang cocok'
                            : 'Belum ada gambar'}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {query || kind
                            ? 'Coba nama atau jenis gambar lain.'
                            : 'Upload gambar pertama untuk digunakan di berbagai proyek.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {images.map((image) => (
                        <article
                            key={image.id}
                            className="relative overflow-hidden rounded-xl border bg-card"
                        >
                            <button
                                type="button"
                                disabled={processing}
                                onClick={() => void choose(image)}
                                aria-label={`${onChoose ? 'Pilih' : 'Lihat'} ${image.name}`}
                                className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset disabled:opacity-50"
                            >
                                <div className="editor-checker aspect-[4/3] bg-slate-50 p-2">
                                    <img
                                        src={image.url}
                                        alt={image.name}
                                        loading="lazy"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="space-y-1 p-3">
                                    <p
                                        className="truncate text-sm font-medium"
                                        title={image.name}
                                    >
                                        {image.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {image.width} × {image.height} ·{' '}
                                        {LABELS[image.kind]}
                                    </p>
                                    {onChoose && (
                                        <p className="text-xs font-semibold text-orange-600">
                                            Gunakan gambar
                                        </p>
                                    )}
                                </div>
                            </button>
                            {!onChoose && (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    disabled={processing}
                                    aria-label={`Hapus ${image.name}`}
                                    className="absolute top-2 right-2 size-7"
                                    onClick={() => void remove(image)}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            )}
                        </article>
                    ))}
                </div>
            )}
            {!loading && !error && meta.last_page > 1 && (
                <div className="flex items-center justify-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || processing}
                        onClick={() => setPage(page - 1)}
                    >
                        <ChevronLeft className="size-4" />
                        Sebelumnya
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        {meta.current_page} / {meta.last_page}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= meta.last_page || processing}
                        onClick={() => setPage(page + 1)}
                    >
                        Berikutnya
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            )}
            <Dialog
                open={preview !== null}
                onOpenChange={(open) => {
                    if (!open) setPreview(null);
                }}
            >
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{preview?.name}</DialogTitle>
                        <DialogDescription>
                            {preview?.width} × {preview?.height} px
                        </DialogDescription>
                    </DialogHeader>
                    {preview && (
                        <img
                            src={preview.url}
                            alt={preview.name}
                            className="editor-checker max-h-[65svh] w-full object-contain"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
