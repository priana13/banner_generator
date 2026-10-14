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
    theme?: 'ramadan';
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

function blob(fill: string): string {
    return `<path d="M352 186 C 372 270, 268 348, 178 338 C 82 328, 22 258, 44 170 C 66 78, 150 22, 238 44 C 304 60, 336 120, 352 186 Z" fill="${fill}"/>`;
}

function dots(fill: string): string {
    const circles = Array.from({ length: 36 }, (_, index) => {
        const column = index % 6;
        const row = Math.floor(index / 6);

        return `<circle cx="${25 + column * 50}" cy="${25 + row * 50}" r="6"/>`;
    });

    return `<g fill="${fill}">${circles.join('')}</g>`;
}

function rings(fill: string): string {
    const circles = Array.from(
        { length: 6 },
        (_, index) =>
            `<circle cx="150" cy="150" r="${30 + index * 22}" opacity="${(1 - index * 0.14).toFixed(2)}"/>`,
    );

    return `<g fill="none" stroke="${fill}" stroke-width="3">${circles.join('')}</g>`;
}

function arc(fill: string): string {
    return (
        `<g fill="none" stroke="${fill}" stroke-width="16">` +
        '<circle cx="0" cy="0" r="110"/>' +
        '<circle cx="0" cy="0" r="180" opacity="0.6"/>' +
        '<circle cx="0" cy="0" r="250" opacity="0.32"/>' +
        '</g>'
    );
}

function swoosh(fill: string): string {
    return (
        `<path d="M0 150 C 150 40, 330 220, 600 60 L600 100 C 340 250, 160 90, 0 190 Z" fill="${fill}"/>` +
        `<path d="M0 120 C 160 20, 320 190, 600 30 L600 44 C 330 205, 160 40, 0 136 Z" fill="${fill}" opacity="0.4"/>`
    );
}

function sparkle(fill: string): string {
    const star =
        'M100 0 C 108 70, 130 92, 200 100 C 130 108, 108 130, 100 200 C 92 130, 70 108, 0 100 C 70 92, 92 70, 100 0 Z';

    return (
        `<path d="${star}" fill="${fill}" transform="translate(0 20) scale(0.8)"/>` +
        `<path d="${star}" fill="${fill}" opacity="0.6" transform="translate(140 0) scale(0.3)"/>`
    );
}

function star8(fill: string): string {
    return (
        `<g fill="${fill}">` +
        '<rect x="38" y="38" width="124" height="124"/>' +
        '<rect x="38" y="38" width="124" height="124" transform="rotate(45 100 100)"/>' +
        '</g><circle cx="100" cy="100" r="34" fill="#fff" opacity="0.28"/>'
    );
}

function crescent(fill: string): string {
    return `<path d="M150 30 A90 90 0 1 0 150 170 A72 72 0 1 1 150 30 Z" fill="${fill}"/>`;
}

function branch(fill: string): string {
    const leaves = Array.from({ length: 7 }, (_, index) => {
        const t = index / 6;
        const x = 30 + t * 240;
        const y = 120 - Math.sin(t * Math.PI) * 60 - t * 20;
        const size = 1 - t * 0.35;
        const side = index % 2 === 0 ? -1 : 1;
        const d = 'M0 0 C 14 -22, 44 -22, 58 0 C 44 22, 14 22, 0 0 Z';

        return `<path d="${d}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${side * 52 - 18}) scale(${size.toFixed(2)})"/>`;
    });

    return (
        `<path d="M10 140 C 90 60, 190 40, 292 96" fill="none" stroke="${fill}" stroke-width="4" stroke-linecap="round"/>` +
        `<g fill="${fill}">${leaves.join('')}</g>`
    );
}

function confetti(fill: string): string {
    const next = sequence(21);
    const pieces = Array.from({ length: 26 }, () => {
        const x = 12 + next() * 276;
        const y = 12 + next() * 176;
        const opacity = (0.35 + next() * 0.65).toFixed(2);

        return next() > 0.5
            ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + next() * 4).toFixed(1)}" opacity="${opacity}"/>`
            : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="14" height="5" rx="2.5" opacity="${opacity}" transform="rotate(${(next() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    });

    return `<g fill="${fill}">${pieces.join('')}</g>`;
}

function heart(fill: string): string {
    return `<path d="M100 170 C 20 110, 0 60, 40 30 C 70 10, 95 30, 100 52 C 105 30, 130 10, 160 30 C 200 60, 180 110, 100 170 Z" fill="${fill}"/>`;
}

function burst(fill: string): string {
    const rays = Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const inner = index % 2 === 0 ? 62 : 78;

        return `<line x1="${(150 + Math.cos(angle) * inner).toFixed(1)}" y1="${(150 + Math.sin(angle) * inner).toFixed(1)}" x2="${(150 + Math.cos(angle) * 140).toFixed(1)}" y2="${(150 + Math.sin(angle) * 140).toFixed(1)}"/>`;
    });

    return `<g stroke="${fill}" stroke-width="7" stroke-linecap="round">${rays.join('')}</g>`;
}

