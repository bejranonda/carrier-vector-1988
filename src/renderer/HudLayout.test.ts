import { describe, it, expect } from 'vitest';
import { HUD_METRICS, NO_RESERVE, solveHudLayout, solveArcadeBar } from './HudLayout';
import type { HudLayout, ArcadeBarSlot } from './HudLayout';

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
        const tall = solveHudLayout({ width: 1440, height: 1200, showApproach: false, hasChecklist: true });
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

describe('touch-mode instrument placement', () => {
    /** A phone-sized reserve: thumb columns left and right, a band at the bottom. */
    const reserve = { left: 150, right: 140, bottom: 120, top: 0 };

    const PHONES: [number, number][] = [[568, 320], [658, 320], [750, 340], [844, 390], [1024, 768]];

    /**
     * The thumb controls occupy the bottom of their columns, so what the side
     * blocks have to clear is the band, not the column. Both blocks are drawn
     * from `cy - 34` and are 68 tall.
     */
    it('lifts the airspeed and altitude blocks above the thumb band', () => {
        for (const [width, height] of PHONES) {
            const layout = solveHudLayout({
                width, height, showApproach: false, hasChecklist: false, reserve, touchMode: true
            });
            const blockBottom = layout.cy - 34 + 68;
            expect(blockBottom, `${width}x${height}`).toBeLessThanOrEqual(height - reserve.bottom);
        }
    });

    it('does not squeeze the ladder to nothing to make room for thumbs', () => {
        // Reserving the thumb columns horizontally drove symHalf to its 24 px
        // hard floor on a 568 px phone, which is not a pitch ladder.
        for (const [width, height] of PHONES) {
            const layout = solveHudLayout({
                width, height, showApproach: false, hasChecklist: false, reserve, touchMode: true
            });
            expect(layout.symHalf, `${width}x${height}`).toBeGreaterThanOrEqual(HUD_METRICS.symHalfMin);
        }
    });

    /**
     * A checklist needs a keyboard to tick its steps off against, and there
     * is no room for it beside two thumb columns anyway.
     */
    it('drops the flight checklist in touch mode, at any width', () => {
        const layout = solveHudLayout({
            width: 1400, height: 900, showApproach: false, hasChecklist: true, reserve, touchMode: true
        });
        expect(layout.showChecklist).toBe(false);
    });

    it('lifts the centre symbology out of the thumb band', () => {
        const withReserve = solveHudLayout({
            width: 750, height: 340, showApproach: false, hasChecklist: false, reserve, touchMode: true
        });
        const without = solveHudLayout({ width: 750, height: 340, showApproach: false, hasChecklist: false });
        expect(withReserve.cy).toBeLessThan(without.cy);
    });

    it('shrinks the RWR scope rather than letting it run under the fire button', () => {
        const touch = solveHudLayout({
            width: 750, height: 340, showApproach: false, hasChecklist: false, reserve, touchMode: true
        });
        const desktop = solveHudLayout({ width: 750, height: 340, showApproach: false, hasChecklist: false });
        expect(touch.rwrSize).toBeLessThan(desktop.rwrSize);
    });

    it('still leaves a readable pitch ladder on the smallest phone', () => {
        const layout = solveHudLayout({
            width: 568, height: 320, showApproach: false, hasChecklist: false, reserve, touchMode: true
        });
        expect(layout.symHalf).toBeGreaterThanOrEqual(HUD_METRICS.symHalfMin);
        expect(layout.symScale).toBeGreaterThan(0.4);
    });

    it('changes nothing for a keyboard player', () => {
        const a = solveHudLayout({ width: 1440, height: 900, showApproach: false, hasChecklist: true });
        const b = solveHudLayout({
            width: 1440, height: 900, showApproach: false, hasChecklist: true, reserve: NO_RESERVE
        });
        expect(a).toEqual(b);
        expect(a.touchMode).toBe(false);
    });
});

