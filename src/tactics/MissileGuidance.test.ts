import { describe, it, expect } from 'vitest';
import {
    SAM_MISSILE,
    dot,
    guideMissile,
    leadInterceptPoint,
    length,
    normalise,
    rotateToward,
    timeToImpact
} from './MissileGuidance';
import type { Vector3 } from '../flight/AircraftPhysics';

const v = (x: number, y: number, z: number): Vector3 => ({ x, y, z });

function angleBetween(a: Vector3, b: Vector3): number {
    const na = normalise(a);
    const nb = normalise(b);
    if (!na || !nb) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(na, nb))));
}

describe('rotateToward', () => {
    it('snaps to the target when it is within budget', () => {
        const out = rotateToward(v(1, 0, 0), v(0, 1, 0), Math.PI);
        expect(out.x).toBeCloseTo(0, 6);
        expect(out.y).toBeCloseTo(1, 6);
    });

    it('never rotates further than the budget allows', () => {
        const from = v(1, 0, 0);
        const to = v(0, 1, 0); // 90 degrees away
        const budget = 0.2;
        const out = rotateToward(from, to, budget);
        expect(angleBetween(from, out)).toBeCloseTo(budget, 6);
    });

    it('returns a unit vector', () => {
        const out = rotateToward(v(3, 0, 0), v(0, 0, 7), 0.3);
        expect(length(out)).toBeCloseTo(1, 9);
    });

    it('moves toward the target, not away from it', () => {
        const from = v(1, 0, 0);
        const to = v(0, 1, 0);
        const out = rotateToward(from, to, 0.4);
        expect(angleBetween(out, to)).toBeLessThan(angleBetween(from, to));
    });

    // REGRESSION: a missile aimed at something directly behind it has no
    // unique arc to rotate along. Normalising a zero-length tangent produced
    // NaN and the round silently disappeared from the simulation.
    it('handles an exactly antiparallel target without producing NaN', () => {
        const out = rotateToward(v(1, 0, 0), v(-1, 0, 0), 0.3);
        expect(Number.isFinite(out.x)).toBe(true);
        expect(Number.isFinite(out.y)).toBe(true);
        expect(Number.isFinite(out.z)).toBe(true);
        expect(length(out)).toBeCloseTo(1, 6);
        expect(angleBetween(out, v(1, 0, 0))).toBeCloseTo(0.3, 6);
    });

    it('survives zero-length inputs', () => {
        expect(() => rotateToward(v(0, 0, 0), v(1, 0, 0), 0.1)).not.toThrow();
        expect(() => rotateToward(v(1, 0, 0), v(0, 0, 0), 0.1)).not.toThrow();
    });
});

describe('leadInterceptPoint', () => {
    it('aims straight at a stationary target', () => {
        const aim = leadInterceptPoint(v(0, 0, 0), v(1000, 0, 0), v(0, 0, 0), 480);
        expect(aim.x).toBeCloseTo(1000, 3);
        expect(aim.z).toBeCloseTo(0, 3);
    });

    it('leads a crossing target ahead of where it is now', () => {
        // Target 2 km downrange, running across the missile's nose at 250 m/s.
        const aim = leadInterceptPoint(v(0, 0, 0), v(0, 0, 2000), v(250, 0, 0), 480);
        expect(aim.x).toBeGreaterThan(0);
        // And the lead is physically consistent: the flight time to the aim
        // point matches the time the target needs to reach it.
        const flightTime = length(v(aim.x, aim.y, aim.z - 0)) / 480;
        expect(aim.x / 250).toBeCloseTo(flightTime, 1);
    });

    it('falls back to pure pursuit when no intercept exists', () => {
        // Target running directly away, faster than the missile flies.
        const aim = leadInterceptPoint(v(0, 0, 0), v(0, 0, 1000), v(0, 0, 900), 480);
        expect(aim.z).toBeCloseTo(1000, 3);
    });

    it('does not return NaN when target speed equals missile speed', () => {
        const aim = leadInterceptPoint(v(0, 0, 0), v(0, 0, 2000), v(480, 0, 0), 480);
        expect(Number.isFinite(aim.x)).toBe(true);
        expect(Number.isFinite(aim.z)).toBe(true);
    });
});

describe('timeToImpact', () => {
    it('divides closing range by closing speed', () => {
        const tti = timeToImpact(v(0, 0, 0), v(0, 0, 480), v(0, 0, 960));
        expect(tti).toBeCloseTo(2, 6);
    });

    it('is null when the missile is not closing', () => {
        expect(timeToImpact(v(0, 0, 0), v(0, 0, -480), v(0, 0, 960))).toBeNull();
    });

    it('is null when the missile has no velocity', () => {
        expect(timeToImpact(v(0, 0, 0), v(0, 0, 0), v(0, 0, 960))).toBeNull();
    });
});

