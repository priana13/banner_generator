import { useEffect, useState } from 'react';

/**
 * Canvas text is measured when it is drawn, so the editor has to wait for
 * its web fonts before rendering (and exporting) a design.
 */
export function useFontsReady(families: string[]): boolean {
    const [ready, setReady] = useState(false);
    const key = families.join('|');

    useEffect(() => {
        let cancelled = false;

        void Promise.allSettled(
            key
                .split('|')
                .flatMap((family) => [
                    document.fonts.load(`400 16px "${family}"`),
                    document.fonts.load(`700 16px "${family}"`),
                ]),
        ).then(() => {
            if (!cancelled) {
                setReady(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [key]);

    return ready;
}