function stripes(fill: string): string {
    const lines = Array.from(
        { length: 20 },
        (_, index) =>
            `<line x1="${-300 + index * 32}" y1="300" x2="${index * 32}" y2="0"/>`,
    );

    return `<g stroke="${fill}" stroke-width="5" opacity="0.55">${lines.join('')}</g>`;
}

function petals(fill: string): string {
    const items = Array.from(
        { length: 8 },
        (_, index) =>
            `<ellipse cx="100" cy="46" rx="20" ry="42" transform="rotate(${index * 45} 100 100)" opacity="0.85"/>`,
    );

    return `<g fill="${fill}">${items.join('')}</g><circle cx="100" cy="100" r="18" fill="#fff" opacity="0.55"/>`;
}

function arch(fill: string): string {
    const d =
        'M22 258 V122 C 22 64, 62 44, 100 12 C 138 44, 178 64, 178 122 V258 Z';

    return (
        `<path d="${d}" fill="${fill}" opacity="0.14"/>` +
        `<path d="${d}" fill="none" stroke="${fill}" stroke-width="6" stroke-linejoin="round"/>`
    );
}

function ramadanLantern(fill: string): string {
    return (
        `<g stroke="${fill}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
        '<path d="M100 4 V35 M90 35 H110 M75 57 Q75 35 100 35 Q125 35 125 57"/>' +
        '<path d="M65 75 L78 57 H122 L135 75 Z M65 75 H135 L150 110 V215 L130 240 H70 L50 215 V110 Z"/>' +
        '<path d="M70 240 H130 L118 258 H82 Z M100 258 V280 M86 280 H114"/>' +
        '<path d="M82 80 L73 112 V210 L84 234 M118 80 L127 112 V210 L116 234"/>' +
        '</g>' +
        `<path d="M100 112 L117 160 L100 208 L83 160 Z" fill="${fill}" opacity="0.65"/>` +
        `<path d="M54 116 H146 V208 H54 Z" fill="${fill}" opacity="0.08"/>`
    );
}

function ramadanMosque(fill: string): string {
    return (
        `<g fill="${fill}">` +
        '<path d="M130 125 C130 96 171 76 200 52 C229 76 270 96 270 125 Z"/>' +
        '<path fill-rule="evenodd" d="M104 132 H296 V224 H104 Z M176 224 V177 Q200 144 224 177 V224 Z"/>' +
        '<path d="M36 100 H70 V224 H36 Z M330 100 H364 V224 H330 Z M26 88 L53 55 L80 88 Z M320 88 L347 55 L374 88 Z"/>' +
        '<path d="M74 180 H99 V224 H74 Z M301 180 H326 V224 H301 Z"/>' +
        '<rect x="16" y="224" width="368" height="8" rx="4"/>' +
        '</g>' +
        `<g fill="none" stroke="${fill}" stroke-width="5" stroke-linecap="round">` +
        '<path d="M200 49 V31 M53 52 V38 M347 52 V38 M26 95 H80 M320 95 H374"/>' +
        '</g>' +
        `<path d="M209 7 A13 13 0 1 0 209 29 A11 11 0 0 1 209 7 Z" fill="${fill}"/>` +
        '<g fill="#fff" opacity="0.25"><rect x="45" y="114" width="16" height="36" rx="8"/><rect x="339" y="114" width="16" height="36" rx="8"/></g>'
    );
}

function ramadanKetupat(fill: string): string {
    return (
        `<g fill="none" stroke="${fill}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">` +
        '<path d="M109 12 C81 30 87 61 106 79 M113 12 C141 30 135 61 116 79"/>' +
        '<path d="M110 197 C86 224 120 246 88 275 M118 203 C146 229 112 252 144 282"/>' +
        '</g>' +
        `<path d="M110 72 L182 144 L110 216 L38 144 Z" fill="${fill}"/>` +
        '<g fill="#fff" opacity="0.32">' +
        '<path d="M92 90 L110 108 L92 126 L74 108 Z M128 90 L146 108 L128 126 L110 108 Z M56 126 L74 144 L56 162 L38 144 Z M92 126 L110 144 L92 162 L74 144 Z M128 126 L146 144 L128 162 L110 144 Z M164 126 L182 144 L164 162 L146 144 Z M92 162 L110 180 L92 198 L74 180 Z M128 162 L146 180 L128 198 L110 180 Z"/>' +
        '</g>'
    );
}

function ramadanMoonStars(fill: string): string {
    return (
        `<g transform="translate(0 14) scale(1.1)">${crescent(fill)}</g>` +
        `<g fill="${fill}">` +
        '<path d="M204 48 L211 65 L229 67 L215 79 L219 97 L204 87 L189 97 L193 79 L179 67 L197 65 Z"/>' +
        '<path d="M240 126 L245 138 L258 140 L248 149 L251 162 L240 155 L229 162 L232 149 L222 140 L235 138 Z" opacity="0.7"/>' +
        '<path d="M166 177 L170 189 L183 190 L173 198 L176 211 L166 204 L155 211 L158 198 L149 190 L162 189 Z" opacity="0.55"/>' +
        '<circle cx="257" cy="42" r="3"/><circle cx="226" cy="202" r="4"/><circle cx="186" cy="126" r="3"/>' +
        '</g>'
    );
}

function ramadanGarland(fill: string): string {
    const lamps = [
        { x: 50, y: 60, scale: 0.55 },
        { x: 205, y: 45, scale: 0.7 },
        { x: 390, y: 60, scale: 0.55 },
    ];
    return (
        `<path d="M0 8 Q250 80 500 8" fill="none" stroke="${fill}" stroke-width="4" stroke-linecap="round"/>` +
        lamps
            .map(
                ({ x, y, scale }) =>
                    `<path d="M${x + 100 * scale} 35 V${y}" stroke="${fill}" stroke-width="3"/>` +
                    `<g transform="translate(${x} ${y}) scale(${scale})">${ramadanLantern(fill)}</g>`,
            )
            .join('')
    );
}

function ramadanPattern(fill: string): string {
    const tiles = Array.from({ length: 10 }, (_, index) => {
        const x = 50 + (index % 5) * 100;
        const y = 50 + Math.floor(index / 5) * 100;
        return (
            `<g transform="translate(${x} ${y})">` +
            '<rect x="-28" y="-28" width="56" height="56"/>' +
            '<rect x="-28" y="-28" width="56" height="56" transform="rotate(45)"/>' +
            '<path d="M-10 0 L0 -10 L10 0 L0 10 Z"/>' +
            '</g>'
        );
    });
    return `<g fill="none" stroke="${fill}" stroke-width="2.5" stroke-linejoin="round">${tiles.join('')}</g>`;
}

export const ORNAMENTS: Record<string, Ornament> = {
    waves: { label: 'Garis lengkung', width: 600, height: 300, draw: waves },
    leaf: { label: 'Daun', width: 120, height: 70, draw: leaf },
    foliage: { label: 'Dedaunan', width: 600, height: 200, draw: foliage },
    glow: { label: 'Pendar', width: 400, height: 400, draw: glow },
    blob: { label: 'Bentuk organik', width: 400, height: 360, draw: blob },
    swoosh: { label: 'Pita lengkung', width: 600, height: 240, draw: swoosh },
    arc: { label: 'Busur sudut', width: 300, height: 300, draw: arc },
    rings: { label: 'Cincin', width: 300, height: 300, draw: rings },
    dots: { label: 'Titik-titik', width: 300, height: 300, draw: dots },
    stripes: { label: 'Garis miring', width: 300, height: 300, draw: stripes },
    burst: { label: 'Sinar', width: 300, height: 300, draw: burst },
    confetti: { label: 'Konfeti', width: 300, height: 200, draw: confetti },
    branch: { label: 'Ranting', width: 300, height: 160, draw: branch },
    petals: { label: 'Bunga', width: 200, height: 200, draw: petals },
    sparkle: { label: 'Kilau', width: 200, height: 200, draw: sparkle },
    star8: {
        label: 'Bintang segi delapan',
        width: 200,
        height: 200,
        draw: star8,
        theme: 'ramadan',
    },
    crescent: {
        label: 'Bulan sabit',
        width: 200,
        height: 200,
        draw: crescent,
        theme: 'ramadan',
    },
    arch: {
        label: 'Lengkung kubah',
        width: 200,
        height: 260,
        draw: arch,
        theme: 'ramadan',
    },
    heart: { label: 'Hati', width: 200, height: 180, draw: heart },
    ramadan_lantern: {
        label: 'Lentera Ramadan',
        width: 200,
        height: 300,
        draw: ramadanLantern,
        theme: 'ramadan',
    },
    ramadan_mosque: {
        label: 'Siluet masjid',
        width: 400,
        height: 240,
        draw: ramadanMosque,
        theme: 'ramadan',
    },
    ramadan_ketupat: {
        label: 'Ketupat',
        width: 220,
        height: 300,
        draw: ramadanKetupat,
        theme: 'ramadan',
    },
    ramadan_moon_stars: {
        label: 'Bulan dan bintang',
        width: 280,
        height: 240,
        draw: ramadanMoonStars,
        theme: 'ramadan',
    },
    ramadan_garland: {
        label: 'Lentera gantung',
        width: 500,
        height: 280,
        draw: ramadanGarland,
        theme: 'ramadan',
    },
    ramadan_pattern: {
        label: 'Pola geometris Ramadan',
        width: 500,
        height: 200,
        draw: ramadanPattern,
        theme: 'ramadan',
    },
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
