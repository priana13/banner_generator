<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\Response;

final class GeminiErrors
{
    public static function message(Response $response, string $model, bool $image = false): string
    {
        // Inspect provider details only to classify the error. Never expose the
        // raw message, which may contain credentials or request contents.
        $details = $response->json('error.details', []);
        $reasons = collect(is_array($details) ? $details : [])->pluck('reason');
        $message = (string) $response->json('error.message', '');
        $kind = $image ? 'gambar' : 'teks/layout';

        if ($reasons->contains('API_KEY_INVALID') || preg_match('/API key (not valid|expired|invalid)/i', $message)) {
            return 'API key Gemini tidak valid atau kedaluwarsa. Perbarui key di pengaturan AI Global.';
        }
        if (str_contains(strtolower($message), 'user location is not supported')) {
            return 'Gemini tidak tersedia di lokasi server ini. Periksa dukungan wilayah Google AI Studio.';
        }
        if ($response->status() === 429 && preg_match('/limit:\s*0\b/i', $message)) {
            return 'Kuota Gemini untuk model ini bernilai 0. Periksa paket dan aktifkan billing pada proyek Google AI Studio, atau pilih model dengan kuota yang tersedia.';
        }

        return match ($response->status()) {
            401, 403 => 'Kredensial Gemini ditolak. Periksa API key dan izin proyek Google AI Studio.',
            404 => "Model {$kind} Gemini \"{$model}\" tidak tersedia untuk akun ini atau sudah dihentikan (HTTP 404). Pilih model yang tersedia di pengaturan AI Global.",
            400 => "Gemini menolak format permintaan untuk model {$kind} \"{$model}\" (HTTP 400). Pastikan model mendukung fitur yang dipilih.",
            429 => 'Gemini sedang membatasi permintaan atau kuota habis. Coba lagi beberapa saat lagi.',
            503 => 'Model Gemini sedang sibuk (HTTP 503). Coba lagi beberapa saat lagi.',
            default => "Gemini mengembalikan galat (HTTP {$response->status()}).",
        };
    }
}
