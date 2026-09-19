import { describe, it, expect } from 'vitest';
import { HUD_METRICS, solveHudLayout } from './HudLayout';
import type { HudLayout } from './HudLayout';

const WIDTHS = [800, 900, 1024, 1100, 1150, 1280, 1440, 1600, 1920, 2560];
const HEIGHTS = [400, 500, 620, 700, 768, 900, 1080];

interface Span { id: string; from: number; to: number }

/**
 * Horizontal spans of everything that lives on the cockpit centre line, in
 * screen order. The pitch ladder occupies +/- symHalf around centre, plus a
 * little for its "00" labels.
 */
function centreLineSpans(l: HudLayout): Span[] {
    const m = HUD_METRICS;
    const spans: Span[] = [];
    if (l.showApproach) {
        spans.push({ id: 'approach', from: l.approachX, to: l.approachX + m.approachW });
    }
    spans.push({ id: 'speed', from: l.speedX, to: l.speedX + m.speedW });
    spans.push({ id: 'ladder', from: l.cx - l.symHalf, to: l.cx + l.symHalf });
    spans.push({ id: 'altitude', from: l.altX, to: l.altX + m.altW });
    return spans;
}

/** The left rail, which the checklist claims when it is shown. */
function railRight(l: HudLayout): number {
    return HUD_METRICS.edge + (l.showChecklist ? HUD_METRICS.checklistW : 0);
}

describe('solveHudLayout', () => {
    // REGRESSION: the blocks used to sit at fixed offsets from screen centre,
    // so at 900x700 the airspeed block was drawn straight underneath the
    // training checklist and the pitch ladder ran through both.
    it('never overlaps two centre-line instruments, at any tested size', () => {
        for (const width of WIDTHS) {
            for (const height of HEIGHTS) {
                for (const showApproach of [false, true]) {
                    const l = solveHudLayout({ width, height, showApproach, hasChecklist: true });
                    const spans = centreLineSpans(l);
                    for (let i = 1; i < spans.length; i++) {
                        expect(
                            spans[i].from,
                            `${spans[i - 1].id}->${spans[i].id} @ ${width}x${height} approach=${showApproach}`
                        ).toBeGreaterThanOrEqual(spans[i - 1].to - 0.01);
                    }
                }
            }
        }
    });

    it('keeps every centre-line instrument inside the viewport', () => {
        for (const width of WIDTHS) {
            for (const height of HEIGHTS) {
                for (const showApproach of [false, true]) {
                    const l = solveHudLayout({ width, height, showApproach, hasChecklist: true });
                    for (const span of centreLineSpans(l)) {
                        expect(span.from, `${span.id} @ ${width}x${height}`).toBeGreaterThanOrEqual(0);
                        expect(span.to, `${span.id} @ ${width}x${height}`).toBeLessThanOrEqual(width + 0.01);
                    }
                }
            }
        }
    });

    it('never lets a centre-line instrument sit on the left rail', () => {
        for (const width of WIDTHS) {
            for (const height of HEIGHTS) {
                for (const showApproach of [false, true]) {
                    const l = solveHudLayout({ width, height, showApproach, hasChecklist: true });
                    const rail = railRight(l);
                    const first = centreLineSpans(l)[0];
                    expect(first.from, `${first.id} @ ${width}x${height}`).toBeGreaterThanOrEqual(rail);
                }
            }
        }
    });

    it('drops the checklist on viewports too narrow to hold it', () => {
        expect(solveHudLayout({ width: 900, height: 700, showApproach: false, hasChecklist: true })
            .showChecklist).toBe(false);
        expect(solveHudLayout({ width: 1150, height: 700, showApproach: false, hasChecklist: true })
            .showChecklist).toBe(true);
    });

    it('never shows a checklist that has no items', () => {
        expect(solveHudLayout({ width: 1920, height: 1080, showApproach: false, hasChecklist: false })
            .showChecklist).toBe(false);
    });

    it('keeps the pitch ladder positive and bounded at every size', () => {
        for (const width of WIDTHS) {
            const l = solveHudLayout({ width, height: 700, showApproach: true, hasChecklist: true });
            expect(l.symHalf, `symHalf @ ${width}`).toBeGreaterThan(20);
            expect(l.symScale, `symScale @ ${width}`).toBeGreaterThan(0);
            expect(l.symScale, `symScale @ ${width}`).toBeLessThanOrEqual(1);
        }
    });

    it('holds the ladder at its readable floor on any ordinary display', () => {
        for (const width of [1280, 1440, 1600, 1920, 2560]) {
            for (const showApproach of [false, true]) {
                const l = solveHudLayout({ width, height: 900, showApproach, hasChecklist: true });
                expect(l.symHalf, `symHalf @ ${width} approach=${showApproach}`)
                    .toBeGreaterThanOrEqual(HUD_METRICS.symHalfMin);
            }
        }
    });

    it('uses a compact systems strip and a smaller RWR on a short window', () => {
        const short = solveHudLayout({ width: 1440, height: 460, showApproach: false, hasChecklist: true });
        const tall = solveHudLayout({ width: 1440, height: 900, showApproach: false, hasChecklist: true });
        expect(short.compactSystems).toBe(true);
        expect(tall.compactSystems).toBe(false);
        expect(short.rwrSize).toBeLessThan(tall.rwrSize);
        expect(short.rwrSize).toBeGreaterThanOrEqual(HUD_METRICS.rwrMin);
        expect(tall.rwrSize).toBe(HUD_METRICS.rwrMax);
    });

    it('gives the ladder its full width on a large display', () => {
        const l = solveHudLayout({ width: 1920, height: 1080, showApproach: false, hasChecklist: true });
        expect(l.symScale).toBeCloseTo(1, 5);
    });

    it('is deterministic for identical input', () => {
        const input = { width: 1440, height: 900, showApproach: true, hasChecklist: true };
        expect(solveHudLayout(input)).toEqual(solveHudLayout(input));
    });

    it('clamps absurdly small viewports instead of producing negative geometry', () => {
        const l = solveHudLayout({ width: 120, height: 90, showApproach: true, hasChecklist: true });
        expect(l.symHalf).toBeGreaterThan(0);
        expect(l.speedX).toBeGreaterThan(0);
        expect(Number.isFinite(l.altX)).toBe(true);
    });
});
