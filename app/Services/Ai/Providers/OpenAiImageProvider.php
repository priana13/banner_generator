<?php

namespace App\Services\Ai\Providers;

use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\ImageProvider;
use App\Services\Ai\GeneratedImage;
use App\Services\Ai\ImageRequest;
use App\Services\Ai\ImageTools;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class OpenAiImageProvider implements ImageProvider
{
    public function name(): string
    {
        return 'openai';
    }

    public function model(): string
    {
        return config()->string('banner.openai.image_model');
    }

    public function generate(ImageRequest $request): GeneratedImage
    {
        $apiKey = config('banner.openai.api_key');

        if (! is_string($apiKey) || $apiKey === '') {
            throw new AiProviderException('OPENAI_API_KEY belum dikonfigurasi di server.');
        }

        $ratio = $request->width / $request->height;

        try {
            $response = Http::withToken($apiKey)
                ->timeout(config()->integer('banner.openai.timeout'))
                ->acceptJson()
                ->post(rtrim(config()->string('banner.openai.base_url'), '/').'/images/generations', [
                    'model' => $this->model(),
                    'prompt' => $this->prompt($request),
                    'size' => match (true) {
                        $ratio > 1.25 => '1536x1024',
                        $ratio < 0.8 => '1024x1536',
                        default => '1024x1024',
                    },
                    'n' => 1,
                ]);
        } catch (ConnectionException) {
            throw new AiProviderException('Tidak dapat terhubung ke penyedia gambar (timeout). Silakan coba lagi.');
        }

        if ($response->failed()) {
            throw new AiProviderException(match (true) {
                $response->status() === 401 => 'Kredensial penyedia gambar ditolak. Periksa OPENAI_API_KEY.',
                $response->status() === 429 => 'Penyedia gambar sedang membatasi permintaan. Coba lagi beberapa saat lagi.',
                $response->status() === 400 => 'Permintaan gambar ditolak penyedia AI. Coba ubah deskripsi banner.',
                default => "Penyedia gambar mengembalikan galat (HTTP {$response->status()}).",
            });
        }

        $binary = base64_decode((string) $response->json('data.0.b64_json'), true);

        if ($binary === false || $binary === '') {
            throw new AiProviderException('Penyedia gambar tidak mengembalikan gambar.');
        }

        return new GeneratedImage(
            ImageTools::cover($binary, $request->width, $request->height),
            'image/jpeg',
            config()->float('banner.openai.image_cost'),
        );
    }

    private function prompt(ImageRequest $request): string
    {
        $style = $request->purpose === ImageRequest::PURPOSE_BACKGROUND
            ? 'Soft, low-contrast abstract background with plenty of empty space.'
            : 'Clean, professional marketing photo or illustration with a clear subject.';

        return "{$request->prompt}\n\n{$style} Dominant color {$request->accentColor}. "
            .'Absolutely no text, letters, numbers, logos or watermarks.';
    }
}
