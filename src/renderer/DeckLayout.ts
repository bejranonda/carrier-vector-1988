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
    rowScale: number;
}

const DEFAULTS = {
    margin: 28,
    gutter: 18,
    headerH: 52,
    footerH: 34,
    rowH: 19,
    titleH: 24,
    padY: 10
};

/** Breakpoints: how many columns the content area can support. */
export function columnsForWidth(contentWidth: number): number {
    if (contentWidth >= 1180) return 3;
    if (contentWidth >= 760) return 2;
    return 1;
}

export function computeDeckLayout(specs: readonly PanelSpec[], opts: LayoutOptions): LayoutResult {
    const margin = opts.margin ?? DEFAULTS.margin;
    const gutter = opts.gutter ?? DEFAULTS.gutter;
    const headerH = opts.headerH ?? DEFAULTS.headerH;
    const footerH = opts.footerH ?? DEFAULTS.footerH;
    const rowH = opts.rowH ?? DEFAULTS.rowH;
    const titleH = opts.titleH ?? DEFAULTS.titleH;
    const padY = opts.padY ?? DEFAULTS.padY;

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

    const active = specs.filter(s => s.present !== false);

    // Choose the column count, then narrow it if any panel wouldn't fit.
    let cols = columnsForWidth(content.w);
    while (cols > 1) {
        const cw = (content.w - gutter * (cols - 1)) / cols;
        const widest = Math.max(...active.filter(s => (s.pin ?? 'flow') === 'flow').map(s => s.minW), 0);
        if (widest <= cw) break;
        cols--;
    }
    const colW = (content.w - gutter * (cols - 1)) / cols;

    const panels: Record<string, Rect> = {};

    // 1. Top-pinned panels claim full content width and stack downward.
    let topCursor = content.y;
    for (const spec of active) {
        if ((spec.pin ?? 'flow') !== 'top') continue;
        const h = titleH + spec.rows * rowH + padY * 2;
        panels[spec.id] = { x: content.x, y: topCursor, w: content.w, h };
        topCursor += h + gutter;
    }

    // 2. Bottom-pinned panels reserve space at the base of the content area.
    let bottomReserved = 0;
    const bottomSpecs = active.filter(s => (s.pin ?? 'flow') === 'bottom');
    for (const spec of bottomSpecs) {
        bottomReserved += titleH + spec.rows * rowH + padY * 2 + gutter;
    }

    // 3. Flow panels greedily fill the shortest column (deterministic:
    //    ties resolve to the leftmost column).
    const colHeights: number[] = new Array(cols).fill(topCursor);
    const flowSpecs = active.filter(s => (s.pin ?? 'flow') === 'flow');

    // Vertical pressure: shrink row height if the natural stack overflows.
    const availableH = content.y + content.h - bottomReserved - topCursor;
    const naturalH = flowSpecs.reduce((sum, s) => {
        const h = s.aspect ? colW * s.aspect : titleH + s.rows * rowH + padY * 2;
        return sum + h + gutter;
    }, 0) / Math.max(1, cols);
    const rowScale = naturalH > 0
        ? Math.max(0.7, Math.min(1.0, availableH / naturalH))
        : 1.0;

    for (const spec of flowSpecs) {
        let shortest = 0;
        for (let c = 1; c < cols; c++) {
            if (colHeights[c] < colHeights[shortest] - 0.5) shortest = c;
        }
        const x = content.x + shortest * (colW + gutter);
        const h = spec.aspect
            ? colW * spec.aspect
            : titleH + spec.rows * rowH * rowScale + padY * 2;

        panels[spec.id] = { x, y: colHeights[shortest], w: colW, h };
        colHeights[shortest] += h + gutter;
    }

    // 4. Bottom-pinned panels laid out under the tallest column.
    const tallest = Math.max(...colHeights, topCursor);
    let bottomCursor = Math.max(tallest, content.y + content.h - bottomReserved);
    for (const spec of bottomSpecs) {
        const h = titleH + spec.rows * rowH + padY * 2;
        panels[spec.id] = { x: content.x, y: bottomCursor, w: content.w, h };
        bottomCursor += h + gutter;
    }

    return { cols, content, header, footer, panels, rowScale };
}
