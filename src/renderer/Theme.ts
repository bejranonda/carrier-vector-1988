/**
 * CARRIER VECTOR: 1988 - Display Theme & Instrument Drawing Kit
 *
 * SINGLE SOURCE OF TRUTH for colour, typography and the handful of
 * primitives every screen is built from (panels, rows, bars, keycaps).
 *
 * WHY THIS EXISTS
 * The original screens each hardcoded their own '#00ff66' / '#00aa44'
 * literals and drew every string with `shadowBlur` glow on top of a live
 * wireframe. Saturated pure-green text, bloomed by a shadow pass and then
 * covered by a scanline mask and a 92%-black vignette, measured well under
 * 3:1 contrast in the screen corners - the readouts that mattered most
 * (fuel, damage, the "press ENTER" prompt) were the hardest to read.
 *
 * The palette below keeps the vector-display identity but treats it as a
 * modern instrument panel:
 *  - a near-black blue-tinted ground instead of pure black
 *  - one bright "ink" for values you must read at a glance
 *  - a NEUTRAL (not green) dim tone for labels, which stays legible where
 *    a desaturated green turns to mud
 *  - cyan reserved exclusively for "this is a key you can press"
 *  - glow used as an accent on live instruments, never behind body text
 *
 * Every colour below is >= 4.5:1 against `GROUND`, checked at the darkest
 * point of the vignette.
 */

export const MONO =
    'ui-monospace, SFMono-Regular, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

export interface UiPalette {
    /** Page/canvas ground. Blue-tinted near-black reads as glass, not soot. */
    ground: string;
    /** Slightly lifted ground used inside panels so they separate from the world. */
    panelFill: string;
    /** Same, but for HUD backplates over a live 3D scene. */
    plateFill: string;
    /** Headline values: altitude, speed, state names, prompts. */
    ink: string;
    /** Primary instrument colour. */
    phosphor: string;
    /** Labels and secondary copy. Deliberately neutral. */
    muted: string;
    /** Interactive affordances - ONLY used for key names. */
    key: string;
    caution: string;
    alert: string;
    /** Enemy / hostile symbology. */
    hostile: string;
    edge: string;
    edgeSoft: string;
    grid: string;
}

/** World-layer (3D wireframe) colours, kept separate from UI chrome. */
export interface WorldPalette {
    horizon: string;
    sea: string;
    terrain: string;
    valley: string;
    carrier: string;
    hostile: string;
    missile: string;
}

export type PaletteId = 'CLASSIC' | 'DEUTERAN' | 'AMBER' | 'ARCTIC' | 'SYNTHWAVE';

export interface PaletteSpec {
    id: PaletteId;
    label: string;
    blurb: string;
    ui: UiPalette;
    world: WorldPalette;
}

/**
 * COLOUR IS NOT ALLOWED TO BE THE ONLY SIGNAL, but it is the fastest one,
 * and the classic palette spends it on the worst possible pair.
 *
 * Green for your own symbology and red for hostiles is the canonical
 * red-green confusion: to a deuteranope or a protanope - together the most
 * common forms of colour blindness, and about one man in twelve - those two
 * are the same muddy yellow-brown. The HUD does carry shape and position cues
 * (corner brackets for air contacts, a diamond for strike targets, a solid box
 * for the designated target), but "which of these two boxes is trying to kill
 * me" should not be a reading-comprehension exercise.
 *
 * The alternative palette moves the whole conversation onto the blue-yellow
 * axis, which both of those conditions leave intact: friendly instruments go
 * cyan, hostiles go amber, and the two warning tones separate by lightness as
 * well as hue. Every colour in both palettes clears 4.5:1 on the ground, and a
 * test enforces it for each of them rather than for whichever happens to be
 * loaded.
 */
