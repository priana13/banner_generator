import type { ElementFade, FadableElement } from '@/types';

/** Rendered above display size so it stays sharp when zoomed in. */
const OVERSAMPLE = 2;
const MAX_SIDE = 4096;

/** [x0, y0, x1, y1] of the opaque-to-transparent axis, in unit space. */
const AXES = {
    right: [0, 0, 1, 0],
    left: [1, 0, 0, 0],
    bottom: [0, 0, 0, 1],
    top: [0, 1, 0, 0],
} as const;

function applyFade(
    ctx: CanvasRenderingContext2D,
    fade: ElementFade,
    width: number,
    height: number,
    round: boolean,
): void {
    // Keep only what the mask covers: its alpha becomes the element's.
    ctx.globalCompositeOperation = 'destination-in';

    if (fade.type === 'linear') {
        const [x0, y0, x1, y1] = AXES[fade.direction];
        const gradient = ctx.createLinearGradient(
            x0 * width,
            y0 * height,
            x1 * width,
            y1 * height,
        );

        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(Math.max(0, 1 - fade.amount), 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        return;
    }

    if (round) {
        // A circle softens radially, keeping its shape.
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(width / 2, height / 2);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);

        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(Math.max(0, 1 - fade.amount), 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();

        return;
    }

    // Feather every edge by the same distance; the two passes multiply,
    // which rounds the corners off softly.
    const feather = (Math.min(width, height) / 2) * fade.amount;

    for (const [length, horizontal] of [
        [width, true],
        [height, false],
    ] as const) {
        const gradient = horizontal
            ? ctx.createLinearGradient(0, 0, width, 0)
            : ctx.createLinearGradient(0, 0, 0, height);
        const stop = Math.min(0.5, feather / length);

        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(stop, 'rgba(0,0,0,1)');
        gradient.addColorStop(1 - stop, 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
}

/**
 * Draw an element with its transparency gradient baked in. The canvas API
 * has no per-shape alpha gradient, so the element is rendered off-screen,
 * masked, and then shown as an image.
 */
export function renderFaded(
    element: FadableElement,
    image: CanvasImageSource | null,
): HTMLCanvasElement | null {
    const fade = element.fade;
    const scale = Math.min(
        OVERSAMPLE,
        MAX_SIDE / Math.max(element.width, element.height),
    );
    const width = Math.max(1, Math.round(element.width * scale));
    const height = Math.max(1, Math.round(element.height * scale));
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    if (!ctx || !fade) {
        return null;
    }

    if (element.type === 'image' || element.type === 'ornament') {
        if (!image) {
            return null;
        }

        ctx.drawImage(image, 0, 0, width, height);
    } else {
        ctx.fillStyle = element.fill;
        ctx.beginPath();

        if (element.type === 'circle') {
            ctx.ellipse(
                width / 2,
                height / 2,
                width / 2,
                height / 2,
                0,
                0,
                Math.PI * 2,
            );
        } else {
            ctx.roundRect(
                0,
                0,
                width,
                height,
                Math.min(element.cornerRadius * scale, width / 2, height / 2),
            );
        }

        ctx.fill();
    }

    applyFade(ctx, fade, width, height, element.type === 'circle');

    return canvas;
}
