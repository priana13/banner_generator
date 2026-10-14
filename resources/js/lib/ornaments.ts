/**
 * Built-in decorative vectors. Each ornament is drawn in the element's
 * color and stretched to its box. The ids and intrinsic sizes are mirrored
 * in config/banner.php, which the server uses for validation and layout.
 */
type Ornament = {
    label: string;
    width: number;
    height: number;
    draw: (fill: string) => string;
};

/** Small deterministic generator, so the artwork never changes. */
function sequence(seed: number): () => number {
    let state = seed;

    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;

        return state / 4294967296;
    };
}

function waves(fill: string): string {
    const lines = Array.from({ length: 14 }, (_, index) => {
        const y = 14 + index * 9;

        return `<path d="M-20 ${y + 96} C 110 ${y - 34}, 250 ${y + 124}, 410 ${y + 16} S 590 ${y - 58}, 640 ${y - 84}"/>`;
    });

    return `<g fill="none" stroke="${fill}" stroke-width="1.3" stroke-linecap="round" opacity="0.6">${lines.join('')}</g>`;
}

function leaf(fill: string): string {
    return [
        `<path d="M3 35 C 30 0, 86 0, 117 35 C 86 70, 30 70, 3 35 Z" fill="${fill}"/>`,
        '<path d="M3 35 C 30 70, 86 70, 117 35 Z" fill="#000" opacity="0.16"/>',
        '<path d="M8 35 L112 35" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.4"/>',
    ].join('');
}

function foliage(fill: string): string {
    const next = sequence(7);
    const leaves = Array.from({ length: 46 }, (_, index) => {
        const x = (index / 45) * 620 - 10 + (next() - 0.5) * 18;
        const length = 70 + next() * 110;
        const half = length * (0.16 + next() * 0.08);
        const angle = (next() - 0.5) * 110;
        const shade = next() * 0.42;
        const d = `M0 0 C ${-half} ${-length * 0.35}, ${-half * 0.7} ${-length * 0.85}, 0 ${-length} C ${half * 0.7} ${-length * 0.85}, ${half} ${-length * 0.35}, 0 0 Z`;

        return (
            `<g transform="translate(${x.toFixed(1)} 212) rotate(${angle.toFixed(1)})">` +
            `<path d="${d}" fill="${fill}"/>` +
            `<path d="${d}" fill="#000" opacity="${shade.toFixed(2)}"/>` +
            '</g>'
        );
    });

    return leaves.join('');
}

function glow(fill: string): string {
    return (
        '<defs><radialGradient id="g">' +
        `<stop offset="0" stop-color="${fill}" stop-opacity="0.5"/>` +
        `<stop offset="0.55" stop-color="${fill}" stop-opacity="0.18"/>` +
        `<stop offset="1" stop-color="${fill}" stop-opacity="0"/>` +
        '</radialGradient></defs><rect width="400" height="400" fill="url(#g)"/>'
    );
}

export const ORNAMENTS: Record<string, Ornament> = {
    waves: { label: 'Garis lengkung', width: 600, height: 300, draw: waves },
    leaf: { label: 'Daun', width: 120, height: 70, draw: leaf },
    foliage: { label: 'Dedaunan', width: 600, height: 200, draw: foliage },
    glow: { label: 'Pendar', width: 400, height: 400, draw: glow },
};

const cache = new Map<string, string>();

/**
 * The ornament as an image URL, ready for the canvas or an <image> tag.
 */
export function ornamentUrl(
    ornamentId: string,
    fill: string,
): string | undefined {
    const ornament = ORNAMENTS[ornamentId];

    // The color ends up inside SVG markup: only ever accept a hex value.
    if (!ornament || !/^#[0-9a-f]{6}$/i.test(fill)) {
        return undefined;
    }

    const key = `${ornamentId}:${fill}`;
    let url = cache.get(key);

    if (!url) {
        // Rendered larger than its nominal size so it stays crisp when
        // stretched over a big canvas.
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${ornament.width * 3}" height="${ornament.height * 3}" ` +
            `viewBox="0 0 ${ornament.width} ${ornament.height}" preserveAspectRatio="none">${ornament.draw(fill)}</svg>`;

        url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        cache.set(key, url);
    }

    return url;
}
