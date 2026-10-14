import { Link } from '@inertiajs/react';
import { PanelsTopLeft } from 'lucide-react';
import { home } from '@/routes';

export default function PublicBrand() {
    return (
        <Link
            href={home()}
            aria-label="Banner Studio — beranda"
            className="inline-flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"
        >
            <span className="flex size-10 items-center justify-center rounded-xl bg-orange-600 text-white">
                <PanelsTopLeft className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
                Banner
                <span className="font-medium text-slate-500"> Studio</span>
            </span>
        </Link>
    );
}
