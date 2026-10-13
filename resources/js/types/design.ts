type BaseElement = {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    visible: boolean;
    locked: boolean;
};

type FontProps = {
    text: string;
    fontFamily: string;
    fontSize: number;
    fontStyle: 'normal' | 'bold';
};

export type TextElement = BaseElement &
    FontProps & {
        type: 'text';
        align: 'left' | 'center' | 'right';
        fill: string;
    };

export type ButtonElement = BaseElement &
    FontProps & {
        type: 'button';
        fill: string;
        textColor: string;
        cornerRadius: number;
    };

export type RectElement = BaseElement & {
    type: 'rect';
    fill: string;
    cornerRadius: number;
};

export type CircleElement = BaseElement & {
    type: 'circle';
    fill: string;
};

export type ImageElement = BaseElement & {
    type: 'image';
    assetId: string;
};

export type DesignElement =
    | TextElement
    | ButtonElement
    | RectElement
    | CircleElement
    | ImageElement;

/** Every property any element type may carry, for generic patches. */
export type ElementPatch = Partial<
    Omit<TextElement, 'id' | 'type'> &
        Omit<ButtonElement, 'id' | 'type'> &
        Omit<RectElement, 'id' | 'type'>
>;

export type DesignCanvas = {
    width: number;
    height: number;
    backgroundColor: string;
};

/** The design document contract (schemaVersion 1). Z-order is array order. */
export type DesignDocument = {
    schemaVersion: 1;
    canvas: DesignCanvas;
    elements: DesignElement[];
};

export type EditorAsset = {
    id: string;
    kind: 'upload' | 'logo' | 'generated';
    url: string;
    width: number;
    height: number;
    name: string | null;
};

export type GenerationJob = {
    id: number;
    project_id: number;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    error_message: string | null;
    provider: string;
    attempts: number;
    finished_at: string | null;
};

export type ProjectStatus = 'draft' | 'generating' | 'ready' | 'failed';

export type EditorPayload = {
    project: { id: number; title: string; status: ProjectStatus };
    document: DesignDocument;
    version: number;
    assets: EditorAsset[];
    job: GenerationJob | null;
};

export type ProjectSummary = {
    id: number;
    title: string;
    status: ProjectStatus;
    canvas_width: number;
    canvas_height: number;
    updated_at: string | null;
    document: DesignDocument | null;
    assets: EditorAsset[];
};
