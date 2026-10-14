import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';

type Model = {
    id: string;
    name: string;
    description: string;
    kind: 'layout' | 'image' | 'other' | 'unknown';
};
type Catalog = { source: string; models: Model[] };

export default function AiModelCatalog({
    provider,
    configured,
    onSelect,
}: {
    provider: 'gemini' | 'openai';
    configured: boolean;
    onSelect: (kind: 'layout' | 'image', id: string) => void;
}) {
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState('');
    const title =
        provider === 'gemini'
            ? 'Google Gemini'
            : 'OpenAI / OpenAI-compatible (termasuk DeepSeek)';
    const models =
        catalog?.models.filter(
            (model) =>
                (filter === 'all' || model.kind === filter) &&
                `${model.id} ${model.name}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
        ) ?? [];

    async function load() {
        setLoading(true);
        setError('');
        setCatalog(null);
        setSelected('');
        try {
            setCatalog(
                await api<Catalog>(
                    { url: '/settings/ai/models', method: 'post' },
                    { provider },
                ),
            );
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }

    return (
        <section
            className="space-y-3 rounded-lg border p-4"
            aria-label={`Daftar model ${title}`}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-medium">{title}</h3>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || !configured}
                    onClick={load}
                >
                    {loading ? 'Mengambil model…' : 'Lihat model tersedia'}
                </Button>
            </div>
            {!configured && (
                <p className="text-sm text-muted-foreground">
                    Simpan API key layanan ini terlebih dahulu.
                </p>
            )}
            {loading && (
                <p role="status" className="text-sm text-muted-foreground">
                    Menghubungi layanan AI…
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {catalog && (
                <>
                    <p className="text-xs text-muted-foreground">
                        {catalog.models.length} model dari {catalog.source}.
                        Kategori merupakan petunjuk dari metadata atau nama
                        model; ketersediaan kuota dan kompatibilitas generasi
                        tetap bergantung pada layanan.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Input
                            aria-label={`Cari model ${title}`}
                            placeholder="Cari nama model…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="min-w-0 flex-1"
                        />
                        <select
                            aria-label={`Filter model ${title}`}
                            className="rounded-md border bg-background px-3 py-2 text-sm"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                        >
                            <option value="all">Semua kategori</option>
                            <option value="layout">Teks/layout</option>
                            <option value="image">Gambar</option>
                            <option value="other">Fungsi lain</option>
                            <option value="unknown">Belum diketahui</option>
                        </select>
                    </div>
                    <div className="max-h-96 space-y-2 overflow-y-auto">
                        {models.map((model) => (
                            <div
                                key={model.id}
                                className="space-y-2 rounded-md border p-3"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium break-all">
                                            {model.name}
                                        </p>
                                        <p className="text-xs break-all text-muted-foreground">
                                            {model.id}
                                        </p>
                                    </div>
                                    <span className="rounded bg-muted px-2 py-1 text-xs">
                                        {
                                            {
                                                layout: 'Teks/layout',
                                                image: 'Gambar',
                                                other: 'Fungsi lain',
                                                unknown: 'Belum diketahui',
                                            }[model.kind]
                                        }
                                    </span>
                                </div>
                                {model.description && (
                                    <p className="text-xs text-muted-foreground">
                                        {model.description}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {(model.kind === 'layout' ||
                                        model.kind === 'unknown') && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                onSelect('layout', model.id);
                                                setSelected(
                                                    `${model.id} dipilih untuk teks/layout.`,
                                                );
                                            }}
                                        >
                                            Pakai untuk teks/layout
                                        </Button>
                                    )}
                                    {(model.kind === 'image' ||
                                        model.kind === 'unknown') && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                onSelect('image', model.id);
                                                setSelected(
                                                    `${model.id} dipilih untuk gambar.`,
                                                );
                                            }}
                                        >
                                            Pakai untuk gambar
                                        </Button>
                                    )}
                                    {model.kind === 'other' && (
                                        <p className="text-xs text-muted-foreground">
                                            Model ini tidak sesuai dengan fitur
                                            generasi banner.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {models.length === 0 && (
                            <p className="py-3 text-sm text-muted-foreground">
                                {catalog.models.length === 0
                                    ? 'Layanan tidak mengembalikan model yang tersedia.'
                                    : 'Tidak ada model yang cocok dengan pencarian atau filter.'}
                            </p>
                        )}
                    </div>
                </>
            )}
            {selected && (
                <p role="status" className="text-sm">
                    {selected} Klik Simpan konfigurasi global untuk menerapkan.
                </p>
            )}
        </section>
    );
}
