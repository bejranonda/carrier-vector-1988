import { describe, it, expect } from 'vitest';
import {
    DEFAULT_PACING,
    PACING_SPECS,
    deckTiming,
    loadPacing,
    nextPacing,
    pacingSpec,
    savePacing,
    scaleOpeningEta
} from './Pacing';

function withStorage(store: Map<string, string> | null | 'throws', run: () => void) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const value = store === null ? undefined
        : store === 'throws' ? {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        }
            : {
                getItem: (k: string) => store.get(k) ?? null,
                setItem: (k: string, v: string) => { store.set(k, v); }
            };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
    try {
        run();
    } finally {
        if (original) Object.defineProperty(globalThis, 'localStorage', original);
        else delete (globalThis as Record<string, unknown>).localStorage;
    }
}

describe('pacing specs', () => {
    it('defaults to ARCADE, because the first impression is the only one most players form', () => {
        expect(DEFAULT_PACING).toBe('ARCADE');
    });

    it('cycles ARCADE <-> SIM', () => {
        expect(nextPacing('ARCADE')).toBe('SIM');
        expect(nextPacing('SIM')).toBe('ARCADE');
    });

    it('preserves the original simulation timings exactly under SIM', () => {
        // These are the numbers the deck state machine shipped with. If this
        // test changes, the "SIM restores what you had" promise is broken.
        expect(deckTiming('SIM')).toEqual({
            maintenanceSeconds: 18,
            armingSeconds: 14,
            repairSeconds: 30,
            derigSeconds: 3
        });
        const sim = pacingSpec('SIM');
        expect(sim.respawnSeconds).toBe(0);
        expect(sim.openingEtaScale).toBe(1);
        expect(sim.spawnDistanceScale).toBe(1);
    });

    it('makes every arcade duration strictly shorter than its sim counterpart', () => {
        const arcade = pacingSpec('ARCADE');
        const sim = pacingSpec('SIM');
        expect(arcade.maintenanceSeconds).toBeLessThan(sim.maintenanceSeconds);
        expect(arcade.armingSeconds).toBeLessThan(sim.armingSeconds);
        expect(arcade.repairSeconds).toBeLessThan(sim.repairSeconds);
        expect(arcade.derigSeconds).toBeLessThan(sim.derigSeconds);
        expect(arcade.openingEtaScale).toBeLessThan(1);
        expect(arcade.spawnDistanceScale).toBeLessThan(1);
    });

    /**
     * The whole justification for this module: arming plus the catapult stroke
     * has to leave the player airborne inside about ten seconds, or the opening
     * is still a progress bar.
     */
    it('puts the player on the catapult within ten seconds under ARCADE', () => {
        const arcade = pacingSpec('ARCADE');
        expect(arcade.armingSeconds + 2.5).toBeLessThan(10);
    });

    it('replaces a lost airframe in seconds under ARCADE, not by the hangar cycle', () => {
        const arcade = pacingSpec('ARCADE');
        expect(arcade.respawnSeconds).toBeGreaterThan(0);
        expect(arcade.respawnSeconds).toBeLessThanOrEqual(5);
        expect(arcade.respawnSeconds).toBeLessThan(arcade.maintenanceSeconds + arcade.armingSeconds);
    });

    it('gives every spec a label and a blurb for the briefing', () => {
        for (const spec of PACING_SPECS) {
            expect(spec.label.length).toBeGreaterThan(0);
            expect(spec.blurb.length).toBeGreaterThan(0);
            expect(pacingSpec(spec.id)).toBe(spec);
        }
    });
});

describe('scaleOpeningEta', () => {
    it('pulls the scripted opening forward under ARCADE', () => {
        expect(scaleOpeningEta(150, 'ARCADE')).toBe(53);
        expect(scaleOpeningEta(280, 'ARCADE')).toBe(98);
        expect(scaleOpeningEta(440, 'ARCADE')).toBe(154);
    });

    it('leaves the timeline untouched under SIM', () => {
        expect(scaleOpeningEta(150, 'SIM')).toBe(150);
        expect(scaleOpeningEta(440, 'SIM')).toBe(440);
    });

    it('never schedules a package so close that it cannot be intercepted', () => {
        // A contact arriving before the jet can be armed and launched is not
        // urgency, it is an unavoidable hull hit.
        expect(scaleOpeningEta(1, 'ARCADE')).toBeGreaterThanOrEqual(20);
        expect(scaleOpeningEta(0, 'ARCADE')).toBeGreaterThanOrEqual(20);
    });

    it('keeps the packages in their original order', () => {
        const scaled = [150, 280, 440].map(e => scaleOpeningEta(e, 'ARCADE'));
        expect(scaled).toEqual([...scaled].sort((a, b) => a - b));
    });
});

describe('persistence', () => {
    it('round-trips a stored setting', () => {
        const store = new Map<string, string>();
        withStorage(store, () => {
            savePacing('SIM');
            expect(loadPacing()).toBe('SIM');
        });
    });

    it('falls back to the default with nothing stored or a corrupt value', () => {
        withStorage(new Map(), () => expect(loadPacing()).toBe(DEFAULT_PACING));
        withStorage(new Map([['carrier-vector-1988.pacing', 'GLACIAL']]), () => {
            expect(loadPacing()).toBe(DEFAULT_PACING);
        });
    });

    it('survives storage that throws, and storage that is absent', () => {
        withStorage('throws', () => {
            expect(loadPacing()).toBe(DEFAULT_PACING);
            expect(() => savePacing('SIM')).not.toThrow();
        });
        withStorage(null, () => {
            expect(loadPacing()).toBe(DEFAULT_PACING);
            expect(() => savePacing('ARCADE')).not.toThrow();
        });
    });
});
