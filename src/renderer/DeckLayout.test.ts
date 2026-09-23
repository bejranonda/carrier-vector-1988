import { describe, it, expect } from 'vitest';
import { computeDeckLayout, columnsForWidth, type PanelSpec, type Rect } from './DeckLayout';
import { deckPanelSpecs } from './DeckView';

/** The real deck screen panel set. */
const SPECS: PanelSpec[] = [
    { id: 'SCRAMBLE', minW: 420, rows: 1, pin: 'top', present: false },
    { id: 'STATUS', minW: 300, rows: 6 },
    { id: 'TURNAROUND', minW: 300, rows: 4 },
    { id: 'CREW', minW: 300, rows: 4 },
    { id: 'PAYLOAD', minW: 300, rows: 3 },
    { id: 'THREATS', minW: 320, rows: 6 },
    { id: 'DECK_PLAN', minW: 260, rows: 0, aspect: 0.75 },
    { id: 'LOG', minW: 400, rows: 6, pin: 'bottom' }
];

/** The same set with the priorities the real screen declares. */
const RANKED: PanelSpec[] = [
    { id: 'ORDERS', minW: 420, rows: 2, pin: 'top', essential: true },
    { id: 'TURNAROUND', minW: 300, rows: 7, priority: 9, essential: true },
    { id: 'PAYLOAD', minW: 300, rows: 5, priority: 8 },
    { id: 'THREATS', minW: 300, rows: 7, priority: 7, minH: 190 },
    { id: 'STATUS', minW: 300, rows: 7, priority: 6 },
    { id: 'CREW', minW: 290, rows: 5, priority: 3 },
    { id: 'DECK_PLAN', minW: 280, rows: 0, aspect: 0.34, priority: 2, maxH: 190, minH: 120 },
    { id: 'LOG', minW: 400, rows: 5, pin: 'bottom', priority: 4 }
];

function overlaps(a: Rect, b: Rect): boolean {
    return !(a.x + a.w <= b.x + 0.01 ||
             b.x + b.w <= a.x + 0.01 ||
             a.y + a.h <= b.y + 0.01 ||
             b.y + b.h <= a.y + 0.01);
}

const WIDTHS = [800, 1000, 1024, 1280, 1600, 1920, 2560];
const HEIGHTS = [600, 720, 900, 1080];

