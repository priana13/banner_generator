import type { ProjectCategory } from '@/types';

export default function ProjectCategorySelect({
    categories,
    value,
    onChange,
    id,
    disabled = false,
    className = '',
}: {
    categories: ProjectCategory[];
    value: number | null;
    onChange: (value: number | null) => void;
    id?: string;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <select
            id={id}
            aria-label="Kategori proyek"
            value={value ?? ''}
            onChange={(event) =>
                onChange(
                    event.target.value === ''
                        ? null
                        : Number(event.target.value),
                )
            }
            disabled={disabled}
            className={`h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-50 ${className}`}
        >
            <option value="">Tanpa kategori</option>
            {categories.map((category) => (
                <option key={category.id} value={category.id}>
                    {category.name}
                </option>
            ))}
        </select>
    );
}
