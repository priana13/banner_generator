<?php

namespace App\Http\Requests\Projects;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'category_id' => ['nullable', 'integer', Rule::exists('project_categories', 'id')->where('user_id', $this->user()->id)],
            'title' => ['required', 'string', 'max:120'],
            'canvas_width' => ['required', 'integer', "between:{$min},{$max}"],
            'canvas_height' => ['required', 'integer', "between:{$min},{$max}"],
        ];
    }
}
