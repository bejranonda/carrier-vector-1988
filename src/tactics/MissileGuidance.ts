/**
 * CARRIER VECTOR: 1988 - Missile Guidance Law
 *
 * WHY THIS EXISTS
 * The SAM missile used to be undodgeable, and not as a difficulty choice -
 * as an accident of arithmetic. Every tick it did this:
 *
 *     missileVel = normalise(aircraft.position - missile.position) * 480
 *
 * The velocity was *overwritten*, so the missile could reverse through 180
 * degrees between two frames at no cost. There was no turn rate, no G limit,
 * no energy bleed and no lead. A break turn, a notch, a split-S - every
 * defensive move a player brings from thirty years of the genre - did
 * precisely nothing, because the missile simply rotated to follow.
 *
 * The only escapes were terrain masking and outliving the motor, so the peak
 * tension moment of the game resolved as a dice roll on whether a ridge
 * happened to be nearby. A playtester reported this as "I don't know how to
 * make defence when missile come to me". They were right: there was none.
 *
 * THE LAW
 * Two changes, both of which give the player something to do:
 *
 * 1. **Lead pursuit.** The missile aims where the aeroplane is *going*, not
 *    where it is. This makes it more dangerous in a straight line - and more
 *    beatable in a turn, because a turn invalidates the lead it committed to.
 *
 * 2. **A turn rate limit.** The heading may rotate by at most
 *    `maxTurnRate * dt` per tick. This is what converts geometry into skill:
 *    hauling the aeroplane across the missile's flight path forces it to pull
 *    lateral G it does not have, and it sails past.
 *
 * Deliberately NOT modelled: energy bleed in the turn, seeker field of view,
 * minimum engagement range. Each would add realism and a failure mode a
 * player cannot see. The turn rate alone is legible - you can watch the
 * missile fail to keep up - and legibility is the point.
 *
 * Pure functions of vectors and time, so the envelope can be asserted in a
 * test rather than eyeballed from the cockpit.
 */

import type { Vector3 } from '../flight/AircraftPhysics';

export const SAM_MISSILE = {
    /** Cruise speed, m/s (~Mach 1.5 at altitude). */
    speed: 480,
    /**
     * Maximum heading change, radians per second.
     *
     * 0.25 rad/s at 480 m/s is about 120 m/s^2 of lateral acceleration - call
     * it 12 g - which is a fair figure for a 1980s medium-range SAM and, more
     * to the point, is the value that produces a playable envelope.
     *
     * This number was not guessed. It was measured, by flying the law against
     * a jet at 250 m/s and recording the closest approach:
     *
     *     turn rate   straight   break at once (3 km)   break at once (1.5 km)
     *     0.20 rad/s      2 m           289 m                   123 m
     *     0.25 rad/s      2 m            98 m                    29 m
     *     0.30 rad/s      2 m             2 m                     2 m
     *
     * At 0.30 even an instant reaction dies, so there is no defence and we are
     * back where we started. At 0.20 a break defeats the missile even at point
     * blank, so the countermeasure has nothing to do. 0.25 is the value where
     * all three of the behaviours the game wants are true at once, against a
     * 40 m fuze:
     *
     *   - fly straight and you are hit, at every range;
     *   - react at once to a distant launch and you live, for free;
     *   - react to a close one and you still die, so chaff has a job.
     *
     * That gradient is the skill. It is asserted in MissileGuidance.test.ts,
     * so retuning this constant without re-checking the envelope will fail.
     */
    maxTurnRateRadPerSec: 0.25,
    /** Motor burn time, seconds. After this the round is spent. */
    fuelSeconds: 10.0,
    /** Length of the drawn tracer, metres. */
    tracerLength: 34
} as const;

/** Squared length, without the square root. */
function lengthSq(v: Vector3): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function length(v: Vector3): number {
    return Math.sqrt(lengthSq(v));
}

