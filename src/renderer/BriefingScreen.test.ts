import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '../core/Scenarios';
import { briefingHitAreas, briefingSecondaryOptions } from './BriefingScreen';


describe('briefingHitAreas', () => {
    const SIZES: [number, number][] = [
        [1440, 900], [1024, 700], [844, 390], [667, 375], [1180, 820]
    ];

    it('gives one pill per scenario, in order, without overlaps', () => {
        for (const [w, h] of SIZES) {
            const { pills } = briefingHitAreas(w, h, SCENARIOS.length, true);
            expect(pills).toHaveLength(SCENARIOS.length);
            for (let i = 1; i < pills.length; i++) {
                expect(pills[i].x, `${w}x${h}`).toBeGreaterThanOrEqual(pills[i - 1].x + pills[i - 1].w);
            }
        }
    });

    it('keeps every interactive area inside the viewport', () => {
        for (const [w, h] of SIZES) {
            const areas = briefingHitAreas(w, h, SCENARIOS.length, true);
            const all = [...areas.pills, areas.cta, areas.daily!];
            for (const r of all) {
                expect(r.x, `${w}x${h}`).toBeGreaterThanOrEqual(0);
                expect(r.x + r.w, `${w}x${h}`).toBeLessThanOrEqual(w + 0.001);
                expect(r.y, `${w}x${h}`).toBeGreaterThanOrEqual(0);
                expect(r.y + r.h, `${w}x${h}`).toBeLessThanOrEqual(h + 0.001);
            }
        }
    });

    it('never lets the daily line and the pills collide', () => {
        for (const [w, h] of SIZES) {
            const { pills, daily } = briefingHitAreas(w, h, SCENARIOS.length, true);
            expect(daily!.y + daily!.h).toBeLessThanOrEqual(pills[0].y);
        }
    });

    it('reclaims the daily line s space when there is no daily', () => {
        const withDaily = briefingHitAreas(1440, 900, 5, true);
        const without = briefingHitAreas(1440, 900, 5, false);
        expect(without.daily).toBeNull();
        expect(without.selectorY).toBeLessThan(withDaily.selectorY);
    });

    /**
     * A pill a thumb cannot hit is a pill that does not exist. Five across a
     * 667px phone is tight, so this is the number that has to hold.
     */
    it('keeps pills thumb-sized on the smallest phone', () => {
        const { pills } = briefingHitAreas(667, 375, 5, true);
        expect(pills[0].h).toBeGreaterThanOrEqual(44);
        expect(pills[0].w).toBeGreaterThanOrEqual(44);
    });

    it('puts the call to action at the bottom, clear of the pills', () => {
        for (const [w, h] of SIZES) {
            const { pills, cta } = briefingHitAreas(w, h, SCENARIOS.length, true);
            expect(cta.y, `${w}x${h}`).toBeGreaterThan(pills[0].y + pills[0].h);
        }
    });
});

describe('briefingSecondaryOptions', () => {
    const base = { pacingLabel: 'ARCADE pacing', threatLabel: 'REGULAR threat' };

    it('always leads with changing the mission, and offers no screen-style choice', () => {
        const opts = briefingSecondaryOptions({ ...base, mapChangeable: false, showPaletteHint: false });
        expect(opts[0]).toEqual(['←  →', 'change mission']);
        // One screen style only - it is no longer something to pick.
        expect(opts.some(([k]) => k === 'P')).toBe(false);
    });

    // Arrow-up defaults to CLIMB; a pilot with flight-sim habits expects the
    // opposite and used to have to discover the flip among forty bindings.
    it('offers the stick flip only until it has been touched', () => {
        const shown = briefingSecondaryOptions({ ...base, mapChangeable: false, showPaletteHint: false, showStickHint: true });
        const hidden = briefingSecondaryOptions({ ...base, mapChangeable: false, showPaletteHint: false, showStickHint: false });
        expect(shown.some(([k]) => k === 'I')).toBe(true);
        expect(hidden.some(([k]) => k === 'I')).toBe(false);
    });

    it('only offers the map change on a scenario that allows it', () => {
        const without = briefingSecondaryOptions({ ...base, mapChangeable: false, showPaletteHint: false });
        const withIt = briefingSecondaryOptions({ ...base, mapChangeable: true, showPaletteHint: false });
        expect(without.some(([k]) => k === '↑  ↓')).toBe(false);
        expect(withIt.some(([k]) => k === '↑  ↓')).toBe(true);
    });

    /**
     * The colour-blind palette shipped fully working and entirely
     * undiscoverable, reachable only through the full control reference. This
     * hint is the fix, and it has to actually disappear once seen or it is
     * just a permanent line of nagging.
     */
    it('hints at the colour-blind palette only until it has been touched', () => {
        const hinted = briefingSecondaryOptions({ ...base, mapChangeable: false, showPaletteHint: true });
        const notHinted = briefingSecondaryOptions({ ...base, mapChangeable: false, showPaletteHint: false });
        expect(hinted.some(([k, label]) => k === 'C' && label.includes('colour-blind'))).toBe(true);
        expect(notHinted.some(([k]) => k === 'C')).toBe(false);
    });

    it('carries the live pacing and threat labels through unchanged', () => {
        const opts = briefingSecondaryOptions({
            pacingLabel: 'SIM pacing',
            threatLabel: 'VETERAN threat',
            mapChangeable: false,
            showPaletteHint: false
        });
        expect(opts.find(([k]) => k === 'O')?.[1]).toBe('SIM pacing');
        expect(opts.find(([k]) => k === 'V')?.[1]).toBe('VETERAN threat');
    });
});
