<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProjectCategoryController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateName($request);
        $category = $request->user()->projectCategories()->create($data);

        return response()->json(['id' => $category->id, 'name' => $category->name], 201);
    }

    public function update(Request $request, ProjectCategory $category): JsonResponse
    {
        abort_unless($category->user_id === $request->user()->id, 403);
        $category->update($this->validateName($request, $category));

        return response()->json(['id' => $category->id, 'name' => $category->name]);
    }

    public function destroy(Request $request, ProjectCategory $category): JsonResponse
    {
        abort_unless($category->user_id === $request->user()->id, 403);
        $category->delete();

        return response()->json(status: 204);
    }

    private function validateName(Request $request, ?ProjectCategory $category = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('project_categories')
                ->where('user_id', $request->user()->id)->ignore($category?->id)],
        ], ['name.unique' => 'Nama kategori ini sudah digunakan.']);
    }
}
