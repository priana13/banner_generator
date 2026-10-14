import type Konva from 'konva';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
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
import { ornamentUrl } from '@/lib/ornaments';
import { layoutSpans } from '@/lib/text-layout';
import type {
    DesignElement,
    ElementPatch,
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
    const updateElement = useEditorStore((state) => state.updateElement);

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
        onMouseDown: () => select(element.id),
        onTap: () => select(element.id),
        onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) =>
            updateElement(element.id, {
                x: round(event.target.x()),
                y: round(event.target.y()),
            }),
        onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
            const node = event.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            // Konva resizes by scaling; bake the scale into real dimensions
            // so the document keeps absolute sizes.
            node.scaleX(1);
            node.scaleY(1);

            const patch: ElementPatch = {
                x: round(node.x()),
                y: round(node.y()),
                rotation: round(node.rotation()),
                width: round(Math.max(MIN_SIZE, element.width * scaleX)),
                height: round(Math.max(MIN_SIZE, element.height * scaleY)),
            };

            if (element.type === 'text') {
                // Corners scale the type, the sides only re-wrap it.
                const fontSize = Math.max(
                    4,
                    Math.round(element.fontSize * scaleY),
                );

                patch.fontSize = fontSize;
                patch.height = round(
                    (element.height / element.fontSize) * fontSize,
                );
            }

            updateElement(element.id, patch);
        },
    };

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
    const selectedId = useEditorStore((state) => state.selectedId);
    const zoom = useEditorStore((state) => state.zoom);
    const select = useEditorStore((state) => state.select);
    const transformerRef = useRef<Konva.Transformer>(null);
    const fontsReady = useFontsReady(fonts);

    const { canvas, elements } = document;
    const selected = elements.find((element) => element.id === selectedId);
    const transformable = selected && !selected.locked && selected.visible;

    useEffect(() => {
        const transformer = transformerRef.current;
        const node = transformable
            ? stageRef.current?.findOne(`#${selectedId}`)
            : undefined;

        transformer?.nodes(node ? [node] : []);
        transformer?.getLayer()?.batchDraw();
    }, [selectedId, transformable, document, fontsReady, stageRef]);

    return (
        <Stage
            ref={stageRef}
            width={canvas.width * zoom}
            height={canvas.height * zoom}
            scaleX={zoom}
            scaleY={zoom}
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
                    flipEnabled={false}
                    rotationSnaps={[0, 90, 180, 270]}
                    anchorStroke="#f97316"
                    borderStroke="#f97316"
                    anchorCornerRadius={3}
                    enabledAnchors={
                        selected?.type === 'text'
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
