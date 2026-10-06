import { describe, it, expect } from 'vitest';
import {
    dailyKey,
    dailyNumber,
    dailySeed,
    loadDailyResults,
    mergeDailyResult,
    saveDailyResults,
    type DailyResult,
    type DailyResults
} from './DailySortie';

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

const run = (over: Partial<DailyResult> = {}): DailyResult => ({
    date: '2026-09-19',
    score: 18400,
    rank: 'LT COMMANDER',
    wave: 7,
    fighterKills: 3,
    bomberKills: 1,
    samKills: 2,
    traps: 2,
    perfectTraps: 1,
    hullRemaining: 62,
    attempts: 1,
    completed: false,
    ...over
});

describe('the day', () => {
    it('keys on the UTC date, so the day rolls over at one instant worldwide', () => {
        expect(dailyKey(new Date('2026-09-19T23:59:00Z'))).toBe('2026-09-19');
        expect(dailyKey(new Date('2026-09-20T00:01:00Z'))).toBe('2026-09-20');
    });

    it('gives the same seed for the same day and a different one the next', () => {
        const a = dailySeed(new Date('2026-09-19T06:00:00Z'));
        const b = dailySeed(new Date('2026-09-19T21:30:00Z'));
        const c = dailySeed(new Date('2026-09-20T06:00:00Z'));
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });

    it('reads the seed straight off the date', () => {
        expect(dailySeed(new Date('2026-09-19T00:00:00Z'))).toBe(20260919);
        expect(dailySeed(new Date('2027-01-05T00:00:00Z'))).toBe(20270105);
    });

    it('numbers the sorties from one, incrementing daily', () => {
        expect(dailyNumber(new Date('2026-01-01T00:00:00Z'))).toBe(1);
        expect(dailyNumber(new Date('2026-01-02T00:00:00Z'))).toBe(2);
        expect(dailyNumber(new Date('2026-09-19T00:00:00Z'))).toBe(262);
    });

    it('never shows a zero or negative sortie number for an early clock', () => {
        expect(dailyNumber(new Date('2025-06-01T00:00:00Z'))).toBe(1);
    });

    it('crosses a month and a year boundary cleanly', () => {
        const janEnd = dailyNumber(new Date('2026-01-31T00:00:00Z'));
        const febStart = dailyNumber(new Date('2026-02-01T00:00:00Z'));
        expect(febStart).toBe(janEnd + 1);

        const decEnd = dailyNumber(new Date('2026-12-31T00:00:00Z'));
        const janNext = dailyNumber(new Date('2027-01-01T00:00:00Z'));
        expect(janNext).toBe(decEnd + 1);
    });
});

describe('mergeDailyResult', () => {
    it('records a first attempt as the best', () => {
        const { today, isBest } = mergeDailyResult({}, run());
        expect(isBest).toBe(true);
        expect(today.attempts).toBe(1);
        expect(today.score).toBe(18400);
    });

    it('counts a worse attempt but keeps the better run intact', () => {
        const first = mergeDailyResult({}, run()).results;
        const { today, isBest } = mergeDailyResult(first, run({ score: 900, wave: 2, fighterKills: 0 }));
        expect(isBest).toBe(false);
        expect(today.score).toBe(18400);
        // The card has to describe one coherent run, not a mix of best bits.
        expect(today.wave).toBe(7);
        expect(today.fighterKills).toBe(3);
        expect(today.attempts).toBe(2);
    });

    it('replaces the record wholesale when beaten', () => {
        const first = mergeDailyResult({}, run()).results;
        const { today } = mergeDailyResult(first, run({ score: 30000, wave: 11, traps: 4 }));
        expect(today.score).toBe(30000);
        expect(today.wave).toBe(11);
        expect(today.traps).toBe(4);
        expect(today.attempts).toBe(2);
    });

    it('keeps days separate', () => {
        const a = mergeDailyResult({}, run()).results;
        const b = mergeDailyResult(a, run({ date: '2026-09-20', score: 100 })).results;
        expect(b['2026-09-19'].score).toBe(18400);
        expect(b['2026-09-20'].score).toBe(100);
        expect(b['2026-09-20'].attempts).toBe(1);
    });

    it('does not mutate the set it was given', () => {
        const start: DailyResults = mergeDailyResult({}, run()).results;
        mergeDailyResult(start, run({ score: 99999 }));
        expect(start['2026-09-19'].score).toBe(18400);
    });
});

