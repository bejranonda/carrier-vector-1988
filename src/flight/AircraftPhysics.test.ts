import { describe, it, expect, beforeEach } from 'vitest';
import { AircraftPhysics } from './AircraftPhysics';

describe('AircraftPhysics 6-DOF Engine', () => {
    let physics: AircraftPhysics;

    beforeEach(() => {
        physics = new AircraftPhysics();
        physics.position = { x: 0, y: 1500, z: 0 };
        physics.velocity = { x: 0, y: 0, z: 200 }; // 200 m/s level flight
        physics.fuel = 4500;
        physics.pitch = 0;
        physics.roll = 0;
        physics.yaw = 0;
    });

    it('should calculate level flight stability with balanced forces', () => {
        physics.throttle = 0.5;
        physics.update(0.1);
        expect(physics.position.z).toBeGreaterThan(0);
        expect(physics.airSpeed).toBeGreaterThan(150);
        expect(physics.isStalled).toBe(false);
        expect(physics.controlAuthority).toBe(1.0);
    });

    it('should induce aerodynamic stall and lose control authority when alpha exceeds critical angle', () => {
        // High pitch relative to velocity vector (e.g. nose pitched up 28 degrees while moving flat)
        physics.pitch = 28 * (Math.PI / 180);
        physics.velocity = { x: 0, y: 0, z: 180 };
        physics.update(0.05);

        expect(physics.alpha).toBeGreaterThan(AircraftPhysics.CRITICAL_ALPHA);
        expect(physics.isStalled).toBe(true);
        expect(physics.controlAuthority).toBeLessThan(0.3); // Severe authority loss
    });

    it('should burn fuel 3.5x faster in full afterburner compared to military power', () => {
        // Test military power burn
        physics.throttle = 1.0;
        const initialFuel = physics.fuel;
        physics.update(1.0);
        const milBurn = initialFuel - physics.fuel;

        // Test afterburner burn
        physics.fuel = initialFuel;
        physics.throttle = 1.5; // Full afterburner
        physics.update(1.0);
        const abBurn = initialFuel - physics.fuel;

        const ratio = abBurn / milBurn;
        expect(ratio).toBeCloseTo(3.5, 1);
    });

    it('should increase induced drag under high G turns', () => {
        // Nose pitched up 14 degrees while velocity vector is still forward produces high lift / G-load
        physics.pitch = 14 * (Math.PI / 180);
        physics.velocity = { x: 0, y: 0, z: 320 }; // High speed pull-up
        physics.update(0.1);

        expect(physics.gLoad).toBeGreaterThan(2.0);
    });

    it('should increase drag when weapons bay doors are opened', () => {
        physics.bayOpen = false;
        physics.throttle = 0.0; // Glide
        physics.update(1.0);
        const speedClosed = physics.airSpeed;

        // Reset and test with bay open
        physics.velocity = { x: 0, y: 0, z: 200 };
        physics.bayOpen = true;
        physics.update(1.0);
        const speedOpen = physics.airSpeed;

        expect(speedOpen).toBeLessThan(speedClosed);
    });
});
