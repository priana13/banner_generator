<?php

namespace App\Services\Ai\Contracts;

use App\Services\Ai\AiProviderException;
use App\Services\Ai\GeneratedImage;
use App\Services\Ai\ImageRequest;

interface ImageProvider
{
    public function name(): string;

    public function model(): string;

    /**
     * Generate an image of exactly the requested size, without text or logos.
     *
     * @throws AiProviderException
     */
    public function generate(ImageRequest $request): GeneratedImage;
}
