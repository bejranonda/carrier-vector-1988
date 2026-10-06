import { describe, expect, it } from 'vitest';
import { STREAK_TUNING, SpeedStreaks } from './SpeedStreaks';

describe('SpeedStreaks', () => {
    it('fills its pool round the camera', () => {
        const s = new SpeedStreaks();
        s.update({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 230 });
        expect(s.points).toHaveLength(STREAK_TUNING.count);
        for (const p of s.points) {
            expect(Math.abs(p.x)).toBeLessThan(STREAK_TUNING.radius * 3);
            expect(Math.abs(p.y - 1000)).toBeLessThan(STREAK_TUNING.radius * 3);
        }
    });

    it('re-seeds points the jet has flown past, ahead of it', () => {
        const s = new SpeedStreaks();
        s.update({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 230 });
        // Fly 2 km on: every point is now far behind and must come back ahead.
        s.update({ x: 0, y: 1000, z: 2000 }, { x: 0, y: 0, z: 230 });
        for (const p of s.points) expect(p.z).toBeGreaterThan(2000 - STREAK_TUNING.radius * 1.6);
    });

    it('fades out when slow and draws longer dashes when fast', () => {
        expect(SpeedStreaks.intensity(50)).toBe(0);
        expect(SpeedStreaks.intensity(400)).toBe(1);
        const p = { x: 0, y: 0, z: 0 };
        const slow = SpeedStreaks.tail(p, { x: 0, y: 0, z: 100 });
        const fast = SpeedStreaks.tail(p, { x: 0, y: 0, z: 300 });
        expect(Math.abs(fast.z)).toBeGreaterThan(Math.abs(slow.z));
    });
});
