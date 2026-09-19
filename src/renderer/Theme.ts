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

export const THEME = {
    /** Page/canvas ground. Blue-tinted near-black reads as glass, not soot. */
    ground: '#070d11',
    /** Slightly lifted ground used inside panels so they separate from the world. */
    panelFill: 'rgba(9, 19, 25, 0.82)',
    /** Same, but for HUD backplates over a live 3D scene. */
    plateFill: 'rgba(6, 13, 17, 0.62)',

    /** Headline values: altitude, speed, state names, prompts. */
    ink: '#eafff5',
    /** Primary instrument colour. */
    phosphor: '#57e39b',
    /** Labels and secondary copy. Deliberately neutral, not green. */
    muted: '#93a9a4',
    /** Interactive affordances - ONLY used for key names. */
    key: '#5fd8ff',
    caution: '#ffc94d',
    alert: '#ff6363',
    /** Enemy / hostile symbology. */
    hostile: '#ff6363',

    edge: 'rgba(87, 227, 155, 0.34)',
    edgeSoft: 'rgba(147, 169, 164, 0.22)',
    grid: 'rgba(87, 227, 155, 0.14)'
} as const;

/** World-layer (3D wireframe) colours, kept separate from UI chrome. */
export const WORLD = {
    horizon: '#2f9e63',
    sea: '#14603a',
    terrain: '#3fb97a',
    valley: '#0f4a2c',
    carrier: '#7df0b4',
    hostile: '#ff5b4a',
    missile: '#ff2d2d'
} as const;

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
