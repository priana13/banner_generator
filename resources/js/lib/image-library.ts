import { api } from '@/lib/api';
import { useEditorStore } from '@/lib/editor-store';
import { prepareImage } from '@/lib/image-processing';
import type { EditorAsset, LibraryImage } from '@/types';

export async function uploadLibraryImage(
    file: File,
    kind: LibraryImage['kind'] = 'upload',
): Promise<LibraryImage> {
    const form = new FormData();
    form.append('file', await prepareImage(file), file.name);
    form.append('kind', kind);
    return api<LibraryImage>(
        { url: '/api/library-images', method: 'post' },
        form,
    );
}

export async function useLibraryImage(
    projectId: number,
    image: LibraryImage,
    kind?: 'upload' | 'logo' | 'cutout',
): Promise<EditorAsset> {
    const asset = await api<EditorAsset>(
        {
            url: `/api/projects/${projectId}/library-images/${image.id}`,
            method: 'post',
        },
        { kind: kind ?? image.kind },
    );
    useEditorStore.getState().addAsset(asset);
    return asset;
}
