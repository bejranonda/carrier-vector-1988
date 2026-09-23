import { describe, it, expect } from 'vitest';
import {
    NO_INSETS,
    TOUCH_METRICS,
    hitTest,
    solveTouchLayout,
    stickDeflection,
    throttleFraction,
    type TouchLayout,
    type TouchRect
} from './TouchLayout';

/** Handsets and tablets, landscape, as the cockpit will actually see them. */
const DEVICES: [string, number, number][] = [
    ['iPhone SE', 667, 375],
    ['iPhone 12', 844, 390],
    ['iPhone 15 Pro Max', 932, 430],
    ['Pixel 7', 892, 412],
    ['Galaxy S20 small', 640, 360],
    ['iPad mini', 1024, 768],
    ['iPad', 1180, 820]
];

const rects = (l: TouchLayout): [string, TouchRect][] => [
    ['throttle', l.throttle],
    ['stickZone', l.stickZone],
    ['fire', { x: l.fire.cx - l.fire.r, y: l.fire.cy - l.fire.r, w: l.fire.r * 2, h: l.fire.r * 2 }],
    ['target', { x: l.target.cx - l.target.r, y: l.target.cy - l.target.r, w: l.target.r * 2, h: l.target.r * 2 }],
    ['chaff', { x: l.chaff.cx - l.chaff.r, y: l.chaff.cy - l.chaff.r, w: l.chaff.r * 2, h: l.chaff.r * 2 }],
    ...l.weapons.map((w, i) => [`weapon${i}`, w] as [string, TouchRect]),
    ['menu', l.menu],
    ['recover', l.recover]
];

const overlaps = (a: TouchRect, b: TouchRect) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('solveTouchLayout', () => {
    it('never overlaps two controls, on any handset', () => {
        for (const [name, w, h] of DEVICES) {
            const all = rects(solveTouchLayout(w, h));
            for (let i = 0; i < all.length; i++) {
                for (let j = i + 1; j < all.length; j++) {
                    expect(
                        overlaps(all[i][1], all[j][1]),
                        `${name}: ${all[i][0]} overlaps ${all[j][0]}`
                    ).toBe(false);
                }
            }
        }
    });

    it('keeps every control inside the viewport', () => {
        for (const [name, w, h] of DEVICES) {
            const layout = solveTouchLayout(w, h);
            for (const [id, r] of rects(layout)) {
                expect(r.x, `${name}: ${id} off the left`).toBeGreaterThanOrEqual(0);
                expect(r.y, `${name}: ${id} off the top`).toBeGreaterThanOrEqual(0);
                expect(r.x + r.w, `${name}: ${id} off the right`).toBeLessThanOrEqual(w + 0.001);
                expect(r.y + r.h, `${name}: ${id} off the bottom`).toBeLessThanOrEqual(h + 0.001);
            }
        }
    });

    /**
     * The pitch ladder, the flight path marker and the designation bracket
     * all live in the middle of the screen. A control drawn over them makes
     * the game unflyable in exactly the moments that matter.
     */
    it('leaves the centre symbology clear', () => {
        for (const [name, w, h] of DEVICES) {
            const layout = solveTouchLayout(w, h);
            const keepout: TouchRect = {
                x: w / 2 - layout.centreKeepout,
                y: h / 2 - layout.centreKeepout * 0.8,
                w: layout.centreKeepout * 2,
                h: layout.centreKeepout * 1.6
            };
            for (const [id, r] of rects(layout)) {
                expect(overlaps(r, keepout), `${name}: ${id} covers the centre`).toBe(false);
            }
        }
    });

    it('never makes a touch target too small for a thumb', () => {
        for (const [name, w, h] of DEVICES) {
            const layout = solveTouchLayout(w, h);
            const min = TOUCH_METRICS.minTarget * 0.72;
            expect(layout.fire.r * 2, `${name}: fire`).toBeGreaterThanOrEqual(min);
            expect(layout.target.r * 2, `${name}: target`).toBeGreaterThanOrEqual(min);
            for (const wpn of layout.weapons) {
                expect(wpn.h, `${name}: weapon height`).toBeGreaterThanOrEqual(TOUCH_METRICS.minTarget);
            }
            expect(layout.menu.w).toBeGreaterThanOrEqual(TOUCH_METRICS.minTarget);
        }
    });

    it('puts the flight controls in the bottom half, where thumbs are', () => {
        for (const [name, w, h] of DEVICES) {
            const layout = solveTouchLayout(w, h);
            expect(layout.stick.cy, `${name}: stick`).toBeGreaterThan(h * 0.45);
            expect(layout.fire.cy, `${name}: fire`).toBeGreaterThan(h * 0.45);
            expect(layout.stick.cx, `${name}: stick is left-hand`).toBeLessThan(w * 0.4);
            expect(layout.fire.cx, `${name}: fire is right-hand`).toBeGreaterThan(w * 0.6);
        }
    });

    it('respects safe-area insets rather than drawing under a notch', () => {
        const insets = { top: 20, right: 48, bottom: 24, left: 48 };
        const layout = solveTouchLayout(844, 390, insets);
        for (const [id, r] of rects(layout)) {
            expect(r.x, `${id} inside the left inset`).toBeGreaterThanOrEqual(insets.left);
            expect(r.x + r.w, `${id} inside the right inset`).toBeLessThanOrEqual(844 - insets.right + 0.001);
            expect(r.y + r.h, `${id} inside the bottom inset`).toBeLessThanOrEqual(390 - insets.bottom + 0.001);
        }
    });

    it('survives a degenerate viewport without producing NaN', () => {
        const layout = solveTouchLayout(1, 1);
        for (const [, r] of rects(layout)) {
            expect(Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true);
            expect(Number.isFinite(r.w) && Number.isFinite(r.h)).toBe(true);
        }
    });

    it('scales the controls together rather than rearranging them', () => {
        const small = solveTouchLayout(640, 360);
        const large = solveTouchLayout(1180, 820);
        // Same relationship: throttle outboard of stick, target above fire.
        expect(small.throttle.x).toBeLessThan(small.stickZone.x);
        expect(large.throttle.x).toBeLessThan(large.stickZone.x);
        expect(small.target.cy).toBeLessThan(small.fire.cy);
        expect(large.target.cy).toBeLessThan(large.fire.cy);
    });
});

