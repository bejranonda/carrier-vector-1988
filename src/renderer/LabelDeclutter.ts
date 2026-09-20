/**
 * CARRIER VECTOR: 1988 - HUD Label Declutter
 *
 * Three MiG-23s in a loose trail print three range tags within forty pixels
 * of each other, and the result is not three labels but one smear - over the
 * top of whichever instrument happens to be behind them. Screenshots of a
 * busy intercept showed "MIG-23 1.1KM", "MIG-23 3.5KM" and "MIG-23 2.1KM"
 * overlapping each other and the altitude block, which is worse than no
 * labels at all: a player cannot read any of the three, and the instrument
 * they were covering was the one that mattered.
 *
 * This decides which tags earn their place. Greedy by priority - nearest
 * first, because the nearest contact is the one about to matter - rejecting
 * any tag that would collide with one already placed or with an instrument,
 * and flipping a tag to the other side of its bracket rather than letting it
 * run off the edge of the screen.
 *
 * Pure geometry, no canvas, so "labels never overlap" is a test rather than
 * an intention.
 */

export interface LabelBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface LabelCandidate {
    id: string;
    /** Anchor point: the contact's position on screen. */
    x: number;
    y: number;
    /** Size of the drawn tag. */
    w: number;
    h: number;
    /** Lower sorts first. Range in metres works well. */
    priority: number;
    /** Horizontal offset from the anchor to the tag's near edge. */
    offset: number;
}

export interface PlacedLabel {
    id: string;
    /** Where to draw the tag's left edge. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Which side of the anchor it ended up on. */
    side: LabelSide;
}

export type LabelSide = 'RIGHT' | 'LEFT' | 'ABOVE' | 'BELOW';

export interface DeclutterOptions {
    viewportW: number;
    viewportH: number;
    /** Hard cap on drawn tags, whatever fits. */
    maxVisible?: number;
    /** Instrument panels and other regions a tag must not cover. */
    avoid?: readonly LabelBox[];
    /** Extra clearance required between two tags. */
    padding?: number;
}

const overlaps = (a: LabelBox, b: LabelBox, pad = 0) =>
    a.x - pad < b.x + b.w && b.x < a.x + a.w + pad &&
    a.y - pad < b.y + b.h && b.y < a.y + a.h + pad;

/**
 * Choose and place the tags worth drawing.
 *
 * Returns them in draw order. A candidate that cannot be placed anywhere is
 * simply dropped - the bracket is still drawn, so the contact never
 * disappears, it just stops shouting its range.
 */
export function placeLabels(
    candidates: readonly LabelCandidate[],
    options: DeclutterOptions
): PlacedLabel[] {
    const { viewportW, viewportH, avoid = [], padding = 4 } = options;
    const maxVisible = options.maxVisible ?? 4;

    const ordered = [...candidates].sort((a, b) =>
        a.priority - b.priority || (a.id < b.id ? -1 : 1));

    const placed: PlacedLabel[] = [];
    const taken: LabelBox[] = [...avoid];

    for (const c of ordered) {
        if (placed.length >= maxVisible) break;
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;

        const level = c.y - c.h / 2;
        /**
         * Four places to try, in order of how well they read: beside the
         * bracket first, then above or below it.
         *
         * Left and right alone were not enough. On a phone the contacts in a
         * head-on merge cluster around the boresight, where both sides are
         * blocked by the systems line - so every tag was rejected and the
         * player got no range at all. A tag above the bracket is slightly
         * harder to associate with it and enormously better than nothing.
         */
        const seats: [number, number, LabelSide][] = [
            [c.x + c.offset, level, 'RIGHT'],
            [c.x - c.offset - c.w, level, 'LEFT'],
            [c.x - c.w / 2, c.y - c.offset - c.h, 'ABOVE'],
            [c.x - c.w / 2, c.y + c.offset, 'BELOW']
        ];

        for (const [x, y, side] of seats) {
            const box: LabelBox = { x, y, w: c.w, h: c.h };
            if (x < 0 || x + c.w > viewportW) continue;
            if (y < 0 || y + c.h > viewportH) continue;
            if (taken.some(t => overlaps(box, t, padding))) continue;

            placed.push({ id: c.id, x, y, w: c.w, h: c.h, side });
            taken.push(box);
            break;
        }
    }

    return placed;
}