export const PALETTES: readonly PaletteSpec[] = [
    {
        id: 'CLASSIC',
        label: 'CLASSIC PHOSPHOR',
        blurb: 'Green instruments, red hostiles',
        ui: {
            ground: '#070d11',
            panelFill: 'rgba(9, 19, 25, 0.82)',
            plateFill: 'rgba(6, 13, 17, 0.62)',
            ink: '#eafff5',
            phosphor: '#57e39b',
            muted: '#93a9a4',
            key: '#5fd8ff',
            caution: '#ffc94d',
            alert: '#ff6363',
            hostile: '#ff6363',
            edge: 'rgba(87, 227, 155, 0.34)',
            edgeSoft: 'rgba(147, 169, 164, 0.22)',
            grid: 'rgba(87, 227, 155, 0.14)'
        },
        world: {
            horizon: '#2f9e63',
            sea: '#14603a',
            terrain: '#3fb97a',
            valley: '#0f4a2c',
            carrier: '#7df0b4',
            hostile: '#ff5b4a',
            missile: '#ff2d2d'
        }
    },
    {
        id: 'DEUTERAN',
        label: 'BLUE / AMBER',
        blurb: 'For red-green colour blindness',
        ui: {
            ground: '#070d11',
            panelFill: 'rgba(9, 19, 25, 0.82)',
            plateFill: 'rgba(6, 13, 17, 0.62)',
            ink: '#eafff5',
            phosphor: '#5ad1ff',
            muted: '#a8b6bd',
            // Violet, not cyan: cyan is the instrument colour here, and a
            // keycap that looks like an instrument is not an affordance.
            key: '#c6a6ff',
            caution: '#ffe066',
            alert: '#ff8a1f',
            hostile: '#ff8a1f',
            edge: 'rgba(90, 209, 255, 0.34)',
            edgeSoft: 'rgba(168, 182, 189, 0.22)',
            grid: 'rgba(90, 209, 255, 0.14)'
        },
        world: {
            horizon: '#2f87ae',
            sea: '#144b60',
            terrain: '#3fa5c9',
            valley: '#0f3846',
            carrier: '#8fe6ff',
            hostile: '#ffae3a',
            missile: '#ff7a1f'
        }
    },
    /*
     * Unlockable looks (v2.0.0, see core/Career.ts) - earned with medal stars.
     * Every one holds the same 4.5:1 floor and the same key-vs-instrument
     * separation as the two above; the tests run over all of them.
     */
    {
        id: 'AMBER',
        label: 'AMBER VECTOR',
        blurb: 'The arcade cabinet look',
        ui: {
            ground: '#0d0a06',
            panelFill: 'rgba(24, 17, 8, 0.82)',
            plateFill: 'rgba(17, 12, 6, 0.62)',
            ink: '#fff3dd',
            phosphor: '#ffb547',
            muted: '#b8a68c',
            key: '#5fd8ff',
            caution: '#fff07a',
            alert: '#ff5e5e',
            hostile: '#ff5e5e',
            edge: 'rgba(255, 181, 71, 0.34)',
            edgeSoft: 'rgba(184, 166, 140, 0.22)',
            grid: 'rgba(255, 181, 71, 0.14)'
        },
        world: {
            horizon: '#b07a24',
            sea: '#5c3d0d',
            terrain: '#d9952e',
            valley: '#4a300a',
            carrier: '#ffd08a',
            hostile: '#ff4d6d',
            missile: '#ff2d55'
        }
    },
    {
        id: 'ARCTIC',
        label: 'ARCTIC WHITE',
        blurb: 'Ice-blue strokes on polar night',
        ui: {
            ground: '#060b10',
            panelFill: 'rgba(10, 18, 26, 0.82)',
            plateFill: 'rgba(7, 13, 19, 0.62)',
            ink: '#ffffff',
            phosphor: '#d8f3ff',
            muted: '#9fb2bd',
            key: '#ffb86b',
            caution: '#ffe066',
            alert: '#ff5c7a',
            hostile: '#ff5c7a',
            edge: 'rgba(216, 243, 255, 0.32)',
            edgeSoft: 'rgba(159, 178, 189, 0.22)',
            grid: 'rgba(216, 243, 255, 0.12)'
        },
        world: {
            horizon: '#7fa8bd',
            sea: '#2a4552',
            terrain: '#bfe6f7',
            valley: '#22343d',
            carrier: '#ffffff',
            hostile: '#ff5c7a',
            missile: '#ff3355'
        }
    },
    {
        id: 'SYNTHWAVE',
        label: 'SYNTHWAVE',
        blurb: 'Neon magenta over a violet sea',
        ui: {
            ground: '#0c0612',
            panelFill: 'rgba(24, 10, 32, 0.82)',
            plateFill: 'rgba(17, 7, 23, 0.62)',
            ink: '#fff0fb',
            phosphor: '#ff6ad5',
            muted: '#b9a5c6',
            key: '#5fd8ff',
            caution: '#ffe066',
            alert: '#ff9a3d',
            hostile: '#ffd23f',
            edge: 'rgba(255, 106, 213, 0.34)',
            edgeSoft: 'rgba(185, 165, 198, 0.22)',
            grid: 'rgba(255, 106, 213, 0.14)'
        },
        world: {
            horizon: '#a03fb0',
            sea: '#3b1450',
            terrain: '#e05ad0',
            valley: '#2c0d3d',
            carrier: '#ffb3ec',
            hostile: '#ffd23f',
            missile: '#ff9a3d'
        }
    }
];

