<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreAssetRequest;
use App\Models\Asset;
use App\Models\Ornament;
use App\Models\Project;
use App\Services\Design\AssetStore;
use App\Services\Design\ImageLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class OrnamentController extends Controller
{
    /**
     * List the ornaments in the user's library.
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->ornaments()
                ->latest()
                ->get()
                ->map(fn (Ornament $ornament) => $ornament->toEditorArray()),
        ]);
    }

    /**
     * Add an image to the user's ornament library.
     */
    public function store(StoreAssetRequest $request, AssetStore $assets, ImageLibrary $library): JsonResponse
    {
        $user = $request->user();

        if ($user->ornaments()->count() >= config()->integer('banner.max_user_ornaments')) {
            return response()->json(['message' => 'Pustaka ornamen Anda sudah penuh. Hapus beberapa terlebih dahulu.'], 422);
        }

        $file = $request->file('file');
        $binary = (string) $file->getContent();
        $info = $assets->inspect($binary);
        $key = sprintf('ornaments/%d/%s.%s', $user->id, Str::uuid(), $info['extension']);

        $assets->disk()->put($key, $binary);

        $ornament = $user->ornaments()->create([
            'name' => Str::limit(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME), 80, '') ?: 'Ornamen',
            'storage_key' => $key,
            'mime_type' => $info['mime'],
            'width' => $info['width'],
            'height' => $info['height'],
        ]);

        $library->rememberOrnament($ornament);

        return response()->json($ornament->toEditorArray(), 201);
    }

    /**
     * Serve a library ornament to its owner.
     */
    public function show(Request $request, Ornament $ornament, AssetStore $assets): Response
    {
        abort_unless($ornament->user_id === $request->user()->id, 403);
        abort_unless($assets->disk()->exists($ornament->storage_key), 404);

        return response((string) $assets->disk()->get($ornament->storage_key), 200, [
            'Content-Type' => $ornament->mime_type,
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Copy a library ornament into a project so a design can use it. Using
     * the same ornament again reuses the existing copy.
     */
    public function use(Request $request, Project $project, Ornament $ornament, AssetStore $assets): JsonResponse
    {
        Gate::authorize('update', $project);
        abort_unless($ornament->user_id === $request->user()->id, 403);

        $asset = $project->assets()
            ->where('kind', Asset::KIND_ORNAMENT)
            ->where('metadata_json->source_ornament_id', $ornament->id)
            ->first();

        if ($asset === null) {
            abort_unless($assets->disk()->exists($ornament->storage_key), 404);

            $asset = $assets->store($project, (string) $assets->disk()->get($ornament->storage_key), Asset::KIND_ORNAMENT, [
                'original_name' => $ornament->name,
                'source_ornament_id' => $ornament->id,
            ]);
        }

        return response()->json($asset->toEditorArray());
    }

    /**
     * Remove an ornament from the library. Designs that already use it keep
     * their own copy.
     */
    public function destroy(Request $request, Ornament $ornament, AssetStore $assets): JsonResponse
    {
        abort_unless($ornament->user_id === $request->user()->id, 403);

        $assets->disk()->delete($ornament->storage_key);
        $ornament->delete();

        return response()->json(status: 204);
    }
}
