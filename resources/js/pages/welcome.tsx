import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Download, MousePointer2, Sparkles } from 'lucide-react';
import BannerSample from '@/components/banner-sample';
import PublicBrand from '@/components/public-brand';
import { dashboard, login, register } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props;
    return (
        <>
            <Head title="Banner Studio — dari ide menjadi banner" />
            <div className="public-surface flex min-h-svh flex-col bg-[#fbfaf7] text-slate-900">
                <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6 sm:px-10">
                    <PublicBrand />
                    <nav
                        aria-label="Navigasi utama"
                        className="flex items-center gap-3 text-sm font-semibold sm:gap-6"
                    >
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="rounded-full bg-slate-900 px-5 py-2.5 text-white hover:bg-slate-700"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="text-slate-600 hover:text-orange-700"
                                >
                                    Masuk
                                </Link>
                                <Link
                                    href={register()}
                                    className="rounded-full bg-slate-900 px-5 py-2.5 text-white hover:bg-slate-700"
                                >
                                    Daftar
                                </Link>
                            </>
                        )}
                    </nav>
                </header>
                <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 sm:px-10 sm:py-20 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800">
                            <Sparkles className="size-3.5" aria-hidden="true" />
                            Ruang kreatif, dibantu AI
                        </span>
                        <h1 className="mt-7 text-5xl leading-[1.08] font-bold tracking-tight sm:text-6xl">
                            Dari ide,
                            <br />
                            jadi{' '}
                            <span className="text-orange-600">banner.</span>
                        </h1>
                        <p className="mt-6 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">
                            Ceritakan idemu, buat desain dengan AI, lalu
                            sesuaikan sesukamu. Banner untuk kampanye dan
                            promosi, dalam satu tempat.
                        </p>
                        <Link
                            href={auth.user ? dashboard() : register()}
                            className="mt-8 inline-flex items-center gap-3 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"
                        >
                            {auth.user
                                ? 'Buka proyek saya'
                                : 'Mulai buat banner'}
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-500">
                            {[
                                { icon: Sparkles, label: 'Buat dengan AI' },
                                {
                                    icon: MousePointer2,
                                    label: 'Edit di kanvas',
                                },
                                { icon: Download, label: 'Ekspor desain' },
                            ].map(({ icon: Icon, label }) => (
                                <span
                                    key={label}
                                    className="inline-flex items-center gap-2"
                                >
                                    <Icon
                                        className="size-4 text-orange-600"
                                        aria-hidden="true"
                                    />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <div className="mb-4 flex items-center justify-between px-1 text-xs font-medium text-slate-500">
                            <span>Sedikit ide. Banyak kemungkinan.</span>
                            <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px]">
                                CONTOH BANNER
                            </span>
                        </div>
                        <BannerSample />
                        <p className="mt-5 text-center text-xs text-slate-500">
                            Teks, warna, dan komposisi — semuanya bisa kamu
                            sesuaikan.
                        </p>
                    </div>
                </main>
                <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-xs text-slate-400 sm:px-10">
                    <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5">
                        <span>Banner Studio</span>
                        <span>Dibuat untuk ide-ide yang ingin tampil.</span>
                    </div>
                </footer>
            </div>
        </>
    );
}
