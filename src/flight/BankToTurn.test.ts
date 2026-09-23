import { describe, it, expect, beforeEach } from 'vitest';
import { AircraftPhysics } from './AircraftPhysics';

const DT = 1 / 120;

function fly(p: AircraftPhysics, seconds: number, control: (p: AircraftPhysics) => void) {
    for (let i = 0; i < seconds * 120; i++) {
        control(p);
        p.update(DT);
    }
}

/** Signed heading change, radians, wrapped to [-pi, pi]. */
function headingDelta(from: number, to: number) {
    const d = to - from;
    return Math.atan2(Math.sin(d), Math.cos(d));
}

describe('bank to turn', () => {
    let p: AircraftPhysics;

    beforeEach(() => {
        p = new AircraftPhysics();
        p.position = { x: 0, y: 2000, z: 0 };
        p.velocity = { x: 0, y: 0, z: 220 };
        p.throttle = 0.9;
        p.pitch = 0.03;
    });

    it('orientation basis is orthonormal at any attitude', () => {
        for (const [pitch, yaw, roll] of [[0, 0, 0.8], [0.4, 2.1, -1.2], [-0.7, 5, 2.5]]) {
            p.pitch = pitch; p.yaw = yaw; p.roll = roll;
            const f = p.forwardVector, u = p.upVector, r = p.rightVector;
            const dot = (a: typeof f, b: typeof f) => a.x * b.x + a.y * b.y + a.z * b.z;
            expect(dot(f, u)).toBeCloseTo(0, 9);
            expect(dot(f, r)).toBeCloseTo(0, 9);
            expect(dot(u, r)).toBeCloseTo(0, 9);
            expect(dot(u, u)).toBeCloseTo(1, 9);
        }
    });

    it('banking right tilts lift right, so the flight path curves right', () => {
        p.roll = 0.8;
        expect(p.upVector.x).toBeGreaterThan(0.5);
        fly(p, 3, () => { /* hold the bank */ });
        expect(p.velocity.x).toBeGreaterThan(5);
    });

    it('with turn assist, holding a right bank turns the nose right', () => {
        p.turnAssist = 1;
        fly(p, 8, (a) => { if (a.roll < 1.0) a.applyRollInput(1, DT); });
        expect(headingDelta(0, p.yaw)).toBeGreaterThan(0.6);
    });

    it('with turn assist, holding a left bank turns the nose left', () => {
        p.turnAssist = 1;
        fly(p, 8, (a) => { if (a.roll > -1.0) a.applyRollInput(-1, DT); });
        expect(headingDelta(0, p.yaw)).toBeLessThan(-0.6);
    });

    it('bank and pull swings the nose round faster than the bank alone', () => {
        p.turnAssist = 1;
        fly(p, 6, (a) => { if (a.roll < 1.0) a.applyRollInput(1, DT); });
        const bankOnly = headingDelta(0, p.yaw);

        const q = new AircraftPhysics();
        q.position = { x: 0, y: 2000, z: 0 };
        q.velocity = { x: 0, y: 0, z: 220 };
        q.throttle = 0.9; q.pitch = 0.03; q.turnAssist = 1;
        fly(q, 6, (a) => { if (a.roll < 1.0) a.applyRollInput(1, DT); a.applyPitchInput(0.6, DT); });
        expect(headingDelta(0, q.yaw)).toBeGreaterThan(bankOnly);
    });

    it('wings-level back-stick only pitches, it does not yaw', () => {
        fly(p, 2, (a) => a.applyPitchInput(0.5, DT));
        expect(p.pitch).toBeGreaterThan(0.2);
        expect(Math.abs(headingDelta(0, p.yaw))).toBeLessThan(0.02);
    });

    it('the turn assist caps an upright bank at 75 degrees and never lets it roll over', () => {
        p.turnAssist = 1;
        const limit = 75 * Math.PI / 180;
        let peak = 0;
        fly(p, 6, (a) => {
            a.applyRollInput(1, DT);
            peak = Math.max(peak, Math.abs(a.roll));
        });
        // Held for six seconds - long enough to barrel-roll several times if
        // the cap leaked - the bank never exceeds the limit.
        expect(peak).toBeLessThanOrEqual(limit + 1e-9);
        expect(peak).toBeGreaterThan(limit - 0.05);
    });

    it('an inverted jet can still roll out (the cap only guards the upright side)', () => {
        p.turnAssist = 1;
        p.roll = Math.PI - 0.1;
        fly(p, 1, (a) => a.applyRollInput(1, DT));
        // Rolled out of the inverted attitude to upright rather than being
        // held there by the cap.
        expect(Math.abs(p.roll)).toBeLessThan(Math.PI / 2);
    });

    it('without turn assist the raw model is unchanged: roll is unlimited', () => {
        fly(p, 3, (a) => a.applyRollInput(1, DT));
        expect(Math.abs(p.roll)).toBeGreaterThan(80 * Math.PI / 180);
    });
});

