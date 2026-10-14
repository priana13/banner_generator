import type Konva from 'konva';
import type { RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
    Ellipse,
    Group,
    Image as KonvaImage,
    Layer,
    Rect,
    Stage,
    Text,
    Transformer,
} from 'react-konva';
import { useFontsReady } from '@/hooks/use-fonts-ready';
import { useImage } from '@/hooks/use-image';
import { LINE_HEIGHT } from '@/lib/editor-elements';
import { useEditorStore } from '@/lib/editor-store';
import { renderFaded } from '@/lib/fade';
import { ornamentUrl } from '@/lib/ornaments';
import { layoutSpans } from '@/lib/text-layout';
import type {
    DesignElement,
    ElementPatch,
    FadableElement,
    ImageElement,
    OrnamentElement,
    TextElement,
} from '@/types';

const MIN_SIZE = 5;
const SIDE_ANCHORS = ['middle-left', 'middle-right'];
const CORNER_ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function ImageNode({
    element,
    common,
}: {
    element: ImageElement;
    common: Konva.NodeConfig;
}) {
    const asset = useEditorStore((state) => state.assets[element.assetId]);
    const image = useImage(asset?.url);

    if (!image) {
        // Keeps the layer selectable while the image loads (or is missing).
        return (
            <Rect
                {...common}
                width={element.width}
                height={element.height}
                fill="#e2e8f0"
            />
        );
    }

    return (
        <KonvaImage
            {...common}
            image={image}
            width={element.width}
            height={element.height}
        />
    );
}

function OrnamentNode({
    element,
    common,
}: {
    element: OrnamentElement;
    common: Konva.NodeConfig;
}) {
    const image = useImage(ornamentUrl(element.ornamentId, element.fill));

    return image ? (
        <KonvaImage
            {...common}
            image={image}
            width={element.width}
            height={element.height}
        />
    ) : null;
}

/**
 * An element with a transparency gradient. It is drawn off-screen with the
 * gradient applied and placed on the stage as an image.
 */
function FadedNode({
    element,
    common,
}: {
    element: FadableElement;
    common: Konva.NodeConfig;
}) {
    const asset = useEditorStore((state) =>
        element.type === 'image' ? state.assets[element.assetId] : undefined,
    );
    const url =
        element.type === 'image'
            ? asset?.url
            : element.type === 'ornament'
              ? ornamentUrl(element.ornamentId, element.fill)
              : undefined;
    const image = useImage(url);
    const rendered = useMemo(
        () => renderFaded(element, image),
        [element, image],
    );

    return rendered ? (
        <KonvaImage
            {...common}
            image={rendered}
            width={element.width}
            height={element.height}
        />
    ) : null;
}

/** Text whose fragments have different colors: one run per word. */
function SpansNode({
    element,
    common,
}: {
    element: TextElement;
    common: Konva.NodeConfig;
}) {
    const { runs, height } = layoutSpans(element);

    return (
        <Group {...common}>
            {/* Gives the group a solid area to click and drag. */}
            <Rect width={element.width} height={height} fill="rgba(0,0,0,0)" />
            {runs.map((run, index) => (
                <Text
                    key={index}
                    x={run.x}
                    y={run.y}
                    text={run.text}
                    fill={run.fill}
                    fontFamily={element.fontFamily}
                    fontSize={element.fontSize}
                    fontStyle={element.fontStyle}
                    listening={false}
                />
            ))}
        </Group>
    );
}

function ElementNode({ element }: { element: DesignElement }) {
    const select = useEditorStore((state) => state.select);

    const common: Konva.NodeConfig = {
        id: element.id,
        x: element.x,
        y: element.y,
        rotation: element.rotation,
        opacity: element.opacity,
        visible: element.visible,
        // Locked layers let clicks fall through to whatever is underneath.
        listening: !element.locked,
        draggable: !element.locked,
        onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
            if (event.evt.button !== 0) return;
            if (event.evt.shiftKey) select(element.id, true);
            else if (
                !useEditorStore.getState().selectedIds.includes(element.id)
            )
                select(element.id);
        },
        onTap: () => {
            if (!useEditorStore.getState().selectedIds.includes(element.id))
                select(element.id);
        },
    };

    if ('fade' in element && element.fade) {
        return <FadedNode element={element} common={common} />;
    }

    switch (element.type) {
        case 'ornament':
            return <OrnamentNode element={element} common={common} />;
        case 'text':
            if (element.spans?.length) {
                return <SpansNode element={element} common={common} />;
            }

            return (
                <Text
                    {...common}
                    text={element.text}
                    width={element.width}
                    fontFamily={element.fontFamily}
                    fontSize={element.fontSize}
                    fontStyle={element.fontStyle}
                    align={element.align}
                    fill={element.fill}
                    lineHeight={LINE_HEIGHT}
                />
            );
        case 'button':
            return (
                <Group {...common}>
                    <Rect
                        width={element.width}
                        height={element.height}
                        fill={element.fill}
                        cornerRadius={Math.min(
                            element.cornerRadius,
                            element.height / 2,
                        )}
                    />
                    <Text
                        text={element.text}
                        width={element.width}
                        height={element.height}
                        align="center"
                        verticalAlign="middle"
                        wrap="none"
                        ellipsis
                        fontFamily={element.fontFamily}
                        fontSize={element.fontSize}
                        fontStyle={element.fontStyle}
                        fill={element.textColor}
                    />
                </Group>
            );
        case 'rect':
            return (
                <Rect
                    {...common}
                    width={element.width}
                    height={element.height}
                    fill={element.fill}
                    cornerRadius={Math.min(
                        element.cornerRadius,
                        element.width / 2,
                        element.height / 2,
                    )}
                />
            );
        case 'circle':
            // Offset so that, like every other element, x/y is the top-left
            // corner of the bounding box.
            return (
                <Ellipse
                    {...common}
                    radiusX={element.width / 2}
                    radiusY={element.height / 2}
                    offsetX={-element.width / 2}
                    offsetY={-element.height / 2}
                    fill={element.fill}
                />
            );
        case 'image':
            return <ImageNode element={element} common={common} />;
    }
}

