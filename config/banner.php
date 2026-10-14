<?php

return [

    /*
    |--------------------------------------------------------------------------
    | AI Providers
    |--------------------------------------------------------------------------
    |
    | The "local" providers are deterministic and never call an external API,
    | which keeps the application usable without credentials. Switch either
    | provider to "openai" once OPENAI_API_KEY has been configured.
    |
    */

    'layout_provider' => env('BANNER_LAYOUT_PROVIDER', 'local'),

    'image_provider' => env('BANNER_IMAGE_PROVIDER', 'local'),

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        'layout_model' => (string) env('OPENAI_LAYOUT_MODEL', 'gpt-4o-mini'),
        'image_model' => env('OPENAI_IMAGE_MODEL', 'gpt-image-1'),
        'timeout' => (int) env('OPENAI_TIMEOUT', 90),

        // Used only to estimate the cost of a generation job (USD).
        'input_cost_per_mtok' => (float) env('OPENAI_INPUT_COST_PER_MTOK', 0.15),
        'output_cost_per_mtok' => (float) env('OPENAI_OUTPUT_COST_PER_MTOK', 0.60),
        'image_cost' => (float) env('OPENAI_IMAGE_COST', 0.04),
    ],

    /*
    |--------------------------------------------------------------------------
    | Limits
    |--------------------------------------------------------------------------
    */

    'generations_per_minute' => (int) env('BANNER_GENERATIONS_PER_MINUTE', 5),

    'daily_generation_quota' => (int) env('BANNER_DAILY_GENERATION_QUOTA', 30),

    // Keep below PHP's upload_max_filesize; the editor downsizes images
    // in the browser before uploading them.
    'max_upload_kb' => 5120,

    'max_prompt_length' => 6000,

    'max_prompt_presets' => 50,

    'max_export_kb' => 20480,

    'max_elements' => 200,

    'max_revisions' => 50,

    'canvas' => [
        'min' => 50,
        'max' => 4096,
    ],

    /*
    |--------------------------------------------------------------------------
    | Storage
    |--------------------------------------------------------------------------
    |
    | Assets are private and always served through an authorized route. Point
    | this at an "s3" disk (Cloudflare R2 / S3) in production.
    |
    */

    'disk' => env('BANNER_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Fonts
    |--------------------------------------------------------------------------
    |
    | Fonts allowed in a design document. Every family listed here must also
    | be loaded by the frontend (see vite.config.ts).
    |
    */

    'fonts' => ['Inter', 'Poppins', 'Montserrat', 'Playfair Display'],

    /*
    |--------------------------------------------------------------------------
    | Ornaments
    |--------------------------------------------------------------------------
    |
    | Built-in decorative vectors and their intrinsic [width, height]. The
    | artwork itself lives in resources/js/lib/ornaments.ts; user-supplied
    | SVG is never accepted.
    |
    */

    'ornaments' => [
        'waves' => [600, 300],
        'leaf' => [120, 70],
        'foliage' => [600, 200],
        'glow' => [400, 400],
        'blob' => [400, 360],
        'swoosh' => [600, 240],
        'arc' => [300, 300],
        'rings' => [300, 300],
        'dots' => [300, 300],
        'stripes' => [300, 300],
        'burst' => [300, 300],
        'confetti' => [300, 200],
        'branch' => [300, 160],
        'petals' => [200, 200],
        'sparkle' => [200, 200],
        'star8' => [200, 200],
        'crescent' => [200, 200],
        'arch' => [200, 260],
        'heart' => [200, 180],
    ],

    'max_user_ornaments' => 60,

];
