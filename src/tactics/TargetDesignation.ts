/**
 * CARRIER VECTOR: 1988 - Target Designation
 *
 * WHY THIS EXISTS
 * Until now the only way to shoot something was to point the whole aeroplane
 * at it and hope: the Sidewinder picked its own target from whatever happened
 * to be inside a 30-degree cone, and the HUD drew every contact identically,
 * so "which of those four boxes is the bomber" was unanswerable. Combined with
 * a 6-DOF flight model, that meant the player was fighting the aeroplane and
 * the interface at the same time and never getting to the fight.
 *
 * Designation separates the two decisions. You pick WHAT to kill - one key,
 * cycling a priority-ordered list - and the rest of the game follows: the HUD
 * brackets it, the weapon recommendation changes with range and aspect, the
 * Sidewinder guides on the thing you chose rather than the thing it liked, and
 * the autopilot (see FlightAssist) will fly the intercept for you if you would
 * rather spend your attention on the shot.
 *
 * Pure geometry - no canvas, no physics instance, no subsystem imports beyond
 * types - because "which target is in the missile envelope" is exactly the
 * kind of question that should be answered by a test and not by squinting at
 * a wireframe.
 */

import type { Vector3 } from '../flight/AircraftPhysics';
import type { NavTarget } from '../flight/FlightAssist';

export type TargetKind = 'AIR' | 'SAM' | 'STRUCTURE';
export type WeaponRecommendation = 'GUN' | 'SIDEWINDER' | 'BOMB';

/** The least a thing needs to be shootable-at. */
export interface DesignatableTarget {
    id: string;
    kind: TargetKind;
    name: string;
    position: Vector3;
}

/** Where the shooter is and which way it is pointing. */
export interface ShooterState {
    position: Vector3;
    /** Unit forward vector of the airframe. */
    forward: Vector3;
}

export interface TargetSolution {
    target: DesignatableTarget;
    /** Slant range, metres. */
    range: number;
    /** Bearing to steer, radians, 0 = +Z, positive right - matches yaw. */
    bearing: number;
    /** Cosine of the angle off the nose. 1 = dead ahead. */
    aspect: number;
    /** Angle off the nose, radians - what the HUD wants for an offset arrow. */
    offBoresight: number;
    inMissileEnvelope: boolean;
    inGunEnvelope: boolean;
    recommendedWeapon: WeaponRecommendation;
    /** Lower is a better candidate; drives the cycle order. */
    priority: number;
}

export const DESIGNATION_TUNING = {
    /** AIM-9 seeker field of view, as a cosine off the nose (~50deg). */
    seekerAspect: 0.64,
    /** Minimum arming range for the Sidewinder, metres. */
    missileMinRange: 300,
    missileMaxRange: 8000,
    /** Effective 20mm range, metres. */
    gunRange: 1800,
    /** How tight the tracking solution has to be for a gun kill. */
    gunAspect: 0.985,
    /** Beyond this the contact is not offered as a designation at all. */
    maxDesignationRange: 20000,
    /** AGL the autopilot holds on a ground attack run. */
    groundRunInAgl: 520,
    /** Floor the autopilot keeps on an air intercept, metres AGL. */
    minInterceptAgl: 260,
    interceptSpeed: 270,
    groundRunInSpeed: 250
} as const;

const TAU = Math.PI * 2;

/** Geometry of one contact relative to the shooter. */
export function solveTarget(shooter: ShooterState, target: DesignatableTarget): TargetSolution {
    const dx = target.position.x - shooter.position.x;
    const dy = target.position.y - shooter.position.y;
    const dz = target.position.z - shooter.position.z;
    const range = Math.hypot(dx, dy, dz);

    const bearing = ((Math.atan2(dx, dz) % TAU) + TAU) % TAU;

    const f = shooter.forward;
    const fLen = Math.hypot(f.x, f.y, f.z) || 1;
    const aspect = range > 0
        ? (dx * f.x + dy * f.y + dz * f.z) / (range * fLen)
        : 1;
    const offBoresight = Math.acos(Math.min(1, Math.max(-1, aspect)));

    const t = DESIGNATION_TUNING;
    const inMissileEnvelope = target.kind === 'AIR'
        && aspect >= t.seekerAspect
        && range >= t.missileMinRange
        && range <= t.missileMaxRange;
    // A hardened structure shrugs off 20mm, so the gun is never "in envelope"
    // against one however close you get - the HUD must not suggest a pass that
    // cannot work.
    const inGunEnvelope = target.kind !== 'STRUCTURE'
        && range <= t.gunRange
        && aspect >= t.gunAspect;

    let recommendedWeapon: WeaponRecommendation;
    if (target.kind === 'STRUCTURE') recommendedWeapon = 'BOMB';
    else if (target.kind === 'SAM') recommendedWeapon = inGunEnvelope ? 'GUN' : 'BOMB';
    else if (inMissileEnvelope) recommendedWeapon = 'SIDEWINDER';
    else recommendedWeapon = 'GUN';

    // Things ahead of the nose come first, near before far. Dividing by the
    // forward component means a contact behind you sorts last without needing
    // a special case, and the ordering stays a total order for cycling.
    const forwardness = Math.max(0.08, (aspect + 1) / 2);
    const priority = range / forwardness;

    return {
        target,
        range,
        bearing,
        aspect,
        offBoresight,
        inMissileEnvelope,
        inGunEnvelope,
        recommendedWeapon,
        priority
    };
}

