import { ArrowUpRight, Sparkles } from 'lucide-react';

export default function BannerSample() {
    return (
        <div
            aria-label="Contoh desain banner promosi"
            role="img"
            className="relative w-full overflow-hidden rounded-2xl border border-orange-200 bg-[#fff4e8] p-6 shadow-[0_20px_60px_-25px_rgba(154,71,22,0.25)] sm:p-9"
        >
            <div className="relative z-10 max-w-[65%]">
                <span className="text-[10px] font-bold tracking-[0.2em] text-orange-800 sm:text-xs">
                    IDE BESAR. DESAIN MENARIK.
                </span>
                <p className="mt-5 text-3xl leading-[1.05] font-bold tracking-tight text-slate-900 sm:text-5xl">
                    Saatnya
                    <br />
                    tampil <span className="text-orange-600">beda.</span>
                </p>
                <p className="mt-4 max-w-48 text-xs leading-relaxed text-slate-600 sm:text-sm">
                    Satu ide sederhana, banyak kemungkinan.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                    Mulai berkarya{' '}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                </span>
            </div>
            <div
                aria-hidden="true"
                className="absolute -right-36 -bottom-14 size-64 rounded-full border-[35px] border-orange-500 sm:size-80"
            />
            <div
                aria-hidden="true"
                className="absolute top-8 right-8 flex size-16 -rotate-12 items-center justify-center rounded-2xl bg-white/80 text-orange-600 shadow-sm sm:size-20"
            >
                <Sparkles className="size-8" />
            </div>
        </div>
    );
}
