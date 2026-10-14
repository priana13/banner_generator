<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiSetting extends Model
{
    protected $guarded = [];

    protected $hidden = ['settings'];

    protected function casts(): array
    {
        return ['settings' => 'encrypted:array'];
    }
}
