<?php

namespace App\Services\Ai;

use App\Models\AiSetting;

class GlobalAiSettings
{
    public const FIELDS = [
        'layout_provider' => 'layout_provider',
        'image_provider' => 'image_provider',
        'gemini_model' => 'gemini.layout_model',
        'gemini_image_model' => 'gemini.image_model',
        'gemini_api_key' => 'gemini.api_key',
        'openai_base_url' => 'openai.base_url',
        'openai_layout_model' => 'openai.layout_model',
        'openai_image_model' => 'openai.image_model',
        'openai_api_key' => 'openai.api_key',
    ];

    public function values(): array
    {
        $values = [];
        foreach (self::FIELDS as $field => $path) {
            $values[$field] = config('banner.'.$path);
        }

        return array_replace($values, AiSetting::find(1)?->settings ?? []);
    }

    public function apply(): void
    {
        foreach ($this->values() as $field => $value) {
            if (isset(self::FIELDS[$field])) {
                config(['banner.'.self::FIELDS[$field] => $value]);
            }
        }
    }
}
