<?php

namespace App\Services\Design;

use Illuminate\Validation\Rule;

/**
 * Validation rules for the design document contract (schemaVersion 1).
 */
final class DocumentRules
{
    public const SCHEMA_VERSION = 1;

    public const ELEMENT_TYPES = ['text', 'button', 'rect', 'circle', 'image', 'ornament'];

    /** Regular, SemiBold, Bold and ExtraBold. */
    public const FONT_STYLES = ['normal', '600', 'bold', '800'];

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(string $key = 'document'): array
    {
        $color = 'regex:'.Color::HEX_PATTERN;
        $min = config()->integer('banner.canvas.min');
        $max = config()->integer('banner.canvas.max');
        $el = "{$key}.elements.*";

        return [
            $key => ['required', 'array'],
            "{$key}.schemaVersion" => ['required', 'integer', Rule::in([self::SCHEMA_VERSION])],
            "{$key}.canvas" => ['required', 'array'],
            "{$key}.canvas.width" => ['required', 'integer', "between:{$min},{$max}"],
            "{$key}.canvas.height" => ['required', 'integer', "between:{$min},{$max}"],
            "{$key}.canvas.backgroundColor" => ['required', 'string', $color],
            "{$key}.elements" => ['present', 'array', 'max:'.config()->integer('banner.max_elements')],
            "{$el}.id" => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/', 'distinct'],
            "{$el}.type" => ['required', 'string', Rule::in(self::ELEMENT_TYPES)],
            "{$el}.name" => ['nullable', 'string', 'max:80'],
            "{$el}.x" => ['required', 'numeric', 'between:-20000,20000'],
            "{$el}.y" => ['required', 'numeric', 'between:-20000,20000'],
            "{$el}.width" => ['required', 'numeric', 'between:1,20000'],
            "{$el}.height" => ['required', 'numeric', 'between:1,20000'],
            "{$el}.rotation" => ['nullable', 'numeric', 'between:-360,360'],
            "{$el}.opacity" => ['nullable', 'numeric', 'between:0,1'],
            "{$el}.visible" => ['nullable', 'boolean'],
            "{$el}.locked" => ['nullable', 'boolean'],
            "{$el}.text" => ['nullable', 'string', 'max:2000'],
            "{$el}.fontFamily" => ['nullable', 'string', Rule::in(config()->array('banner.fonts'))],
            "{$el}.fontSize" => ['nullable', 'numeric', 'between:4,1000'],
            "{$el}.fontStyle" => ['nullable', 'string', Rule::in(self::FONT_STYLES)],
            // Optional per-fragment colors of a text element.
            "{$el}.spans" => ['nullable', 'array', 'max:8'],
            "{$el}.spans.*.text" => ['required', 'string', 'max:500'],
            "{$el}.spans.*.fill" => ['required', 'string', $color],
            "{$el}.align" => ['nullable', 'string', Rule::in(['left', 'center', 'right'])],
            "{$el}.fill" => ['nullable', 'string', $color],
            "{$el}.textColor" => ['nullable', 'string', $color],
            "{$el}.cornerRadius" => ['nullable', 'numeric', 'between:0,10000'],
            "{$el}.assetId" => ["required_if:{$el}.type,image", 'nullable', 'uuid'],
            "{$el}.ornamentId" => [
                "required_if:{$el}.type,ornament", 'nullable', 'string',
                Rule::in(array_keys(config()->array('banner.ornaments'))),
            ],
        ];
    }
}
