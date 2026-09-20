import { describe, it, expect } from 'vitest';
import { VectorDebrisSystem, rotateAroundAxis, DEBRIS_CONFIG } from './VectorDebris';
import type { WireframeLine } from './VectorRenderer';

describe('rotateAroundAxis', () => {
    it('preserves vector length under rotation', () => {
        const v = { x: 3, y: 4, z: 0 };
        const axis = { x: 0, y: 1, z: 0 };
        const rotated = rotateAroundAxis(v, axis, Math.PI / 4);
        const origLen = Math.hypot(v.x, v.y, v.z);
        const rotLen = Math.hypot(rotated.x, rotated.y, rotated.z);
        expect(rotLen).toBeCloseTo(origLen, 4);
    });

    it('correctly rotates 90 degrees around Y axis', () => {
        const v = { x: 1, y: 0, z: 0 };
        const axis = { x: 0, y: 1, z: 0 };
        const rotated = rotateAroundAxis(v, axis, Math.PI / 2);
        expect(rotated.x).toBeCloseTo(0, 4);
        expect(rotated.y).toBeCloseTo(0, 4);
        expect(rotated.z).toBeCloseTo(-1, 4);
    });

    it('returns original vector when theta is 0', () => {
        const v = { x: 2, y: -5, z: 3 };
        const axis = { x: 1, y: 0, z: 0 };
        const rotated = rotateAroundAxis(v, axis, 0);
        expect(rotated.x).toBeCloseTo(v.x, 5);
        expect(rotated.y).toBeCloseTo(v.y, 5);
        expect(rotated.z).toBeCloseTo(v.z, 5);
    });
});

describe('VectorDebrisSystem', () => {
    it('spawns 10 to 16 fragments upon target mesh destruction', () => {
        const system = new VectorDebrisSystem();
        const dummyLines: WireframeLine[] = [
            { p1: { x: -2, y: 0, z: 0 }, p2: { x: 2, y: 0, z: 0 }, color: '#ff3333' },
            { p1: { x: 0, y: 0, z: -2 }, p2: { x: 0, y: 0, z: 2 }, color: '#ff3333' }
        ];

        system.spawnFromMesh(dummyLines, { x: 100, y: 500, z: 2000 });
        expect(system.fragments.length).toBeGreaterThanOrEqual(DEBRIS_CONFIG.MIN_FRAGMENTS);
        expect(system.fragments.length).toBeLessThanOrEqual(DEBRIS_CONFIG.MAX_FRAGMENTS);

        for (const f of system.fragments) {
            expect(f.life).toBe(DEBRIS_CONFIG.DEFAULT_LIFESPAN);
            expect(f.maxLife).toBe(DEBRIS_CONFIG.DEFAULT_LIFESPAN);
            expect(Number.isFinite(f.vel.x)).toBe(true);
            expect(Number.isFinite(f.vel.y)).toBe(true);
            expect(Number.isFinite(f.vel.z)).toBe(true);
        }
    });

    it('inherits parent aircraft momentum in fragment velocities', () => {
        const system = new VectorDebrisSystem();
        const parentVel = { x: 0, y: 0, z: 250 }; // High speed forward ingress
        system.spawnFromMesh([], { x: 0, y: 1000, z: 0 }, parentVel, '#ffaa00', 12);

        // Every fragment should have significant +Z velocity due to parent momentum
        for (const f of system.fragments) {
            expect(f.vel.z).toBeGreaterThan(200);
        }
    });

    it('applies gravity and drag over simulation updates', () => {
        const system = new VectorDebrisSystem();
        system.spawnFromMesh([], { x: 0, y: 1000, z: 0 }, { x: 50, y: 0, z: 0 }, '#ffffff', 10);

        const initialVy = system.fragments[0].vel.y;
        const initialVx = system.fragments[0].vel.x;

        // Update 0.1s
        system.update(0.1, () => 0);

        // Y velocity should decrease due to gravity (-9.81 m/s^2)
        expect(system.fragments[0].vel.y).toBeLessThan(initialVy);
        // Drag should reduce magnitude of horizontal velocity
        expect(Math.abs(system.fragments[0].vel.x)).toBeLessThan(Math.abs(initialVx));
    });

    it('midpoint tumble preserves segment length across ticks', () => {
        const system = new VectorDebrisSystem();
        system.spawnFromMesh([], { x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 0 }, '#ffffff', 10);
        const f = system.fragments[0];

        const initialLen = Math.hypot(f.p1.x - f.p2.x, f.p1.y - f.p2.y, f.p1.z - f.p2.z);

        system.update(0.2, () => 0);

        const newLen = Math.hypot(f.p1.x - f.p2.x, f.p1.y - f.p2.y, f.p1.z - f.p2.z);
        expect(newLen).toBeCloseTo(initialLen, 3);
    });

    it('decays and purges dead fragments after lifespan expires', () => {
        const system = new VectorDebrisSystem();
        system.spawnFromMesh([], { x: 0, y: 500, z: 0 }, { x: 0, y: 0, z: 0 }, '#ffffff', 12);
        expect(system.fragments.length).toBe(12);

        // Advance past lifespan (1.2s)
        system.update(1.5, () => 0);
        expect(system.fragments.length).toBe(0);
    });

    it('clamps active fragments to MAX_ACTIVE_FRAGMENTS capacity', () => {
        const system = new VectorDebrisSystem();
        for (let i = 0; i < 20; i++) {
            system.spawnFromMesh([], { x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 0 }, '#ffffff', 16);
        }
        expect(system.fragments.length).toBeLessThanOrEqual(DEBRIS_CONFIG.MAX_ACTIVE_FRAGMENTS);
    });
});
