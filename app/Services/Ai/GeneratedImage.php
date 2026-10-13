<?php

namespace App\Services\Ai;

final readonly class GeneratedImage
{
    public function __construct(
        public string $binary,
        public string $mimeType,
        public float $cost = 0.0,
    ) {}
}
