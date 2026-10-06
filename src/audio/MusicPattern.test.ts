import { describe, expect, it } from 'vitest';
import { LAYERS, LOOP_STEPS, musicStep, scrambleIntensity } from './MusicPattern';

const voicesOverLoop = (intensity: number) => {
    const set = new Set<string>();
    for (let s = 0; s < LOOP_STEPS; s++) for (const n of musicStep(s, intensity)) set.add(n.voice);
    return set;
};

describe('SCRAMBLE soundtrack pattern', () => {
    it('is silent below the first layer and layers up with intensity', () => {
        expect(voicesOverLoop(0).size).toBe(0);
        expect([...voicesOverLoop(LAYERS.bass)].sort()).toEqual(['BASS', 'KICK']);
        expect(voicesOverLoop(LAYERS.hat).has('HAT')).toBe(true);
        expect(voicesOverLoop(LAYERS.hat).has('ARP')).toBe(false);
        expect(voicesOverLoop(1).has('ARP')).toBe(true);
    });

    it('keeps the kick on the beat and loops cleanly', () => {
        for (let s = 0; s < LOOP_STEPS; s++) {
            const kick = musicStep(s, 1).some(n => n.voice === 'KICK');
            expect(kick).toBe(s % 4 === 0);
        }
        expect(musicStep(LOOP_STEPS + 3, 1)).toEqual(musicStep(3, 1));
        expect(musicStep(-1, 1)).toEqual(musicStep(LOOP_STEPS - 1, 1));
    });

    it('plays only audible, positive notes', () => {
        for (let s = 0; s < LOOP_STEPS; s++) {
            for (const n of musicStep(s, 1)) {
                expect(n.dur).toBeGreaterThan(0);
                expect(n.gain).toBeGreaterThan(0);
                if (n.voice === 'BASS' || n.voice === 'ARP') {
                    expect(n.freq).toBeGreaterThan(40);
                    expect(n.freq).toBeLessThan(2000);
                }
            }
        }
    });

    it('heats up when a wave is live, and again for a chain or a late wave', () => {
        const calm = scrambleIntensity({ wave: 2, waveLive: false, chain: 0 });
        const live = scrambleIntensity({ wave: 2, waveLive: true, chain: 0 });
        const hot = scrambleIntensity({ wave: 2, waveLive: true, chain: 3 });
        expect(live).toBeGreaterThan(calm);
        expect(hot).toBeGreaterThan(live);
        expect(scrambleIntensity({ wave: 6, waveLive: true, chain: 0 })).toBe(1);
    });
});