/** Unit vector, or null when the input has no direction to normalise. */
export function normalise(v: Vector3): Vector3 | null {
    const len = length(v);
    if (len < 1e-9) return null;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Rotate the unit vector `from` toward the unit vector `to`, by at most
 * `maxRadians`.
 *
 * Spherical linear interpolation done the cheap way: work out the angle
 * between the two, and if it is within budget just snap to the target;
 * otherwise walk that fraction of the way along the arc. The component of
 * `to` perpendicular to `from` gives the arc's tangent direction.
 *
 * The antiparallel case (exactly 180 degrees apart) has no unique arc - every
 * great circle through the two points is equally valid - so we pick an
 * arbitrary perpendicular rather than dividing by a zero-length tangent.
 * Without that guard a missile fired at a target directly behind it produces
 * NaN and vanishes from the simulation.
 */
export function rotateToward(from: Vector3, to: Vector3, maxRadians: number): Vector3 {
    const a = normalise(from);
    const b = normalise(to);
    if (!a || !b) return from;
    if (maxRadians <= 0) return a;

    const cosAngle = Math.max(-1, Math.min(1, dot(a, b)));
    const angle = Math.acos(cosAngle);

    if (angle <= maxRadians) return b;
    if (angle < 1e-9) return a;

    // Tangent: the part of b that is perpendicular to a, renormalised.
    let tangent = normalise({
        x: b.x - a.x * cosAngle,
        y: b.y - a.y * cosAngle,
        z: b.z - a.z * cosAngle
    });

    if (!tangent) {
        // Exactly antiparallel. Any perpendicular will do; build one from
        // whichever world axis is least aligned with `a`.
        const axis: Vector3 = Math.abs(a.y) < 0.9
            ? { x: 0, y: 1, z: 0 }
            : { x: 1, y: 0, z: 0 };
        tangent = normalise({
            x: axis.y * a.z - axis.z * a.y,
            y: axis.z * a.x - axis.x * a.z,
            z: axis.x * a.y - axis.y * a.x
        });
        if (!tangent) return a;
    }

    const cos = Math.cos(maxRadians);
    const sin = Math.sin(maxRadians);
    return {
        x: a.x * cos + tangent.x * sin,
        y: a.y * cos + tangent.y * sin,
        z: a.z * cos + tangent.z * sin
    };
}

/**
 * Where to aim to hit a target that keeps moving.
 *
 * Solves for the flight time `t` at which the missile, travelling at
 * `missileSpeed`, arrives at the same place as a target that continues on its
 * present velocity. That is the quadratic
 *
 *     |targetPos + targetVel*t - missilePos|^2 = (missileSpeed*t)^2
 *
 * which expands to `a*t^2 + b*t + c = 0` with
 *
 *     a = |targetVel|^2 - missileSpeed^2
 *     b = 2 * dot(targetVel, targetPos - missilePos)
 *     c = |targetPos - missilePos|^2
 *
 * Returns the intercept point, or falls back to the target's current position
 * when no positive real root exists - a target running away faster than the
 * missile flies has no intercept, and pure pursuit is the honest answer.
 */
export function leadInterceptPoint(
    missilePos: Vector3,
    targetPos: Vector3,
    targetVel: Vector3,
    missileSpeed: number
): Vector3 {
    const rel: Vector3 = {
        x: targetPos.x - missilePos.x,
        y: targetPos.y - missilePos.y,
        z: targetPos.z - missilePos.z
    };

    const a = lengthSq(targetVel) - missileSpeed * missileSpeed;
    const b = 2 * dot(targetVel, rel);
    const c = lengthSq(rel);

    let t: number;
    if (Math.abs(a) < 1e-6) {
        // Target speed equals missile speed: the quadratic degenerates.
        if (Math.abs(b) < 1e-9) return targetPos;
        t = -c / b;
    } else {
        const disc = b * b - 4 * a * c;
        if (disc < 0) return targetPos;
        const root = Math.sqrt(disc);
        const t1 = (-b + root) / (2 * a);
        const t2 = (-b - root) / (2 * a);
        // Smallest strictly positive root: the earliest intercept.
        const positives = [t1, t2].filter(v => v > 1e-6);
        if (positives.length === 0) return targetPos;
        t = Math.min(...positives);
    }

    if (!Number.isFinite(t) || t <= 0) return targetPos;

    return {
        x: targetPos.x + targetVel.x * t,
        y: targetPos.y + targetVel.y * t,
        z: targetPos.z + targetVel.z * t
    };
}

/**
 * Seconds until the missile reaches the aeroplane, at the present closing
 * rate. `null` when it is not closing at all, which is exactly the case a
 * countdown must not display.
 */
export function timeToImpact(
    missilePos: Vector3,
    missileVel: Vector3,
    targetPos: Vector3
): number | null {
    const toTarget: Vector3 = {
        x: targetPos.x - missilePos.x,
        y: targetPos.y - missilePos.y,
        z: targetPos.z - missilePos.z
    };
    const range = length(toTarget);
    if (range < 1e-6) return 0;

    const dir = normalise(toTarget);
    if (!dir) return null;

    const closingSpeed = dot(missileVel, dir);
    if (closingSpeed <= 1e-6) return null;

    return range / closingSpeed;
}

/**
 * Advance a missile one tick under the guidance law.
 *
 * Returned as a new heading rather than mutating, so the caller keeps
 * ownership of the missile's state and the law stays testable in isolation.
 */
export function guideMissile(
    missilePos: Vector3,
    missileVel: Vector3,
    targetPos: Vector3,
    targetVel: Vector3,
    dt: number,
    speed: number = SAM_MISSILE.speed,
    maxTurnRate: number = SAM_MISSILE.maxTurnRateRadPerSec
): Vector3 {
    const aim = leadInterceptPoint(missilePos, targetPos, targetVel, speed);
    const desired = normalise({
        x: aim.x - missilePos.x,
        y: aim.y - missilePos.y,
        z: aim.z - missilePos.z
    });
    if (!desired) return missileVel;

    // A missile that has just left the rail has no heading yet; take the
    // desired one directly rather than rotating away from a zero vector.
    const current = normalise(missileVel);
    if (!current) {
        return { x: desired.x * speed, y: desired.y * speed, z: desired.z * speed };
    }

    const heading = rotateToward(current, desired, maxTurnRate * dt);
    return { x: heading.x * speed, y: heading.y * speed, z: heading.z * speed };
}