describe('computeDeckLayout', () => {
    it('never places any panel outside the viewport, at any tested size', () => {
        for (const width of WIDTHS) {
            for (const height of HEIGHTS) {
                const layout = computeDeckLayout(SPECS, { width, height });
                for (const [id, r] of Object.entries(layout.panels)) {
                    expect(r.x, `${id} @ ${width}x${height} left edge`).toBeGreaterThanOrEqual(0);
                    expect(r.y, `${id} @ ${width}x${height} top edge`).toBeGreaterThanOrEqual(0);
                    expect(r.x + r.w, `${id} @ ${width}x${height} right edge`).toBeLessThanOrEqual(width + 0.01);
                    expect(r.w, `${id} @ ${width}x${height} width`).toBeGreaterThan(0);
                    expect(r.h, `${id} @ ${width}x${height} height`).toBeGreaterThan(0);
                }
            }
        }
    });

    it('never overlaps two panels, at any tested size', () => {
        for (const width of WIDTHS) {
            for (const height of HEIGHTS) {
                const layout = computeDeckLayout(SPECS, { width, height });
                const entries = Object.entries(layout.panels);
                for (let i = 0; i < entries.length; i++) {
                    for (let j = i + 1; j < entries.length; j++) {
                        const [idA, a] = entries[i];
                        const [idB, b] = entries[j];
                        expect(
                            overlaps(a, b),
                            `${idA} overlaps ${idB} @ ${width}x${height}`
                        ).toBe(false);
                    }
                }
            }
        }
    });

    it('REGRESSION: the threat panel stays on screen at 1000px wide', () => {
        // The original code drew this with strokeRect(800, y, w - 840, 52),
        // which ran off the right edge on any window under ~1250px.
        const layout = computeDeckLayout(SPECS, { width: 1000, height: 720 });
        const threats = layout.panels['THREATS'];
        expect(threats.x + threats.w).toBeLessThanOrEqual(1000);
    });

    it('REGRESSION: an active scramble banner reserves its own row instead of colliding', () => {
        // The original banner was drawn at a fixed y=295, straight through
        // the crew stamina rows.
        const withBanner = SPECS.map(s =>
            s.id === 'SCRAMBLE' ? { ...s, present: true } : s
        );
        const layout = computeDeckLayout(withBanner, { width: 1280, height: 800 });
        expect(layout.panels['SCRAMBLE']).toBeDefined();

        const entries = Object.entries(layout.panels);
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                expect(overlaps(entries[i][1], entries[j][1])).toBe(false);
            }
        }
    });

    it('omits panels that are not present', () => {
        const layout = computeDeckLayout(SPECS, { width: 1280, height: 800 });
        expect(layout.panels['SCRAMBLE']).toBeUndefined();
    });

    it('reflows to fewer columns on narrow viewports', () => {
        expect(computeDeckLayout(SPECS, { width: 800, height: 720 }).cols).toBe(1);
        expect(computeDeckLayout(SPECS, { width: 1920, height: 1080 }).cols).toBe(3);
    });

    it('picks column counts by content width breakpoints', () => {
        expect(columnsForWidth(500)).toBe(1);
        expect(columnsForWidth(800)).toBe(2);
        expect(columnsForWidth(1400)).toBe(3);
    });

    it('spans bottom-pinned panels across the full content width', () => {
        const layout = computeDeckLayout(SPECS, { width: 1600, height: 900 });
        expect(layout.panels['LOG'].w).toBeCloseTo(layout.content.w, 5);
        expect(layout.panels['LOG'].x).toBeCloseTo(layout.content.x, 5);
    });

    // REGRESSION: the solver used to pin the bottom panel to the base of the
    // viewport and let everything else spill past it. At 900x620 the crew
    // list, the payload rows and the entire log panel were drawn off-screen.
    it('never places any panel below the bottom of the viewport', () => {
        for (const width of [...WIDTHS, 900]) {
            for (const height of [...HEIGHTS, 620, 560]) {
                const layout = computeDeckLayout(RANKED, { width, height });
                for (const [id, r] of Object.entries(layout.panels)) {
                    expect(r.y + r.h, `${id} @ ${width}x${height} bottom edge`)
                        .toBeLessThanOrEqual(height + 0.01);
                }
            }
        }
    });

    it('never overlaps ranked panels either, at any tested size', () => {
        for (const width of [...WIDTHS, 900]) {
            for (const height of [...HEIGHTS, 620, 560]) {
                const entries = Object.entries(computeDeckLayout(RANKED, { width, height }).panels);
                for (let i = 0; i < entries.length; i++) {
                    for (let j = i + 1; j < entries.length; j++) {
                        expect(
                            overlaps(entries[i][1], entries[j][1]),
                            `${entries[i][0]} overlaps ${entries[j][0]} @ ${width}x${height}`
                        ).toBe(false);
                    }
                }
            }
        }
    });

    it('keeps essential panels even on a viewport too small for the rest', () => {
        const layout = computeDeckLayout(RANKED, { width: 900, height: 560 });
        expect(layout.panels['ORDERS']).toBeDefined();
        expect(layout.panels['TURNAROUND']).toBeDefined();
    });

    it('drops the least important panels first under vertical pressure', () => {
        const layout = computeDeckLayout(RANKED, { width: 900, height: 620 });
        if (layout.dropped.length > 0) {
            // DECK_PLAN (priority 2) must never survive while CREW (3) is cut.
            expect(layout.dropped).toContain('DECK_PLAN');
            expect(layout.dropped).not.toContain('TURNAROUND');
            expect(layout.dropped).not.toContain('ORDERS');
        }
    });

    // REGRESSION: at 1440x900 the flow columns ended two thirds of the way
    // down, leaving a ~220px band of dead screen above the pinned log.
    it('fills the content area instead of leaving a dead band above the pinned panel', () => {
        const layout = computeDeckLayout(RANKED, { width: 1440, height: 900 });
        const log = layout.panels['LOG'];
        expect(log).toBeDefined();

        const tallestFlowBottom = Object.entries(layout.panels)
            .filter(([id]) => id !== 'LOG' && id !== 'ORDERS')
            .reduce((max, [, r]) => Math.max(max, r.y + r.h), 0);

        // The log must start close under the tallest column, not float at the
        // base of the screen with a gap above it.
        expect(log.y - tallestFlowBottom).toBeLessThan(30);
        // And the content area must be used down to its bottom edge.
        const contentBottom = layout.content.y + layout.content.h;
        expect(log.y + log.h).toBeGreaterThan(contentBottom - 2);
    });

    it('is deterministic for identical input', () => {
        const a = computeDeckLayout(SPECS, { width: 1440, height: 900 });
        const b = computeDeckLayout(SPECS, { width: 1440, height: 900 });
        expect(a).toEqual(b);
    });

    it('compresses row height under vertical pressure but never below 0.7', () => {
        const cramped = computeDeckLayout(SPECS, { width: 900, height: 600 });
        expect(cramped.rowScale).toBeGreaterThanOrEqual(0.7);
        expect(cramped.rowScale).toBeLessThanOrEqual(1.0);
    });

    it('gives every flow panel at least its minimum usable width where possible', () => {
        const layout = computeDeckLayout(SPECS, { width: 1920, height: 1080 });
        for (const spec of SPECS) {
            if ((spec.pin ?? 'flow') !== 'flow') continue;
            const r = layout.panels[spec.id];
            if (r) expect(r.w).toBeGreaterThanOrEqual(spec.minW - 0.01);
        }
    });
});

