<?php

namespace App\Services\Design;

use RuntimeException;

class VersionConflictException extends RuntimeException
{
    public function __construct(public readonly int $currentVersion)
    {
        parent::__construct('The document was changed elsewhere.');
    }
}