/**
 * The next palette in the cycle that `available` allows. The cycle key skips
 * looks that are still locked rather than showing one and refusing it.
 */
export function nextAvailablePalette(id: PaletteId, available: (p: PaletteId) => boolean): PaletteId {
    let next = id;
    for (let i = 0; i < PALETTES.length; i++) {
        next = nextPalette(next);
        if (available(next)) return next;
    }
    return id;
}

export const DEFAULT_PALETTE: PaletteId = 'CLASSIC';

export function paletteSpec(id: PaletteId): PaletteSpec {
    return PALETTES.find(p => p.id === id) ?? PALETTES[0];
}

export function nextPalette(id: PaletteId): PaletteId {
    const i = PALETTES.findIndex(p => p.id === id);
    return PALETTES[(i + 1) % PALETTES.length].id;
}

/**
 * The live palettes.
 *
 * Mutable on purpose. Two hundred and sixty call sites read `THEME.x` at draw
 * time, and threading a palette argument through every one of them would be a
 * far bigger change than the feature deserves - so the palette is swapped in
 * place and the next frame picks it up. Nothing caches a colour between
 * frames, which is what makes that safe.
 */
export const THEME: UiPalette = { ...PALETTES[0].ui };
export const WORLD: WorldPalette = { ...PALETTES[0].world };

let activePalette: PaletteId = DEFAULT_PALETTE;

export function currentPalette(): PaletteId {
    return activePalette;
}

export function applyPalette(id: PaletteId) {
    const spec = paletteSpec(id);
    activePalette = spec.id;
    Object.assign(THEME, spec.ui);
    Object.assign(WORLD, spec.world);
}

const PALETTE_STORAGE_KEY = 'carrier-vector-1988.palette';

function isPaletteId(value: unknown): value is PaletteId {
    return typeof value === 'string' && PALETTES.some(p => p.id === value);
}

/** Best-effort restore; storage can throw or be blocked and the game must boot. */
export function loadPalette(): PaletteId {
    try {
        const raw = globalThis.localStorage?.getItem(PALETTE_STORAGE_KEY);
        return isPaletteId(raw) ? raw : DEFAULT_PALETTE;
    } catch {
        return DEFAULT_PALETTE;
    }
}