describe('persistence', () => {
    it('round-trips a day', () => {
        const store = new Map<string, string>();
        withStorage(store, () => {
            const { results } = mergeDailyResult({}, run());
            saveDailyResults(results);
            expect(loadDailyResults()).toEqual(results);
        });
    });

    it('starts clean on corrupt or missing data', () => {
        withStorage(new Map(), () => expect(loadDailyResults()).toEqual({}));
        withStorage(new Map([['carrier-vector-1988.daily', '{oh no']]), () => {
            expect(loadDailyResults()).toEqual({});
        });
    });

    it('discards garbage fields rather than trusting them', () => {
        const store = new Map([[
            'carrier-vector-1988.daily',
            JSON.stringify({ '2026-09-19': { score: 'lots', wave: -4, rank: 12, attempts: 2.5 } })
        ]]);
        withStorage(store, () => {
            const day = loadDailyResults()['2026-09-19'];
            expect(day.score).toBe(0);
            expect(day.wave).toBe(0);
            expect(day.rank).toBe('NUGGET');
            expect(day.attempts).toBe(2);
        });
    });

    it('survives storage that throws and storage that is absent', () => {
        withStorage('throws', () => {
            expect(loadDailyResults()).toEqual({});
            expect(() => saveDailyResults({})).not.toThrow();
        });
        withStorage(null, () => {
            expect(loadDailyResults()).toEqual({});
            expect(() => saveDailyResults({})).not.toThrow();
        });
    });
});

describe('SCRAMBLE days survive a reload (v2.2.0)', () => {
    const scrambleDay = (over: Partial<DailyResult> = {}) => run({
        date: '2026-10-06', score: 9000, wave: 6, samKills: 0, traps: 0, perfectTraps: 0,
        mode: 'SCRAMBLE', bestChain: 3, ...over
    });

    it('keeps the mode, the chain and EASY through storage', () => {
        const store = new Map<string, string>();
        withStorage(store, () => {
            const { results } = mergeDailyResult({}, scrambleDay({ easy: true }));
            saveDailyResults(results);
            const day = loadDailyResults()['2026-10-06'];
            expect(day.mode).toBe('SCRAMBLE');
            expect(day.bestChain).toBe(3);
            expect(day.easy).toBe(true);
        });
    });

    it('keeps a SCRAMBLE day a SCRAMBLE day after a weaker second attempt and a reload', () => {
        // The bug: the stored day lost its mode, the weaker attempt kept the
        // stored record, and the day came back as a deck sortie.
        const store = new Map<string, string>();
        withStorage(store, () => {
            saveDailyResults(mergeDailyResult({}, scrambleDay()).results);
            const second = mergeDailyResult(loadDailyResults(), scrambleDay({ score: 4000 }));
            expect(second.today.mode).toBe('SCRAMBLE');
            expect(second.today.attempts).toBe(2);
            expect(second.today.score).toBe(9000);
        });
    });

    it('ignores a forged mode or EASY flag of the wrong type', () => {
        const store = new Map([[
            'carrier-vector-1988.daily',
            JSON.stringify({ '2026-10-06': { score: 10, mode: 'HACKED', easy: 'yes', bestChain: 'x' } })
        ]]);
        withStorage(store, () => {
            const day = loadDailyResults()['2026-10-06'];
            expect(day.mode).toBeUndefined();
            expect(day.easy).toBeUndefined();
        });
    });
});