/**
 * Rank every contact the pilot could designate, best candidate first. Ties
 * break on id so the order is stable frame to frame - a cycle key that
 * reshuffles the list underneath itself is worse than no cycle key.
 */
export function rankTargets(shooter: ShooterState, candidates: readonly DesignatableTarget[]): TargetSolution[] {
    return candidates
        .map(c => solveTarget(shooter, c))
        .filter(s => s.range <= DESIGNATION_TUNING.maxDesignationRange)
        .sort((a, b) => a.priority - b.priority || (a.target.id < b.target.id ? -1 : 1));
}

/**
 * The autopilot profile that prosecutes a designated target: run its bearing
 * down, at an altitude and speed appropriate to what it is.
 *
 * It deliberately will NOT fly into the ground or into the target - altitude
 * is floored, and the terrain floor in FlightAssist still has the last word.
 * The autopilot delivers you to the fight; the shot is still yours.
 */
export function pursuitNav(solution: TargetSolution, groundElevation: number): NavTarget {
    const t = DESIGNATION_TUNING;

    if (solution.target.kind === 'AIR') {
        const targetAgl = solution.target.position.y - groundElevation;
        return {
            bearing: solution.bearing,
            altitudeAgl: Math.max(t.minInterceptAgl, targetAgl),
            airSpeed: t.interceptSpeed,
            // Wide open: an intercept that will not bank is an intercept that
            // never arrives.
            maxBank: 1.15
        };
    }

    return {
        bearing: solution.bearing,
        altitudeAgl: t.groundRunInAgl,
        airSpeed: t.groundRunInSpeed,
        // Steadier for a bombing run, so the release cue is not swinging.
        maxBank: 0.8
    };
}

/** A designatable target as it appears on the glass. */
export interface ScreenTarget {
    id: string;
    x: number;
    y: number;
}

/**
 * Which target a tap chose.
 *
 * On a touchscreen the natural way to pick something is to point at it, and
 * cycling a list with a button is a keyboard idiom wearing a thumb's
 * clothing. The radius is generous because a fingertip covers about 40 px and
 * lands slightly below where its owner thinks it did; ties go to whatever is
 * nearest the touch, so a crowded furball still resolves to one contact.
 */
export function pickTargetAt(
    x: number,
    y: number,
    targets: readonly ScreenTarget[],
    radius = 80
): string | null {
    let bestId: string | null = null;
    let bestDistance = radius;

    for (const t of targets) {
        if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
        const d = Math.hypot(t.x - x, t.y - y);
        if (d <= bestDistance) {
            bestDistance = d;
            bestId = t.id;
        }
    }
    return bestId;
}

/**
 * Holds the pilot's choice across frames. The lock is stored as an ID, not a
 * reference or an index: a destroyed contact simply stops appearing in the
 * candidate list and the lock drops itself, which is the one behaviour that
 * has to be right or the HUD brackets empty sky.
 */
export class TargetTracker {
    public solutions: TargetSolution[] = [];
    private lockedId: string | null = null;

    /** Recompute geometry and drop a lock whose target is gone. */
    public refresh(shooter: ShooterState, candidates: readonly DesignatableTarget[]) {
        this.solutions = rankTargets(shooter, candidates);
        if (this.lockedId && !this.solutions.some(s => s.target.id === this.lockedId)) {
            this.lockedId = null;
        }
    }

    public get designatedId(): string | null {
        return this.lockedId;
    }

    public designated(): TargetSolution | null {
        if (!this.lockedId) return null;
        return this.solutions.find(s => s.target.id === this.lockedId) ?? null;
    }

    public designateById(id: string): TargetSolution | null {
        const found = this.solutions.find(s => s.target.id === id);
        this.lockedId = found ? id : null;
        return found ?? null;
    }

    public clear() {
        this.lockedId = null;
    }

    /**
     * Step the designation through the ranked list. With nothing designated
     * this picks the best candidate, so the first press of the key always
     * locks the most useful thing on the scope rather than an arbitrary one.
     */
    public cycle(direction: number = 1): TargetSolution | null {
        if (this.solutions.length === 0) {
            this.lockedId = null;
            return null;
        }

        const current = this.solutions.findIndex(s => s.target.id === this.lockedId);
        const next = current < 0
            ? (direction >= 0 ? 0 : this.solutions.length - 1)
            : (current + (direction >= 0 ? 1 : -1) + this.solutions.length) % this.solutions.length;

        const chosen = this.solutions[next];
        this.lockedId = chosen.target.id;
        return chosen;
    }

    /**
     * Automatically acquire the highest-priority target on the scope if none is locked.
     * Prevents new pilots from flying blind in wireframe space without an off-screen chevron
     * or radar solution.
     */
    public autoAcquire(): TargetSolution | null {
        if (this.lockedId) return this.designated();
        if (this.solutions.length === 0) return null;
        this.lockedId = this.solutions[0].target.id;
        return this.solutions[0];
    }
}
