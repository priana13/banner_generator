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

export type FontStyle = 'normal' | '600' | 'bold' | '800';

export type TextSpan = { text: string; fill: string };

type FontProps = {
    text: string;
    fontFamily: string;
    fontSize: number;
    /** Regular, SemiBold, Bold or ExtraBold. */
    fontStyle: FontStyle;
};

export type TextElement = BaseElement &
    FontProps & {
        type: 'text';
        align: 'left' | 'center' | 'right';
        fill: string;
        /**
         * Optional per-fragment colors. When present, `text` is the
         * fragments joined with spaces.
         */
        spans?: TextSpan[];
    };

export type ButtonElement = BaseElement &
    FontProps & {
        type: 'button';
        fill: string;
        textColor: string;
        cornerRadius: number;
    };

/**
 * A transparency gradient: fading out towards one side (`linear`), or
 * feathered along all edges (`edges`). `amount` is the share of the element
 * the gradient covers, 0–1.
 */
export type ElementFade =
    | { type: 'linear'; direction: FadeDirection; amount: number }
    | { type: 'edges'; amount: number };

export type FadeDirection = 'left' | 'right' | 'top' | 'bottom';

export type RectElement = BaseElement & {
    type: 'rect';
    fade?: ElementFade;
    fill: string;
    cornerRadius: number;
};

export type CircleElement = BaseElement & {
    type: 'circle';
    fade?: ElementFade;
    fill: string;
};

export type ImageElement = BaseElement & {
    type: 'image';
    fade?: ElementFade;
    assetId: string;
};

/** A built-in decorative vector (see lib/ornaments.ts). */
export type OrnamentElement = BaseElement & {
    type: 'ornament';
    fade?: ElementFade;
    ornamentId: string;
    fill: string;
};

export type FadableElement =
    | RectElement
    | CircleElement
    | ImageElement
    | OrnamentElement;

export type DesignElement =
    | OrnamentElement
    | TextElement
    | ButtonElement
    | RectElement
    | CircleElement
    | ImageElement;

/** Every property any element type may carry, for generic patches. */
export type ElementPatch = Partial<
    Omit<TextElement, 'id' | 'type'> &
        Omit<ButtonElement, 'id' | 'type'> &
        Omit<RectElement, 'id' | 'type'> &
        Omit<ImageElement, 'id' | 'type'>
> & { spans?: TextSpan[] | undefined; fade?: ElementFade | undefined };

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
    kind: 'upload' | 'logo' | 'cutout' | 'generated' | 'ornament';
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
    project: {
        id: number;
        title: string;
        status: ProjectStatus;
        category_id: number | null;
    };
    document: DesignDocument;
    version: number;
    assets: EditorAsset[];
    job: GenerationJob | null;
    brief: {
        prompt: string;
        primary_color: string | null;
        style: BannerStyle | null;
        design_style: string | null;
    } | null;
};

export type DesignStyle = {
    id: number | null;
    key: string;
    builtin: boolean;
    name: string;
    description: string;
    text_instructions: string;
    image_instructions: string;
    font: string | null;
    ornaments: string[];
};

export type BannerStyle = 'cutout' | 'panel';

/** An image in the user's personal ornament library. */
export type UserOrnament = {
    id: string;
    name: string;
    url: string;
    width: number;
    height: number;
};

export type PromptPreset = {
    id: number;
    name: string;
    prompt: string;
    primary_color: string | null;
    style: BannerStyle | null;
    design_style: string | null;
    builder?: {
        concept?: string | null;
        audience?: string | null;
        headline?: string | null;
        cta?: string | null;
        visual?: string | null;
        theme_id?: string | null;
        layout?: 'left' | 'right' | null;
        include_text?: boolean;
    } | null;
};

export type ProjectCategory = {
    id: number;
    name: string;
    projects_count?: number;
};

export type ProjectSummary = {
    category_id: number | null;
    category_name: string | null;
    id: number;
    title: string;
    status: ProjectStatus;
    canvas_width: number;
    canvas_height: number;
    updated_at: string | null;
    document: DesignDocument | null;
    assets: EditorAsset[];
};

export type LibraryImage = {
    id: string;
    name: string;
    kind: 'upload' | 'logo' | 'cutout';
    url: string;
    width: number;
    height: number;
    bytes: number;
    created_at: string | null;
};