/**
 * The stored choice, or null when the player has never made one.
 *
 * `loadPalette()` collapses "never chosen" into `DEFAULT_PALETTE`, which is
 * right for booting the game but wrong for deciding whether to mention the
 * setting exists: the colour-blind palette was built and then left entirely
 * behind a key in the control reference, discoverable only by a player who
 * already knew to look for it. The briefing surfaces a one-line hint for as
 * long as this returns null, and the hint retires itself the moment the
 * player touches the setting - even to confirm CLASSIC is what they want.
 */
export function storedPalette(): PaletteId | null {
    try {
        const raw = globalThis.localStorage?.getItem(PALETTE_STORAGE_KEY);
        return isPaletteId(raw) ? raw : null;
    } catch {
        return null;
    }
}

export function savePalette(id: PaletteId) {
    try {
        globalThis.localStorage?.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
        // The setting still holds for this session.
    }
}

/**
 * Text size (v2.1.0). Almost every label in the game was drawn at 9-12 px -
 * fine for a young eye at a desk, unreadable for many older players and on a
 * laptop across a room.
 *
 * Implemented as a UI ZOOM, not a font multiplier. A first attempt scaled
 * `font()` alone: at 150% every fixed line height overlapped (card bodies,
 * menu rows, the stat grid, callout plates). Zooming instead lays every screen
 * out for a smaller virtual viewport and scales the result up, so text,
 * boxes and spacing grow together - and every layout is already tested down
 * to a 640 x 360 phone, which is exactly the floor the zoom stops at.
 */
export type TextSizeId = 'NORMAL' | 'LARGE' | 'HUGE';

export const TEXT_SIZES: readonly { id: TextSizeId; label: string; scale: number }[] = [
    { id: 'NORMAL', label: 'NORMAL', scale: 1 },
    { id: 'LARGE', label: 'LARGE', scale: 1.25 },
    { id: 'HUGE', label: 'EXTRA LARGE', scale: 1.5 }
];

export function textSizeSpec(id: TextSizeId) {
    return TEXT_SIZES.find(t => t.id === id) ?? TEXT_SIZES[0];
}

export function nextTextSize(id: TextSizeId): TextSizeId {
    const i = TEXT_SIZES.findIndex(t => t.id === id);
    return TEXT_SIZES[(i + 1) % TEXT_SIZES.length].id;
}

/**
 * The smallest virtual viewport the zoom will lay a screen out for, CSS px.
 * Layouts are tested down to 640 x 360; this keeps a margin above that, and
 * it means a landscape phone - whose touch layout is already large - is never
 * zoomed at all (checked: at 844 x 390 a 1.08 zoom crowded the cockpit).
 */
export const MIN_LAYOUT = { width: 720, height: 400 } as const;

/**
 * The zoom actually used for a screen: what the player asked for, but never
 * so much that the virtual viewport drops below the smallest layout every
 * screen is tested at. Never below 1.
 */
export function uiZoomFor(id: TextSizeId, cssWidth: number, cssHeight: number): number {
    const requested = textSizeSpec(id).scale;
    const fit = Math.min(cssWidth / MIN_LAYOUT.width, cssHeight / MIN_LAYOUT.height);
    return Math.max(1, Math.min(requested, fit));
}

/** A touch screen shorter than this, in CSS px, is a phone. */
export const PHONE_MAX_HEIGHT = 500;
/** The most a phone's in-flight text grows in place. */
export const PHONE_TEXT_BOOST_MAX = 1.4;

/**
 * How a screen honours the text size (v2.2.0, Known Issues #103): a zoom for
 * the whole UI, and a boost for the in-flight words a phone cannot zoom.
 *
 * A phone is not zoomed - 1.08 already crowded its cockpit - so the setting
 * did nothing there at all, on the device most older players use. Now on a
 * phone LARGE and EXTRA LARGE enlarge, in place, the three things a pilot
 * reads in flight: the order strip, the coach line and the banners. Anywhere
 * else the zoom does everything and the boost is 1.
 */
