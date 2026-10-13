# AI Banner Generator — PRD MVP dan Arsitektur Teknis

Versi: 1.0 | Tanggal: 13 Oktober 2026

## 1. Ringkasan
Aplikasi SaaS pembuat banner website berbasis AI dengan hasil berupa dokumen desain berlapis yang dapat diedit seperti Canva. Pengguna memasukkan brief, memilih ukuran, mengunggah aset, lalu AI menghasilkan layout JSON dan gambar terpisah. Editor React Konva memungkinkan pengeditan tanpa regenerasi seluruh banner.

## 2. Tujuan dan metrik keberhasilan
- Pengguna dapat menghasilkan desain pertama, mengubah teks dan posisi, menyimpan, lalu mengekspor tanpa bantuan admin.
- 95% dokumen yang disimpan dapat dibuka kembali tanpa kehilangan layer.
- 100% judul, CTA, dan logo yang ditambahkan lewat editor tetap menjadi layer editable.
- Kegagalan job AI memiliki status jelas dan dapat diulang tanpa menduplikasi proyek.

## 3. Pengguna dan use case
- Admin NGO/fundraising: banner program donasi dengan foto santri dan CTA.
- Pengelola sekolah/pesantren: banner penerimaan siswa, kegiatan, pengumuman.
- Pemilik bisnis: hero banner promosi website.

## 4. Fitur MVP
### P0 (wajib)
1. Registrasi/login dan dashboard proyek.
2. Form brief: prompt, rasio/ukuran, warna utama, upload foto/logo.
3. Generate layout JSON menggunakan LLM dengan schema validation.
4. Generate background atau foto AI sebagai aset terpisah.
5. Editor canvas: select, drag, resize, rotate, layer order, hide/lock, delete.
6. Editor teks: konten, font, ukuran, warna, alignment; logo dan CTA sebagai layer.
7. Autosave dengan revision number dan undo/redo lokal.
8. Export PNG/JPEG dan WebP via konversi.
9. Job queue, status, retry, dan error handling.
### P1
- Regenerate satu aset saja; template; multi-size; brand kit sederhana.
### Tidak termasuk MVP
- Kolaborasi real-time, marketplace template, editor video, native mobile, integrasi Canva, billing berlangganan.

## 5. Arsitektur
- Laravel 13: autentikasi, REST endpoints, validation, orchestration, project storage, queue jobs.
- React + Inertia + Tailwind: dashboard dan UI.
- react-konva + Zustand: canvas renderer dan editor state.
- MySQL: projects, design_documents, assets, generation_jobs, design_revisions.
- Redis + Laravel Horizon: antrean generasi AI.
- Cloudflare R2/S3: aset gambar dan hasil ekspor.
- LLM provider adapter (OpenAI/Gemini): menghasilkan DesignSpec tervalidasi.
- Image provider adapter: menghasilkan gambar tanpa teks/logo kritis.
- Backend menyimpan secret API; frontend tidak memanggil provider AI langsung.

### Alur
Brief -> Laravel -> LLM (DesignSpec) -> validasi & normalisasi -> image jobs -> simpan assets -> compose document -> React Konva -> edit -> autosave -> export.

## 6. Kontrak dokumen desain
```json
{
  "schemaVersion": 1,
  "canvas": {"width": 1200, "height": 400, "backgroundColor": "#FFFFFF"},
  "elements": [
    {"id": "bg-1", "type": "image", "assetId": "asset-001", "x": 0, "y": 0, "width": 1200, "height": 400, "rotation": 0, "locked": true},
    {"id": "title-1", "type": "text", "text": "Tebar Pangan untuk Santri", "x": 64, "y": 78, "width": 560, "height": 120, "fontFamily": "Inter", "fontSize": 46, "fill": "#1F2937", "rotation": 0},
    {"id": "cta-1", "type": "button", "text": "Donasi Sekarang", "x": 64, "y": 286, "width": 220, "height": 56, "fill": "#F97316", "textColor": "#FFFFFF", "rotation": 0}
  ]
}
```
Simpan `schemaVersion`, UUID stabil, z-order sesuai urutan array, ukuran absolut, dan referensi `assetId` (bukan URL provider sementara). Gunakan JSON Schema / Laravel validation untuk tipe, batas ukuran, font, warna, dan elemen. Normalisasi koordinat; ukur teks untuk mendeteksi overflow; jangan percaya layout AI secara mentah.

