<?php

namespace App\Services\Ai\Providers;

use App\Services\Ai\AiProviderException;
use App\Services\Ai\Contracts\LayoutProvider;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\DesignPrompt;
use App\Services\Ai\LayoutResult;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class OpenAiLayoutProvider implements LayoutProvider
{
    public function name(): string
    {
        return 'openai';
    }

    public function model(): string
    {
        return config()->string('banner.openai.layout_model');
    }

    public function generate(DesignBrief $brief): LayoutResult
    {
        return $this->generateWithPrompt($brief, new DesignPrompt);
    }

    public function generateWithPrompt(DesignBrief $brief, DesignPrompt $prompt): LayoutResult
    {
        $apiKey = config('banner.openai.api_key');

        if (! is_string($apiKey) || $apiKey === '') {
            throw new AiProviderException('OPENAI_API_KEY belum dikonfigurasi di server.');
        }

        if ($this->model() === '') {
            throw new AiProviderException('OPENAI_LAYOUT_MODEL belum dikonfigurasi di server.');
        }

        $payload = [
            'model' => $this->model(),
            'messages' => [
                ['role' => 'system', 'content' => $prompt->instructions()],
                ['role' => 'user', 'content' => $prompt->brief($brief)],
            ],
        ];
        $structured = [
            'response_format' => [
                'type' => 'json_schema',
                'json_schema' => ['name' => 'design_spec', 'strict' => true, 'schema' => $prompt->schema()],
            ],
        ];

        $host = strtolower((string) parse_url(config()->string('banner.openai.base_url'), PHP_URL_HOST));
        $deepSeek = $host === 'api.deepseek.com';
        $openRouter = $host === 'openrouter.ai';
        if ($deepSeek) {
            $structured = ['response_format' => ['type' => 'json_object']];
        }
        if ($openRouter) {
            // Router models have different structured-output capabilities. The
            // prompt already specifies JSON; request text for the layout only.
            $structured = [];
            $payload['modalities'] = ['text'];
        }

        try {
            $response = $this->request($apiKey, $payload + $structured);

            // OpenAI-compatible routers may proxy models without structured
            // output support; the instructions alone still ask for JSON.
            if ($response->status() === 400 && $structured !== []) {
                $response = $this->request($apiKey, $payload);
            }
        } catch (ConnectionException) {
            throw new AiProviderException('Tidak dapat terhubung ke penyedia AI (timeout). Silakan coba lagi.');
        }

        if ($response->failed()) {
            $message = strtolower((string) $response->json('error.message'));
            if ($openRouter) {
                throw new AiProviderException($this->openRouterError($response, $apiKey));
            }
            throw new AiProviderException(match (true) {
                $response->status() === 400 && $deepSeek && str_contains($message, 'supported api model names') => 'Model layout DeepSeek tidak didukung. Pilih deepseek-flash atau deepseek-v4-pro di pengaturan AI Global. Janus-Pro-7B tidak tersedia melalui API chat DeepSeek.',
                $response->status() === 401 => 'Kredensial penyedia AI ditolak. Periksa API key di pengaturan AI Global.',
                $response->status() === 402 => 'Saldo penyedia AI tidak mencukupi. Periksa saldo akun API Anda.',
                $response->status() === 429 => 'Penyedia AI sedang membatasi permintaan. Coba lagi beberapa saat lagi.',
                in_array($response->status(), [502, 503, 504], true) => 'Layanan atau model AI sementara tidak tersedia (HTTP '.$response->status().'). Percobaan ulang otomatis belum berhasil. Coba lagi sebentar atau pilih model teks lain di pengaturan AI Global.',
                default => "Penyedia AI mengembalikan galat (HTTP {$response->status()}).",
            });
        }

        $spec = $this->decode((string) $response->json('choices.0.message.content'));

        if (! is_array($spec)) {
            throw new AiProviderException('AI tidak mengembalikan layout yang dapat dibaca. Silakan coba lagi.');
        }

        $cost = ((int) $response->json('usage.prompt_tokens', 0)) * config()->float('banner.openai.input_cost_per_mtok') / 1_000_000
            + ((int) $response->json('usage.completion_tokens', 0)) * config()->float('banner.openai.output_cost_per_mtok') / 1_000_000;

        return new LayoutResult($spec, $cost);
    }

    private function openRouterError(Response $response, string $apiKey): string
    {
        $prefix = 'OpenRouter menolak permintaan layout (HTTP '.$response->status().').';
        $hint = match ($response->status()) {
            401 => 'Periksa API key di pengaturan AI Global.',
            402 => 'Saldo API tidak mencukupi. Periksa saldo akun OpenRouter.',
            403 => 'Periksa izin model dan pengaturan privasi akun OpenRouter.',
            404 => 'Periksa ID model, ketersediaan penyedia, dan pengaturan privasi OpenRouter.',
            429 => 'Batas permintaan tercapai. Coba lagi beberapa saat lagi.',
            502, 503, 504 => 'Layanan atau model AI sementara tidak tersedia. Percobaan ulang otomatis belum berhasil. Coba lagi sebentar atau pilih model teks lain di pengaturan AI Global.',
            default => 'Periksa model layout dan pengaturan akun OpenRouter di AI Global.',
        };

        // Show the router's public error, never its raw upstream response,
        // request headers, or credentials.
        $detail = $response->json('error.message');
        if (is_string($detail) && trim($detail) !== '') {
            $detail = str_replace($apiKey, '[REDACTED]', $detail);
            $detail = preg_replace('/Bearer\s+\S+|sk-[a-zA-Z0-9_-]+/i', '[REDACTED]', $detail);
            $detail = mb_substr(preg_replace('/\s+/', ' ', strip_tags($detail)), 0, 400);

            return "{$prefix} {$detail} {$hint}";
        }

        return "{$prefix} {$hint}";
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function request(string $apiKey, array $payload): Response
    {
        return Http::withToken($apiKey)
            ->timeout(config()->integer('banner.openai.timeout'))
            ->retry(2, 500, fn (\Exception $error) => $error instanceof RequestException
                && in_array($error->response->status(), [502, 503, 504], true), throw: false)
            ->acceptJson()
            ->post(rtrim(config()->string('banner.openai.base_url'), '/').'/chat/completions', $payload);
    }

    /**
     * Decode the model's answer, tolerating code fences or prose around the
     * JSON object.
     */
    private function decode(string $content): mixed
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');

        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        return json_decode(substr($content, $start, $end - $start + 1), true);
    }
}
