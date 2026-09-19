import { describe, it, expect } from 'vitest';
import {
    isCleared,
    loadMissionRecords,
    mergeMissionResult,
    recordFor,
    saveMissionRecords,
    type MissionRecords
} from './MissionRecords';

/** Swap in a fake localStorage for the duration of `run`. */
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

describe('recordFor', () => {
    it('reports a zeroed record for a mission never flown', () => {
        expect(recordFor({}, 'CANYON_STRIKE')).toEqual({ best: 0, completions: 0, attempts: 0 });
    });

    it('treats a mission with no completions as not cleared', () => {
        const records: MissionRecords = { A: { best: 9000, completions: 0, attempts: 4 } };
        expect(isCleared(records, 'A')).toBe(false);
        expect(isCleared(records, 'B')).toBe(false);
    });

    it('treats one completion as cleared, forever', () => {
        const records: MissionRecords = { A: { best: 10, completions: 1, attempts: 9 } };
        expect(isCleared(records, 'A')).toBe(true);
    });
});

describe('mergeMissionResult', () => {
    it('records a first attempt', () => {
        const { records, record, isNewBest } = mergeMissionResult({}, 'A', 1200, true);
        expect(record).toEqual({ best: 1200, completions: 1, attempts: 1 });
        expect(isNewBest).toBe(true);
        expect(records.A).toBe(record);
    });

    it('keeps the higher score and counts the attempt', () => {
        const first = mergeMissionResult({}, 'A', 1200, true).records;
        const { record, isNewBest } = mergeMissionResult(first, 'A', 800, true);
        expect(record.best).toBe(1200);
        expect(record.attempts).toBe(2);
        expect(record.completions).toBe(2);
        expect(isNewBest).toBe(false);
    });

    it('counts a loss as an attempt but not a completion', () => {
        const { record } = mergeMissionResult({}, 'A', 500, false);
        expect(record).toEqual({ best: 500, completions: 0, attempts: 1 });
    });

    it('lets a losing run set a personal best', () => {
        // Dying on wave nine with a huge score is still the best run so far.
        const after = mergeMissionResult({}, 'A', 50000, false);
        expect(after.isNewBest).toBe(true);
        expect(after.record.best).toBe(50000);
        expect(after.record.completions).toBe(0);
    });

    it('leaves every other mission record untouched', () => {
        const start = mergeMissionResult({}, 'A', 1000, true).records;
        const after = mergeMissionResult(start, 'B', 40, false).records;
        expect(after.A).toEqual({ best: 1000, completions: 1, attempts: 1 });
        expect(after.B).toEqual({ best: 40, completions: 0, attempts: 1 });
    });

    it('does not mutate the record set it was given', () => {
        const start: MissionRecords = { A: { best: 100, completions: 1, attempts: 1 } };
        mergeMissionResult(start, 'A', 9999, true);
        expect(start.A.best).toBe(100);
    });

    it('floors a fractional score and survives a non-finite one', () => {
        expect(mergeMissionResult({}, 'A', 1200.9, true).record.best).toBe(1200);
        expect(mergeMissionResult({}, 'A', Number.NaN, true).record.best).toBe(0);
        expect(mergeMissionResult({}, 'A', Number.POSITIVE_INFINITY, true).record.best).toBe(0);
    });

    it('never records a negative best', () => {
        const { record } = mergeMissionResult({}, 'A', -400, false);
        expect(record.best).toBe(0);
        expect(record.attempts).toBe(1);
    });
});

describe('persistence', () => {
    it('round-trips a record set', () => {
        const store = new Map<string, string>();
        withStorage(store, () => {
            const { records } = mergeMissionResult({}, 'CANYON_STRIKE', 4200, true);
            saveMissionRecords(records);
            expect(loadMissionRecords()).toEqual(records);
        });
    });

    it('starts clean with nothing stored', () => {
        withStorage(new Map(), () => expect(loadMissionRecords()).toEqual({}));
    });

    it('starts clean on corrupt JSON rather than refusing to boot', () => {
        const store = new Map([['carrier-vector-1988.missionRecords', '{not json']]);
        withStorage(store, () => expect(loadMissionRecords()).toEqual({}));
    });

    it('discards garbage fields inside otherwise valid JSON', () => {
        const store = new Map([[
            'carrier-vector-1988.missionRecords',
            JSON.stringify({ A: { best: 'lots', completions: -3, attempts: 2.7 }, B: 17, C: null })
        ]]);
        withStorage(store, () => {
            expect(loadMissionRecords()).toEqual({ A: { best: 0, completions: 0, attempts: 2 } });
        });
    });

    it('survives storage that throws in both directions', () => {
        withStorage('throws', () => {
            expect(loadMissionRecords()).toEqual({});
            expect(() => saveMissionRecords({ A: { best: 1, completions: 1, attempts: 1 } })).not.toThrow();
        });
    });

    it('survives storage being absent entirely', () => {
        withStorage(null, () => {
            expect(loadMissionRecords()).toEqual({});
            expect(() => saveMissionRecords({})).not.toThrow();
        });
    });
});
