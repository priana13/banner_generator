<?php

namespace App\Services\Design;

use App\Models\Asset;
use App\Models\Project;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class AssetStore
{
    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function disk(): Filesystem
    {
        return Storage::disk(config()->string('banner.disk'));
    }

    public function storeUpload(Project $project, UploadedFile $file, string $kind): Asset
    {
        return $this->store($project, (string) $file->getContent(), $kind, [
            'original_name' => Str::limit($file->getClientOriginalName(), 120, ''),
        ]);
    }

    public function delete(Asset $asset): void
    {
        $this->disk()->delete($asset->storage_key);
        $asset->delete();
    }

    /**
     * Persist image bytes as a project asset. The MIME type and dimensions
     * are read from the bytes themselves, never from client-supplied data.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function store(Project $project, string $binary, string $kind, array $metadata = []): Asset
    {
        $info = @getimagesizefromstring($binary);

        if ($info === false || ! isset(self::EXTENSIONS[$info['mime']])) {
            throw new RuntimeException('Unsupported image data.');
        }

        $key = sprintf('projects/%d/%s.%s', $project->id, Str::uuid(), self::EXTENSIONS[$info['mime']]);

        $this->disk()->put($key, $binary);

        return $project->assets()->create([
            'user_id' => $project->user_id,
            'kind' => $kind,
            'storage_key' => $key,
            'mime_type' => $info['mime'],
            'width' => $info[0],
            'height' => $info[1],
            'metadata_json' => $metadata + ['bytes' => strlen($binary)],
        ]);
    }
}
