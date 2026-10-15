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
     * Generate an image of exactly the requested size. Banner requests follow the supplied copy; visual and background requests omit text and logos.
     *
     * @throws AiProviderException
     */
    public function generate(ImageRequest $request): GeneratedImage;
}
