import { LINE_HEIGHT } from '@/lib/editor-elements';
import type { TextElement } from '@/types';

export type TextRun = { text: string; x: number; y: number; fill: string };

let context: CanvasRenderingContext2D | null = null;

function measurer(element: TextElement): (text: string) => number {
    context ??= document.createElement('canvas').getContext('2d');

    const ctx = context;

    if (!ctx) {
        return (text) => text.length * element.fontSize * 0.6;
    }

    const weight = element.fontStyle === 'normal' ? '400' : element.fontStyle;

    ctx.font = `${weight === 'bold' ? '700' : weight} ${element.fontSize}px "${element.fontFamily}"`;

    return (text) => ctx.measureText(text).width;
}

/**
 * Word-wrap a text element whose fragments have their own colors. Konva's
 * Text node supports a single fill, so multi-color text is drawn as one
 * run per word, positioned here.
 */
export function layoutSpans(element: TextElement): {
    runs: TextRun[];
    height: number;
} {
    const measure = measurer(element);
    const space = measure(' ');
    const lineHeight = element.fontSize * LINE_HEIGHT;
    const words = (element.spans ?? []).flatMap((span) =>
        span.text
            .split(/\s+/)
            .filter(Boolean)
            .map((text) => ({ text, fill: span.fill, width: measure(text) })),
    );

    const lines: (typeof words)[] = [];
    let line: typeof words = [];
    let lineWidth = 0;

    for (const word of words) {
        const needed =
            line.length === 0 ? word.width : lineWidth + space + word.width;

        if (needed > element.width && line.length > 0) {
            lines.push(line);
            line = [word];
            lineWidth = word.width;
        } else {
            line.push(word);
            lineWidth = needed;
        }
    }

    if (line.length > 0) {
        lines.push(line);
    }

    const runs: TextRun[] = [];

    lines.forEach((items, index) => {
        const width =
            items.reduce((total, word) => total + word.width, 0) +
            space * (items.length - 1);
        let x =
            element.align === 'center'
                ? (element.width - width) / 2
                : element.align === 'right'
                  ? element.width - width
                  : 0;

        for (const word of items) {
            runs.push({
                text: word.text,
                fill: word.fill,
                x,
                // Match Konva, which centers glyphs within the line box.
                y: index * lineHeight + (lineHeight - element.fontSize) / 2,
            });
            x += word.width + space;
        }
    });

    return { runs, height: Math.max(1, lines.length) * lineHeight };
}
