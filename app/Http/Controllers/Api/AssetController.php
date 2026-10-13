<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreAssetRequest;
use App\Models\Asset;
use App\Models\Project;
use App\Services\Design\AssetStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class AssetController extends Controller
{
    /**
     * Upload a photo or logo to the project.
     */
    public function store(StoreAssetRequest $request, Project $project, AssetStore $assets): JsonResponse
    {
        Gate::authorize('update', $project);

        $asset = $assets->storeUpload(
            $project,
            $request->file('file'),
            $request->string('kind', Asset::KIND_UPLOAD)->toString(),
        );

        return response()->json($asset->toEditorArray(), 201);
    }
}
