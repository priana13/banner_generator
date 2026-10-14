import { ORNAMENTS } from '@/lib/ornaments';
import type {
    CircleElement,
    DesignCanvas,
    EditorAsset,
    ImageElement,
    OrnamentElement,
    RectElement,
    TextElement,
} from '@/types';

export const CANVAS_PRESETS = [
    { label: 'Website Hero', width: 1200, height: 400 },
    { label: 'NGO Hero', width: 2048, height: 640 },
    { label: 'Wide Hero', width: 1920, height: 600 },
    { label: 'Square', width: 1080, height: 1080 },
    { label: 'Portrait', width: 1080, height: 1350 },
] as const;

export const ACCENT_COLORS = [
    { name: 'Oranye', value: '#f97316' },
    { name: 'Hijau', value: '#16a34a' },
    { name: 'Biru', value: '#2563eb' },
    { name: 'Ungu', value: '#7c3aed' },
] as const;

/** Must match the line height assumed by the server-side layout engine. */
export const LINE_HEIGHT = 1.2;

export function uid(): string {
    // randomUUID is only available in secure contexts.
    return typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const base = {
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
};

export function createText(canvas: DesignCanvas): TextElement {
    const fontSize = Math.round(Math.max(16, canvas.height * 0.1));
    const width = Math.round(canvas.width * 0.3);

    return {
        ...base,
        id: uid(),
        type: 'text',
        name: 'Teks baru',
        text: 'Teks baru',
        x: Math.round((canvas.width - width) / 2),
        y: Math.round((canvas.height - fontSize) / 2),
        width,
        height: Math.round(fontSize * LINE_HEIGHT),
        fontFamily: 'Inter',
        fontSize,
        fontStyle: 'bold',
        align: 'left',
        fill: '#172554',
    };
}

export function createRect(canvas: DesignCanvas, fill: string): RectElement {
    const width = Math.round(canvas.width * 0.18);
    const height = Math.round(canvas.height * 0.25);

    return {
        ...base,
        id: uid(),
        type: 'rect',
        name: 'Bentuk baru',
        x: Math.round((canvas.width - width) / 2),
        y: Math.round((canvas.height - height) / 2),
        width,
        height,
        fill,
        cornerRadius: 12,
    };
}

export function createCircle(
    canvas: DesignCanvas,
    fill: string,
): CircleElement {
    const size = Math.round(Math.min(canvas.width, canvas.height) * 0.3);

    return {
        ...base,
        id: uid(),
        type: 'circle',
        name: 'Lingkaran',
        x: Math.round((canvas.width - size) / 2),
        y: Math.round((canvas.height - size) / 2),
        width: size,
        height: size,
        fill,
    };
}

export function createOrnament(
    canvas: DesignCanvas,
    ornamentId: string,
    fill: string,
): OrnamentElement {
    const ornament = ORNAMENTS[ornamentId];
    const width = Math.round(canvas.width * 0.2);
    const height = Math.round((width * ornament.height) / ornament.width);

    return {
        ...base,
        id: uid(),
        type: 'ornament',
        name: ornament.label,
        ornamentId,
        fill,
        x: Math.round((canvas.width - width) / 2),
        y: Math.round((canvas.height - height) / 2),
        width,
        height,
    };
}

export function createImage(
    canvas: DesignCanvas,
    asset: EditorAsset,
): ImageElement {
    const scale = Math.min(
        (canvas.width * 0.4) / asset.width,
        (canvas.height * 0.8) / asset.height,
    );
    const width = Math.round(asset.width * scale);
    const height = Math.round(asset.height * scale);

    return {
        ...base,
        id: uid(),
        type: 'image',
        name: asset.name ? `Foto: ${asset.name}` : 'Foto',
        assetId: asset.id,
        x: Math.round((canvas.width - width) / 2),
        y: Math.round((canvas.height - height) / 2),
        width,
        height,
    };
}
