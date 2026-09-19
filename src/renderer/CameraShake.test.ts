import { describe, it, expect } from 'vitest';
import {
    SHAKE_SOURCES,
    SHAKE_TUNING,
    addTrauma,
    blastTrauma,
    decayTrauma,
    shakeOffsets
} from './CameraShake';

describe('trauma accumulation', () => {
    it('adds up, so two events in the same second compound', () => {
        expect(addTrauma(0.2, 0.3)).toBeCloseTo(0.5, 6);
    });

    it('saturates at 1, so a held trigger cannot white out the screen', () => {
        let trauma = 0;
        for (let i = 0; i < 200; i++) trauma = addTrauma(trauma, SHAKE_SOURCES.gun);
        expect(trauma).toBe(1);
    });

    it('ignores a negative contribution', () => {
        expect(addTrauma(0.4, -1)).toBeCloseTo(0.4, 6);
    });
});

describe('trauma decay', () => {
    it('reaches zero and stays there', () => {
        let trauma = 1;
        for (let i = 0; i < 300; i++) trauma = decayTrauma(trauma, 1 / 60);
        expect(trauma).toBe(0);
        expect(decayTrauma(0, 1 / 60)).toBe(0);
    });

    it('lets a hit be felt for about a second', () => {
        const afterHalf = decayTrauma(SHAKE_SOURCES.damageTaken, 0.25);
        expect(afterHalf).toBeGreaterThan(0.1);
        expect(decayTrauma(SHAKE_SOURCES.damageTaken, 1.0)).toBe(0);
    });

    it('is frame-rate independent to within a step', () => {
        const oneStep = decayTrauma(1, 0.5);
        let many = 1;
        for (let i = 0; i < 30; i++) many = decayTrauma(many, 0.5 / 30);
        expect(many).toBeCloseTo(oneStep, 6);
    });
});

describe('blastTrauma', () => {
    it('is loudest at zero range and silent beyond the falloff', () => {
        expect(blastTrauma(0)).toBeGreaterThan(0.5);
        expect(blastTrauma(700)).toBe(0);
        expect(blastTrauma(5000)).toBe(0);
    });

    it('falls off monotonically', () => {
        let previous = Infinity;
        for (let d = 0; d <= 700; d += 50) {
            const t = blastTrauma(d);
            expect(t).toBeLessThanOrEqual(previous);
            previous = t;
        }
    });

    it('survives nonsense input rather than shaking the screen forever', () => {
        expect(blastTrauma(Number.NaN)).toBe(0);
        expect(blastTrauma(-10)).toBe(0);
    });
});

describe('shakeOffsets', () => {
    it('is exactly zero with no trauma, so a calm cockpit is perfectly still', () => {
        expect(shakeOffsets(0, 12.5)).toEqual({ pitch: 0, yaw: 0, roll: 0 });
    });

    it('never exceeds its tuned bounds', () => {
        for (let t = 0; t < 4; t += 0.017) {
            const o = shakeOffsets(1, t);
            expect(Math.abs(o.pitch)).toBeLessThanOrEqual(SHAKE_TUNING.maxPitch + 1e-9);
            expect(Math.abs(o.yaw)).toBeLessThanOrEqual(SHAKE_TUNING.maxYaw + 1e-9);
            expect(Math.abs(o.roll)).toBeLessThanOrEqual(SHAKE_TUNING.maxRoll + 1e-9);
        }
    });

    /**
     * Squared amplitude is what makes a cannon round and a missile hit feel
     * like different events. With linear amplitude they read the same.
     */
    it('grows with the square of trauma, so small events stay small', () => {
        const peak = (trauma: number) => {
            let max = 0;
            for (let t = 0; t < 1; t += 0.003) max = Math.max(max, Math.abs(shakeOffsets(trauma, t).roll));
            return max;
        };
        const quarter = peak(0.25);
        const half = peak(0.5);
        const full = peak(1);
        expect(half / quarter).toBeGreaterThan(3.5);
        expect(full / half).toBeGreaterThan(3.5);
        expect(quarter).toBeLessThan(SHAKE_TUNING.maxRoll * 0.1);
    });

    it('is deterministic for a given trauma and time', () => {
        expect(shakeOffsets(0.6, 3.25)).toEqual(shakeOffsets(0.6, 3.25));
    });

    it('does not repeat on a short loop', () => {
        // Three incommensurate rates: the same offsets must not come back a
        // second later, or a sustained shake looks like a stuck animation.
        const a = shakeOffsets(1, 1.0);
        const b = shakeOffsets(1, 2.0);
        expect(Math.abs(a.roll - b.roll) + Math.abs(a.yaw - b.yaw)).toBeGreaterThan(1e-3);
    });

    it('shakes roll hardest, because that is what a cockpit does under load', () => {
        expect(SHAKE_TUNING.maxRoll).toBeGreaterThan(SHAKE_TUNING.maxPitch);
        expect(SHAKE_TUNING.maxRoll).toBeGreaterThan(SHAKE_TUNING.maxYaw);
    });
});
