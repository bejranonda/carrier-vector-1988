/**
 * CARRIER VECTOR: 1988 - Hardened Ground Targets
 *
 * A fixed structure in the terrain that a scenario asks you to destroy. It
 * exists because every target in the game was airborne or a soft SAM site,
 * which meant the Mk.82 was almost dead weight and the canyon was only ever
 * cover, never a route to something.
 *
 * The defining property is that a hardened target is NOT killed by a near
 * miss. A SAM site dies to any bomb inside 180 m; a hardened pen needs a
 * bomb inside `hitRadius` (tens of metres), which forces a low, fast, aimed
 * delivery rather than a lob from altitude. That single number is what turns
 * "drop a bomb somewhere over there" into a skill.
 *
 * Pure logic, no canvas - the hit geometry is unit-tested.
 */

import type { Vector3 } from '../flight/AircraftPhysics';

export interface StrikeTargetSpec {
    id: string;
    name: string;
    /** Short line for the briefing and the objective detail. */
    description: string;
    x: number;
    z: number;
    /** Height of the structure above local terrain, in metres. */
    height: number;
    /** A bomb must land within this many metres to count. */
    hitRadius: number;
    /** Direct hits needed to destroy it. */
    hitsRequired: number;
}

export class StrikeTarget {
    public readonly id: string;
    public readonly name: string;
    public readonly description: string;
    public readonly position: Vector3;
    public readonly hitRadius: number;
    public readonly hitsRequired: number;
    public hits = 0;
    public destroyed = false;

    constructor(spec: StrikeTargetSpec, groundElevation: number) {
        this.id = spec.id;
        this.name = spec.name;
        this.description = spec.description;
        this.position = { x: spec.x, y: groundElevation, z: spec.z };
        this.hitRadius = spec.hitRadius;
        this.hitsRequired = spec.hitsRequired;
    }

    /** Horizontal distance from a world point to the structure. */
    public horizontalDistanceTo(p: Vector3): number {
        return Math.hypot(p.x - this.position.x, p.z - this.position.z);
    }

    /**
     * Register a bomb impact. Returns true when it was inside the hit radius,
     * so the caller can spawn the right explosion and log the right line.
     * Impacts after destruction are reported as misses - a dead target cannot
     * absorb more hits, and the score must not count them twice.
     */
    public registerImpact(impact: Vector3): boolean {
        if (this.destroyed) return false;
        if (this.horizontalDistanceTo(impact) > this.hitRadius) return false;

        this.hits++;
        if (this.hits >= this.hitsRequired) this.destroyed = true;
        return true;
    }
}
