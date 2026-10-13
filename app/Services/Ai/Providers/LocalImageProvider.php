<?php

namespace App\Services\Ai\Providers;

use App\Services\Ai\Contracts\ImageProvider;
use App\Services\Ai\GeneratedImage;
use App\Services\Ai\ImageRequest;
use App\Services\Ai\ImageTools;
use App\Services\Design\Color;

/**
 * Offline stand-in for an image model: renders an abstract gradient in the
 * brand color. Deterministic for a given prompt.
 */
class LocalImageProvider implements ImageProvider
{
    public function name(): string
    {
        return 'local';
    }

    public function model(): string
    {
        return 'gradient-v1';
    }

    public function generate(ImageRequest $request): GeneratedImage
    {
        $width = $request->width;
        $height = $request->height;
        $image = ImageTools::canvas($width, $height);

        // Backgrounds stay pale so copy placed on top remains readable.
        [$from, $to] = $request->purpose === ImageRequest::PURPOSE_BACKGROUND
            ? [Color::mix($request->accentColor, '#ffffff', 0.94), Color::mix($request->accentColor, '#ffffff', 0.72)]
            : [Color::mix($request->accentColor, '#ffffff', 0.22), Color::mix($request->accentColor, '#000000', 0.28)];

        for ($x = 0; $x < $width; $x++) {
            [$r, $g, $b] = Color::toRgb(Color::mix($from, $to, $x / max(1, $width - 1)));
            imageline($image, $x, 0, $x, $height, (int) imagecolorallocate($image, $r, $g, $b));
        }

        imagealphablending($image, true);
        mt_srand(crc32($request->prompt.$request->purpose));
        $short = min($width, $height);

        for ($i = 0; $i < 6; $i++) {
            $diameter = mt_rand((int) ($short * 0.25), (int) ($short * 0.9));
            $shade = mt_rand(0, 1) === 1 ? 255 : 0;
            $color = (int) imagecolorallocatealpha($image, $shade, $shade, $shade, $shade === 255 ? 108 : 120);
            imagefilledellipse($image, mt_rand(0, $width), mt_rand(0, $height), $diameter, $diameter, $color);
        }

        mt_srand();

        return new GeneratedImage(ImageTools::encode($image, 'image/jpeg', 90), 'image/jpeg');
    }
}
