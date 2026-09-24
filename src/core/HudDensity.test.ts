import { describe, it, expect } from 'vitest';
import {
    HUD_DENSITIES,
    defaultHudDensity,
    hudVisibility,
    nextHudDensity,
    resolveHudDensity,
    saveHudDensity,
    storedHudDensity,
    visibleRegionCount
} from './HudDensity';
import type { DensityStore } from './HudDensity';

function memoryStore(initial: Record<string, string> = {}): DensityStore {
    const data = { ...initial };
    return {
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = v; }
    };
}

describe('HUD density', () => {
    it('cycles FIRST_FLIGHT -> ARCADE -> PRO -> FIRST_FLIGHT', () => {
        expect(nextHudDensity('FIRST_FLIGHT')).toBe('ARCADE');
        expect(nextHudDensity('ARCADE')).toBe('PRO');
        expect(nextHudDensity('PRO')).toBe('FIRST_FLIGHT');
    });

    it('starts a new pilot on FIRST_FLIGHT and graduates them on a completion', () => {
        expect(defaultHudDensity(false)).toBe('FIRST_FLIGHT');
        expect(defaultHudDensity(true)).toBe('ARCADE');
    });

    it("never overrides the player's own choice", () => {
        const store = memoryStore();
        saveHudDensity('PRO', store);
        expect(storedHudDensity(store)).toBe('PRO');
        expect(resolveHudDensity(false, store)).toBe('PRO');

        saveHudDensity('FIRST_FLIGHT', store);
        expect(resolveHudDensity(true, store)).toBe('FIRST_FLIGHT');
    });

    it('ignores a corrupt stored value and a broken store', () => {
        expect(resolveHudDensity(false, memoryStore({ 'carrier-vector-1988.hud-density': 'HUGE' }))).toBe('FIRST_FLIGHT');
        const broken: DensityStore = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        };
        expect(() => saveHudDensity('PRO', broken)).not.toThrow();
        expect(resolveHudDensity(true, broken)).toBe('ARCADE');
    });

    /**
     * The screen budget. Thirteen consecutive "beginner" features all ADDED a
     * region, until four pairs of them overlapped. These numbers are the brake:
     * raising one should be a decision someone makes on purpose, in review.
     */
    it('holds each density to its screen budget', () => {
        expect(visibleRegionCount('FIRST_FLIGHT')).toBeLessThanOrEqual(3);
        expect(visibleRegionCount('ARCADE')).toBeLessThanOrEqual(8);
        expect(visibleRegionCount('FIRST_FLIGHT')).toBeLessThan(visibleRegionCount('ARCADE'));
    });

    it('always gives the pilot an attitude reference', () => {
        for (const d of HUD_DENSITIES) {
            const v = hudVisibility(d);
            expect(v.horizon || v.pitchLadder, `${d} has no attitude reference`).toBe(true);
        }
    });

    it('always gives the pilot a way to see and fire the armed weapon', () => {
        for (const d of HUD_DENSITIES) {
            const v = hudVisibility(d);
            // PRO shows it in the systems panel, which is not optional there.
            expect(v.pillBar || v.armedWeaponChip || d === 'PRO').toBe(true);
        }
    });

    it('FIRST_FLIGHT drops the compass and radar, and keeps the graduation hint', () => {
        const v = hudVisibility('FIRST_FLIGHT');
        expect(v.compass).toBe(false);
        expect(v.radar).toBe(false);
        expect(v.pillBar).toBe(false);
        expect(v.graduationHint).toBe(true);
    });
});
