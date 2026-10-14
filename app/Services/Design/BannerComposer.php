<?php

namespace App\Services\Design;

use App\Models\Asset;
use App\Services\Ai\DesignBrief;
use Illuminate\Support\Str;

/**
 * Deterministic layout engine. Takes a normalized DesignSpec (content only)
 * and composes a layered design document with absolute coordinates, fitting
 * the copy so it never overflows its column.
 *
 * @phpstan-import-type DesignSpec from DesignSpecNormalizer
 *
 * @phpstan-type Box array{x: int, y: int, width: int, height: int}
 * @phpstan-type Document array{schemaVersion: int, canvas: array{width: int, height: int, backgroundColor: string}, elements: list<array<string, mixed>>}
 */
class BannerComposer
{
    /** Colored panel next to the copy, with an AI image. */
    public const STYLE_PANEL = 'panel';

    /** Light background, ornaments and a photo with its background removed. */
    public const STYLE_CUTOUT = 'cutout';

    public const STYLES = [self::STYLE_PANEL, self::STYLE_CUTOUT];

    private const LINE_HEIGHT = 1.2;

    /** Type scale as fractions of the text box height. */
    private const TYPOGRAPHY = [
        self::STYLE_PANEL => [
            'font' => 'Inter', 'headline' => 0.15, 'headlineStyle' => 'bold',
            'subheadline' => 0.065, 'body' => 0.056, 'label' => 0.046, 'button' => 2.6, 'pill' => false,
        ],
        self::STYLE_CUTOUT => [
            'font' => 'Poppins', 'headline' => 0.25, 'headlineStyle' => '800',
            'subheadline' => 0.083, 'body' => 0.06, 'label' => 0.046, 'button' => 2.5, 'pill' => true,
        ],
    ];

    public function __construct(private DocumentNormalizer $normalizer) {}

    /**
     * The area reserved for the photo / AI visual.
     *
     * @return Box
     */
    public function visualBox(int $width, int $height, string $layout, float $share = 0.38): array
    {
        if ($this->isWide($width, $height)) {
            $panelWidth = (int) round($width * $share);

            return [
                'x' => $layout === 'visual-left' ? 0 : $width - $panelWidth,
                'y' => 0,
                'width' => $panelWidth,
                'height' => $height,
            ];
        }

        $panelHeight = (int) round($height * 0.42);

        return ['x' => 0, 'y' => $height - $panelHeight, 'width' => $width, 'height' => $panelHeight];
    }

    /**
     * The "panel" style.
     *
     * @param  DesignSpec  $spec
     * @param  Asset|null  $visual  AI image generated at the exact size of the visual box.
     * @param  Asset|null  $background  AI image generated at the exact size of the canvas.
     * @return Document
     */
    public function compose(
        array $spec,
        DesignBrief $brief,
        ?Asset $visual = null,
        ?Asset $background = null,
        ?Asset $photo = null,
        ?Asset $logo = null,
    ): array {
        $width = $brief->width;
        $height = $brief->height;
        $accent = strtolower($brief->accentColor);
        $panel = $this->visualBox($width, $height, $spec['layout']);
        $elements = [];

        if ($background !== null) {
            $elements[] = [
                'type' => 'image', 'name' => 'Latar AI', 'assetId' => $background->id,
                'x' => 0, 'y' => 0, 'width' => $width, 'height' => $height, 'locked' => true,
            ];
            $elements[] = [
                'type' => 'rect', 'name' => 'Panel teks', 'fill' => $spec['backgroundColor'], 'opacity' => 0.88,
                ...$this->textPanel($width, $height, $panel), 'locked' => true,
            ];
        }

        $elements[] = ['type' => 'rect', 'name' => 'Panel warna', 'fill' => $accent, ...$panel];

        if ($visual !== null) {
            $elements[] = ['type' => 'image', 'name' => 'Visual AI', 'assetId' => $visual->id, ...$panel];
        } else {
            $radius = (int) round(min($panel['width'], $panel['height']) * 0.37);
            $elements[] = [
                'type' => 'circle', 'name' => 'Dekorasi', 'fill' => '#ffffff', 'opacity' => 0.16,
                'x' => (int) round($panel['x'] + $panel['width'] / 2 - $radius),
                'y' => (int) round($panel['y'] + $panel['height'] / 2 - $radius),
                'width' => $radius * 2, 'height' => $radius * 2,
            ];
        }

        if ($photo !== null) {
            $elements[] = [
                'type' => 'image', 'name' => 'Foto', 'assetId' => $photo->id,
                ...$this->contain($photo, $this->inset($panel, 0.08)),
            ];
        }

        $textBox = $this->inset($this->textPanel($width, $height, $panel), $this->isWide($width, $height) ? 0.13 : 0.1);

        return $this->document($width, $height, $spec['backgroundColor'], [
            ...$elements,
            ...$this->copy($spec, self::STYLE_PANEL, $textBox, $logo, [
                'label' => $this->readable($accent, $spec['textColor'], $spec['backgroundColor']),
                'headline' => $spec['textColor'],
                'subheadline' => $spec['textColor'],
                'description' => Color::mix($spec['textColor'], $spec['backgroundColor'], 0.3),
                'button' => $spec['ctaColor'] ?? $accent,
            ]),
        ]);
    }

