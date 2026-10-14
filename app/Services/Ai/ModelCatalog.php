<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class ModelCatalog
{
    public function list(string $provider, array $settings): array
    {
        $key = $settings[$provider.'_api_key'] ?? '';
        if (! is_string($key) || $key === '') {
            throw new AiProviderException('API key belum dikonfigurasi. Simpan API key di pengaturan AI Global terlebih dahulu.');
        }

        $models = [];
        try {
            if ($provider === 'gemini') {
                $token = null;
                for ($page = 0; $page < 10; $page++) {
                    $response = Http::withHeaders(['x-goog-api-key' => $key])->acceptJson()
                        ->withoutRedirecting()->connectTimeout(10)->timeout(20)
                        ->get('https://generativelanguage.googleapis.com/v1beta/models', array_filter([
                            'pageSize' => 1000, 'pageToken' => $token,
                        ]));
                    $this->check($response, 'models');
                    foreach ($response->json('models') as $model) {
                        if (! is_array($model) || ! is_string($model['name'] ?? null)) {
                            continue;
                        }
                        $id = preg_replace('#^models/#', '', $model['name']);
                        $methods = $model['supportedGenerationMethods'] ?? [];
                        $methods = is_array($methods) ? array_values(array_filter($methods, 'is_string')) : [];
                        $kind = ! in_array('generateContent', $methods, true) ? 'other'
                            : (preg_match('/image/i', $id) ? 'image' : (preg_match('/tts|audio/i', $id) ? 'other' : 'layout'));
                        $models[] = $this->model($id, $model['displayName'] ?? $id, $model['description'] ?? '', $kind, $key);
                    }
                    $token = $response->json('nextPageToken');
                    if (! is_string($token) || $token === '') {
                        break;
                    }
                    if ($page === 9) {
                        throw new AiProviderException('Daftar model terlalu panjang untuk dimuat lengkap. Silakan coba lagi.');
                    }
                }
                $source = 'Google Gemini';
            } else {
                $base = rtrim($settings['openai_base_url'], '/');
                $response = Http::withToken($key)->acceptJson()->withoutRedirecting()
                    ->connectTimeout(10)->timeout(20)->get($base.'/models');
                $this->check($response, 'data');
                foreach ($response->json('data') as $model) {
                    if (! is_array($model) || ! is_string($model['id'] ?? null)) {
                        continue;
                    }
                    $id = $model['id'];
                    $modalities = $model['output_modalities'] ?? null;
                    $kind = is_array($modalities) && $modalities === ['text'] ? 'layout'
                        : (preg_match('/^(gpt-image|dall-e)/i', $id) ? 'image'
                            : (preg_match('/embedding|whisper|tts|audio|realtime|moderation|transcri|sora/i', $id) ? 'other'
                                : (preg_match('/^(deepseek-|gpt-|chatgpt-|o[134]-)/i', $id) ? 'layout' : 'unknown')));
                    $models[] = $this->model($id, $model['name'] ?? $id, '', $kind, $key);
                }
                $source = parse_url($base, PHP_URL_HOST);
            }
        } catch (ConnectionException) {
            throw new AiProviderException('Tidak dapat mengambil daftar model (koneksi atau timeout). Silakan coba lagi.');
        }

        $models = collect($models)->filter(fn ($model) => $model['id'] !== '' && mb_strlen($model['id']) <= 120)
            ->unique('id')->sortBy('id')->values()->all();

        return ['provider' => $provider, 'source' => $source, 'models' => $models];
    }

    private function model(string $id, mixed $name, mixed $description, string $kind, string $key): array
    {
        return [
            'id' => str_replace($key, '[REDACTED]', $id),
            'name' => mb_substr(str_replace($key, '[REDACTED]', is_string($name) ? $name : $id), 0, 200),
            'description' => mb_substr(str_replace($key, '[REDACTED]', is_string($description) ? $description : ''), 0, 500),
            'kind' => $kind,
        ];
    }

    private function check(Response $response, string $listKey): void
    {
        if (! $response->successful()) {
            throw new AiProviderException(match ($response->status()) {
                400, 401, 403 => 'Layanan menolak permintaan daftar model. Periksa API key dan izin akun pada pengaturan AI Global.',
                404 => 'Endpoint daftar model tidak tersedia. Periksa Base URL atau dukungan /models pada layanan Anda.',
                429 => 'Layanan sedang membatasi permintaan. Coba lagi beberapa saat lagi.',
                default => 'Gagal mengambil daftar model dari layanan AI (HTTP '.$response->status().').',
            });
        }
        if (! is_array($response->json($listKey))) {
            throw new AiProviderException('Format daftar model dari layanan AI tidak dapat dibaca. Periksa Base URL layanan Anda.');
        }
    }
}
