import type { CSSProperties, ReactNode } from 'react';
import { ornamentUrl } from '@/lib/ornaments';
import type { DesignDocument, DesignElement, EditorAsset } from '@/types';

function PreviewElement({
    element,
    assets,
}: {
    element: DesignElement;
    assets: EditorAsset[];
}) {
    const box = {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
    };
    const text: CSSProperties = {
        fontFamily: `"${'fontFamily' in element ? element.fontFamily : 'Inter'}", sans-serif`,
        fontSize: 'fontSize' in element ? element.fontSize : undefined,
        fontWeight:
            'fontStyle' in element
                ? { normal: 400, '600': 600, bold: 700, '800': 800 }[
                      element.fontStyle
                  ]
                : 400,
        lineHeight: 1.2,
    };

    switch (element.type) {
        case 'ornament':
            return (
                <image
                    {...box}
                    href={ornamentUrl(element.ornamentId, element.fill)}
                    preserveAspectRatio="none"
                />
            );
        case 'rect':
            return (
                <rect {...box} rx={element.cornerRadius} fill={element.fill} />
            );
        case 'circle':
            return (
                <ellipse
                    cx={element.x + element.width / 2}
                    cy={element.y + element.height / 2}
                    rx={element.width / 2}
                    ry={element.height / 2}
                    fill={element.fill}
                />
            );
        case 'image': {
            const asset = assets.find((item) => item.id === element.assetId);

            return asset ? (
                <image {...box} href={asset.url} preserveAspectRatio="none" />
            ) : null;
        }
        case 'text':
            return (
                <foreignObject {...box} height={element.height * 4}>
                    <div
                        style={{
                            ...text,
                            color: element.fill,
                            textAlign: element.align,
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {element.spans?.length
                            ? element.spans.map((span, index) => (
                                  <span
                                      key={index}
                                      style={{ color: span.fill }}
                                  >
                                      {span.text}{' '}
                                  </span>
                              ))
                            : element.text}
                    </div>
                </foreignObject>
            );
        case 'button':
            return (
                <foreignObject {...box}>
                    <div
                        style={{
                            ...text,
                            display: 'grid',
                            placeItems: 'center',
                            height: '100%',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            color: element.textColor,
                            backgroundColor: element.fill,
                            borderRadius: element.cornerRadius,
                        }}
                    >
                        {element.text}
                    </div>
                </foreignObject>
            );
    }
}

const FADE_AXES = {
    right: { x1: 0, y1: 0, x2: 1, y2: 0 },
    left: { x1: 1, y1: 0, x2: 0, y2: 0 },
    bottom: { x1: 0, y1: 0, x2: 0, y2: 1 },
    top: { x1: 0, y1: 1, x2: 0, y2: 0 },
} as const;

/** SVG counterpart of lib/fade.ts: the gradient becomes a luminance mask. */
function Faded({
    element,
    children,
}: {
    element: DesignElement;
    children: ReactNode;
}) {
    const fade = 'fade' in element ? element.fade : undefined;

    if (!fade) {
        return children;
    }

    const box = {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
    };
    const id = `fade-${element.id}`;

    if (fade.type === 'linear') {
        return (
            <>
                <defs>
                    <linearGradient
                        id={`${id}-g`}
                        {...FADE_AXES[fade.direction]}
                    >
                        <stop offset={0} stopColor="#fff" />
                        <stop offset={1 - fade.amount} stopColor="#fff" />
                        <stop offset={1} stopColor="#000" />
                    </linearGradient>
                    <mask id={id}>
                        <rect {...box} fill={`url(#${id}-g)`} />
                    </mask>
                </defs>
                <g mask={`url(#${id})`}>{children}</g>
            </>
        );
    }

    if (element.type === 'circle') {
        return (
            <>
                <defs>
                    <radialGradient id={`${id}-g`}>
                        <stop offset={0} stopColor="#fff" />
                        <stop offset={1 - fade.amount} stopColor="#fff" />
                        <stop offset={1} stopColor="#000" />
                    </radialGradient>
                    <mask id={id}>
                        <rect {...box} fill={`url(#${id}-g)`} />
                    </mask>
                </defs>
                <g mask={`url(#${id})`}>{children}</g>
            </>
        );
    }

    const feather = (Math.min(element.width, element.height) / 2) * fade.amount;
    const stops = (length: number) => {
        const stop = Math.min(0.5, feather / length);

        return (
            <>
                <stop offset={0} stopColor="#000" />
                <stop offset={stop} stopColor="#fff" />
                <stop offset={1 - stop} stopColor="#fff" />
                <stop offset={1} stopColor="#000" />
            </>
        );
    };

    return (
        <>
            <defs>
                <linearGradient id={`${id}-h`} x1={0} y1={0} x2={1} y2={0}>
                    {stops(element.width)}
                </linearGradient>
                <linearGradient id={`${id}-v`} x1={0} y1={0} x2={0} y2={1}>
                    {stops(element.height)}
                </linearGradient>
                <mask id={`${id}-mh`}>
                    <rect {...box} fill={`url(#${id}-h)`} />
                </mask>
                <mask id={`${id}-mv`}>
                    <rect {...box} fill={`url(#${id}-v)`} />
                </mask>
            </defs>
            <g mask={`url(#${id}-mh)`}>
                <g mask={`url(#${id}-mv)`}>{children}</g>
            </g>
        </>
    );
}

/**
 * A lightweight, non-interactive rendering of a design document, used for
 * thumbnails. The editor itself renders with Konva.
 */
export function DocumentPreview({
    document,
    assets,
    className,
}: {
    document: DesignDocument;
    assets: EditorAsset[];
    className?: string;
}) {
    const { canvas, elements } = document;

    return (
        <svg
            viewBox={`0 0 ${canvas.width} ${canvas.height}`}
            className={className}
            role="img"
            aria-label="Pratinjau banner"
        >
            <rect
                width={canvas.width}
                height={canvas.height}
                fill={canvas.backgroundColor}
            />
            {elements
                .filter((element) => element.visible)
                .map((element) => (
                    <g
                        key={element.id}
                        opacity={element.opacity}
                        transform={`rotate(${element.rotation} ${element.x} ${element.y})`}
                    >
                        <Faded element={element}>
                            <PreviewElement element={element} assets={assets} />
                        </Faded>
                    </g>
                ))}
        </svg>
    );
}
