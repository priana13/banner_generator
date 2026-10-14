import {
    canvasToPng,
    prepareImage,
    trimTransparent,
} from '@/lib/image-processing';

/**
 * Portrait matting model (Apache-2.0). It is downloaded once and cached by
 * the browser; the photo itself never leaves the user's device.
 */
const MODEL = 'Xenova/modnet';

type Matte = { toCanvas: () => HTMLCanvasElement | OffscreenCanvas };

type Segmenter = (image: unknown) => Promise<Matte | Matte[]>;

let segmenter: Promise<Segmenter> | null = null;

async function load(): Promise<Segmenter> {
    // Loaded on demand: the library and model are large and most page
    // views never need them.
    const { pipeline } = await import('@huggingface/transformers');

    return (await pipeline('background-removal', MODEL, {
        dtype: 'fp32',
    })) as unknown as Segmenter;
}

/**
 * Remove the background of a photo, entirely in the browser. Returns a
 * transparent PNG cropped to the subject.
 */
export async function removeBackground(photo: Blob): Promise<Blob> {
    const { RawImage } = await import('@huggingface/transformers');

    segmenter ??= load();

    let run: Segmenter;

    try {
        run = await segmenter;
    } catch {
        // Allow another attempt, e.g. after a failed model download.
        segmenter = null;

        throw new Error(
            'Model penghapus latar gagal dimuat. Periksa koneksi internet lalu coba lagi.',
        );
    }

    const result = await run(
        await RawImage.fromBlob(await prepareImage(photo)),
    );
    // One image in, but the pipeline may still answer with a list.
    const rendered = (Array.isArray(result) ? result[0] : result).toCanvas();
    const canvas = document.createElement('canvas');

    canvas.width = rendered.width;
    canvas.height = rendered.height;
    canvas.getContext('2d')?.drawImage(rendered, 0, 0);

    return canvasToPng(trimTransparent(canvas));
}