    /**
     * The "cutout" style: white canvas, soft glow, thin wave lines, leaves,
     * and the photo (ideally with its background removed) standing on the
     * bottom edge with foliage in front of it.
     *
     * @param  DesignSpec  $spec
     * @param  string|null  $backgroundColor  Canvas color to keep, if light enough.
     * @return Document
     */
    public function composeCutout(
        array $spec,
        DesignBrief $brief,
        ?Asset $photo = null,
        ?Asset $logo = null,
        ?string $backgroundColor = null,
    ): array {
        // The canvas color the user picked is kept as long as the dark
        // copy stays readable on it.
        $background = $backgroundColor !== null && Color::contrast('#3f3f46', $backgroundColor) >= 4.5
            ? strtolower($backgroundColor)
            : '#ffffff';

        $width = $brief->width;
        $height = $brief->height;
        $accent = strtolower($brief->accentColor);
        $dark = Color::mix($accent, '#000000', 0.45);
        $wide = $this->isWide($width, $height);
        $panel = $this->visualBox($width, $height, $spec['layout'], 0.4);
        $textPanel = $this->textPanel($width, $height, $panel);
        $short = min($width, $height);

        $ornament = fn (string $id, string $name, int $x, int $y, int $w, int $h, float $opacity = 1, int $rotation = 0): array => [
            'type' => 'ornament', 'ornamentId' => $id, 'name' => $name, 'fill' => $accent,
            'x' => $x, 'y' => $y, 'width' => max(1, $w), 'height' => max(1, $h),
            'opacity' => $opacity, 'rotation' => $rotation,
        ];

        // Backdrop: a faint wash over the copy and a stronger glow where the
        // photo goes, then the parallel wave lines.
        $glow = (int) round(min($panel['width'], $panel['height']) * 1.05);
        $elements = [
            [...$ornament('glow', 'Gradasi lembut', 0, 0, (int) round($textPanel['width'] * 0.7), $textPanel['height'], 0.3), 'locked' => true],
            [
                ...$ornament(
                    'glow', 'Pendar foto',
                    (int) round($panel['x'] + ($panel['width'] - $glow) / 2),
                    (int) round($panel['y'] + ($panel['height'] - $glow) / 2),
                    $glow, $glow, 0.9,
                ),
                'locked' => true,
            ],
            $ornament('waves', 'Garis lengkung atas', 0, 0, (int) round($width * 0.3), (int) round($height * 0.36), 0.7),
            $ornament(
                'waves', 'Garis lengkung bawah',
                (int) round($textPanel['x'] + $textPanel['width'] * 0.45), (int) round($height * 0.7),
                (int) round($textPanel['width'] * 0.5), (int) round($height * 0.3), 0.7,
            ),
        ];

        if ($photo !== null) {
            // Stand the subject on the bottom edge, never cropped at the top.
            $box = $this->contain($photo, [
                'x' => $panel['x'], 'y' => $panel['y'] + (int) round($panel['height'] * 0.05),
                'width' => $panel['width'], 'height' => (int) round($panel['height'] * 0.95),
            ]);
            $elements[] = [
                'type' => 'image', 'name' => 'Foto', 'assetId' => $photo->id,
                ...$box, 'y' => $panel['y'] + $panel['height'] - $box['height'],
            ];

            $foliage = min((int) round($panel['height'] * 0.24), (int) round($panel['width'] / 3));
            $elements[] = $ornament(
                'foliage', 'Dedaunan', $panel['x'], $panel['y'] + $panel['height'] - $foliage, $panel['width'], $foliage,
            );
        }

        $leaf = (int) round($short * 0.085);
        $leafHeight = (int) round($leaf * 0.58);

        foreach ([[0.01, 0.47, -28], [0.9, 0.15, 24], [0.8, 0.84, 150]] as $index => [$fx, $fy, $rotation]) {
            $elements[] = $ornament(
                'leaf', 'Daun '.($index + 1),
                (int) round($textPanel['x'] + $textPanel['width'] * $fx),
                (int) round($textPanel['y'] + $textPanel['height'] * $fy),
                (int) round($leaf * (1 - $index * 0.15)), (int) round($leafHeight * (1 - $index * 0.15)),
                1, $rotation,
            );
        }

        // Unless told otherwise, the headline goes from the brand color to a
        // deeper shade of it, like the CTA.
        $spans = $spec['headlineSpans'];
        $last = count($spans) - 1;

        foreach ($spans as $index => $span) {
            $fill = $span['fill'] ?? ($index === $last ? $dark : $accent);
            $spans[$index]['fill'] = Color::contrast($fill, $background) >= 1.8 ? $fill : $dark;
        }

        $textBox = $this->inset($textPanel, $wide ? 0.13 : 0.1);

        if ($wide) {
            // Keep clear of the photo.
            $textBox['width'] -= (int) round($textPanel['width'] * 0.04);
        }

        return $this->document($width, $height, $background, [
            ...$elements,
            ...$this->copy([...$spec, 'label' => '', 'headlineSpans' => $spans], self::STYLE_CUTOUT, $textBox, $logo, [
                'label' => $dark,
                'headline' => $dark,
                'subheadline' => '#3f3f46',
                'description' => '#52525b',
                'button' => $spec['ctaColor'] ?? $dark,
            ]),
        ]);
    }

