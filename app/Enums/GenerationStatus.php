<?php

namespace App\Enums;

enum GenerationStatus: string
{
    case Queued = 'queued';
    case Running = 'running';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    public function isActive(): bool
    {
        return $this === self::Queued || $this === self::Running;
    }
}
