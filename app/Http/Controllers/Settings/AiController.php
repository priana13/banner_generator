<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\AiSetting;
use App\Services\Ai\GlobalAiSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AiController extends Controller
{
    public function edit(GlobalAiSettings $settings): Response
    {
        $values = $settings->values();
        foreach (['gemini_api_key', 'openai_api_key'] as $key) {
            $values[$key.'_configured'] = ! empty($values[$key]);
            unset($values[$key]);
        }

        return Inertia::render('settings/ai', ['settings' => $values]);
    }

    public function update(Request $request, GlobalAiSettings $settings): RedirectResponse
    {
        $data = $request->validate([
            'layout_provider' => ['required', Rule::in(['local', 'openai', 'gemini'])],
            'image_provider' => ['required', Rule::in(['local', 'openai', 'gemini'])],
            'gemini_model' => ['required', 'string', 'max:120', 'regex:/^[a-zA-Z0-9._-]+$/'],
            'gemini_image_model' => ['required', 'string', 'max:120', 'regex:/^[a-zA-Z0-9._-]+$/'],
            'gemini_api_key' => ['nullable', 'string', 'max:500'],
            'openai_api_key' => ['nullable', 'string', 'max:500'],
            'openai_base_url' => ['required', 'url:http,https', 'max:500'],
            'openai_layout_model' => ['required', 'string', 'max:120'],
            'openai_image_model' => ['required', 'string', 'max:120'],
        ]);

        DB::transaction(function () use ($data, $settings) {
            $row = AiSetting::query()->firstOrCreate(['id' => 1], ['settings' => []]);
            $row = AiSetting::query()->lockForUpdate()->findOrFail($row->id);
            $values = array_replace($settings->values(), $row->settings);
            foreach (['gemini_api_key', 'openai_api_key'] as $key) {
                if (empty($data[$key])) {
                    unset($data[$key]);
                }
            }
            $values = array_replace($values, $data);
            if (($values['layout_provider'] === 'gemini' || $values['image_provider'] === 'gemini') && empty($values['gemini_api_key'])) {
                throw ValidationException::withMessages(['gemini_api_key' => 'Masukkan API key Gemini untuk mengaktifkan provider ini.']);
            }
            if (($values['layout_provider'] === 'openai' || $values['image_provider'] === 'openai') && empty($values['openai_api_key'])) {
                throw ValidationException::withMessages(['openai_api_key' => 'Masukkan API key OpenAI untuk mengaktifkan provider ini.']);
            }
            $row->update(['settings' => $values]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Konfigurasi AI global disimpan. Berlaku untuk semua pengguna.']);

        return to_route('ai.edit');
    }
}
