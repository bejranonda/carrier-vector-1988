import { describe, expect, it } from 'vitest';
import {
    SCRAMBLE, SCRAMBLE_LOADOUT, escalationCount, fighterAccuracy, formatScrambleCard, mulberry32, rearmAfterWave, scrambleWave, waveClearBonus
} from './Scramble';

describe('SCRAMBLE wave director', () => {
    it('opens with a single passive bomber dead ahead - a first shot that lands', () => {
        const w = scrambleWave(1);
        expect(w.spawns).toHaveLength(1);
        expect(w.spawns[0].type).toBe('BOMBER');
        expect(w.spawns[0].bearingDeg).toBe(0);
        expect(w.spawns[0].passive).toBe(true);
        expect(w.spawns[0].rangeM).toBeLessThan(3000);
        expect(w.brief).toMatch(/SPACE/);
    });

    it('keeps the first two waves harmless and makes wave 3 shoot back', () => {
        expect(scrambleWave(1).spawns.every(s => s.passive)).toBe(true);
        expect(scrambleWave(2).spawns.every(s => s.passive)).toBe(true);
        expect(scrambleWave(3).spawns.some(s => !s.passive && s.type === 'FIGHTER')).toBe(true);
    });

    it('introduces a threat from behind by wave 5', () => {
        expect(scrambleWave(5).spawns.some(s => Math.abs(s.bearingDeg) > 120)).toBe(true);
    });

    it('escalates after the opening, capped for readability', () => {
        expect(escalationCount(6)).toBe(4);
        expect(escalationCount(9)).toBe(6);
        expect(escalationCount(200)).toBe(SCRAMBLE.maxContacts);
        for (let wave = 6; wave < 40; wave++) {
            const w = scrambleWave(wave);
            expect(w.spawns.length).toBe(escalationCount(wave));
            expect(w.spawns.some(s => s.type === 'BOMBER')).toBe(true);
            for (const s of w.spawns) {
                expect(s.bearingDeg).toBeGreaterThanOrEqual(-180);
                expect(s.bearingDeg).toBeLessThanOrEqual(180);
                expect(s.rangeM).toBeGreaterThanOrEqual(2800);
                expect(s.rangeM).toBeLessThanOrEqual(4400);
                expect(s.passive).toBe(false);
            }
        }
    });

    it('is reproducible from (wave, seed) and varies with the seed', () => {
        expect(scrambleWave(8, 42)).toEqual(scrambleWave(8, 42));
        expect(scrambleWave(8, 42)).not.toEqual(scrambleWave(8, 43));
    });

    it('never hands out a shared spec object (callers may mutate)', () => {
        const a = scrambleWave(1);
        a.spawns[0].rangeM = 1;
        expect(scrambleWave(1).spawns[0].rangeM).not.toBe(1);
    });

    it('produces uniform numbers in [0,1)', () => {
        const r = mulberry32(7);
        for (let i = 0; i < 1000; i++) {
            const v = r();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});

describe('SCRAMBLE economy', () => {
    it('pays more for later waves and for faster clears, never less than the wave base', () => {
        expect(waveClearBonus(1, 10)).toBe(150 + 20 * 15);
        expect(waveClearBonus(4, 60)).toBe(600);
        expect(waveClearBonus(4, 5)).toBeGreaterThan(waveClearBonus(4, 25));
        expect(waveClearBonus(0, -5)).toBeGreaterThan(0);
    });

    it('rearms and patches without exceeding the magazine', () => {
        const out = rearmAfterWave({ ...SCRAMBLE_LOADOUT, vulcanAmmo: 3, sidewinders: 5, chaff: 15 }, 50);
        expect(out.loadout.vulcanAmmo).toBe(SCRAMBLE.vulcanAmmo);
        expect(out.loadout.sidewinders).toBe(SCRAMBLE.maxSidewinders);
        expect(out.loadout.chaff).toBe(SCRAMBLE.maxChaff);
        expect(out.damage).toBe(50 - SCRAMBLE.repairPerWave);
        expect(rearmAfterWave(SCRAMBLE_LOADOUT, 10).damage).toBe(0);
    });

    it('starts the jet with missiles armed for the first shot', () => {
        expect(SCRAMBLE_LOADOUT.sidewinders).toBeGreaterThan(0);
        expect(SCRAMBLE_LOADOUT.ironBombs).toBe(0);
    });
});

describe('SCRAMBLE fighter accuracy', () => {
    it('ramps up with the waves and never exceeds full accuracy', () => {
        expect(fighterAccuracy(3)).toBeLessThan(fighterAccuracy(6));
        expect(fighterAccuracy(6)).toBeLessThan(fighterAccuracy(12));
        expect(fighterAccuracy(50)).toBe(1);
    });
});

describe('SCRAMBLE brag card', () => {
    it('is three short lines ending in the address of the game', () => {
        const card = formatScrambleCard({ wavesCleared: 7, score: 12400, stars: 2, kills: 18, bestChain: 4, url: 'example.org/game' });
        expect(card.split('\n')).toEqual([
            'CARRIER VECTOR: 1988 — SCRAMBLE ★★☆',
            '7 WAVES HELD · 12,400 PTS · 18 splashed · chain x4',
            'beat it: example.org/game'
        ]);
        expect(formatScrambleCard({ wavesCleared: 1, score: 10, stars: 0, kills: 1, bestChain: 1, url: 'u' }))
            .toContain('1 WAVE HELD');
    });
});