describe('hitTest', () => {
    const layout = solveTouchLayout(844, 390);

    it('finds each control at its own centre', () => {
        expect(hitTest(layout, layout.fire.cx, layout.fire.cy)).toBe('FIRE');
        expect(hitTest(layout, layout.target.cx, layout.target.cy)).toBe('TARGET');
        expect(hitTest(layout, layout.stick.cx, layout.stick.cy)).toBe('STICK');
        expect(hitTest(layout, layout.throttle.x + 4, layout.throttle.y + 20)).toBe('THROTTLE');
        expect(hitTest(layout, layout.menu.x + 4, layout.menu.y + 4)).toBe('MENU');
        expect(hitTest(layout, layout.recover.x + 4, layout.recover.y + 4)).toBe('RECOVER');
    });

    it('finds the chaff button (Known Issues #44)', () => {
        expect(hitTest(layout, layout.chaff.cx, layout.chaff.cy)).toBe('CHAFF');
    });

    it('keeps chaff within a thumb-sized target on the smallest handset', () => {
        const small = solveTouchLayout(640, 360);
        expect(small.chaff.r * 2).toBeGreaterThanOrEqual(TOUCH_METRICS.minTarget * 0.72 * 0.95 - 0.001);
    });

    it('finds each weapon button, HARM included', () => {
        const ids = ['WEAPON_GUN', 'WEAPON_MISSILE', 'WEAPON_BOMB', 'WEAPON_HARM'];
        expect(layout.weapons).toHaveLength(4);
        layout.weapons.forEach((w, i) => {
            expect(hitTest(layout, w.x + w.w / 2, w.y + w.h / 2)).toBe(ids[i]);
        });
    });

    /**
     * A tap that hits nothing is not a miss: it is how a target gets picked
     * on a touchscreen, which is the whole point of the mode.
     */
    it('reports a tap on open screen as WORLD', () => {
        expect(hitTest(layout, 844 / 2, 120)).toBe('WORLD');
    });

    it('offers only the launch button on the deck', () => {
        expect(hitTest(layout, layout.launch.x + 10, layout.launch.y + 10, 'DECK')).toBe('LAUNCH');
        expect(hitTest(layout, layout.fire.cx, layout.fire.cy, 'DECK')).toBe('WORLD');
        // The recovery toggle is a flight control, and there is nothing to
        // recover from on the deck.
        expect(hitTest(layout, layout.recover.x + 4, layout.recover.y + 4, 'DECK')).toBe('WORLD');
        // The menu is reachable from both screens.
        expect(hitTest(layout, layout.menu.x + 2, layout.menu.y + 2, 'DECK')).toBe('MENU');
    });

    it('is forgiving at the edge of a button, as a thumb requires', () => {
        expect(hitTest(layout, layout.fire.cx + layout.fire.r + 5, layout.fire.cy)).toBe('FIRE');
    });
});

describe('stickDeflection', () => {
    it('is centred where the thumb first landed', () => {
        const d = stickDeflection({ x: 100, y: 100 }, 100, 100, 46);
        expect(d.pitch).toBe(0);
        expect(d.roll).toBe(0);
    });

    it('pulls back to pitch up, because screen y grows downward', () => {
        expect(stickDeflection({ x: 100, y: 100 }, 100, 60, 46).pitch).toBeGreaterThan(0);
        expect(stickDeflection({ x: 100, y: 100 }, 100, 140, 46).pitch).toBeLessThan(0);
    });

    it('rolls toward the thumb', () => {
        expect(stickDeflection({ x: 100, y: 100 }, 140, 100, 46).roll).toBeGreaterThan(0);
        expect(stickDeflection({ x: 100, y: 100 }, 60, 100, 46).roll).toBeLessThan(0);
    });

    it('saturates instead of running away past the stick radius', () => {
        const d = stickDeflection({ x: 100, y: 100 }, 900, -900, 46);
        expect(d.roll).toBe(1);
        expect(d.pitch).toBe(1);
    });
});

describe('throttleFraction', () => {
    const track = { x: 0, y: 100, w: 30, h: 200 };

    it('is full at the top and closed at the bottom', () => {
        expect(throttleFraction(track, 100)).toBe(1);
        expect(throttleFraction(track, 300)).toBe(0);
        expect(throttleFraction(track, 200)).toBeCloseTo(0.5, 6);
    });

    it('clamps a thumb that slides off either end', () => {
        expect(throttleFraction(track, -500)).toBe(1);
        expect(throttleFraction(track, 5000)).toBe(0);
    });
});

describe('NO_INSETS', () => {
    it('is the identity, so a browser without safe-area support loses nothing', () => {
        const a = solveTouchLayout(844, 390, NO_INSETS);
        const b = solveTouchLayout(844, 390);
        expect(a).toEqual(b);
    });
});