describe('guideMissile holds its speed and respects the turn limit', () => {
    it('keeps the commanded speed', () => {
        const out = guideMissile(v(0, 0, 0), v(0, 0, 100), v(500, 0, 500), v(0, 0, 0), 1 / 120);
        expect(length(out)).toBeCloseTo(SAM_MISSILE.speed, 3);
    });

    it('cannot turn faster than the law allows', () => {
        const dt = 1 / 120;
        const before = v(0, 0, SAM_MISSILE.speed);
        // Target directly abeam: demands a 90-degree turn.
        const after = guideMissile(v(0, 0, 0), before, v(4000, 0, 0), v(0, 0, 0), dt);
        expect(angleBetween(before, after))
            .toBeLessThanOrEqual(SAM_MISSILE.maxTurnRateRadPerSec * dt + 1e-9);
    });

    it('takes the desired heading directly when leaving the rail with no velocity', () => {
        const out = guideMissile(v(0, 0, 0), v(0, 0, 0), v(0, 0, 1000), v(0, 0, 0), 1 / 120);
        expect(length(out)).toBeCloseTo(SAM_MISSILE.speed, 3);
        expect(out.z).toBeGreaterThan(0);
    });
});

/**
 * The point of the whole module: the envelope has to have a GRADIENT. A hard
 * break must defeat a shot taken at long range and must NOT defeat one fired
 * from close in, because that difference is the entire skill of surviving a
 * SAM. Before this law existed the missile re-pointed itself every tick and
 * no manoeuvre could ever work.
 */
describe('the defensive envelope', () => {
    const DT = 1 / 120;
    const FUZE = 40; // SensorTacticsManager.FUZE_RADIUS

    /**
     * Fly a missile against a jet ingressing toward the launcher, and report
     * the closest it ever gets.
     *
     * `reactAfter` is how many seconds the pilot takes to start hauling the
     * aeroplane round - `Infinity` for a pilot who never reacts at all.
     */
    function closestApproach(launchRange: number, reactAfter: number): number {
        const speed = 250;       // m/s, a fighter at combat speed
        const jetTurn = 0.6;     // rad/s, a hard sustained break
        let acPos = v(launchRange, 800, 0);
        let heading = -Math.PI / 2;  // flying at the site
        let mPos = v(0, 50, 0);
        let mVel = v(0, 0, 0);
        let closest = Infinity;

        for (let t = 0; t < SAM_MISSILE.fuelSeconds; t += DT) {
            const acVel = v(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
            if (t >= reactAfter) heading += jetTurn * DT;
            acPos = { x: acPos.x + acVel.x * DT, y: acPos.y, z: acPos.z + acVel.z * DT };

            mVel = guideMissile(mPos, mVel, acPos, acVel, DT);
            mPos = { x: mPos.x + mVel.x * DT, y: mPos.y + mVel.y * DT, z: mPos.z + mVel.z * DT };

            closest = Math.min(closest, length(v(acPos.x - mPos.x, acPos.y - mPos.y, acPos.z - mPos.z)));
        }
        return closest;
    }

    // Without this the guidance law is pointless - a missile nobody has to
    // respect is scenery.
    it('kills a pilot who does not react', () => {
        expect(closestApproach(3000, Infinity)).toBeLessThanOrEqual(FUZE);
        expect(closestApproach(1500, Infinity)).toBeLessThanOrEqual(FUZE);
        expect(closestApproach(4500, Infinity)).toBeLessThanOrEqual(FUZE);
    });

    // The whole reason the law exists. Before it, the missile re-pointed
    // itself every tick and this was impossible at any range.
    it('can be out-flown when the launch comes from far enough away', () => {
        expect(closestApproach(3000, 0)).toBeGreaterThan(FUZE);
        expect(closestApproach(4500, 0)).toBeGreaterThan(FUZE);
    });

    // And the reason countermeasures exist. If flying well always worked,
    // chaff would have no job and the dispenser would be decoration.
    it('cannot be out-flown from close range, however hard the pilot pulls', () => {
        expect(closestApproach(1500, 0)).toBeLessThanOrEqual(FUZE);
    });

    it('punishes a slow reaction more than a fast one', () => {
        expect(closestApproach(3000, 0)).toBeGreaterThan(closestApproach(3000, 2));
    });
});