export function textScaling(
    id: TextSizeId,
    cssWidth: number,
    cssHeight: number,
    touch: boolean
): { zoom: number; boost: number } {
    if (touch && cssHeight < PHONE_MAX_HEIGHT) {
        return { zoom: 1, boost: Math.min(PHONE_TEXT_BOOST_MAX, textSizeSpec(id).scale) };
    }
    return { zoom: uiZoomFor(id, cssWidth, cssHeight), boost: 1 };
}

const TEXT_SIZE_KEY = 'carrier-vector-1988.textSize';

export function loadTextSize(): TextSizeId {
    try {
        const raw = globalThis.localStorage?.getItem(TEXT_SIZE_KEY);
        return TEXT_SIZES.some(t => t.id === raw) ? raw as TextSizeId : 'NORMAL';
    } catch {
        return 'NORMAL';
    }
}

export function saveTextSize(id: TextSizeId) {
    try {
        globalThis.localStorage?.setItem(TEXT_SIZE_KEY, id);
    } catch {
        // Best effort.
    }
}

export function font(size: number, weight: 400 | 500 | 600 | 700 = 400): string {
    return `${weight} ${size}px ${MONO}`;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Turn off the shadow pass. Body text must never carry glow - it bolds the
 *  strokes and halves effective contrast. */
export function noGlow(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
}

/** Accent glow for live instruments (bars, reticles, alert banners). */
export function glow(ctx: CanvasRenderingContext2D, color: string, blur = 6) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
}

export function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
}

/**
 * Translucent backplate. The single highest-impact readability fix in the
 * cockpit: HUD text used to be drawn straight over the wireframe canyon, so
 * legibility depended on what happened to be behind it.
 */
