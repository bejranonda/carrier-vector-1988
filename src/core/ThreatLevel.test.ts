import { describe, it, expect } from 'vitest';
import {
    DEFAULT_THREAT_LEVEL,
    THREAT_LEVELS,
    loadThreatLevel,
    nextThreatLevel,
    saveThreatLevel,
    startWaveFor,
    threatLevelSpec
} from './ThreatLevel';

describe('threat level ladder', () => {
    it('cycles through every level and comes back', () => {
        let id = DEFAULT_THREAT_LEVEL;
        const seen = new Set<string>([id]);
        for (let i = 0; i < THREAT_LEVELS.length; i++) {
            id = nextThreatLevel(id);
            seen.add(id);
        }
        expect(seen.size).toBe(THREAT_LEVELS.length);
        expect(id).toBe(DEFAULT_THREAT_LEVEL);
    });

    it('has unique ids and labels', () => {
        expect(new Set(THREAT_LEVELS.map(t => t.id)).size).toBe(THREAT_LEVELS.length);
        expect(new Set(THREAT_LEVELS.map(t => t.label)).size).toBe(THREAT_LEVELS.length);
    });

    it('falls back to the middle setting for an unknown id', () => {
        expect(threatLevelSpec('NAVIGATOR' as never).id).toBe(DEFAULT_THREAT_LEVEL);
    });

    /**
     * The default has to be the scenario exactly as designed, or every
     * mission record and every piece of tuning in the game is measured
     * against something nobody chose.
     */
    it('leaves the fight untouched at the default', () => {
        expect(threatLevelSpec(DEFAULT_THREAT_LEVEL).waveOffset).toBe(0);
        expect(startWaveFor(6, DEFAULT_THREAT_LEVEL)).toBe(6);
        expect(startWaveFor(0, DEFAULT_THREAT_LEVEL)).toBe(0);
    });

    it('orders the levels from gentlest to hardest', () => {
        const offsets = THREAT_LEVELS.map(t => t.waveOffset);
        for (let i = 1; i < offsets.length; i++) {
            expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
        }
    });
});

describe('startWaveFor', () => {
    it('moves a scenario along the escalation curve', () => {
        expect(startWaveFor(6, 'VETERAN')).toBeGreaterThan(6);
        expect(startWaveFor(6, 'CADET')).toBeLessThan(6);
    });

    /**
     * Wave zero is the hand-curated opening act. A negative wave number is
     * not a gentler fight, it is an index into nothing.
     */
    it('never goes below the opening wave', () => {
        for (const level of THREAT_LEVELS) {
            expect(startWaveFor(0, level.id)).toBeGreaterThanOrEqual(0);
            expect(startWaveFor(1, level.id)).toBeGreaterThanOrEqual(0);
        }
    });

    it('gives a gentle setting the same floor as everything else', () => {
        expect(startWaveFor(0, 'CADET')).toBe(0);
    });
});

describe('threat level persistence', () => {
    const store = () => {
        const map = new Map<string, string>();
        return {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => { map.set(k, v); }
        };
    };

    it('defaults to the fight as designed', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        expect(loadThreatLevel()).toBe(DEFAULT_THREAT_LEVEL);
    });

    it('round-trips a choice', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        saveThreatLevel('VETERAN');
        expect(loadThreatLevel()).toBe('VETERAN');
    });

    it('falls back to the default on a corrupt value', () => {
        const s = store();
        s.setItem('carrier-vector-1988.threatLevel', 'IMPOSSIBLE');
        (globalThis as { localStorage?: unknown }).localStorage = s;
        expect(loadThreatLevel()).toBe(DEFAULT_THREAT_LEVEL);
    });

    it('survives storage that throws', () => {
        (globalThis as { localStorage?: unknown }).localStorage = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        };
        expect(loadThreatLevel()).toBe(DEFAULT_THREAT_LEVEL);
        expect(() => saveThreatLevel('CADET')).not.toThrow();
    });
});
