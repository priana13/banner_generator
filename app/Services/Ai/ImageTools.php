<?php

namespace App\Services\Ai;

use GdImage;

final class ImageTools
{
    /**
     * Decode an image, cover-crop it to the exact target size and re-encode
     * it as JPEG.
     *
     * @throws AiProviderException
     */
    public static function cover(string $binary, int $width, int $height): string
    {
        $source = @imagecreatefromstring($binary);

        if ($source === false) {
            throw new AiProviderException('Penyedia gambar mengembalikan berkas yang tidak dapat dibaca.');
        }

        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        $scale = max($width / $sourceWidth, $height / $sourceHeight);
        $cropWidth = (int) min($sourceWidth, round($width / $scale));
        $cropHeight = (int) min($sourceHeight, round($height / $scale));

        $target = self::canvas($width, $height);

        imagecopyresampled(
            $target, $source,
            0, 0,
            intdiv($sourceWidth - $cropWidth, 2), intdiv($sourceHeight - $cropHeight, 2),
            $width, $height,
            $cropWidth, $cropHeight,
        );

        return self::encode($target, 'image/jpeg');
    }

    public static function canvas(int $width, int $height): GdImage
    {
        $image = imagecreatetruecolor(max(1, $width), max(1, $height));

        if ($image === false) {
            throw new AiProviderException('Gagal menyiapkan kanvas gambar.');
        }

        return $image;
    }

    /**
     * @param  'image/jpeg'|'image/png'|'image/webp'  $mimeType
     */
    public static function encode(GdImage $image, string $mimeType, int $quality = 88): string
    {
        ob_start();

        match ($mimeType) {
            'image/png' => imagepng($image),
            'image/webp' => imagewebp($image, null, $quality),
            'image/jpeg' => imagejpeg($image, null, $quality),
        };

        return (string) ob_get_clean();
    }
}