## 7. Skema database minimal
- `users`: id, name, email, password.
- `projects`: id, user_id, title, status, canvas_width, canvas_height, current_revision_id, timestamps.
- `design_revisions`: id, project_id, version, document_json, created_by, created_at.
- `assets`: id, user_id, project_id, kind, storage_key, mime_type, width, height, metadata_json, created_at.
- `generation_jobs`: id, project_id, provider, model, status, request_json, result_json, error_message, cost_estimate, started_at, finished_at.
Tambahkan indeks `user_id`, `project_id`, `status`; terapkan authorization policy per proyek dan asset.

## 8. API utama
- `POST /api/projects` buat proyek.
- `GET /api/projects/{id}` ambil dokumen dan aset.
- `PATCH /api/projects/{id}/document` simpan dengan `version` untuk optimistic concurrency.
- `POST /api/projects/{id}/generate` antrekan generasi.
- `GET /api/generation-jobs/{id}` status dan error.
- `POST /api/projects/{id}/assets` upload tervalidasi.
- `POST /api/projects/{id}/export` ekspor dokumen.
- `GET /api/projects/{id}/revisions` riwayat.

## 9. Editor dan ekspor
- Canvas menampilkan teks, bentuk, gambar, tombol sebagai node terpisah.
- `Transformer` Konva untuk resize/rotate; kontrol layer untuk lock/visibility/order.
- Undo/redo memakai command history atau snapshot terbatasi; autosave debounce.
- Font wajib tersedia saat render/ekspor; tunggu pemuatan gambar/font.
- Batasi export pixel ratio untuk menghindari konsumsi memori berlebihan.
- Gunakan canvas export PNG/JPEG; WebP melalui canvas/browser atau proses konversi server.
- CORS dan signed asset URLs perlu dikonfigurasi agar canvas tidak tainted.

## 10. Keamanan dan biaya
- Semua API key hanya di server; rate limit per user; kuota job.
- Batasi tipe/ukuran file, periksa MIME, sanitasi SVG atau larang SVG pada MVP.
- Signed URLs untuk private assets; akses lintas tenant dilarang.
- Prompt dan hasil AI tidak dianggap tepercaya; validasi output sebelum render.
- Simpan estimasi biaya per generation job, retry dengan backoff, timeout, idempotency key.
- Jangan memasukkan informasi pribadi atau foto tanpa izin ke provider AI.

## 11. Acceptance criteria
1. Pengguna membuat proyek 1200x400 dan generate dari prompt.
2. Judul, CTA, logo, dan foto muncul sebagai layer terpisah.
3. Judul dapat diubah tanpa memanggil image generation API.
4. Pengguna dapat mengubah urutan layer, memindahkan foto, undo, dan redo.
5. Setelah refresh, dokumen kembali sama dengan versi terakhir tersimpan.
6. Export PNG/JPG/WebP berhasil pada ukuran target.
7. Job gagal memperlihatkan pesan kesalahan dan opsi retry.
8. Pengguna A tidak dapat mengakses proyek/aset pengguna B.

## 12. Tahapan implementasi
1. Fondasi: auth, project CRUD, database, storage.
2. Editor: React Konva, layer panel, text tools, save/load, undo/redo.
3. AI: adapters, prompt schema, generate background, queue, polling status.
4. Quality: overflow detection, asset handling, export, test E2E.
5. Beta: template awal, metering biaya, observability, limit pengguna.

## 13. Risiko dan keputusan
- AI sulit memposisikan teks secara presisi: gunakan schema + deterministic layout engine.
- Foto AI bukan layer editable per objek: pisahkan hanya aset yang dibuat/diunggah; tidak menjanjikan dekomposisi objek otomatis.
- Ukuran berbeda dapat merusak komposisi: buat duplikasi layout lalu reflow dan koreksi manual.
- Model dan harga berubah: pakai adapter provider dan evaluasi kualitas/latensi/biaya sebelum produksi.
