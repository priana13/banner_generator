import { CANVAS_PRESETS } from '@/lib/editor-elements';

export type GeneratorSettingsValue = {
    width: number;
    height: number;
    color: string;
};
export default function GeneratorSettings({
    value,
    onChange,
    disabled = false,
}: {
    value: GeneratorSettingsValue;
    onChange: (value: GeneratorSettingsValue) => void;
    disabled?: boolean;
}) {
    return (
        <fieldset
            disabled={disabled}
            className="flex flex-wrap items-end gap-4"
        >
            <label className="text-sm font-medium">
                Ukuran gambar
                <select
                    value={`${value.width}x${value.height}`}
                    onChange={(event) => {
                        const [width, height] = event.target.value
                            .split('x')
                            .map(Number);
                        onChange({ ...value, width, height });
                    }}
                    className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-slate-800"
                >
                    {!CANVAS_PRESETS.some(
                        (item) =>
                            item.width === value.width &&
                            item.height === value.height,
                    ) && (
                        <option value={`${value.width}x${value.height}`}>
                            {value.width} × {value.height}
                        </option>
                    )}
                    {CANVAS_PRESETS.map((item) => (
                        <option
                            key={item.label}
                            value={`${item.width}x${item.height}`}
                        >
                            {item.label} — {item.width} × {item.height}
                        </option>
                    ))}
                </select>
            </label>
            <label className="text-sm font-medium">
                Warna utama
                <input
                    type="color"
                    value={value.color}
                    onChange={(event) =>
                        onChange({ ...value, color: event.target.value })
                    }
                    className="mt-1 block h-10 w-16"
                />
            </label>
        </fieldset>
    );
}
