<?php

namespace App\Http\Controllers;

use App\Http\Requests\Projects\StoreAssetRequest;
use App\Models\Asset;
use App\Models\LibraryImage;
use App\Models\Project;
use App\Services\Design\AssetStore;
use App\Services\Design\ImageLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as FileResponse;

class LibraryImageController extends Controller
{
    public function page(): Response
    {
        return Inertia::render('assets/index');
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:120'], 'page' => ['nullable', 'integer', 'min:1'],
            'kind' => ['nullable', Rule::in([Asset::KIND_UPLOAD, Asset::KIND_LOGO, Asset::KIND_CUTOUT])],
        ]);
        $images = $request->user()->libraryImages()
            ->when($data['search'] ?? null, fn ($query, $search) => $query->where('name', 'like', '%'.$search.'%'))
            ->when($data['kind'] ?? null, fn ($query, $kind) => $query->where('kind', $kind))
            ->latest('created_at')->orderByDesc('id')->paginate(24);

        return response()->json([
            'data' => $images->getCollection()->map(fn (LibraryImage $image) => $image->toLibraryArray()),
            'meta' => ['current_page' => $images->currentPage(), 'last_page' => $images->lastPage(), 'total' => $images->total()],
        ]);
    }

    public function store(StoreAssetRequest $request, ImageLibrary $library): JsonResponse
    {
        $image = $library->upload($request->user(), $request->file('file'), $request->input('kind') ?? Asset::KIND_UPLOAD);

        return response()->json($image->toLibraryArray(), 201);
    }

    public function show(Request $request, LibraryImage $libraryImage, AssetStore $assets): FileResponse
    {
        abort_unless($libraryImage->user_id === $request->user()->id, 403);
        abort_unless($assets->disk()->exists($libraryImage->storage_key), 404);

        return response((string) $assets->disk()->get($libraryImage->storage_key), 200, [
            'Content-Type' => $libraryImage->mime_type,
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function use(Request $request, Project $project, LibraryImage $libraryImage, AssetStore $assets): JsonResponse
    {
        Gate::authorize('update', $project);
        abort_unless($libraryImage->user_id === $request->user()->id, 403);
        $data = $request->validate(['kind' => ['nullable', Rule::in([Asset::KIND_UPLOAD, Asset::KIND_LOGO, Asset::KIND_CUTOUT])]]);
        $kind = $data['kind'] ?? $libraryImage->kind;
        $existing = $project->assets()->where('metadata_json->library_image_id', $libraryImage->id)->where('kind', $kind)->first();
        if ($existing !== null) {
            return response()->json($existing->toEditorArray());
        }
        abort_unless($assets->disk()->exists($libraryImage->storage_key), 404);
        $asset = $assets->store($project, (string) $assets->disk()->get($libraryImage->storage_key), $kind, [
            'original_name' => $libraryImage->name, 'library_image_id' => $libraryImage->id,
        ]);

        return response()->json($asset->toEditorArray());
    }

    public function destroy(Request $request, LibraryImage $libraryImage, AssetStore $assets): JsonResponse
    {
        abort_unless($libraryImage->user_id === $request->user()->id, 403);
        $assets->disk()->delete($libraryImage->storage_key);
        $libraryImage->delete();

        return response()->json(status: 204);
    }
}
