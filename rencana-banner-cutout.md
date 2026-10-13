# Rencana: Banner Gaya "Foto Cutout" (lanjutan MVP)

Dibuat: 13 Oktober 2026 · Status: belum dimulai

## Tujuan

Aplikasi dapat menghasilkan banner seperti contoh "Ekspedisi Qur'an": latar terang, judul dua warna, subjudul, deskripsi, tombol, ornamen (garis lengkung, daun, pendar), dan foto orang **tanpa latar** yang bisa digeser dan diubah ukurannya sebagai layer.

Semua tetap berupa layer yang dapat diedit. Tidak ada bagian yang "dibakar" menjadi satu gambar.

## Kondisi saat ini

Sudah ada dan bisa dipakai ulang:

- Dokumen berlapis (`schemaVersion: 1`) dengan elemen `text`, `button`, `rect`, `circle`, `image`.
- PNG transparan sudah bisa diunggah dan dirender di kanvas.
- Alur generate lewat antrean, dengan status, batal, dan retry.
- Mesin tata letak di server (`BannerComposer`) dengan satu pola: panel warna + teks.
- Font Poppins sudah dimuat.

Belum ada:

- Penghapusan latar foto.
- Teks multi-warna dalam satu layer.
- Subjudul sebagai tingkat teks tersendiri.
- Ornamen dan efek bayangan/pendar.
- Template tata letak selain panel warna.

## Keputusan yang masih terbuka

| # | Keputusan | Pilihan | Rekomendasi |
|---|---|---|---|
| 1 | Cara menghapus latar foto | (a) Model lokal di server (rembg) · (b) API berbayar (remove.bg, fal, Replicate) | **(a) lokal.** Foto yang diproses sering foto anak-anak, dan PRD §10 melarang mengirim foto pribadi ke penyedia AI tanpa izin. |
| 2 | Sumber ornamen | (a) Pustaka bawaan buatan sendiri · (b) Dihasilkan model gambar | **(a) pustaka bawaan** dulu: hasilnya konsisten dan gratis. |
| 3 | Model gambar AI | GPT Image / FLUX / Imagen, atau tetap tanpa model gambar | Tidak wajib untuk gaya ini, karena visual utamanya foto unggahan. Bisa ditunda. |

Keputusan 1 harus diambil sebelum Tahap 1 dimulai. Rancangan di bawah memakai adapter, jadi pilihan (a) dan (b) bisa ditukar lewat konfigurasi.

## Tahap 1 — Hapus latar foto

Dampak terbesar; tahap lain tidak bergantung padanya.

**Backend**

- Kontrak baru `App\Services\Ai\Contracts\BackgroundRemover` dengan satu method: terima bytes gambar, kembalikan PNG transparan.
- Implementasi sesuai keputusan 1:
  - Lokal: layanan kecil rembg (Python) yang dipanggil lewat HTTP di jaringan internal, atau lewat proses CLI.
  - API: adapter HTTP ke penyedia terpilih.
- Job antrean `RemoveBackgroundJob`, memakai tabel `generation_jobs` yang sudah ada dengan kolom pembeda `type` (`banner` | `remove_background`). Status, batal, dan retry ikut mekanisme yang sama.
- Endpoint `POST /api/projects/{project}/assets/{asset}/remove-background` → mengembalikan job.
- Hasil disimpan sebagai **aset baru** (`kind: cutout`, `metadata.source_asset_id`), aset asli tidak diubah.
- Batas: ukuran sisi terpanjang diperkecil ke 2000 px sebelum diproses; kuota harian per pengguna.

**Frontend**

- Tombol **Hapus latar** di panel properti untuk layer gambar.
- Selama proses: indikator di layer tersebut saja, editor tetap bisa dipakai.
- Setelah selesai: `assetId` layer diganti ke aset cutout sebagai satu langkah undo.
- Opsi "hapus latar otomatis" pada unggahan foto di form brief.

**Kriteria selesai**

- Foto JPG orang berjilbab/berpeci menjadi PNG transparan dengan tepi yang layak.
- Undo mengembalikan foto asli.
- Job gagal menampilkan pesan dan tombol coba lagi.
- Pengguna lain tidak bisa memproses aset milik orang lain.

## Tahap 2 — Teks: multi-warna dan subjudul

**Skema dokumen (naik ke `schemaVersion: 2`)**

