import { describe, expect, it } from 'vitest';
import {
    SCRAMBLE, SCRAMBLE_LOADOUT, escalationCount, fighterAccuracy, keepClearOfBoat, mulberry32, rearmAfterWave, scrambleWave, spawnReference, waveClearBonus
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

    it('sends escalation bombers in from the far side of the jet, never from between it and the boat', () => {
        for (let wave = 6; wave < 40; wave++) {
            for (const s of scrambleWave(wave, 1234).spawns) {
                if (s.type === 'BOMBER') expect(Math.abs(s.bearingDeg)).toBeLessThanOrEqual(SCRAMBLE.bomberArcDeg);
            }
        }
    });

    it('measures a bomber from the line out through the jet, and a fighter from the nose', () => {
        // Jet 8 km east of the boat, nose pointed home (west).
        const jet = { x: 8000, z: 0 };
        const homeward = -Math.PI / 2;
        expect(spawnReference('FIGHTER', jet, homeward)).toBe(homeward);
        expect(spawnReference('BOMBER', jet, homeward)).toBeCloseTo(Math.PI / 2, 9);
        // A bomber placed at bearing 0 is further out than the jet, so its run
        // at the boat (the origin) comes straight past it.
        const a = spawnReference('BOMBER', jet, homeward);
        const bomber = { x: jet.x + Math.sin(a) * 3000, z: jet.z + Math.cos(a) * 3000 };
        expect(Math.hypot(bomber.x, bomber.z)).toBeGreaterThan(Math.hypot(jet.x, jet.z));
    });

    it('never puts a bomber on top of the boat (v2.2.0 review)', () => {
        // Inside the strike radius a bomber hit the carrier on its first tick.
        expect(keepClearOfBoat(300, 0)).toEqual({ x: SCRAMBLE.bomberSpawnClear, z: 0 });
        expect(keepClearOfBoat(0, 0)).toEqual({ x: 0, z: SCRAMBLE.bomberSpawnClear });
        expect(keepClearOfBoat(4000, 1000)).toEqual({ x: 4000, z: 1000 });
        expect(SCRAMBLE.bomberSpawnClear).toBeGreaterThan(SCRAMBLE.bomberStrikeRadius * 3);
    });

    it('keeps wave 1 dead ahead: next to the boat a bomber is measured from the nose too', () => {
        const launch = { x: 0, z: 1200 };
        expect(spawnReference('BOMBER', launch, 0.3)).toBe(0.3);
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

