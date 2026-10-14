<?php

namespace App\Services\Design;

use App\Services\Ai\DesignBrief;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Validates and normalizes the raw DesignSpec returned by a layout provider.
 *
 * The provider only decides *content* (copy, palette, which side the visual
 * goes on). Positions and sizes are computed by the BannerComposer, so AI
 * output is never trusted for layout.
 *
 * @phpstan-type HeadlineSpan array{text: string, fill: string|null}
 * @phpstan-type DesignSpec array{label: string, headline: string, headlineSpans: list<HeadlineSpan>, subheadline: string, description: string, cta: string, ctaColor: string|null, layout: string, imagePrompt: string, backgroundColor: string, textColor: string}
 */
class DesignSpecNormalizer
{
    public const LAYOUTS = ['visual-right', 'visual-left'];

    private const DEFAULT_TEXT_COLOR = '#172554';

    /**
     * @param  array<array-key, mixed>  $raw
     * @return DesignSpec
     *
     * @throws InvalidDesignSpecException
     */
    public function normalize(array $raw, DesignBrief $brief): array
    {
        $clean = [];

        foreach (['label', 'headline', 'subheadline', 'description', 'cta', 'imagePrompt'] as $key) {
            $clean[$key] = is_string($raw[$key] ?? null) ? $this->cleanText($raw[$key]) : null;
        }

        // Only art direction for the image model: too long is not an error.
        $clean['imagePrompt'] = $clean['imagePrompt'] === null ? null : Str::limit($clean['imagePrompt'], 590, '');

        // A headline given as colored fragments is the headline.
        $spans = $this->headlineSpans($raw['headlineSegments'] ?? null);

        if ($spans !== []) {
            $clean['headline'] = implode(' ', array_column($spans, 'text'));
        }

        $validator = Validator::make($clean, [
            'label' => ['nullable', 'string', 'max:48'],
            'headline' => ['required', 'string', 'max:90'],
            'subheadline' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:220'],
            'cta' => ['required', 'string', 'max:32'],
            'imagePrompt' => ['nullable', 'string', 'max:600'],
        ]);

        if ($validator->fails()) {
            throw new InvalidDesignSpecException(
                'AI menghasilkan layout yang tidak valid. Silakan coba lagi.',
            );
        }

        $layout = $raw['layout'] ?? null;
        $background = $raw['backgroundColor'] ?? null;
        $text = $raw['textColor'] ?? null;

        // Colors are cosmetic: fall back to a safe palette instead of failing
        // the job, and reject any pairing that would make the copy unreadable.
        $background = Color::isHex($background)
            ? strtolower((string) $background)
            : Color::mix($brief->accentColor, '#ffffff', 0.9);
        $text = Color::isHex($text) ? strtolower((string) $text) : self::DEFAULT_TEXT_COLOR;

        if (Color::contrast($text, $background) < 4.5) {
            $background = Color::mix($brief->accentColor, '#ffffff', 0.9);
            $text = self::DEFAULT_TEXT_COLOR;
        }

        return [
            'label' => Str::upper($clean['label'] ?? ''),
            'headline' => (string) $clean['headline'],
            'headlineSpans' => count($spans) > 1 ? $spans : [],
            'subheadline' => $clean['subheadline'] ?? '',
            'description' => $clean['description'] ?? '',
            'cta' => (string) $clean['cta'],
            'ctaColor' => Color::isHex($raw['ctaColor'] ?? null) ? strtolower((string) $raw['ctaColor']) : null,
            'layout' => in_array($layout, self::LAYOUTS, true) ? $layout : self::LAYOUTS[0],
            'imagePrompt' => $clean['imagePrompt'] ?? $brief->prompt,
            'backgroundColor' => $background,
            'textColor' => $text,
        ];
    }

    /**
     * @return list<HeadlineSpan>
     */
    private function headlineSpans(mixed $segments): array
    {
        $spans = [];

        foreach (is_array($segments) ? array_slice($segments, 0, 4) : [] as $segment) {
            $text = is_array($segment) && is_string($segment['text'] ?? null) ? $this->cleanText($segment['text']) : '';

            if ($text !== '') {
                $color = $segment['color'] ?? null;
                $spans[] = ['text' => $text, 'fill' => Color::isHex($color) ? strtolower((string) $color) : null];
            }
        }

        return $spans;
    }

    private function cleanText(string $value): string
    {
        $value = strip_tags($value);
        $value = (string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value);

        return Str::squish($value);
    }
}
