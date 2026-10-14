<?php

namespace App\Services\Ai\Providers;

use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\ImageProvider;
use App\Services\Ai\GeneratedImage;
use App\Services\Ai\ImageRequest;
use App\Services\Ai\ImageTools;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class GeminiImageProvider implements ImageProvider
{
    public function name(): string
    {
        return 'gemini';
    }

    public function model(): string
    {
        return config()->string('banner.gemini.image_model');
    }

    public function generate(ImageRequest $request): GeneratedImage
    {
        $key = config('banner.gemini.api_key');
        if (! is_string($key) || $key === '') {
            throw new AiProviderException('GEMINI_API_KEY belum dikonfigurasi. Buka pengaturan AI Global.');
        }
        if (! preg_match('/^[a-zA-Z0-9._-]+$/', $this->model())) {
            throw new AiProviderException('Model gambar Gemini tidak valid. Periksa pengaturan AI Global.');
        }

        $style = $request->purpose === ImageRequest::PURPOSE_BACKGROUND
            ? 'Soft, low-contrast abstract background with plenty of empty space.'
            : 'Clean, professional marketing photo or illustration with a clear subject.';
        $prompt = "{$request->prompt}\n\n{$style} Dominant color {$request->accentColor}. "
            .'Absolutely no text, letters, numbers, logos or visible watermarks.';
        $ratio = $request->width / $request->height;

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $key])
                ->acceptJson()->timeout(config()->integer('banner.gemini.timeout'))
                ->post('https://generativelanguage.googleapis.com/v1beta/models/'.$this->model().':generateContent', [
                    'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                    'generationConfig' => [
                        'responseModalities' => ['TEXT', 'IMAGE'],
                        'imageConfig' => ['aspectRatio' => match (true) {
                            $ratio >= 1.5 => '16:9',
                            $ratio > 1.15 => '4:3',
                            $ratio <= 0.67 => '9:16',
                            $ratio < 0.87 => '3:4',
                            default => '1:1',
                        }],
                    ],
                ]);
        } catch (ConnectionException) {
            throw new AiProviderException('Tidak dapat terhubung ke penyedia gambar Gemini (timeout). Silakan coba lagi.');
        }

        if ($response->failed()) {
            throw new AiProviderException(match ($response->status()) {
                401, 403 => 'Kredensial gambar Gemini ditolak. Periksa API key dan izin proyek Google AI Studio.',
                429 => 'Gemini sedang membatasi permintaan gambar atau kuota habis. Coba lagi beberapa saat lagi.',
                400, 404 => 'Permintaan gambar Gemini ditolak. Periksa nama model gambar, API key, atau ubah deskripsi banner.',
                default => "Penyedia gambar Gemini mengembalikan galat (HTTP {$response->status()}).",
            });
        }

        $parts = $response->json('candidates.0.content.parts', []);
        foreach (is_array($parts) ? $parts : [] as $part) {
            $inline = $part['inlineData'] ?? null;
            if (! empty($part['thought']) || ! is_array($inline)) {
                continue;
            }
            if (! in_array($inline['mimeType'] ?? '', ['image/png', 'image/jpeg', 'image/webp'], true)) {
                throw new AiProviderException('Gemini mengembalikan format gambar yang tidak didukung.');
            }
            $binary = is_string($inline['data'] ?? null) ? base64_decode($inline['data'], true) : false;
            if ($binary === false || $binary === '') {
                throw new AiProviderException('Gemini mengembalikan data gambar yang tidak valid.');
            }

            return new GeneratedImage(
                ImageTools::cover($binary, $request->width, $request->height),
                'image/jpeg',
                config()->float('banner.gemini.image_cost'),
            );
        }

        throw new AiProviderException('Gemini tidak mengembalikan gambar atau respons diblokir. Coba ubah deskripsi banner dan pastikan model mendukung gambar.');
    }
}
