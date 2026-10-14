<?php

namespace App\Services\Design;

/**
 * Brings a (validated) design document into its canonical shape: every
 * element carries exactly the properties of its type, with defaults applied.
 */
class DocumentNormalizer
{
    /**
     * @return array{schemaVersion: int, canvas: array{width: int, height: int, backgroundColor: string}, elements: list<array<string, mixed>>}
     */
    public static function blank(int $width, int $height): array
    {
        return [
            'schemaVersion' => DocumentRules::SCHEMA_VERSION,
            'canvas' => ['width' => $width, 'height' => $height, 'backgroundColor' => '#ffffff'],
            'elements' => [],
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array{schemaVersion: int, canvas: array{width: int, height: int, backgroundColor: string}, elements: list<array<string, mixed>>}
     */
    public function normalize(array $document): array
    {
        $canvas = $document['canvas'];

        return [
            'schemaVersion' => DocumentRules::SCHEMA_VERSION,
            'canvas' => [
                'width' => (int) $canvas['width'],
                'height' => (int) $canvas['height'],
                'backgroundColor' => strtolower((string) $canvas['backgroundColor']),
            ],
            'elements' => array_map($this->element(...), array_values($document['elements'] ?? [])),
        ];
    }

    /**
     * The asset ids referenced by a document.
     *
     * @param  array<string, mixed>  $document
     * @return list<string>
     */
    public static function assetIds(array $document): array
    {
        $ids = [];

        foreach ($document['elements'] ?? [] as $element) {
            if (($element['type'] ?? null) === 'image' && is_string($element['assetId'] ?? null)) {
                $ids[] = $element['assetId'];
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * @param  array<string, mixed>  $element
     * @return array<string, mixed>
     */
    private function element(array $element): array
    {
        $type = (string) $element['type'];

        $base = [
            'id' => (string) $element['id'],
            'type' => $type,
            'name' => (string) ($element['name'] ?? ucfirst($type)),
            'x' => $this->number($element['x']),
            'y' => $this->number($element['y']),
            'width' => $this->number($element['width']),
            'height' => $this->number($element['height']),
            'rotation' => $this->number($element['rotation'] ?? 0),
            'opacity' => $this->number($element['opacity'] ?? 1),
            'visible' => (bool) ($element['visible'] ?? true),
            'locked' => (bool) ($element['locked'] ?? false),
        ];

        $font = [
            'text' => (string) ($element['text'] ?? ''),
            'fontFamily' => (string) ($element['fontFamily'] ?? 'Inter'),
            'fontSize' => $this->number($element['fontSize'] ?? 24),
            'fontStyle' => (string) ($element['fontStyle'] ?? 'normal'),
        ];

        $spans = $type === 'text' ? $this->spans($element['spans'] ?? null) : [];

        if ($spans !== []) {
            $font['text'] = implode(' ', array_column($spans, 'text'));
        }

        if (in_array($type, DocumentRules::FADABLE_TYPES, true) && is_array($element['fade'] ?? null)) {
            $fade = $element['fade'];
            $base['fade'] = ['type' => (string) $fade['type'], 'amount' => $this->number($fade['amount'])]
                + ($fade['type'] === 'linear' ? ['direction' => (string) ($fade['direction'] ?? 'bottom')] : []);
        }

        return $base + match ($type) {
            'text' => $font + [
                'align' => (string) ($element['align'] ?? 'left'),
                'fill' => strtolower((string) ($element['fill'] ?? '#1f2937')),
            ] + ($spans === [] ? [] : ['spans' => $spans]),
            'button' => $font + [
                'fill' => strtolower((string) ($element['fill'] ?? '#f97316')),
                'textColor' => strtolower((string) ($element['textColor'] ?? '#ffffff')),
                'cornerRadius' => $this->number($element['cornerRadius'] ?? 12),
            ],
            'rect' => [
                'fill' => strtolower((string) ($element['fill'] ?? '#f97316')),
                'cornerRadius' => $this->number($element['cornerRadius'] ?? 0),
            ],
            'circle' => [
                'fill' => strtolower((string) ($element['fill'] ?? '#f97316')),
            ],
            'ornament' => [
                'ornamentId' => (string) $element['ornamentId'],
                'fill' => strtolower((string) ($element['fill'] ?? '#f97316')),
            ],
            default => [
                'assetId' => (string) $element['assetId'],
            ],
        };
    }

    /**
     * @return list<array{text: string, fill: string}>
     */
    private function spans(mixed $spans): array
    {
        $clean = [];

        foreach (is_array($spans) ? $spans : [] as $span) {
            $text = trim((string) ($span['text'] ?? ''));

            if ($text !== '') {
                $clean[] = ['text' => $text, 'fill' => strtolower((string) $span['fill'])];
            }
        }

        // A single color needs no spans: the element's own fill covers it.
        return count($clean) > 1 ? $clean : [];
    }

    private function number(mixed $value): float|int
    {
        $rounded = round((float) $value, 2);

        return $rounded == (int) $rounded ? (int) $rounded : $rounded;
    }
}
