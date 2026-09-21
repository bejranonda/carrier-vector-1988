/**
 * CARRIER VECTOR: 1988 - Tactical radar geometry
 *
 * WHY THIS EXISTS
 * The corner scope used to be a radar warning receiver: it drew a letter for
 * each SAM site that was pinging you and nothing else. A player reads a round
 * scope in the corner of a flight game as "the radar", looks for the carrier
 * and the bandits on it, and finds neither. The scope now answers the three
 * questions the player actually has - where is home, where is the enemy, where
 * am I supposed to go - and this module is the arithmetic behind it.
 *
 * The scope is heading-up (the top is where the nose points), like every
 * arcade radar, so "the red triangle is up and to the right" means "the bandit
 * is ahead and to the right". Pure and DOM-free so the projection is asserted
 * rather than eyeballed.
 */

export interface RadarPoint {
    /** Pixels right of the scope centre. */
    x: number;
    /** Pixels below the scope centre (canvas convention: up is negative). */
    y: number;
    /** Ground distance, metres. */
    distance: number;
    /** True when the contact is beyond scope range and was pinned to the rim. */
    clamped: boolean;
}

export interface Xz { x: number; z: number }

/**
 * Project a world position onto a heading-up scope.
 *
 * @param yaw     player heading, radians, 0 = +Z, positive clockwise (matches AircraftPhysics)
 * @param rangeM  ground distance that maps to the scope rim
 * @param radiusPx scope radius in pixels
 */
export function radarProject(player: Xz, yaw: number, target: Xz, rangeM: number, radiusPx: number): RadarPoint {
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Components along the nose and along the right wing.
    const ahead = dx * sin + dz * cos;
    const right = dx * cos - dz * sin;
    const distance = Math.hypot(dx, dz);

    const scale = distance > rangeM ? radiusPx / distance : radiusPx / rangeM;
    return {
        x: right * scale,
        y: -ahead * scale,
        distance,
        clamped: distance > rangeM
    };
}

/** Heading of a velocity relative to the player's nose, radians (0 = up the scope). */
export function relativeHeading(yaw: number, velocity: Xz): number {
    const vAhead = velocity.x * Math.sin(yaw) + velocity.z * Math.cos(yaw);
    const vRight = velocity.x * Math.cos(yaw) - velocity.z * Math.sin(yaw);
    return Math.atan2(vRight, vAhead);
}

const METRES_PER_NM = 1852;

/** "8.4NM" - one decimal under 10, none above. */
export function formatNm(metres: number): string {
    const nm = metres / METRES_PER_NM;
    return `${nm < 10 ? nm.toFixed(1) : Math.round(nm)}NM`;
}

/**
 * Pick the scope range: wide enough that the carrier is on it while the
 * player is nearby, but never so wide that a dogfight is a single dot.
 */
export const RADAR_RANGE_M = 12000;
