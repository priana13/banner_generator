<?php

namespace App\Http\Requests\Projects;

use App\Models\Asset;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;

class StoreAssetRequest extends FormRequest
{
    /**
     * SVG is deliberately not accepted: it can carry scripts.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                File::types(['jpg', 'jpeg', 'png', 'webp'])->max(config()->integer('banner.max_upload_kb')),
                'dimensions:min_width=8,min_height=8,max_width=8000,max_height=8000',
            ],
            'kind' => ['nullable', 'string', Rule::in([Asset::KIND_UPLOAD, Asset::KIND_LOGO, Asset::KIND_CUTOUT])],
        ];
    }
}
