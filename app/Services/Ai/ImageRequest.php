<?php

namespace App\Services\Ai;

final readonly class ImageRequest
{
    public const PURPOSE_BACKGROUND = 'background';

    public const PURPOSE_VISUAL = 'visual';

    public const PURPOSE_BANNER = 'banner';

    public function __construct(
        public string $prompt,
        public int $width,
        public int $height,
        public string $accentColor,
        public string $purpose,
        public string $styleInstructions = '',
    ) {}
}
