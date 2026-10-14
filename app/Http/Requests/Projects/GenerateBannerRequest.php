<?php

namespace App\Http\Requests\Projects;

use App\Models\Project;
use App\Services\Design\BannerComposer;
use App\Services\Design\Color;
use App\Services\Design\DesignStyles;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GenerateBannerRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Project $project */
        $project = $this->route('project');
        $min = config()->integer('banner.canvas.min');
        $max = config()->integer('banner.canvas.max');
        $asset = Rule::exists('assets', 'id')->where('project_id', $project->id);

        return [
            'prompt' => ['required', 'string', 'min:5', 'max:'.config()->integer('banner.max_prompt_length')],
            'design_style' => ['nullable', 'string', Rule::in(array_column(app(DesignStyles::class)->available($this->user()), 'key'))],
            'style' => ['nullable', 'string', Rule::in(BannerComposer::STYLES)],
            'primary_color' => ['required', 'string', 'regex:'.Color::HEX_PATTERN],
            'background_color' => ['nullable', 'string', 'regex:'.Color::HEX_PATTERN],
            'width' => ['required', 'integer', "between:{$min},{$max}"],
            'height' => ['required', 'integer', "between:{$min},{$max}"],
            'photo_asset_id' => ['nullable', 'uuid', $asset],
            'logo_asset_id' => ['nullable', 'uuid', $asset],
            'idempotency_key' => ['nullable', 'string', 'max:64'],
        ];
    }
}
