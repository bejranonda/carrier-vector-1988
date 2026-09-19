import { describe, it, expect } from 'vitest';
import { StrikeTarget } from './StrikeTarget';
import type { StrikeTargetSpec } from './StrikeTarget';

const SPEC: StrikeTargetSpec = {
    id: 'TARGET-ALPHA',
    name: 'HARDENED SUBMARINE PEN',
    description: 'test fixture',
    x: 60,
    z: 10400,
    height: 46,
    hitRadius: 55,
    hitsRequired: 1
};

const at = (x: number, z: number) => ({ x, y: 20, z });

describe('StrikeTarget', () => {
    it('sits on the terrain it was placed on', () => {
        const t = new StrikeTarget(SPEC, 18);
        expect(t.position).toEqual({ x: 60, y: 18, z: 10400 });
    });

    it('measures range horizontally, ignoring the jet altitude', () => {
        const t = new StrikeTarget(SPEC, 18);
        expect(t.horizontalDistanceTo({ x: 60, y: 4000, z: 10400 })).toBeCloseTo(0, 5);
        expect(t.horizontalDistanceTo({ x: 60, y: 20, z: 9400 })).toBeCloseTo(1000, 5);
    });

    // The whole point of a hardened target: a near miss does nothing, which is
    // what forces a low aimed delivery instead of a lob from altitude.
    it('is not destroyed by a near miss', () => {
        const t = new StrikeTarget(SPEC, 18);
        expect(t.registerImpact(at(60, 10400 - 56))).toBe(false);
        expect(t.registerImpact(at(60 + 120, 10400))).toBe(false);
        expect(t.hits).toBe(0);
        expect(t.destroyed).toBe(false);
    });

    it('is destroyed by a bomb inside the hit radius', () => {
        const t = new StrikeTarget(SPEC, 18);
        expect(t.registerImpact(at(60, 10400 - 40))).toBe(true);
        expect(t.destroyed).toBe(true);
        expect(t.hits).toBe(1);
    });

    it('counts a hit exactly on the radius boundary', () => {
        const t = new StrikeTarget(SPEC, 18);
        expect(t.registerImpact(at(60, 10400 - 55))).toBe(true);
    });

    it('needs every required hit before it goes down', () => {
        const t = new StrikeTarget({ ...SPEC, hitsRequired: 3 }, 18);
        expect(t.registerImpact(at(60, 10400))).toBe(true);
        expect(t.destroyed).toBe(false);
        t.registerImpact(at(60, 10400));
        expect(t.destroyed).toBe(false);
        t.registerImpact(at(60, 10400));
        expect(t.destroyed).toBe(true);
    });

    it('ignores impacts after destruction, so the score cannot be farmed', () => {
        const t = new StrikeTarget(SPEC, 18);
        t.registerImpact(at(60, 10400));
        expect(t.registerImpact(at(60, 10400))).toBe(false);
        expect(t.hits).toBe(1);
    });
});
