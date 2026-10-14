import type { ReactElement } from 'react';
import { useState } from 'react';
import ImageLibraryBrowser from '@/components/image-library-browser';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import type { LibraryImage } from '@/types';

export default function ImageLibraryPicker({
    children,
    onChoose,
    title = 'Pilih gambar',
    uploadKind = 'upload',
}: {
    children: ReactElement;
    onChoose: (image: LibraryImage) => Promise<void>;
    title?: string;
    uploadKind?: LibraryImage['kind'];
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!busy) setOpen(value);
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Pilih gambar dari pustaka pribadi atau upload gambar
                        baru.
                    </DialogDescription>
                </DialogHeader>
                {open && (
                    <ImageLibraryBrowser
                        uploadKind={uploadKind}
                        onBusyChange={setBusy}
                        onChoose={async (image) => {
                            await onChoose(image);
                            setOpen(false);
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
