import type Konva from 'konva';
import { apiBlob } from '@/lib/api';
import { useEditorStore } from '@/lib/editor-store';
import { exportMethod } from '@/routes/api/projects';

export type ExportFormat = 'png' | 'jpeg' | 'webp';

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
                    : reject(new Error('Gagal merender banner.')),
            type,
            quality,
        );
    });
}

/**
 * Render the design at exactly its target size, whatever the current zoom.
 * The pixel ratio only undoes the zoom, so the output never exceeds the
 * canvas size and memory use stays bounded.
 */
async function render(stage: Konva.Stage): Promise<HTMLCanvasElement> {
    const { canvas } = useEditorStore.getState().document;
    const transformer = stage.findOne('Transformer');
    const wasVisible = transformer?.visible() ?? false;

    await document.fonts.ready;
    transformer?.visible(false);

    try {
        const rendered = stage.toCanvas({
            pixelRatio: canvas.width / stage.width(),
        });
        const output = document.createElement('canvas');

        output.width = canvas.width;
        output.height = canvas.height;
        output
            .getContext('2d')
            ?.drawImage(rendered, 0, 0, canvas.width, canvas.height);

        return output;
    } finally {
        transformer?.visible(wasVisible);
    }
}

function download(blob: Blob, filename: string): void {
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export async function exportBanner(
    stage: Konva.Stage,
    projectId: number,
    title: string,
    format: ExportFormat,
): Promise<void> {
    const canvas = await render(stage);
    const name =
        title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'banner';

    if (format === 'png') {
        return download(await toBlob(canvas, 'image/png'), `${name}.png`);
    }

    if (format === 'jpeg') {
        return download(
            await toBlob(canvas, 'image/jpeg', 0.92),
            `${name}.jpg`,
        );
    }

    // WebP encoding is not available in every browser: convert server-side.
    const form = new FormData();

    form.append('format', format);
    form.append('image', await toBlob(canvas, 'image/png'), 'canvas.png');

    download(await apiBlob(exportMethod(projectId), form), `${name}.webp`);
}
