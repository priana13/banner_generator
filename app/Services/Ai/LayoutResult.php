<?php

namespace App\Services\Ai;

final readonly class LayoutResult
{
    /**
     * @param  array<array-key, mixed>  $spec  Raw, untrusted DesignSpec as returned by the provider.
     */
    public function __construct(
        public array $spec,
        public float $cost = 0.0,
    ) {}
}
