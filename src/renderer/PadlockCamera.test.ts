import { describe, it, expect } from 'vitest';
import { PadlockCamera, PADLOCK_LIMITS, easeOutCubic } from './PadlockCamera';
import type { CameraBasisVectors } from './PadlockCamera';

const levelBasis: CameraBasisVectors = {
    forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 }
};

describe('easeOutCubic', () => {
    it('returns 0 at t=0 and 1 at t=1', () => {
        expect(easeOutCubic(0)).toBe(0);
        expect(easeOutCubic(1)).toBe(1);
    });

    it('has ease-out deceleration curve (f(0.5) > 0.5)', () => {
        expect(easeOutCubic(0.5)).toBe(0.875);
    });
});

describe('PadlockCamera', () => {
    it('calculates 0 azimuth and elevation for target dead ahead', () => {
        const camera = new PadlockCamera();
        const acPos = { x: 0, y: 1000, z: 0 };
        const tgtPos = { x: 0, y: 1000, z: 2000 };

        const angles = camera.calculateTargetAngles(acPos, levelBasis, tgtPos);
        expect(angles.azimuth).toBeCloseTo(0, 4);
        expect(angles.elevation).toBeCloseTo(0, 4);
    });

    it('calculates +90 degree azimuth for target directly off right wing', () => {
        const camera = new PadlockCamera();
        const acPos = { x: 0, y: 1000, z: 0 };
        const tgtPos = { x: 2000, y: 1000, z: 0 };

        const angles = camera.calculateTargetAngles(acPos, levelBasis, tgtPos);
        expect(angles.azimuth).toBeCloseTo(Math.PI / 2, 4);
        expect(angles.elevation).toBeCloseTo(0, 4);
    });

    it('clamps azimuth to +/- 110 degrees for targets behind the wing line', () => {
        const camera = new PadlockCamera();
        const acPos = { x: 0, y: 1000, z: 0 };
        // Target at 150 degrees right/rear
        const tgtPos = { x: 1000, y: 1000, z: -1732 };

        const angles = camera.calculateTargetAngles(acPos, levelBasis, tgtPos);
        expect(angles.azimuth).toBeCloseTo(PADLOCK_LIMITS.MAX_AZIMUTH_RAD, 4);
    });

    it('clamps elevation to [-30 deg, +60 deg] canopy limits', () => {
        const camera = new PadlockCamera();
        const acPos = { x: 0, y: 1000, z: 0 };

        // Target high above (+80 deg)
        const highTgt = { x: 0, y: 5000, z: 500 };
        const highAngles = camera.calculateTargetAngles(acPos, levelBasis, highTgt);
        expect(highAngles.elevation).toBeCloseTo(PADLOCK_LIMITS.MAX_ELEVATION_RAD, 4);

        // Target steep below (-60 deg)
        const lowTgt = { x: 0, y: -2000, z: 500 };
        const lowAngles = camera.calculateTargetAngles(acPos, levelBasis, lowTgt);
        expect(lowAngles.elevation).toBeCloseTo(PADLOCK_LIMITS.MIN_ELEVATION_RAD, 4);
    });

    it('smoothly interpolates offsets over 250ms when engaged', () => {
        const camera = new PadlockCamera();
        camera.setEnabled(true);

        const acPos = { x: 0, y: 1000, z: 0 };
        const tgtPos = { x: 2000, y: 1000, z: 2000 }; // 45 deg right

        // Update 125ms (halfway)
        const mid = camera.update(0.125, acPos, levelBasis, tgtPos);
        expect(mid.yawOffset).toBeGreaterThan(0);
        expect(mid.yawOffset).toBeLessThan(Math.PI / 4);

        // Update full 250ms
        const full = camera.update(0.125, acPos, levelBasis, tgtPos);
        expect(full.yawOffset).toBeCloseTo(Math.PI / 4, 3);
        expect(full.isPadlocked).toBe(true);
    });

    it('smoothly returns to boresight when target is lost or disengaged', () => {
        const camera = new PadlockCamera();
        camera.setEnabled(true);

        const acPos = { x: 0, y: 1000, z: 0 };
        const tgtPos = { x: 2000, y: 1000, z: 0 };

        // Settle on target
        camera.update(0.3, acPos, levelBasis, tgtPos);
        expect(camera.currentYawOffset).toBeCloseTo(Math.PI / 2, 2);

        // Disengage
        camera.setEnabled(false);
        camera.update(0.125, acPos, levelBasis, null);
        expect(camera.currentYawOffset).toBeLessThan(Math.PI / 2);

        camera.update(0.15, acPos, levelBasis, null);
        expect(camera.currentYawOffset).toBeCloseTo(0, 3);
        expect(camera.isPadlocked).toBe(false);
    });
});
