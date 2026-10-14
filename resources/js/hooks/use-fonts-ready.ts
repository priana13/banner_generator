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
            key.split('|').flatMap((family) =>
                // Every weight the editor offers.
                [400, 600, 700, 800].map((weight) =>
                    document.fonts.load(`${weight} 16px "${family}"`),
                ),
            ),
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