describe('loops through the vertical', () => {
    it('pitch is never clamped and passes over the top without NaN', () => {
        const p = new AircraftPhysics();
        p.turnAssist = 1;
        p.position = { x: 0, y: 2500, z: 0 };
        p.velocity = { x: 0, y: 0, z: 260 };
        p.throttle = 1.5;
        p.pitch = 0.03;
        let peakClimb = 0;
        let sawFoldedAttitude = false;
        for (let i = 0; i < 120 * 14; i++) {
            p.applyPitchInput(1, DT);
            p.update(DT);
            expect(Number.isFinite(p.pitch + p.yaw + p.roll)).toBe(true);
            expect(Math.abs(p.pitch)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
            peakClimb = Math.max(peakClimb, p.forwardVector.y);
            // Past vertical the nose points back toward where it started (-Z)
            // while the pitch stays folded below 90 degrees.
            if (p.forwardVector.z < -0.05 && p.forwardVector.y > 0) sawFoldedAttitude = true;
        }
        expect(peakClimb).toBeGreaterThan(0.99);
        expect(sawFoldedAttitude).toBe(true);
    });

    it('folding past vertical preserves the direction the nose points', () => {
        const p = new AircraftPhysics();
        p.turnAssist = 0;
        p.velocity = { x: 0, y: 0, z: 200 };
        p.pitch = 1.55; p.yaw = 0.4; p.roll = 0.2;
        const before = p.forwardVector;
        p.applyPitchInput(0.4, DT); // crosses 90 degrees
        // The nose moved a small step, it did not teleport.
        const after = p.forwardVector;
        const d = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
        expect(d).toBeLessThan(0.05);
    });
});

describe('coordinated turning (v1.10.0)', () => {
    let p: AircraftPhysics;

    beforeEach(() => {
        p = new AircraftPhysics();
        p.position = { x: 0, y: 2500, z: 0 };
        p.velocity = { x: 0, y: 0, z: 200 };
        p.throttle = 1.0;
        p.turnAssist = 1;
    });

    /**
     * Directional stability acts about the BODY yaw axis.
     *
     * It used to act about the world vertical, which is right wings-level and
     * wrong in a bank: nothing pulled a banked nose back down to the flight
     * path. Measured before the fix, 16 s of held bank left the nose 43 deg
     * above the horizon while the jet DESCENDED 146 m - a large sideslip the
     * model never corrected, and the reason every held bank became a slow
     * climbing spiral.
     */
    it('keeps the nose on the flight path in a sustained bank (no climbing spiral)', () => {
        p.throttle = 1.0; p.pitch = 0; p.position.y = 2500; p.velocity = { x: 0, y: 0, z: 200 };
        p.turnAssist = 1;
        fly(p, 16, (a) => a.applyRollInput(-1, DT));
        const pathPitch = Math.asin(p.velocity.y / p.airSpeed);
        expect(Math.abs(p.pitch - pathPitch)).toBeLessThan(15 * Math.PI / 180);
        expect(p.pitch).toBeLessThan(20 * Math.PI / 180);
    });

    it('reduces sideslip when banked', () => {
        p.turnAssist = 1; p.throttle = 1.0; p.position.y = 2500;
        fly(p, 1, (a) => a.applyRollInput(-1, DT));
        const slip = () => {
            const r = p.rightVector;
            return Math.abs((p.velocity.x * r.x + p.velocity.y * r.y + p.velocity.z * r.z) / p.airSpeed);
        };
        fly(p, 12, () => {});
        expect(slip()).toBeLessThan(0.1);
    });

    /**
     * #70: the saturated case the older bank-and-pull test never covered - full
     * deflection, sustained, from the state the game actually creates. The
     * property the game promises is that holding the stick keeps turning; it
     * must not collapse to a stationary heading.
     */
    it('a held full-deflection bank-and-pull keeps turning for 16 s', () => {
        p.turnAssist = 1; p.throttle = 1.0; p.position.y = 2500; p.velocity = { x: 0, y: 0, z: 200 };
        let turned = 0;
        let prev = p.yaw;
        fly(p, 16, (a) => {
            a.applyRollInput(-1, DT);
            a.applyPitchInput(1, DT);
            turned += headingDelta(prev, a.yaw);
            prev = a.yaw;
        });
        // 16 s at no less than 6 deg/s, and never stalled at the end.
        expect(Math.abs(turned)).toBeGreaterThan(16 * 6 * Math.PI / 180);
        expect(p.isStalled).toBe(false);
    });

    it('the ARCADE airframe (liftScale 1.7) turns faster and holds altitude in a held bank', () => {
        const run = (liftScale: number) => {
            const q = new AircraftPhysics();
            q.position = { x: 0, y: 2500, z: 0 };
            q.velocity = { x: 0, y: 0, z: 200 };
            q.throttle = 1.0; q.turnAssist = 1; q.liftScale = liftScale;
            let turned = 0;
            let prev = q.yaw;
            fly(q, 16, (a) => {
                a.applyRollInput(-1, DT);
                turned += headingDelta(prev, a.yaw);
                prev = a.yaw;
            });
            return { rate: Math.abs(turned) / 16 * 180 / Math.PI, dAlt: q.position.y - 2500 };
        };
        const sim = run(1);
        const arcade = run(1.7);
        expect(arcade.rate).toBeGreaterThan(sim.rate * 1.2);
        expect(arcade.rate).toBeGreaterThan(11);
        // A bigger wing carries more drag as well as more lift, so the arcade
        // jet still sinks a little in a hands-off 75-degree bank - but far less
        // than the original airframe (measured: -126 m versus -284 m in 16 s).
        expect(Math.abs(arcade.dAlt)).toBeLessThan(Math.abs(sim.dAlt) * 0.6);
    });
});