describe('essential panels on a short screen', () => {
    /**
     * The shedding loop is not allowed to drop an `essential` panel, so when
     * one will not fit it used to be packed at its intrinsic height and drawn
     * straight off the bottom of the screen - which is precisely the failure
     * the whole solver exists to prevent. A one-row turnaround panel on a
     * 320 px phone overflowed its content box by about fifty pixels.
     */
    const PHONE_SIZES: [number, number][] = [
        [568, 320], [658, 320], [750, 340], [844, 390], [1024, 420]
    ];

    const essentialSpecs = [
        { id: 'ORDERS', minW: 220, rows: 1, pin: 'top' as const, essential: true },
        { id: 'TURNAROUND', minW: 220, rows: 3, priority: 9, essential: true },
        { id: 'THREATS', minW: 220, rows: 4, priority: 7 }
    ];

    it('keeps every panel inside the content box, however short the screen', () => {
        for (const [width, height] of PHONE_SIZES) {
            for (const footerH of [44, 64, 90]) {
                const layout = computeDeckLayout(essentialSpecs, { width, height, footerH });
                const contentBottom = layout.content.y + layout.content.h;
                for (const [id, r] of Object.entries(layout.panels)) {
                    expect(
                        r.y + r.h,
                        `${width}x${height} footer ${footerH}: ${id} overflows by ${Math.round(r.y + r.h - contentBottom)}px`
                    ).toBeLessThanOrEqual(contentBottom + 1);
                }
            }
        }
    });

    it('never draws a panel over the footer', () => {
        for (const [width, height] of PHONE_SIZES) {
            const layout = computeDeckLayout(essentialSpecs, { width, height, footerH: 72 });
            for (const [id, r] of Object.entries(layout.panels)) {
                expect(r.y + r.h, `${width}x${height}: ${id}`).toBeLessThanOrEqual(layout.footer.y + 1);
            }
        }
    });

    it('squeezes rather than dropping a panel it is told to keep', () => {
        const layout = computeDeckLayout(essentialSpecs, { width: 568, height: 320, footerH: 64 });
        expect(layout.panels['ORDERS']).toBeDefined();
        expect(layout.panels['TURNAROUND']).toBeDefined();
        expect(layout.dropped).toContain('THREATS');
    });

    it('still grows to fill a tall window', () => {
        const layout = computeDeckLayout(essentialSpecs, { width: 1440, height: 1200 });
        expect(layout.growScale).toBeGreaterThan(1);
    });
});

describe('deck panel sets (v1.10.0)', () => {
    it('shows a first-time pilot the brief deck: orders, turnaround, contacts, log', () => {
        const ids = deckPanelSpecs({ detail: 'BRIEF' }).map(s => s.id);
        expect(ids).toEqual(['ORDERS', 'TURNAROUND', 'THREATS', 'LOG']);
    });

    it('keeps the full deck without a separate crew panel', () => {
        const ids = deckPanelSpecs({ detail: 'FULL' }).map(s => s.id);
        expect(ids).toContain('PAYLOAD');
        expect(ids).toContain('STATUS');
        expect(ids).not.toContain('CREW');
    });

    it('lays out every set without overlap at desktop and laptop sizes', () => {
        for (const detail of ['BRIEF', 'FULL'] as const) {
            for (const [width, height] of [[1440, 900], [1280, 720], [1024, 640]]) {
                const out = computeDeckLayout(deckPanelSpecs({ detail }), { width, height });
                const rects = Object.values(out.panels);
                for (let i = 0; i < rects.length; i++) {
                    for (let j = i + 1; j < rects.length; j++) {
                        const a = rects[i];
                        const b = rects[j];
                        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
                        expect(overlap, `${detail} ${width}x${height}`).toBe(false);
                    }
                }
            }
        }
    });
});
