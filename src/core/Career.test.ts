import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ALWAYS_AVAILABLE, CAREER_TITLES, CAREER_TUNING, UNLOCKS, awardRun, careerLevel, isPaletteUnlocked,
    loadCareer, newlyUnlocked, nextUnlock, saveCareer, xpForLevel
} from './Career';
import { PALETTES, nextAvailablePalette } from '../renderer/Theme';

describe('career levels', () => {
    it('starts a new pilot at level 1, NUGGET, with an empty bar', () => {
        expect(careerLevel(0)).toEqual({ level: 1, title: 'NUGGET', into: 0, span: xpForLevel(2) });
    });

    it('climbs through every title with growing steps', () => {
        let prevSpan = 0;
        for (let level = 1; level <= CAREER_TITLES.length; level++) {
            const at = careerLevel(xpForLevel(level));
            expect(at.level).toBe(level);
            expect(at.title).toBe(CAREER_TITLES[level - 1]);
            expect(at.span).toBeGreaterThan(prevSpan);
            prevSpan = at.span;
        }
        expect(careerLevel(xpForLevel(CAREER_TITLES.length + 2)).title).toMatch(/^LEGEND ★★$/);
    });

    it('survives junk input', () => {
        expect(careerLevel(Number.NaN).level).toBe(1);
        expect(careerLevel(-50).level).toBe(1);
    });
});

describe('XP awards', () => {
    it('pays every run something, even a negative score', () => {
        const a = awardRun({ xp: 0, runs: 0 }, -400, 0);
        expect(a.gained).toBe(CAREER_TUNING.perRun);
        expect(a.career.runs).toBe(1);
    });

    it('pays score plus a bounty per new star, and reports a promotion', () => {
        const a = awardRun({ xp: xpForLevel(2) - 100, runs: 3 }, 50, 1);
        expect(a.gained).toBe(50 + CAREER_TUNING.perRun + CAREER_TUNING.perNewStar);
        expect(a.promoted).toBe(true);
        expect(a.before.level).toBe(1);
        expect(a.after.level).toBe(2);
    });
});

describe('unlocks', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('never locks the default or the accessibility palette', () => {
        for (const id of ALWAYS_AVAILABLE) expect(isPaletteUnlocked(id, 0)).toBe(true);
    });

    it('prices every cosmetic palette in stars and every unlock names a real palette', () => {
        for (const u of UNLOCKS) {
            expect(PALETTES.some(p => p.id === u.palette)).toBe(true);
            expect(isPaletteUnlocked(u.palette, u.stars - 1)).toBe(false);
            expect(isPaletteUnlocked(u.palette, u.stars)).toBe(true);
        }
    });

    it('reports exactly the unlocks a run crossed, and the next one ahead', () => {
        expect(newlyUnlocked(2, 3).map(u => u.palette)).toEqual(['AMBER']);
        expect(newlyUnlocked(0, 21).length).toBe(UNLOCKS.length);
        expect(newlyUnlocked(3, 3)).toEqual([]);
        expect(nextUnlock(0)?.palette).toBe('AMBER');
        expect(nextUnlock(99)).toBeNull();
    });

    it('cycles only through palettes the pilot owns', () => {
        const owned = (stars: number) => (p: Parameters<typeof isPaletteUnlocked>[0]) => isPaletteUnlocked(p, stars);
        expect(nextAvailablePalette('DEUTERAN', owned(0))).toBe('CLASSIC');
        expect(nextAvailablePalette('DEUTERAN', owned(3))).toBe('AMBER');
        expect(nextAvailablePalette('AMBER', owned(3))).toBe('CLASSIC');
    });

    it('round-trips the career through storage', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v); }
        });
        expect(loadCareer()).toEqual({ xp: 0, runs: 0 });
        saveCareer({ xp: 1234, runs: 5 });
        expect(loadCareer()).toEqual({ xp: 1234, runs: 5 });
        store.set('carrier-vector-1988.career', '"garbage"');
        expect(loadCareer()).toEqual({ xp: 0, runs: 0 });
    });
});
