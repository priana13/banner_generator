<?php

namespace App\Services\Ai\Providers;

use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\LayoutProvider;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\DesignPrompt;
use App\Services\Ai\GeminiErrors;
use App\Services\Ai\LayoutResult;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class GeminiLayoutProvider implements LayoutProvider
{
    public function name(): string
    {
        return 'gemini';
    }

    public function model(): string
    {
        return config()->string('banner.gemini.layout_model');
    }

    public function generate(DesignBrief $brief): LayoutResult
    {
        return $this->generateWithPrompt($brief, new DesignPrompt);
    }

    public function generateWithPrompt(DesignBrief $brief, DesignPrompt $prompt): LayoutResult
    {
        $key = config('banner.gemini.api_key');
        if (! is_string($key) || $key === '') {
            throw new AiProviderException('GEMINI_API_KEY belum dikonfigurasi. Buka pengaturan AI Global.');
        }
        if (! preg_match('/^[a-zA-Z0-9._-]+$/', $this->model())) {
            throw new AiProviderException('Model Gemini tidak valid. Periksa pengaturan AI Global.');
        }

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $key])
                ->acceptJson()->timeout(config()->integer('banner.gemini.timeout'))
                ->post('https://generativelanguage.googleapis.com/v1beta/models/'.$this->model().':generateContent', [
                    'systemInstruction' => ['parts' => [['text' => $prompt->instructions()]]],
                    'contents' => [['role' => 'user', 'parts' => [['text' => $prompt->brief($brief)]]]],
                    'generationConfig' => [
                        'responseMimeType' => 'application/json',
                        'responseJsonSchema' => $prompt->schema(),
                    ],
                ]);
        } catch (ConnectionException) {
            throw new AiProviderException('Tidak dapat terhubung ke Gemini (timeout). Silakan coba lagi.');
        }

        if ($response->failed()) {
            throw new AiProviderException(GeminiErrors::message($response, $this->model()));
        }

        $parts = $response->json('candidates.0.content.parts', []);
        $text = '';
        foreach (is_array($parts) ? $parts : [] as $part) {
            if (empty($part['thought']) && is_string($part['text'] ?? null)) {
                $text .= $part['text'];
            }
        }
        $spec = json_decode($text, true);
        if (! is_array($spec) || array_is_list($spec)) {
            throw new AiProviderException('Gemini tidak mengembalikan layout yang dapat dibaca atau respons diblokir. Silakan coba lagi.');
        }

        $cost = (int) $response->json('usageMetadata.promptTokenCount', 0) * config()->float('banner.gemini.input_cost_per_mtok') / 1_000_000
            + (int) $response->json('usageMetadata.candidatesTokenCount', 0) * config()->float('banner.gemini.output_cost_per_mtok') / 1_000_000;

        return new LayoutResult($spec, $cost);
    }
}