- Elemen `text` mendapat properti opsional `spans`: daftar `{ text, fill }`. Bila ada, `spans` menentukan warna per potongan; `text` tetap berisi gabungannya.
- Migrasi saat dokumen dibuka: v1 → v2 tanpa perubahan isi (hanya nomor versi), sehingga dokumen lama tetap terbaca.

**Backend**

- `DocumentRules` dan `DocumentNormalizer` menerima `spans` (maks. 8 potongan, warna hex tervalidasi).
- `DesignSpecNormalizer` menerima `subheadline` dan `headlineAccent` (potongan judul yang diberi warna aksen).
- Prompt di `OpenAiLayoutProvider` diperbarui untuk mengisi dua kolom itu.

**Frontend**

- `canvas-stage.tsx`: teks dengan `spans` dirender sebagai beberapa `Text` Konva dalam satu `Group`, dengan pemenggalan baris dihitung sendiri.
- Panel properti: pilih kata/potongan lalu beri warna.
- `document-preview.tsx` ikut mendukung `spans`.

**Kriteria selesai**

- "Ekspedisi Qur'an" tampil dua warna dalam satu layer dan tetap bisa diedit teksnya.
- Hasil ekspor sama dengan tampilan kanvas.

## Tahap 3 — Template tata letak "cutout"

**Backend**

- `BannerComposer` dipecah menjadi beberapa template yang memakai mesin penyusun teks yang sama:
  - `panel` (yang sekarang),
  - `cutout`: latar terang, tanpa panel warna, foto di satu sisi dan boleh melewati tepi bawah/kanan.
- Pemilihan template: otomatis `cutout` bila foto unggahan berupa aset cutout; bisa dipilih manual di form brief.
- Urutan teks baru: judul → subjudul → deskripsi → tombol.

**Frontend**

- Pilihan gaya di panel generator (dua kartu pratinjau kecil).

**Kriteria selesai**

- Generate dengan foto cutout pada 1200×400 dan 1920×600 menghasilkan komposisi mendekati contoh, tanpa teks meluber atau menabrak foto.
- Tes "copy selalu muat di kanvas" lulus untuk kedua template di semua ukuran preset.

## Tahap 4 — Ornamen dan efek

**Ornamen**

- Pustaka bawaan di `resources/ornaments/` (garis lengkung, daun, bentuk organik), berupa SVG yang warnanya mengikuti warna utama.
- Elemen baru `ornament` dengan `ornamentId` dan `fill`. SVG hanya berasal dari pustaka bawaan; larangan unggah SVG tetap berlaku.
- Panel "Tambahkan elemen" mendapat tab ornamen.
- Template `cutout` menaruh 2–3 ornamen secara otomatis.

**Efek**

- Properti opsional `shadow` pada semua elemen: `{ color, blur, offsetX, offsetY, opacity }`. Pendar hijau di belakang foto adalah bayangan dengan blur besar dan offset nol.
- Kontrol bayangan di panel properti.

**Kriteria selesai**

- Ornamen bisa digeser, diubah ukuran, diwarnai, dan ikut terekspor.
- Pendar di belakang foto cutout terlihat di kanvas dan di hasil ekspor.

## Di luar cakupan rencana ini

- Menyusun banyak foto terpisah menjadi kolase bertumpuk secara otomatis. Pengguna menyusunnya sendiri di editor.
- Pemotongan (crop) dan masking gambar bentuk bebas.
- Integrasi Canva.

## Risiko

- **Kualitas cutout pada rambut, jilbab, dan tepi halus.** Uji dengan 10–15 foto nyata sebelum memutuskan model; siapkan jalur pindah ke API bila hasil lokal kurang.
- **Beban server untuk model lokal.** Proses di antrean dengan satu worker khusus; ukur waktu per foto di server target.
- **Teks multi-warna dan pemenggalan baris.** Ukuran teks dihitung di browser, perkiraan di server bisa meleset; sisakan ruang cadangan di template.
- **Perubahan skema.** Semua dokumen lama harus tetap terbuka; tambahkan tes migrasi v1 → v2.

## Perkiraan urutan kerja

Tahap 1 → 2 → 3 → 4. Tahap 1 dan 2 berdiri sendiri dan masing-masing sudah berguna bagi pengguna. Tahap 3 membutuhkan keduanya agar hasilnya mendekati contoh. Tahap 4 adalah pemoles.
