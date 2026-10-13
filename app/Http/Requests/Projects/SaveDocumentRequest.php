<?php

namespace App\Http\Requests\Projects;

use App\Models\Project;
use App\Services\Design\DocumentNormalizer;
use App\Services\Design\DocumentRules;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveDocumentRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
            ...DocumentRules::rules('document'),
        ];
    }

    /**
     * Images may only reference assets that belong to this project.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var Project $project */
                $project = $this->route('project');
                $ids = DocumentNormalizer::assetIds((array) $this->input('document'));

                if ($ids !== [] && $project->assets()->whereKey($ids)->count() !== count($ids)) {
                    $validator->errors()->add('document.elements', 'Dokumen merujuk aset yang tidak tersedia di proyek ini.');
                }
            },
        ];
    }
}
