import { describe, it, expect } from 'vitest';
import { TimeRewindBuffer, REWIND_CONFIG } from './TimeRewind';
import { AircraftPhysics } from '../flight/AircraftPhysics';

function createTestPhysics(): AircraftPhysics {
    const physics = new AircraftPhysics();
    physics.position = { x: 0, y: 1000, z: 0 };
    physics.velocity = { x: 0, y: 0, z: 200 };
    physics.pitch = 0.05;
    physics.yaw = 0;
    physics.roll = 0;
    physics.fuel = 4000;
    physics.damage = 0;
    return physics;
}

describe('TimeRewindBuffer', () => {
    it('initializes with max rewinds available and empty count', () => {
        const buffer = new TimeRewindBuffer(5.0, 20);
        expect(buffer.rewindsRemaining).toBe(REWIND_CONFIG.MAX_REWINDS_PER_SORTIE);
        expect(buffer.canRewind()).toBe(false);
    });

    it('collects samples over time and enables rewind after 6 samples', () => {
        const buffer = new TimeRewindBuffer(5.0, 20);
        const physics = createTestPhysics();

        // 6 samples at 20Hz = 0.3s
        for (let i = 0; i < 6; i++) {
            buffer.update(0.05, physics);
        }

        expect(buffer.canRewind()).toBe(true);
    });

    it('restores aircraft telemetry from the past upon triggering rewind', () => {
        const buffer = new TimeRewindBuffer(5.0, 20);
        const physics = createTestPhysics();

        const initialPos = { ...physics.position };
        const initialZ = initialPos.z;

        // Fly forward for 3 seconds, changing position significantly
        for (let t = 0; t < 3.0; t += 0.05) {
            physics.position.z += physics.velocity.z * 0.05; // moves +10m each tick
            buffer.update(0.05, physics);
        }

        expect(physics.position.z).toBeGreaterThan(initialZ + 500);

        // Inflict damage right before rewind
        physics.damage = 80;

        const success = buffer.triggerRewind(physics);
        expect(success).toBe(true);

        // Position should be restored back near initial
        expect(physics.position.z).toBeLessThanOrEqual(20);
        expect(physics.position.z).toBeGreaterThanOrEqual(initialZ);
        expect(buffer.rewindsRemaining).toBe(REWIND_CONFIG.MAX_REWINDS_PER_SORTIE - 1);
        expect(buffer.isRewindingEffect).toBeGreaterThan(0);
    });

    it('limits rewinds to MAX_REWINDS_PER_SORTIE budget', () => {
        const buffer = new TimeRewindBuffer(5.0, 20);
        const physics = createTestPhysics();

        // Fill buffer
        for (let i = 0; i < 20; i++) {
            buffer.update(0.05, physics);
        }

        // Trigger 1st rewind
        expect(buffer.triggerRewind(physics)).toBe(true);

        // Refill buffer
        for (let i = 0; i < 20; i++) {
            buffer.update(0.05, physics);
        }

        // Trigger 2nd rewind
        expect(buffer.triggerRewind(physics)).toBe(true);
        expect(buffer.rewindsRemaining).toBe(0);

        // Refill buffer
        for (let i = 0; i < 20; i++) {
            buffer.update(0.05, physics);
        }

        // 3rd attempt must fail
        expect(buffer.canRewind()).toBe(false);
        expect(buffer.triggerRewind(physics)).toBe(false);
    });

    it('clears state upon reset', () => {
        const buffer = new TimeRewindBuffer();
        const physics = createTestPhysics();
        for (let i = 0; i < 20; i++) buffer.update(0.05, physics);
        buffer.triggerRewind(physics);

        buffer.reset();
        expect(buffer.rewindsRemaining).toBe(REWIND_CONFIG.MAX_REWINDS_PER_SORTIE);
        expect(buffer.canRewind()).toBe(false);
    });
});
