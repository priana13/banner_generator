<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Services\Design\AssetStore;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class AssetController extends Controller
{
    /**
     * Stream a private asset to its owner. Serving it from our own origin
     * also keeps the editor canvas untainted, so it can be exported.
     */
    public function show(Asset $asset, AssetStore $assets): Response
    {
        Gate::authorize('view', $asset->project);

        $disk = $assets->disk();

        abort_unless($disk->exists($asset->storage_key), 404);

        return response((string) $disk->get($asset->storage_key), 200, [
            'Content-Type' => $asset->mime_type,
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