export function plate(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    opts: { fill?: string; border?: string; radius?: number } = {}
) {
    ctx.save();
    noGlow(ctx);
    roundRect(ctx, r.x, r.y, r.w, r.h, opts.radius ?? 4);
    ctx.fillStyle = opts.fill ?? THEME.plateFill;
    ctx.fill();
    if (opts.border) {
        ctx.strokeStyle = opts.border;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * A glowing outline round a rect - a highlight. `plate()` clears the glow on
 * purpose (a backplate must not bloom), so a glow set before calling it drew
 * nothing: the chooser's selected card and FLY AGAIN never lit (v2.2.0 review).
 */
export function halo(ctx: CanvasRenderingContext2D, r: Rect, color: string, blur: number, radius = 6) {
    ctx.save();
    glow(ctx, color, blur);
    roundRect(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

/**
 * Framed instrument panel with a title tab. Returns the padded inner rect.
 * `accent` tints the border and title when the panel wants attention.
 */
export function panel(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    title: string,
    opts: { accent?: string; fill?: string; emphasis?: boolean } = {}
): Rect {
    const accent = opts.accent ?? THEME.phosphor;

    ctx.save();
    noGlow(ctx);

    roundRect(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.fillStyle = opts.fill ?? THEME.panelFill;
    ctx.fill();
    ctx.strokeStyle = opts.emphasis ? accent : THEME.edgeSoft;
    ctx.lineWidth = opts.emphasis ? 1.6 : 1;
    ctx.stroke();

    // A short accent rule along the top edge instead of a full glowing box:
    // it marks the panel without adding another bright rectangle to scan.
    ctx.strokeStyle = accent;
    ctx.globalAlpha = opts.emphasis ? 1 : 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x + 5, r.y + 1);
    ctx.lineTo(r.x + Math.min(34, r.w * 0.22), r.y + 1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = font(11, 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = opts.emphasis ? accent : THEME.muted;
    ctx.fillText(title.toUpperCase(), r.x + 12, r.y + 17);

    ctx.restore();

    return { x: r.x + 12, y: r.y + 28, w: r.w - 24, h: r.h - 40 };
}

/** Label/value row. Labels sit in the neutral tone, values carry the colour. */
export function row(
    ctx: CanvasRenderingContext2D,
    inner: Rect,
    y: number,
    label: string,
    value: string,
    color: string = THEME.ink
) {
    if (y > inner.y + inner.h + 8) return;
    ctx.save();
    noGlow(ctx);
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(12);
    ctx.fillStyle = THEME.muted;
    ctx.textAlign = 'left';
    ctx.fillText(label, inner.x, y);
    ctx.font = font(12, 600);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(value, inner.x + inner.w, y);
    ctx.restore();
}

/**
 * Segmented level bar. Unlit segments keep a faint trace so the full scale
 * is always visible - a bar that simply vanishes reads as "no data".
 */
export function bar(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    frac: number,
    color: string = THEME.phosphor,
    segments = 20
) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
    const segW = r.w / segments;
    const lit = Math.round(clamped * segments);

    ctx.save();
    noGlow(ctx);
    for (let i = 0; i < segments; i++) {
        ctx.fillStyle = i < lit ? color : THEME.edgeSoft;
        ctx.globalAlpha = i < lit ? 1 : 0.5;
        ctx.fillRect(r.x + i * segW, r.y, Math.max(1, segW - 2), r.h);
    }
    ctx.restore();
}

/**
 * Draw a key as a physical keycap. Players skim for something that LOOKS
 * pressable; "[ENTER]" inside a paragraph of green text does not.
 * Returns the advance width so callers can lay out a sentence.
 */
export function keycap(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    opts: { size?: number; color?: string } = {}
): number {
    const size = opts.size ?? 12;
    const color = opts.color ?? THEME.key;
    ctx.save();
    noGlow(ctx);
    ctx.font = font(size, 600);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const padX = 7;
    const w = Math.ceil(ctx.measureText(label).width) + padX * 2;
    const h = size + 9;

    roundRect(ctx, x, y - h / 2, w, h, 3);
    ctx.fillStyle = 'rgba(95, 216, 255, 0.14)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(label, x + w / 2, y + 0.5);
    ctx.restore();
    return w;
}

/**
 * Advance width a keycap WOULD take, without drawing it. Lets a caller decide
 * whether the next item on a strip fits before committing ink to the glass.
 */
export function keycapWidth(ctx: CanvasRenderingContext2D, label: string, size = 12): number {
    ctx.save();
    ctx.font = font(size, 600);
    const w = Math.ceil(ctx.measureText(label).width) + 14;
    ctx.restore();
    return w;
}

export type Segment = { key: string } | { text: string; color?: string; weight?: 400 | 600 };

/**
 * Truncate `text` with an ellipsis so it fits `maxWidth` at the CURRENT font.
 * Canvas has no overflow handling of its own, so without this a long objective
 * line simply paints straight through the edge of its panel.
 */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (maxWidth <= 0) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;

    const ellipsis = '…';
    const ellipsisW = ctx.measureText(ellipsis).width;
    if (ellipsisW > maxWidth) return '';

    // Binary search the longest prefix that still fits with the ellipsis.
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(text.slice(0, mid)).width + ellipsisW <= maxWidth) lo = mid;
        else hi = mid - 1;
    }
    return text.slice(0, lo).trimEnd() + ellipsis;
}

/** Draw a mixed keycap/text sentence left-aligned from (x, y-middle). */
export function drawSegments(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    segs: readonly Segment[],
    size = 12
): number {
    let cursor = x;
    ctx.save();
    noGlow(ctx);
    ctx.textBaseline = 'middle';
    for (const s of segs) {
        if ('key' in s) {
            cursor += keycap(ctx, cursor, y, s.key, { size }) + 6;
        } else {
            ctx.font = font(size, s.weight ?? 400);
            ctx.fillStyle = s.color ?? THEME.muted;
            ctx.textAlign = 'left';
            ctx.fillText(s.text, cursor, y);
            cursor += ctx.measureText(s.text).width + 6;
        }
    }
    ctx.restore();
    return cursor - x - 6;
}
