<?php

namespace App\Services\Ai;

use RuntimeException;

/**
 * Thrown when an AI provider fails or returns unusable output. The message
 * is safe to show to the end user.
 */
class AiProviderException extends RuntimeException {}
