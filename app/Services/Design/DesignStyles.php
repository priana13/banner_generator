<?php

namespace App\Services\Design;

use App\Models\DesignStyle;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class DesignStyles
{
    public function available(User $user): array
    {
        $builtins = [];
        foreach (config()->array('design_styles') as $key => $style) {
            $builtins[] = ['id' => null, 'key' => 'builtin:'.$key, 'builtin' => true, ...$style];
        }

        return [...$builtins, ...$user->designStyles()->orderBy('name')->get()->map(fn (DesignStyle $style) => $style->toEditorArray())->all()];
    }

    public function snapshot(User $user, ?string $key): ?array
    {
        if ($key === null || $key === '') {
            return null;
        }
        foreach ($this->available($user) as $style) {
            if ($style['key'] === $key) {
                return $style;
            }
        }

        throw ValidationException::withMessages(['design_style' => 'Gaya desain tidak tersedia. Pilih gaya lain.']);
    }
}