describe('solveArcadeBar', () => {
    // REGRESSION: HUD.ts (drawing) and PointerInteractivity.ts (hit-testing)
    // used to each hardcode this row's pixel geometry independently. They
    // had already drifted apart by 8px at the assist pill before this
    // solver existed - exactly the class of bug this file makes impossible.
    function overlaps(a: ArcadeBarSlot, b: ArcadeBarSlot): boolean {
        return a.rect.x < b.rect.x + b.rect.w && b.rect.x < a.rect.x + a.rect.w;
    }

    it('never overlaps two slots, at several viewport sizes', () => {
        for (const width of [800, 1024, 1280, 1440, 1920, 2560]) {
            for (const height of [500, 700, 900, 1080]) {
                for (const showCountermeasure of [false, true]) {
                    const bar = solveArcadeBar({
                        width, height, weaponCount: 3, showCountermeasure,
                        showRewind: true, showPadlock: true, statusTextWidth: 220
                    });
                    const sorted = [...bar].sort((a, b) => a.rect.x - b.rect.x);
                    for (let i = 1; i < sorted.length; i++) {
                        expect(
                            overlaps(sorted[i - 1], sorted[i]),
                            `${sorted[i - 1].id}/${sorted[i].id} @ ${width}x${height} cm=${showCountermeasure}`
                        ).toBe(false);
                    }
                }
            }
        }
    });

    it('keeps every slot inside the viewport horizontally', () => {
        for (const width of [800, 1024, 1280, 1440, 1920, 2560]) {
            const bar = solveArcadeBar({
                width, height: 800, weaponCount: 4, showCountermeasure: true,
                showRewind: true, showPadlock: true, statusTextWidth: 220
            });
            for (const s of bar) {
                expect(s.rect.x, `${s.id} @ ${width}`).toBeGreaterThanOrEqual(0);
                expect(s.rect.x + s.rect.w, `${s.id} @ ${width}`).toBeLessThanOrEqual(width);
            }
        }
    });

    it('orders slots left to right', () => {
        const bar = solveArcadeBar({
            width: 1440, height: 900, weaponCount: 4, showCountermeasure: true,
            showRewind: true, showPadlock: true, statusTextWidth: 220
        });
        for (let i = 1; i < bar.length; i++) {
            expect(bar[i].rect.x, `${bar[i - 1].id}->${bar[i].id}`).toBeGreaterThan(bar[i - 1].rect.x);
        }
    });

    it('adds a 4th weapon slot without overlapping anything else', () => {
        const three = solveArcadeBar({
            width: 1440, height: 900, weaponCount: 3, showCountermeasure: false,
            showRewind: true, showPadlock: true
        });
        const four = solveArcadeBar({
            width: 1440, height: 900, weaponCount: 4, showCountermeasure: false,
            showRewind: true, showPadlock: true
        });
        expect(three.filter(s => s.id.startsWith('WEAPON_'))).toHaveLength(3);
        expect(four.filter(s => s.id.startsWith('WEAPON_'))).toHaveLength(4);
        expect(four.find(s => s.id === 'WEAPON_3')).toBeDefined();

        const sorted = [...four].sort((a, b) => a.rect.x - b.rect.x);
        for (let i = 1; i < sorted.length; i++) {
            expect(overlaps(sorted[i - 1], sorted[i]), `${sorted[i - 1].id}/${sorted[i].id}`).toBe(false);
        }
    });

    it('only shows the countermeasure slot when requested', () => {
        const without = solveArcadeBar({
            width: 1440, height: 900, weaponCount: 3, showCountermeasure: false,
            showRewind: true, showPadlock: true
        });
        const withCm = solveArcadeBar({
            width: 1440, height: 900, weaponCount: 3, showCountermeasure: true,
            showRewind: true, showPadlock: true
        });
        expect(without.find(s => s.id === 'COUNTERMEASURE')).toBeUndefined();
        expect(withCm.find(s => s.id === 'COUNTERMEASURE')).toBeDefined();
    });

    it('reproduces the exact current geometry for 3 weapons, no countermeasure', () => {
        const bar = solveArcadeBar({
            width: 1280, height: 720, weaponCount: 3, showCountermeasure: false,
            showRewind: true, showPadlock: true
        });
        const barY = 720 - HUD_METRICS.arcadeBar.y;
        const byId = (id: string) => bar.find(s => s.id === id)!.rect;

        expect(byId('WEAPON_0')).toEqual({ x: 24, y: barY, w: 78, h: 34 });
        expect(byId('WEAPON_1')).toEqual({ x: 110, y: barY, w: 78, h: 34 });
        expect(byId('WEAPON_2')).toEqual({ x: 196, y: barY, w: 78, h: 34 });
        expect(byId('ASSIST')).toEqual({ x: 290, y: barY, w: 110, h: 34 });
        expect(byId('REWIND')).toEqual({ x: 408, y: barY, w: 84, h: 34 });
        expect(byId('PADLOCK')).toEqual({ x: 500, y: barY, w: 80, h: 34 });
    });

    it('omits the status pill when it would overflow the viewport', () => {
        const narrow = solveArcadeBar({
            width: 620, height: 720, weaponCount: 3, showCountermeasure: false,
            showRewind: true, showPadlock: true, statusTextWidth: 400
        });
        const wide = solveArcadeBar({
            width: 1440, height: 720, weaponCount: 3, showCountermeasure: false,
            showRewind: true, showPadlock: true, statusTextWidth: 400
        });
        expect(narrow.find(s => s.id === 'STATUS')).toBeUndefined();
        expect(wide.find(s => s.id === 'STATUS')).toBeDefined();
    });

    it('omits the status pill entirely when no text width is given', () => {
        const bar = solveArcadeBar({
            width: 2560, height: 900, weaponCount: 3, showCountermeasure: false,
            showRewind: true, showPadlock: true
        });
        expect(bar.find(s => s.id === 'STATUS')).toBeUndefined();
    });

    it('drops the rewind and padlock slots when hidden', () => {
        const bar = solveArcadeBar({
            width: 1440, height: 900, weaponCount: 3, showCountermeasure: false,
            showRewind: false, showPadlock: false
        });
        expect(bar.find(s => s.id === 'REWIND')).toBeUndefined();
        expect(bar.find(s => s.id === 'PADLOCK')).toBeUndefined();
    });

    it('is deterministic for identical input', () => {
        const input = {
            width: 1440, height: 900, weaponCount: 4, showCountermeasure: true,
            showRewind: true, showPadlock: true, statusTextWidth: 220
        };
        expect(solveArcadeBar(input)).toEqual(solveArcadeBar(input));
    });
});
