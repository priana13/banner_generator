import { Link } from '@inertiajs/react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import BannerSample from '@/components/banner-sample';
import PublicBrand from '@/components/public-brand';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="public-surface min-h-svh bg-[#fbfaf7] text-slate-900">
            <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6 sm:px-10">
                <PublicBrand />
                <Link
                    href={home()}
                    aria-label="Kembali ke beranda"
                    className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-orange-700"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Kembali ke beranda</span>
                </Link>
            </header>
            <main className="mx-auto grid max-w-6xl items-center gap-16 px-6 py-8 sm:px-10 sm:py-12 lg:min-h-[calc(100svh-100px)] lg:grid-cols-2 lg:py-10">
                <aside className="hidden lg:block">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-orange-700">
                        <Sparkles className="size-4" aria-hidden="true" />
                        TEMPAT IDE MENJADI DESAIN
                    </span>
                    <h2 className="mt-6 text-5xl leading-[1.12] font-bold tracking-tight">
                        Ide bagus layak
                        <br />
                        tampil <span className="text-orange-600">menarik.</span>
                    </h2>
                    <p className="mt-5 max-w-sm text-base leading-relaxed text-slate-500">
                        Buat banner dengan bantuan AI, atur detailnya di kanvas,
                        lalu ekspor desainmu.
                    </p>
                    <div className="mt-9">
                        <BannerSample />
                    </div>
                </aside>
                <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_12px_45px_-25px_rgba(15,23,42,0.2)] sm:p-10">
                    <div className="mb-8 space-y-3">
                        <h1 className="text-3xl font-bold tracking-tight">
                            {title}
                        </h1>
                        <p className="text-sm leading-relaxed text-slate-500">
                            {description}
                        </p>
                    </div>
                    {children}
                </section>
            </main>
        </div>
    );
}
