/**
 * CARRIER VECTOR: 1988 - Responsive Panel Layout Solver
 *
 * The original deck screen placed every panel at hardcoded absolute pixel
 * coordinates (x = 50, 420, 800...). Below roughly 1250px of window width
 * the threat timeline ran clean off the right edge, and the scramble banner
 * at y=295 collided with the crew stamina list.
 *
 * This is a pure geometry solver: given the viewport and a list of panel
 * specs, it returns a rect for each panel. No canvas, no DOM - which makes
 * the "nothing is ever clipped or overlapping" property directly testable.
 *
 * VERTICAL FITTING (added after the first pass still failed in practice):
 * the solver only ever shrank row height, with a 0.7 floor, and then pinned
 * the bottom panel to the base of the viewport. That produced both failure
 * modes at once -
 *   - at 1440x900 the flow columns ended two thirds of the way down and the
 *     log sat alone at the bottom, with ~220px of dead screen between them;
 *   - at 900x620 the 0.7 floor was not enough, so the crew list, the payload
 *     rows and the whole log panel were simply drawn past the bottom edge.
 * It now shrinks, then DROPS the least important panels if shrinking is not
 * enough, then GROWS what is left to fill the height it actually has.
 */

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export type PanelPin = 'flow' | 'top' | 'bottom';

export interface PanelSpec {
    id: string;
    /** Minimum usable width in px (longest content line). */
    minW: number;
    /** Number of content rows, used to derive intrinsic height. */
    rows: number;
    /** If set, height is derived as w * aspect (square-ish instruments). */
    aspect?: number;
    pin?: PanelPin;
    /** Conditionally present panels (e.g. the scramble banner). */
    present?: boolean;
    /**
     * Drop order under vertical pressure: the LOWEST priority goes first.
     * Defaults to 5. Panels marked `essential` are never dropped.
     */
    priority?: number;
    essential?: boolean;
    /** Hard cap so a wide column can't inflate an instrument into a billboard. */
    maxH?: number;
    /** Minimum height, enforced after shrinking. */
    minH?: number;
}

export interface LayoutOptions {
    width: number;
    height: number;
    margin?: number;
    gutter?: number;
    headerH?: number;
    footerH?: number;
    rowH?: number;
    titleH?: number;
    padY?: number;
}

export interface LayoutResult {
    cols: number;
    content: Rect;
    header: Rect;
    footer: Rect;
    panels: Record<string, Rect>;
    /** Vertical compression applied to fit (<= 1). */
    rowScale: number;
    /** Vertical expansion applied to fill leftover space (>= 1). */
    growScale: number;
    /** Panels omitted because the viewport could not fit them. */
    dropped: string[];
}

const DEFAULTS = {
    margin: 24,
    gutter: 14,
    headerH: 56,
    footerH: 44,
    rowH: 19,
    titleH: 34,
    padY: 10
};

/** Shrink ladder, tried in order until the stack fits. */
const ROW_SCALES = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7];

/** Never let a grown panel become more than this much taller than intrinsic. */
const MAX_GROW = 1.55;

/** Breakpoints: how many columns the content area can support. */
export function columnsForWidth(contentWidth: number): number {
    if (contentWidth >= 1180) return 3;
    if (contentWidth >= 760) return 2;
    return 1;
}

interface Metrics {
    gutter: number;
    rowH: number;
    titleH: number;
    padY: number;
}

function intrinsicHeight(spec: PanelSpec, colW: number, rowScale: number, m: Metrics): number {
    const raw = spec.aspect !== undefined
        ? colW * spec.aspect * rowScale
        : m.titleH + spec.rows * m.rowH * rowScale + m.padY * 2;
    let h = raw;
    if (spec.maxH !== undefined) h = Math.min(h, spec.maxH * rowScale);
    if (spec.minH !== undefined) h = Math.max(h, spec.minH * rowScale);
    return Math.max(24, h);
}

/**
 * Greedy shortest-column packing. Deterministic: ties resolve to the
 * leftmost column, and specs are consumed in declaration order.
 */
