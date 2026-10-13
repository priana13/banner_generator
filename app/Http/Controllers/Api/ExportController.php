<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ExportRequest;
use App\Models\Project;
use App\Services\Ai\ImageTools;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class ExportController extends Controller
{
    private const MIME_TYPES = ['png' => 'image/png', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp'];

    /**
     * Convert the canvas rendered by the editor (PNG) into the requested
     * format. Used for formats the browser cannot reliably encode itself.
     */
    public function store(ExportRequest $request, Project $project): Response
    {
        Gate::authorize('view', $project);

        $source = @imagecreatefromstring((string) $request->file('image')->getContent());

        abort_if($source === false, 422, 'Gambar tidak dapat dibaca.');

        // Flatten onto white so transparent pixels do not turn black in JPEG.
        $image = ImageTools::canvas(imagesx($source), imagesy($source));
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 255, 255, 255));
        imagecopy($image, $source, 0, 0, 0, 0, imagesx($source), imagesy($source));

        $format = $request->string('format')->toString();
        $mimeType = self::MIME_TYPES[$format];
        $filename = (Str::slug($project->title) ?: 'banner').'.'.($format === 'jpeg' ? 'jpg' : $format);

        return response(ImageTools::encode($image, $mimeType, 92), 200, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
