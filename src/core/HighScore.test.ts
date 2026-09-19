import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadBestScore, recordBestScore } from './HighScore';

const KEY = 'carrier-vector-1988.bestScore';

function stubStorage(initial: Record<string, string> = {}) {
    const store = { ...initial };
    vi.stubGlobal('localStorage', {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = v; }
    });
    return store;
}

describe('personal best', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('starts at zero with nothing stored', () => {
        stubStorage();
        expect(loadBestScore()).toBe(0);
    });

    it('records and reports a new best', () => {
        const store = stubStorage();
        const result = recordBestScore(1400, 0);
        expect(result).toEqual({ best: 1400, isNewBest: true });
        expect(store[KEY]).toBe('1400');
        expect(loadBestScore()).toBe(1400);
    });

    it('keeps the previous best when the run is worse', () => {
        const store = stubStorage({ [KEY]: '2000' });
        const result = recordBestScore(900, 2000);
        expect(result).toEqual({ best: 2000, isNewBest: false });
        expect(store[KEY]).toBe('2000');
    });

    it('treats an equal score as not a new best', () => {
        expect(recordBestScore(500, 500).isNewBest).toBe(false);
    });

    it('never stores a negative or non-finite score', () => {
        stubStorage();
        expect(recordBestScore(-300, 0)).toEqual({ best: 0, isNewBest: false });
        expect(recordBestScore(Number.NaN, 0)).toEqual({ best: 0, isNewBest: false });
        expect(loadBestScore()).toBe(0);
    });

    it('ignores a corrupt stored value', () => {
        stubStorage({ [KEY]: 'not-a-number' });
        expect(loadBestScore()).toBe(0);
        stubStorage({ [KEY]: '-40' });
        expect(loadBestScore()).toBe(0);
    });

    it('survives storage that throws, and storage that is absent', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('SecurityError'); },
            setItem: () => { throw new Error('SecurityError'); }
        });
        expect(loadBestScore()).toBe(0);
        expect(() => recordBestScore(1000, 0)).not.toThrow();

        vi.stubGlobal('localStorage', undefined);
        expect(loadBestScore()).toBe(0);
        expect(recordBestScore(1000, 0).best).toBe(1000);
    });
});