function packFlow(
    specs: readonly PanelSpec[],
    cols: number,
    colW: number,
    contentX: number,
    startY: number,
    rowScale: number,
    m: Metrics
): { rects: Record<string, Rect>; colHeights: number[] } {
    const rects: Record<string, Rect> = {};
    const colHeights: number[] = new Array(cols).fill(startY);

    for (const spec of specs) {
        let shortest = 0;
        for (let c = 1; c < cols; c++) {
            if (colHeights[c] < colHeights[shortest] - 0.5) shortest = c;
        }
        const h = intrinsicHeight(spec, colW, rowScale, m);
        rects[spec.id] = {
            x: contentX + shortest * (colW + m.gutter),
            y: colHeights[shortest],
            w: colW,
            h
        };
        colHeights[shortest] += h + m.gutter;
    }

    return { rects, colHeights };
}

export function computeDeckLayout(specs: readonly PanelSpec[], opts: LayoutOptions): LayoutResult {
    const margin = opts.margin ?? DEFAULTS.margin;
    const m: Metrics = {
        gutter: opts.gutter ?? DEFAULTS.gutter,
        rowH: opts.rowH ?? DEFAULTS.rowH,
        titleH: opts.titleH ?? DEFAULTS.titleH,
        padY: opts.padY ?? DEFAULTS.padY
    };
    const headerH = opts.headerH ?? DEFAULTS.headerH;
    const footerH = opts.footerH ?? DEFAULTS.footerH;

    const W = Math.max(320, opts.width);
    const H = Math.max(240, opts.height);

    const header: Rect = { x: margin, y: margin, w: W - margin * 2, h: headerH };
    const footer: Rect = { x: margin, y: H - margin - footerH, w: W - margin * 2, h: footerH };
    const content: Rect = {
        x: margin,
        y: margin + headerH,
        w: W - margin * 2,
        h: Math.max(80, H - margin * 2 - headerH - footerH)
    };
    const contentBottom = content.y + content.h;

    const active = specs.filter(s => s.present !== false);

    // Choose the column count, then narrow it if any panel wouldn't fit.
    let cols = columnsForWidth(content.w);
    while (cols > 1) {
        const cw = (content.w - m.gutter * (cols - 1)) / cols;
        const widest = Math.max(
            ...active.filter(s => (s.pin ?? 'flow') === 'flow').map(s => s.minW),
            0
        );
        if (widest <= cw) break;
        cols--;
    }
    const colW = (content.w - m.gutter * (cols - 1)) / cols;

    const panels: Record<string, Rect> = {};

    // 1. Top-pinned panels claim full content width and stack downward.
    let topCursor = content.y;
    for (const spec of active) {
        if ((spec.pin ?? 'flow') !== 'top') continue;
        const h = intrinsicHeight({ ...spec, aspect: undefined }, content.w, 1, m);
        panels[spec.id] = { x: content.x, y: topCursor, w: content.w, h };
        topCursor += h + m.gutter;
    }

    // 2. Bottom-pinned panels reserve space at the base of the content area -
    //    unless doing so would starve the flow panels, in which case the
    //    least important of them is dropped instead of squeezing everything.
    const MIN_FLOW_H = 300;
    const bottomSpecs = active.filter(s => (s.pin ?? 'flow') === 'bottom');
    const dropped: string[] = [];
    let bottomHeights = bottomSpecs.map(s => intrinsicHeight({ ...s, aspect: undefined }, content.w, 1, m));
    let bottomReserved = bottomHeights.reduce((sum, h) => sum + h + m.gutter, 0);

    while (
        bottomSpecs.length > 0 &&
        contentBottom - topCursor - bottomReserved < MIN_FLOW_H
    ) {
        const victimIndex = bottomSpecs.reduce(
            (worst, s, i) => ((s.priority ?? 5) < (bottomSpecs[worst].priority ?? 5) && !s.essential ? i : worst),
            0
        );
        if (bottomSpecs[victimIndex].essential) break;
        dropped.push(bottomSpecs[victimIndex].id);
        bottomSpecs.splice(victimIndex, 1);
        bottomHeights = bottomSpecs.map(s => intrinsicHeight({ ...s, aspect: undefined }, content.w, 1, m));
        bottomReserved = bottomHeights.reduce((sum, h) => sum + h + m.gutter, 0);
    }

    /**
     * Space actually left for the flow panels, and the (larger) figure the
     * fit attempts are allowed to aim at.
     *
     * The floor matters: when a top-pinned panel has eaten most of a short
     * screen there may genuinely be forty pixels left, and pretending there
     * are sixty is how an essential panel ends up drawn past the bottom edge.
     * The attempts may aim at the optimistic figure; the final scale is
     * measured against the real one.
     */
    const realAvailable = Math.max(24, contentBottom - bottomReserved - topCursor);
    const available = Math.max(60, realAvailable);

    // 3. Fit the flow panels: shrink, then drop, then grow.
    const flowSpecs = active.filter(s => (s.pin ?? 'flow') === 'flow');
    let candidates = flowSpecs.slice();

    const usedHeight = (colHeights: number[]) =>
        Math.max(...colHeights, topCursor) - m.gutter - topCursor;

    let rowScale = ROW_SCALES[ROW_SCALES.length - 1];
    let packed = packFlow(candidates, cols, colW, content.x, topCursor, rowScale, m);

    for (;;) {
        let fitted = false;
        for (const scale of ROW_SCALES) {
            const attempt = packFlow(candidates, cols, colW, content.x, topCursor, scale, m);
            if (usedHeight(attempt.colHeights) <= available) {
                rowScale = scale;
                packed = attempt;
                fitted = true;
                break;
            }
        }
        if (fitted) break;

        // Still too tall at the smallest scale: shed the least important
        // panel that is allowed to go, rather than drawing it off-screen.
        const droppable = candidates
            .filter(s => !s.essential)
            .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));
        if (droppable.length === 0) {
            rowScale = ROW_SCALES[ROW_SCALES.length - 1];
            packed = packFlow(candidates, cols, colW, content.x, topCursor, rowScale, m);
            break;
        }
        const victim = droppable[0];
        dropped.push(victim.id);
        candidates = candidates.filter(s => s.id !== victim.id);
    }

    /**
     * 4. Scale to fit the space that is really there.
     *
     * Growing and squeezing are the same computation. This used to grow only
     * (`used < available`), which left the other case unhandled: an essential
     * panel - one the shedding loop above is not allowed to drop - stayed at
     * its intrinsic height and was simply drawn off the bottom of the screen.
     * A one-row turnaround panel on a 320 px phone overflowed its own content
     * box by fifty pixels that way.
     */
    const used = usedHeight(packed.colHeights);
    let growScale = 1;
    if (used > 0) {
        growScale = Math.min(MAX_GROW, realAvailable / used);
    }

    for (const [id, r] of Object.entries(packed.rects)) {
        panels[id] = growScale === 1
            ? r
            : {
                x: r.x,
                y: topCursor + (r.y - topCursor) * growScale,
                w: r.w,
                h: r.h * growScale
            };
    }

    // 5. Bottom-pinned panels sit directly under the tallest column, and
    //    absorb any remaining slack so there is never a floating gap.
    // Bottom panels start immediately under the tallest column rather than
    // being pinned to the base of the screen, and the last of them absorbs
    // whatever height is left - otherwise a capped grow factor leaves a
    // visible dead band floating between the columns and the log.
    let bottomCursor = Object.values(packed.rects).length
        ? topCursor + used * growScale + m.gutter
        : topCursor;
    bottomSpecs.forEach((spec, i) => {
        const isLast = i === bottomSpecs.length - 1;
        const natural = bottomHeights[i];
        // The last pinned panel soaks up the slack the grow cap left behind,
        // but only up to 1.6x its natural height - otherwise a tall window
        // turned the (usually near-empty) log into a 380px void.
        const h = isLast
            ? Math.min(natural * 1.6, Math.max(natural, contentBottom - bottomCursor))
            : natural;
        panels[spec.id] = { x: content.x, y: bottomCursor, w: content.w, h };
        bottomCursor += h + m.gutter;
    });

    return { cols, content, header, footer, panels, rowScale, growScale, dropped };
}
