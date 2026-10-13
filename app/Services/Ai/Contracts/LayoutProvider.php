<?php

namespace App\Services\Ai\Contracts;

use App\Services\Ai\AiProviderException;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\LayoutResult;

interface LayoutProvider
{
    public function name(): string;

    public function model(): string;

    /**
     * Turn a brief into a raw DesignSpec. The result is untrusted and must be
     * passed through the DesignSpecNormalizer before it is used.
     *
     * @throws AiProviderException
     */
    public function generate(DesignBrief $brief): LayoutResult;
}
