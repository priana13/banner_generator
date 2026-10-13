<?php

namespace App\Services\Ai;

final readonly class DesignBrief
{
    public function __construct(
        public string $prompt,
        public int $width,
        public int $height,
        public string $accentColor,
    ) {}
}
