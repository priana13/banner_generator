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
 * @phpstan-type DesignSpec array{label: string, headline: string, description: string, cta: string, layout: string, imagePrompt: string, backgroundColor: string, textColor: string}
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

        foreach (['label', 'headline', 'description', 'cta', 'imagePrompt'] as $key) {
            $clean[$key] = is_string($raw[$key] ?? null) ? $this->cleanText($raw[$key]) : null;
        }

        $validator = Validator::make($clean, [
            'label' => ['nullable', 'string', 'max:48'],
            'headline' => ['required', 'string', 'max:90'],
            'description' => ['nullable', 'string', 'max:180'],
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
            'description' => $clean['description'] ?? '',
            'cta' => (string) $clean['cta'],
            'layout' => in_array($layout, self::LAYOUTS, true) ? $layout : self::LAYOUTS[0],
            'imagePrompt' => $clean['imagePrompt'] ?? $brief->prompt,
            'backgroundColor' => $background,
            'textColor' => $text,
        ];
    }

    private function cleanText(string $value): string
    {
        $value = strip_tags($value);
        $value = (string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value);

        return Str::squish($value);
    }
}