    /**
     * Stack logo, label, headline, subheadline, description and CTA inside
     * the text box, shrinking the type scale until the whole block fits.
     *
     * @param  DesignSpec  $spec
     * @param  self::STYLE_*  $style
     * @param  Box  $box
     * @param  array{label: string, headline: string, subheadline: string, description: string, button: string}  $colors
     * @return list<array<string, mixed>>
     */
    private function copy(array $spec, string $style, array $box, ?Asset $logo, array $colors): array
    {
        $type = self::TYPOGRAPHY[$style];
        $heights = $sizes = ['label' => 0, 'headline' => 0, 'subheadline' => 0, 'description' => 0];
        $unit = min($box['height'], $box['width'] * 0.75);

        // Shrink the type scale first; if the copy still does not fit (tiny
        // banners), drop the optional lines rather than overflow the canvas.
        foreach ([[], ['description'], ['description', 'subheadline'], ['description', 'subheadline', 'label']] as $dropped) {
            $spec = [...$spec, ...array_fill_keys($dropped, '')];
            $scale = 1.0;

            do {
                $sizes = [
                    'label' => max(8, (int) round($unit * $type['label'] * $scale)),
                    'headline' => max(10, (int) round($unit * $type['headline'] * $scale)),
                    'subheadline' => max(9, (int) round($unit * $type['subheadline'] * $scale)),
                    'description' => max(9, (int) round($unit * $type['body'] * $scale)),
                ];
                $gap = (int) round($unit * 0.045 * $scale);

                $logoBox = $logo === null ? null : $this->contain($logo, [
                    'x' => $box['x'], 'y' => 0,
                    'width' => (int) round($box['width'] * 0.4), 'height' => (int) round($unit * 0.15 * $scale),
                ], center: false);

                foreach ($sizes as $key => $size) {
                    $heights[$key] = $spec[$key] === ''
                        ? 0
                        : $this->textHeight($spec[$key], $size, $box['width'], $key !== 'description');
                }

                $buttonHeight = (int) round($sizes['description'] * $type['button']);
                $stack = array_filter([$logoBox['height'] ?? 0, ...array_values($heights), $buttonHeight]);
                $total = array_sum($stack) + $gap * (count($stack) - 1);
                $fits = $total <= $box['height'];
                $scale *= 0.94;
            } while (! $fits && $scale > 0.3);

            if ($fits) {
                break;
            }
        }

        $y = (int) round($box['y'] + max(0, $box['height'] - $total) / 2);
        $elements = [];

        if ($logo !== null && $logoBox !== null) {
            $elements[] = ['type' => 'image', 'name' => 'Logo', 'assetId' => $logo->id, ...$logoBox, 'y' => $y];
            $y += $logoBox['height'] + $gap;
        }

        $lines = [
            'label' => ['Label', 'bold'],
            'headline' => ['Judul utama', $type['headlineStyle']],
            'subheadline' => ['Subjudul', '600'],
            'description' => ['Deskripsi', 'normal'],
        ];

        foreach ($lines as $key => [$name, $fontStyle]) {
            if ($heights[$key] === 0) {
                continue;
            }

            $elements[] = [
                'type' => 'text', 'name' => $name, 'text' => $spec[$key],
                'x' => $box['x'], 'y' => $y, 'width' => $box['width'], 'height' => $heights[$key],
                'fontFamily' => $type['font'], 'fontSize' => $sizes[$key], 'fontStyle' => $fontStyle,
                'fill' => $colors[$key],
                ...($key === 'headline' ? ['spans' => array_map(
                    fn (array $span): array => ['text' => $span['text'], 'fill' => $span['fill'] ?? $colors['headline']],
                    $spec['headlineSpans'],
                )] : []),
            ];
            $y += $heights[$key] + $gap;
        }

        $buttonSize = $sizes['description'];
        $buttonWidth = (int) round(mb_strlen($spec['cta']) * $buttonSize * 0.62 + $buttonSize * 3.2);
        $elements[] = [
            'type' => 'button', 'name' => 'Tombol CTA', 'text' => $spec['cta'],
            'x' => $box['x'], 'y' => $y, 'width' => min($box['width'], $buttonWidth), 'height' => $buttonHeight,
            'fontFamily' => $type['font'], 'fontSize' => $buttonSize, 'fontStyle' => $type['pill'] ? '600' : 'bold',
            'fill' => $colors['button'],
            'textColor' => Color::contrast('#ffffff', $colors['button']) >= 2.2 ? '#ffffff' : '#111827',
            'cornerRadius' => (int) round($buttonHeight * ($type['pill'] ? 0.5 : 0.26)),
        ];

        return $elements;
    }

