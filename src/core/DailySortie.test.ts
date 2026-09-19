import { describe, it, expect } from 'vitest';
import {
    dailyKey,
    dailyNumber,
    dailySeed,
    formatShareCard,
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

describe('formatShareCard', () => {
    it('is four short lines', () => {
        const lines = formatShareCard(run()).split('\n');
        expect(lines).toHaveLength(4);
        for (const line of lines) expect(line.length).toBeLessThan(80);
    });

    it('leads with the sortie number and carries the headline figures', () => {
        const card = formatShareCard(run());
        expect(card).toContain('DAILY SORTIE #262');
        expect(card).toContain('WAVE 7');
        expect(card).toContain('18,400 PTS');
        expect(card).toContain('LT COMMANDER');
    });

    it('states the attempt, so sharing stays honest without being punitive', () => {
        expect(formatShareCard(run({ attempts: 3 }))).toContain('attempt 3');
    });

    it('uses only glyphs the game\'s monospace font actually has', () => {
        // An aircraft emoji rendered as a stray arrow in the debrief card.
        const card = formatShareCard(run());
        expect(card).not.toMatch(/[\u{1F000}-\u{1FAFF}\u2700-\u27BF]/u);
    });

    it('draws one mark per kill, capped so a long run stays one line', () => {
        const modest = formatShareCard(run({ fighterKills: 2, bomberKills: 1, samKills: 0, traps: 0 }));
        expect(modest).toContain('●●●');
        const huge = formatShareCard(run({ fighterKills: 40, bomberKills: 40 }));
        expect(huge.split('\n')[2].length).toBeLessThan(80);
    });

    it('says so plainly when the pilot never got home', () => {
        expect(formatShareCard(run({ traps: 0, perfectTraps: 0 }))).toContain('no trap');
    });

    it('calls out perfect traps, because that is the flex', () => {
        expect(formatShareCard(run({ traps: 2, perfectTraps: 1 }))).toContain('(1 perfect)');
        expect(formatShareCard(run({ traps: 2, perfectTraps: 0 }))).not.toContain('perfect');
    });

    it('survives a zeroed run without printing junk', () => {
        const card = formatShareCard(run({
            score: 0, wave: 0, fighterKills: 0, bomberKills: 0,
            samKills: 0, traps: 0, perfectTraps: 0, hullRemaining: 100
        }));
        expect(card).not.toContain('undefined');
        expect(card).not.toContain('NaN');
        expect(card.split('\n')).toHaveLength(4);
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

    it('discards garbage fields rather than trusting them into the card', () => {
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
            expect(() => formatShareCard(day)).not.toThrow();
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
