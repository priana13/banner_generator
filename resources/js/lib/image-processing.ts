import { api } from '@/lib/api';
import { useEditorStore } from '@/lib/editor-store';
import { store as uploadAsset } from '@/routes/api/projects/assets';
import type { EditorAsset } from '@/types';

const MAX_SIDE = 1600;
/** Stays below PHP's default 2 MB upload limit. */
const MAX_BYTES = 1_800_000;

function toBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) =>
                blob
                    ? resolve(blob)
                    : reject(new Error('Gagal memproses gambar.')),
            type,
            quality,
        );
    });
}

function draw(source: CanvasImageSource, width: number, height: number) {
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    canvas
        .getContext('2d')
        ?.drawImage(source, 0, 0, canvas.width, canvas.height);

    return canvas;
}

/**
 * Shrink an image until it is small enough to upload. Photos become JPEG;
 * formats that can carry transparency stay PNG.
 */
export async function prepareImage(source: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(source).catch(() => {
        throw new Error('Berkas gambar tidak dapat dibaca.');
    });
    const longest = Math.max(bitmap.width, bitmap.height);

    if (longest <= MAX_SIDE && source.size <= MAX_BYTES) {
        return source;
    }

    const type = source.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    let scale = Math.min(1, MAX_SIDE / longest);
    let blob = source;

    for (let attempt = 0; attempt < 8; attempt++) {
        blob = await toBlob(
            draw(bitmap, bitmap.width * scale, bitmap.height * scale),
            type,
            0.9,
        );

        if (blob.size <= MAX_BYTES) {
            break;
        }

        scale *= 0.8;
    }

    return blob;
}

/**
 * Crop away fully transparent margins, so a cutout's box hugs its subject.
 */
export function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return canvas;
    }

    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let top = height;
    let left = width;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 12) {
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
                left = Math.min(left, x);
                right = Math.max(right, x);
            }
        }
    }

    if (right < left || bottom < top) {
        return canvas;
    }

    const trimmed = document.createElement('canvas');

    trimmed.width = right - left + 1;
    trimmed.height = bottom - top + 1;
    trimmed
        .getContext('2d')
        ?.drawImage(
            canvas,
            left,
            top,
            trimmed.width,
            trimmed.height,
            0,
            0,
            trimmed.width,
            trimmed.height,
        );

    return trimmed;
}

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
    return prepareImage(await toBlob(canvas, 'image/png'));
}

/**
 * Upload an image to the project and register it with the editor.
 */
export async function uploadImage(
    projectId: number,
    image: Blob,
    kind: EditorAsset['kind'],
    name: string,
): Promise<EditorAsset> {
    const form = new FormData();

    form.append('file', await prepareImage(image), name);
    form.append('kind', kind);

    const asset = await api<EditorAsset>(uploadAsset(projectId), form);

    useEditorStore.getState().addAsset(asset);

    return asset;
}