    /**
     * @param  list<array<string, mixed>>  $elements
     * @return Document
     */
    private function document(int $width, int $height, string $backgroundColor, array $elements): array
    {
        return $this->normalizer->normalize([
            'canvas' => ['width' => $width, 'height' => $height, 'backgroundColor' => $backgroundColor],
            'elements' => array_map(
                fn (array $element): array => ['id' => (string) Str::uuid(), ...$element],
                $elements,
            ),
        ]);
    }

    /**
     * Use the accent for small copy only when it is legible on the background.
     */
    private function readable(string $accent, string $textColor, string $backgroundColor): string
    {
        return Color::contrast($accent, $backgroundColor) >= 2.5 ? $accent : $textColor;
    }

    /**
     * Estimate the rendered height of wrapped text. Konva measures the real
     * glyphs in the browser; this approximation is deliberately pessimistic.
     */
    private function textHeight(string $text, int $fontSize, int $width, bool $bold): int
    {
        $charWidth = $fontSize * ($bold ? 0.62 : 0.56);
        $lines = 0;

        foreach (explode("\n", $text) as $paragraph) {
            $lineWidth = 0.0;
            $lines++;

            foreach (explode(' ', $paragraph) as $word) {
                $wordWidth = mb_strlen($word) * $charWidth;
                $needed = $lineWidth === 0.0 ? $wordWidth : $lineWidth + $charWidth + $wordWidth;

                if ($needed > $width && $lineWidth > 0.0) {
                    $lines++;
                    $lineWidth = $wordWidth;
                } else {
                    $lineWidth = $needed;
                }

                // A single word wider than the column is broken across lines.
                if ($lineWidth > $width) {
                    $lines += (int) floor($lineWidth / $width);
                    $lineWidth = fmod($lineWidth, $width);
                }
            }
        }

        return (int) ceil($lines * $fontSize * self::LINE_HEIGHT);
    }

    /**
     * Everything that is not the visual box.
     *
     * @param  Box  $panel
     * @return Box
     */
    private function textPanel(int $width, int $height, array $panel): array
    {
        if ($this->isWide($width, $height)) {
            return [
                'x' => $panel['x'] === 0 ? $panel['width'] : 0,
                'y' => 0,
                'width' => $width - $panel['width'],
                'height' => $height,
            ];
        }

        return ['x' => 0, 'y' => 0, 'width' => $width, 'height' => $height - $panel['height']];
    }

    /**
     * @param  Box  $box
     * @return Box
     */
    private function inset(array $box, float $ratio): array
    {
        $pad = (int) round(min($box['width'], $box['height']) * $ratio);

        return [
            'x' => $box['x'] + $pad,
            'y' => $box['y'] + $pad,
            'width' => $box['width'] - $pad * 2,
            'height' => $box['height'] - $pad * 2,
        ];
    }

    /**
     * Fit an asset inside a box while keeping its aspect ratio.
     *
     * @param  Box  $box
     * @return Box
     */
    private function contain(Asset $asset, array $box, bool $center = true): array
    {
        $ratio = min($box['width'] / max(1, $asset->width), $box['height'] / max(1, $asset->height));
        $width = max(1, (int) round($asset->width * $ratio));
        $height = max(1, (int) round($asset->height * $ratio));

        return [
            'x' => $center ? (int) round($box['x'] + ($box['width'] - $width) / 2) : $box['x'],
            'y' => $center ? (int) round($box['y'] + ($box['height'] - $height) / 2) : $box['y'],
            'width' => $width,
            'height' => $height,
        ];
    }

    private function isWide(int $width, int $height): bool
    {
        return $width / $height >= 1.5;
    }
}
