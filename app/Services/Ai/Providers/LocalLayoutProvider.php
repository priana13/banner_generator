<?php

namespace App\Services\Ai\Providers;

use App\Services\Ai\Contracts\LayoutProvider;
use App\Services\Ai\DesignBrief;
use App\Services\Ai\LayoutResult;
use Illuminate\Support\Str;

/**
 * Deterministic, offline stand-in for an LLM. It picks copy from a few
 * keyword-matched templates so the whole pipeline works without an API key.
 */
class LocalLayoutProvider implements LayoutProvider
{
    private const TEMPLATES = [
        '/masjid|musholl?a/i' => [
            'label' => 'Wakaf Pembangunan',
            'headline' => 'Bangun Masjid Bersama Kita',
            'description' => 'Setiap bata yang Anda titipkan menjadi amal jariyah yang terus mengalir.',
            'cta' => 'Wakaf Sekarang',
        ],
        '/pendaftaran|penerimaan|ppdb|siswa baru|santri baru/i' => [
            'label' => 'Penerimaan Siswa Baru',
            'headline' => 'Wujudkan Generasi Cerdas dan Berakhlak',
            'description' => 'Pendaftaran tahun ajaran baru telah dibuka. Kuota terbatas.',
            'cta' => 'Daftar Sekarang',
        ],
        '/pangan|santri|penghafal|tahfi[dz]/i' => [
            'label' => 'Program Berbagi Kebaikan',
            'headline' => 'Tebar Pangan untuk Santri',
            'description' => 'Bersama hadirkan pangan bergizi untuk para penghafal Al-Qur’an.',
            'cta' => 'Donasi Sekarang',
        ],
        '/sekolah|pendidikan|beasiswa|pesantren/i' => [
            'label' => 'Program Pendidikan',
            'headline' => 'Dukung Pendidikan Generasi Bangsa',
            'description' => 'Bantu mereka meraih masa depan melalui pendidikan yang layak.',
            'cta' => 'Donasi Sekarang',
        ],
        '/donasi|sedekah|zakat|infaq|infak|wakaf/i' => [
            'label' => 'Program Kebaikan',
            'headline' => 'Salurkan Kebaikan Anda Hari Ini',
            'description' => 'Donasi Anda menghadirkan harapan baru bagi mereka yang membutuhkan.',
            'cta' => 'Donasi Sekarang',
        ],
        '/promo|diskon|sale|gratis ongkir|cashback/i' => [
            'label' => 'Promo Terbatas',
            'headline' => 'Penawaran Spesial untuk Anda',
            'description' => 'Dapatkan harga terbaik hanya selama periode promo berlangsung.',
            'cta' => 'Belanja Sekarang',
        ],
    ];

    public function name(): string
    {
        return 'local';
    }

    public function model(): string
    {
        return 'template-v1';
    }

    public function generate(DesignBrief $brief): LayoutResult
    {
        $spec = [
            'label' => 'Penawaran Terbaru',
            'headline' => Str::title(Str::words(Str::before($brief->prompt, ','), 6, '')),
            'description' => Str::limit($brief->prompt, 120),
            'cta' => 'Pelajari Selengkapnya',
        ];

        foreach (self::TEMPLATES as $pattern => $template) {
            if (preg_match($pattern, $brief->prompt) === 1) {
                $spec = $template;

                break;
            }
        }

        if (preg_match('/tombol\s+["“\']?([\p{L} ]{3,28}?)["”\']?(?:[.,]|$)/iu', $brief->prompt, $match) === 1) {
            $spec['cta'] = Str::title(trim($match[1]));
        }

        return new LayoutResult([
            ...$spec,
            'layout' => preg_match('/\b(di\s+)?(sebelah\s+)?kiri\b/i', $brief->prompt) === 1 ? 'visual-left' : 'visual-right',
            'imagePrompt' => $brief->prompt,
        ]);
    }
}
