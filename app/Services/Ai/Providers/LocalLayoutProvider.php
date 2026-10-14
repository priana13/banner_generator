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

    /**
     * The quoted text following a `Label:` marker (markdown emphasis allowed).
     */
    private function quoted(string $prompt, string $labels): ?string
    {
        $found = preg_match(
            '/(?<![\p{L}])(?:'.$labels.')\s*:?[\s*_]*:?[\s*_]*["“]([^"”\n]{2,220})["”]/iu',
            $prompt,
            $match,
        );

        return $found === 1 ? trim($match[1]) : null;
    }

    /**
     * Split the headline by instructions such as `(#65B32E) untuk kata "Sedekah Pangan"`.
     *
     * @return list<array{text: string, color: string}>
     */
    private function segments(string $prompt, string $headline): array
    {
        preg_match_all(
            '/(#[0-9a-f]{6})\)?\s+(?:untuk|for)\s+(?:kata|the\s+words?)\s+["“]([^"”\n]+)["”]/iu',
            $prompt,
            $matches,
            PREG_SET_ORDER,
        );

        $segments = [];
        $rest = $headline;

        foreach ($matches as [, $color, $words]) {
            if (! Str::startsWith($rest, $words)) {
                return [];
            }

            $segments[] = ['text' => $words, 'color' => $color];
            $rest = ltrim(Str::after($rest, $words));
        }

        return $rest === '' ? $segments : [];
    }

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

        // Exact wording given as `Headline: "..."` wins over the templates.
        $explicit = array_filter([
            'headline' => $this->quoted($brief->prompt, 'headline|judul'),
            'subheadline' => $this->quoted($brief->prompt, 'subheadline|subjudul'),
            'description' => $this->quoted($brief->prompt, 'deskripsi|description'),
            'cta' => $this->quoted($brief->prompt, '(?:tombol\s+)?cta'),
        ]);

        if (isset($explicit['headline'])) {
            $spec = ['label' => '', 'description' => '', ...$spec, ...$explicit];
            $spec['label'] = '';
            $spec['headlineSegments'] = $this->segments($brief->prompt, $explicit['headline']);
        }

        return new LayoutResult([
            ...$spec,
            'layout' => preg_match('/\b(di\s+)?(sebelah\s+)?kiri\b/i', $brief->prompt) === 1 ? 'visual-left' : 'visual-right',
            'imagePrompt' => $brief->prompt,
        ]);
    }
}