export function CanvasStage({
    stageRef,
    fonts,
}: {
    stageRef: RefObject<Konva.Stage | null>;
    fonts: string[];
}) {
    const document = useEditorStore((state) => state.document);
    const selectedIds = useEditorStore((state) => state.selectedIds);
    const zoom = useEditorStore((state) => state.zoom);
    const select = useEditorStore((state) => state.select);
    const transformerRef = useRef<Konva.Transformer>(null);
    const fontsReady = useFontsReady(fonts);

    const { canvas, elements } = document;
    const selected =
        selectedIds.length === 1
            ? elements.find((element) => element.id === selectedIds[0])
            : undefined;

    useEffect(() => {
        const transformer = transformerRef.current;
        const nodes = elements
            .filter(
                (element) =>
                    selectedIds.includes(element.id) &&
                    !element.locked &&
                    element.visible,
            )
            .map((element) => stageRef.current?.findOne(`#${element.id}`))
            .filter((node): node is Konva.Node => node !== undefined);
        transformer?.nodes(nodes);
        transformer?.getLayer()?.batchDraw();
    }, [selectedIds, document, fontsReady, stageRef]);

    const savePositions = (): void => {
        const patches: Record<string, ElementPatch> = {};
        for (const node of transformerRef.current?.nodes() ?? []) {
            patches[node.id()] = { x: round(node.x()), y: round(node.y()) };
        }
        useEditorStore.getState().updateElements(patches);
    };
    const saveTransform = (): void => {
        const patches: Record<string, ElementPatch> = {};
        const originals = useEditorStore.getState().document.elements;
        for (const node of transformerRef.current?.nodes() ?? []) {
            const element = originals.find((item) => item.id === node.id());
            if (!element) continue;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            const patch: ElementPatch = {
                x: round(node.x()),
                y: round(node.y()),
                rotation: round(node.rotation()),
                width: round(Math.max(MIN_SIZE, element.width * scaleX)),
                height: round(Math.max(MIN_SIZE, element.height * scaleY)),
            };
            if (element.type === 'text') {
                const fontSize = Math.max(
                    4,
                    Math.round(element.fontSize * scaleY),
                );
                patch.fontSize = fontSize;
                patch.height = round(
                    (element.height / element.fontSize) * fontSize,
                );
            }
            node.scaleX(1);
            node.scaleY(1);
            patches[element.id] = patch;
        }
        useEditorStore.getState().updateElements(patches);
    };

    return (
        <Stage
            ref={stageRef}
            width={canvas.width * zoom}
            height={canvas.height * zoom}
            scaleX={zoom}
            scaleY={zoom}
            onDragEnd={(event) => {
                if (
                    useEditorStore
                        .getState()
                        .selectedIds.includes(event.target.id()) ||
                    event.target.getClassName() === 'Transformer'
                )
                    savePositions();
            }}
            onMouseDown={(event) => {
                if (event.target.name() === 'background') {
                    select(null);
                }
            }}
            onTap={(event) => {
                if (event.target.name() === 'background') {
                    select(null);
                }
            }}
        >
            {/* Remount once fonts are in, so text is measured with them. */}
            <Layer key={fontsReady ? 'ready' : 'loading'}>
                <Rect
                    name="background"
                    width={canvas.width}
                    height={canvas.height}
                    fill={canvas.backgroundColor}
                />
                {elements.map((element) => (
                    <ElementNode key={element.id} element={element} />
                ))}
                <Transformer
                    ref={transformerRef}
                    onTransformEnd={saveTransform}
                    flipEnabled={false}
                    rotationSnaps={[0, 90, 180, 270]}
                    anchorStroke="#f97316"
                    borderStroke="#f97316"
                    anchorCornerRadius={3}
                    enabledAnchors={
                        selectedIds.length > 1
                            ? CORNER_ANCHORS
                            : selected?.type === 'text'
                              ? [...SIDE_ANCHORS, ...CORNER_ANCHORS]
                              : undefined
                    }
                    boundBoxFunc={(oldBox, newBox) =>
                        Math.abs(newBox.width) < MIN_SIZE ||
                        Math.abs(newBox.height) < MIN_SIZE
                            ? oldBox
                            : newBox
                    }
                />
            </Layer>
        </Stage>
    );
}
