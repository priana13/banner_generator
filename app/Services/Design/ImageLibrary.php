<?php

namespace App\Services\Design;

use App\Models\Asset;
use App\Models\LibraryImage;
use App\Models\Ornament;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class ImageLibrary
{
    public function __construct(private AssetStore $assets) {}

    public function upload(User $user, UploadedFile $file, string $kind = Asset::KIND_UPLOAD): LibraryImage
    {
        return $this->store($user->id, (string) $file->getContent(), $file->getClientOriginalName(), $kind);
    }

    public function generated(int $userId, string $binary, string $name): LibraryImage
    {
        return $this->store($userId, $binary, $name, Asset::KIND_UPLOAD);
    }

    /** Keep an independent library copy, so deleting a project cannot remove it. */
    public function remember(Asset $asset): LibraryImage
    {
        $image = $this->store(
            $asset->user_id, (string) $this->assets->disk()->get($asset->storage_key),
            $asset->metadata_json['original_name'] ?? 'Gambar', $asset->kind,
        );
        $asset->update(['metadata_json' => [...($asset->metadata_json ?? []), 'library_image_id' => $image->id]]);

        return $image;
    }

    public function syncExisting(): int
    {
        $count = 0;
        Asset::query()->whereIn('kind', [Asset::KIND_UPLOAD, Asset::KIND_LOGO, Asset::KIND_CUTOUT])
            ->whereNull('metadata_json->library_image_id')->chunkById(100, function ($assets) use (&$count) {
                foreach ($assets as $asset) {
                    if ($this->assets->disk()->exists($asset->storage_key)) {
                        $this->remember($asset);
                        $count++;
                    }
                }
            });

        Ornament::query()->whereNull('library_image_id')->chunkById(100, function ($ornaments) use (&$count) {
            foreach ($ornaments as $ornament) {
                if ($this->assets->disk()->exists($ornament->storage_key)) {
                    $this->rememberOrnament($ornament);
                    $count++;
                }
            }
        });

        return $count;
    }

    public function rememberOrnament(Ornament $ornament): LibraryImage
    {
        $image = $this->store($ornament->user_id, (string) $this->assets->disk()->get($ornament->storage_key), $ornament->name, Asset::KIND_UPLOAD);
        $ornament->forceFill(['library_image_id' => $image->id])->save();

        return $image;
    }

    private function store(int $userId, string $binary, string $name, string $kind): LibraryImage
    {
        $hash = hash('sha256', $binary);
        $existing = LibraryImage::where('user_id', $userId)->where('sha256', $hash)->first();
        if ($existing !== null) {
            return $existing;
        }
        $info = $this->assets->inspect($binary);
        $key = sprintf('library-images/%d/%s.%s', $userId, Str::uuid(), $info['extension']);
        if (! $this->assets->disk()->put($key, $binary)) {
            throw new RuntimeException('Gagal menyimpan gambar ke pustaka.');
        }
        try {
            $image = LibraryImage::firstOrCreate(['user_id' => $userId, 'sha256' => $hash], [
                'name' => Str::limit($name, 120, '') ?: 'Gambar', 'kind' => $kind,
                'storage_key' => $key, 'mime_type' => $info['mime'],
                'width' => $info['width'], 'height' => $info['height'], 'bytes' => strlen($binary),
            ]);
        } catch (Throwable $exception) {
            $this->assets->disk()->delete($key);
            throw $exception;
        }
        // Concurrent uploads of identical bytes reuse one library image.
        if ($image->storage_key !== $key) {
            $this->assets->disk()->delete($key);
        }

        return $image;
    }
}
