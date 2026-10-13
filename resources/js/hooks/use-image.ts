import { useEffect, useState } from 'react';

/**
 * Load an image for use on the canvas. Returns null until it is ready.
 */
export function useImage(url: string | undefined): HTMLImageElement | null {
    const [loaded, setLoaded] = useState<{
        url: string;
        image: HTMLImageElement;
    } | null>(null);

    useEffect(() => {
        if (!url) {
            return;
        }

        const image = new window.Image();

        image.onload = () => setLoaded({ url, image });
        image.src = url;

        return () => {
            image.onload = null;
        };
    }, [url]);

    return loaded && loaded.url === url ? loaded.image : null;
}
