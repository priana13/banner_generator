<?php

namespace App\Http\Requests\Projects;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $min = config()->integer('banner.canvas.min');
        $max = config()->integer('banner.canvas.max');

        return [
            'title' => ['required', 'string', 'max:120'],
            'canvas_width' => ['required', 'integer', "between:{$min},{$max}"],
            'canvas_height' => ['required', 'integer', "between:{$min},{$max}"],
        ];
    }
}
