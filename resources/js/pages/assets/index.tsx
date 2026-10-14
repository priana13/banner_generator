import { Head } from '@inertiajs/react';
import ImageLibraryBrowser from '@/components/image-library-browser';

export default function Assets() {
    return (
        <>
            <Head title="Pustaka aset" />
            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div>
                    <h1 className="text-xl font-semibold">Pustaka aset</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Simpan gambar dan gunakan kembali untuk foto, logo, atau
                        elemen di berbagai proyek.
                    </p>
                </div>
                <ImageLibraryBrowser />
            </div>
        </>
    );
}
Assets.layout = { breadcrumbs: [{ title: 'Aset', href: '/assets' }] };
