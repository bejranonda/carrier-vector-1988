import { describe, it, expect } from 'vitest';
import { computeDeckLayout, columnsForWidth, type PanelSpec, type Rect } from './DeckLayout';

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
