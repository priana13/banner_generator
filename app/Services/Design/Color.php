<?php

namespace App\Services\Design;

final class Color
{
    public const HEX_PATTERN = '/^#[0-9a-fA-F]{6}$/';

    public static function isHex(mixed $value): bool
    {
        return is_string($value) && preg_match(self::HEX_PATTERN, $value) === 1;
    }

    /**
     * @return array{int<0, 255>, int<0, 255>, int<0, 255>}
     */
    public static function toRgb(string $hex): array
    {
        $channel = fn (int $offset): int => max(0, min(255, (int) hexdec(substr($hex, $offset, 2))));

        return [$channel(1), $channel(3), $channel(5)];
    }

    /**
     * Mix two colors. A weight of 0 returns $hex, a weight of 1 returns $with.
     */
    public static function mix(string $hex, string $with, float $weight): string
    {
        $a = self::toRgb($hex);
        $b = self::toRgb($with);

        return sprintf(
            '#%02x%02x%02x',
            (int) round($a[0] + ($b[0] - $a[0]) * $weight),
            (int) round($a[1] + ($b[1] - $a[1]) * $weight),
            (int) round($a[2] + ($b[2] - $a[2]) * $weight),
        );
    }

    /**
     * WCAG contrast ratio between two colors (1 to 21).
     */
    public static function contrast(string $a, string $b): float
    {
        $la = self::luminance($a);
        $lb = self::luminance($b);

        return (max($la, $lb) + 0.05) / (min($la, $lb) + 0.05);
    }

    private static function luminance(string $hex): float
    {
        $channels = array_map(function (int $channel): float {
            $value = $channel / 255;

            return $value <= 0.03928 ? $value / 12.92 : (($value + 0.055) / 1.055) ** 2.4;
        }, self::toRgb($hex));

        return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
    }
}
