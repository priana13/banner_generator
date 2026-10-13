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
 */
class BannerComposer
{
    private const LINE_HEIGHT = 1.2;

    public function __construct(private DocumentNormalizer $normalizer) {}

    /**
     * The area reserved for the photo / AI visual.
     *
     * @return Box
     */
    public function visualBox(int $width, int $height, string $layout): array
    {
        if ($this->isWide($width, $height)) {
            $panelWidth = (int) round($width * 0.38);

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
     * @param  DesignSpec  $spec
     * @param  Asset|null  $visual  AI image generated at the exact size of the visual box.
     * @param  Asset|null  $background  AI image generated at the exact size of the canvas.
     * @return array{schemaVersion: int, canvas: array{width: int, height: int, backgroundColor: string}, elements: list<array<string, mixed>>}
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
        $textBox = $this->textBox($width, $height, $panel);
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

        return $this->normalizer->normalize([
            'canvas' => ['width' => $width, 'height' => $height, 'backgroundColor' => $spec['backgroundColor']],
            'elements' => array_map(
                fn (array $element): array => ['id' => (string) Str::uuid(), ...$element],
                [...$elements, ...$this->copy($spec, $accent, $textBox, $logo)],
            ),
        ]);
    }

    /**
     * Stack logo, label, headline, description and CTA inside the text box,
     * shrinking the type scale until the whole block fits.
     *
     * @param  DesignSpec  $spec
     * @param  Box  $box
     * @return list<array<string, mixed>>
     */
    private function copy(array $spec, string $accent, array $box, ?Asset $logo): array
    {
        $unit = min($box['height'], $box['width'] * 0.75);

        // Shrink the type scale first; if the copy still does not fit (tiny
        // banners), drop the optional lines rather than overflow the canvas.
        foreach ([[], ['description'], ['description', 'label']] as $dropped) {
            $spec = [...$spec, ...array_fill_keys($dropped, '')];
            $scale = 1.0;

            do {
                $labelSize = max(8, (int) round($unit * 0.046 * $scale));
                $headlineSize = max(10, (int) round($unit * 0.15 * $scale));
                $bodySize = max(9, (int) round($unit * 0.056 * $scale));
                $gap = (int) round($unit * 0.045 * $scale);

                $logoBox = $logo === null ? null : $this->contain($logo, [
                    'x' => $box['x'], 'y' => 0,
                    'width' => (int) round($box['width'] * 0.4), 'height' => (int) round($unit * 0.15 * $scale),
                ], center: false);

                $labelHeight = $spec['label'] === '' ? 0 : $this->textHeight($spec['label'], $labelSize, $box['width'], true);
                $headlineHeight = $this->textHeight($spec['headline'], $headlineSize, $box['width'], true);
                $bodyHeight = $spec['description'] === '' ? 0 : $this->textHeight($spec['description'], $bodySize, $box['width'], false);
                $buttonHeight = (int) round($bodySize * 2.6);

                $heights = array_filter([$logoBox['height'] ?? 0, $labelHeight, $headlineHeight, $bodyHeight, $buttonHeight]);
                $total = array_sum($heights) + $gap * (count($heights) - 1);
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

        $text = fn (string $name, string $content, int $top, int $size, int $height, string $fill, bool $bold): array => [
            'type' => 'text', 'name' => $name, 'text' => $content,
            'x' => $box['x'], 'y' => $top, 'width' => $box['width'], 'height' => $height,
            'fontFamily' => 'Inter', 'fontSize' => $size, 'fontStyle' => $bold ? 'bold' : 'normal', 'fill' => $fill,
        ];

        if ($labelHeight > 0) {
            $elements[] = $text('Label', $spec['label'], $y, $labelSize, $labelHeight, $this->readable($accent, $spec), true);
            $y += $labelHeight + $gap;
        }

        $elements[] = $text('Judul utama', $spec['headline'], $y, $headlineSize, $headlineHeight, $spec['textColor'], true);
        $y += $headlineHeight + $gap;

        if ($bodyHeight > 0) {
            $muted = Color::mix($spec['textColor'], $spec['backgroundColor'], 0.3);
            $elements[] = $text('Deskripsi', $spec['description'], $y, $bodySize, $bodyHeight, $muted, false);
            $y += $bodyHeight + $gap;
        }

        $buttonWidth = (int) round(mb_strlen($spec['cta']) * $bodySize * 0.62 + $bodySize * 3.2);
        $elements[] = [
            'type' => 'button', 'name' => 'Tombol CTA', 'text' => $spec['cta'],
            'x' => $box['x'], 'y' => $y, 'width' => min($box['width'], $buttonWidth), 'height' => $buttonHeight,
            'fontFamily' => 'Inter', 'fontSize' => $bodySize, 'fontStyle' => 'bold',
            'fill' => $accent,
            'textColor' => Color::contrast('#ffffff', $accent) >= 2.2 ? '#ffffff' : '#111827',
            'cornerRadius' => (int) round($buttonHeight * 0.26),
        ];

        return $elements;
    }

    /**
     * Use the accent for small copy only when it is legible on the background.
     *
     * @param  DesignSpec  $spec
     */
    private function readable(string $accent, array $spec): string
    {
        return Color::contrast($accent, $spec['backgroundColor']) >= 2.5 ? $accent : $spec['textColor'];
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
     * The padded column the copy lives in.
     *
     * @param  Box  $panel
     * @return Box
     */
    private function textBox(int $width, int $height, array $panel): array
    {
        return $this->inset($this->textPanel($width, $height, $panel), $this->isWide($width, $height) ? 0.13 : 0.1);
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
