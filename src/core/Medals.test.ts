import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEDALS, earnedMask, loadMedals, mergeMedals, saveMedals, starCount, totalStars } from './Medals';
import type { RunSummary } from './Medals';
import { SCENARIOS } from './Scenarios';

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
    completed: false, score: 0, waves: 0, airframesLost: 0, traps: 0,
    perfectTraps: 0, bestChain: 0, hull: 100, seconds: 300, ...over
});

describe('medal criteria', () => {
    it('gives every scenario exactly three named stars', () => {
        for (const s of SCENARIOS) {
            expect(MEDALS[s.id], s.id).toHaveLength(3);
            for (const c of MEDALS[s.id]) expect(c.label.length).toBeGreaterThan(5);
        }
    });

    it('earns stars independently, so a reachable one is never gated behind a hard one', () => {
        // Scored 8,000 in SCRAMBLE but went down on wave 4: star 2 only.
        expect(earnedMask('SCRAMBLE', run({ score: 9000, waves: 4 }))).toBe(0b010);
        expect(earnedMask('SCRAMBLE', run({ score: 100, waves: 10 }))).toBe(0b101);
    });

    it('awards nothing for an empty run and everything for a perfect one', () => {
        for (const s of SCENARIOS) expect(earnedMask(s.id, run())).toBe(0);
        const perfect = run({
            completed: true, score: 1e6, waves: 99, perfectTraps: 3, traps: 3, hull: 100, seconds: 60
        });
        for (const s of SCENARIOS) expect(earnedMask(s.id, perfect), s.id).toBe(0b111);
    });

    it('requires completion for the no-loss and 3-wire stars on scripted missions', () => {
        expect(earnedMask('CANYON_STRIKE', run({ perfectTraps: 1 }))).toBe(0);
        expect(earnedMask('CANYON_STRIKE', run({ completed: true, airframesLost: 1, perfectTraps: 1 }))).toBe(0b101);
    });
});

describe('medal records', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('only ever gains stars and reports the fresh ones', () => {
        let m = mergeMedals({}, 'SCRAMBLE', 0b001);
        expect(m.fresh).toEqual([0]);
        m = mergeMedals(m.records, 'SCRAMBLE', 0b010);
        expect(m.fresh).toEqual([1]);
        expect(m.mask).toBe(0b011);
        m = mergeMedals(m.records, 'SCRAMBLE', 0);
        expect(m.fresh).toEqual([]);
        expect(m.records.SCRAMBLE).toBe(0b011);
    });

    it('counts stars across missions', () => {
        expect(starCount(0b111)).toBe(3);
        expect(totalStars({ SCRAMBLE: 0b011, CARRIER_QUALS: 0b100 })).toBe(3);
    });

    it('round-trips through storage and drops junk', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v); }
        });
        saveMedals({ SCRAMBLE: 0b101 });
        expect(loadMedals()).toEqual({ SCRAMBLE: 0b101 });
        store.set('carrier-vector-1988.medals', JSON.stringify({ SCRAMBLE: 99, NOPE: 1, IRON_HAND: 'x' }));
        expect(loadMedals()).toEqual({ SCRAMBLE: 99 & 0b111 });
        store.set('carrier-vector-1988.medals', '{not json');
        expect(loadMedals()).toEqual({});
    });
});
