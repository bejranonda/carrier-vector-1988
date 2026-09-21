/**
 * CARRIER VECTOR: 1988 - Enemy Aircraft Behaviour
 *
 * The original enemy "AI" was three lines of position integration - MiGs
 * flew perfectly straight lines forever and never reacted to the player.
 * This gives each contact a small behaviour state machine:
 *
 *   INGRESS -> press toward the carrier (the mission objective)
 *   ENGAGE  -> fighter has detected the player and turns to fight
 *   RTB     -> bombers ignore the player entirely and drive for the boat
 *
 * That split is the tactical tension: escorts try to drag you into a
 * turning fight while the bomber keeps running at your carrier. Chasing
 * the wrong contact costs you hull integrity.
 */

import type { AirborneTarget } from '../renderer/HUD';
import type { AircraftPhysics } from '../flight/AircraftPhysics';

export type EnemyBehavior = 'INGRESS' | 'ENGAGE' | 'RTB';

export const AI_TUNING = {
    DETECTION_RANGE: 6000,   // m - fighter notices the player
    ENGAGE_RANGE: 3500,      // m - fighter commits to a turning fight
    FIRE_RANGE: 1600,        // m - effective cannon range
    FIRE_CONE_DEG: 12,       // must be this well aligned to shoot
    FIRE_COOLDOWN: 1.4,      // s between bursts
    AIM_TIME: 0.7,           // s of held guns solution before the first burst
    HIT_CHANCE: 0.6,         // fraction of bursts that connect
    ENGAGE_TURN_RATE: 1.1,   // velocity-steering gain while dogfighting
    INGRESS_TURN_RATE: 0.4,  // gentler correction while running in
    MAX_BANK: 0.6            // rad, visual bank limit
} as const;

/** True if this contact is a heavy bomber (drives for the carrier, never dogfights). */
export function isBomber(target: AirborneTarget): boolean {
    return target.name.includes('Tu-22') || target.id.toUpperCase().includes('TU-22');
}

/**
 * Decide the behaviour state for a contact given its distance to the player.
 * Pure - separated out so the transition policy is headlessly testable.
 */
export function decideBehavior(target: AirborneTarget, distanceToPlayer: number): EnemyBehavior {
    if (isBomber(target)) return 'RTB';
    if (distanceToPlayer < AI_TUNING.ENGAGE_RANGE) return 'ENGAGE';
    if (distanceToPlayer < AI_TUNING.DETECTION_RANGE) return 'INGRESS';
    return 'INGRESS';
}

/**
 * Advance all enemy contacts.
 *
 * A fighter that gets a guns solution does not shoot on the same frame: it
 * has to hold the solution for AIM_TIME, and `onAim` fires the moment it first
 * has one. That is the player's warning - the difference between "a MiG
 * appeared on my tail and I was dead" and "a MiG is lining me up, break".
 * `onFire` then reports each burst, with `hit` saying whether it connected
 * (HIT_CHANCE), so a burst can be a near miss the pilot hears go past.
 */
export function updateEnemyAI(
    dt: number,
    targets: AirborneTarget[],
    player: AircraftPhysics,
    onFire?: (target: AirborneTarget, hit: boolean) => void,
    onAim?: (target: AirborneTarget) => void,
    rng: () => number = Math.random
) {
    for (const t of targets) {
        if (!t.isAlive) continue;

        t.aiFireCooldown = Math.max(0, (t.aiFireCooldown ?? 0) - dt);

        const dx = player.position.x - t.position.x;
        const dy = player.position.y - t.position.y;
        const dz = player.position.z - t.position.z;
        const dist = Math.hypot(dx, dy, dz) || 1;

        t.aiBehavior = decideBehavior(t, dist);

        if (t.aiBehavior === 'ENGAGE') {
            steerToward(t, dx / dist, dy / dist * 0.5, dz / dist, AI_TUNING.ENGAGE_TURN_RATE, dt);

            // Guns solution: close enough AND pointing at the player.
            let solution = false;
            if (dist < AI_TUNING.FIRE_RANGE) {
                const speed = Math.hypot(t.velocity.x, t.velocity.y, t.velocity.z) || 1;
                const dot = (dx * t.velocity.x + dy * t.velocity.y + dz * t.velocity.z) / (dist * speed);
                const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
                solution = angleDeg < AI_TUNING.FIRE_CONE_DEG;
            }

            if (!solution) {
                t.aiAimTimer = 0;
            } else {
                const before = t.aiAimTimer ?? 0;
                t.aiAimTimer = before + dt;
                if (before === 0 && onAim) onAim(t);
                if (t.aiAimTimer >= AI_TUNING.AIM_TIME && (t.aiFireCooldown ?? 0) <= 0) {
                    t.aiFireCooldown = AI_TUNING.FIRE_COOLDOWN;
                    if (onFire) onFire(t, rng() < AI_TUNING.HIT_CHANCE);
                }
            }
        } else {
            // Press toward the carrier at the origin.
            const toOriginX = -t.position.x;
            const toOriginZ = -t.position.z;
            const horiz = Math.hypot(toOriginX, toOriginZ) || 1;
            steerToward(t, toOriginX / horiz, 0, toOriginZ / horiz, AI_TUNING.INGRESS_TURN_RATE, dt);
        }

        // Integrate position
        t.position.x += t.velocity.x * dt;
        t.position.y += t.velocity.y * dt;
        t.position.z += t.velocity.z * dt;

        updateVisualOrientation(t);
    }
}

/** Blend the velocity vector toward a desired unit direction at a given rate. */
function steerToward(
    t: AirborneTarget,
    dirX: number,
    dirY: number,
    dirZ: number,
    rate: number,
    dt: number
) {
    const speed = Math.hypot(t.velocity.x, t.velocity.y, t.velocity.z) || 200;
    const desiredX = dirX * speed;
    const desiredY = dirY * speed;
    const desiredZ = dirZ * speed;

    const k = Math.min(1, rate * dt);
    // Record lateral steering demand before it is applied, for the bank cue.
    t.aiTurnDemand = (desiredX - t.velocity.x) / speed;

    t.velocity.x += (desiredX - t.velocity.x) * k;
    t.velocity.y += (desiredY - t.velocity.y) * k;
    t.velocity.z += (desiredZ - t.velocity.z) * k;
}

/**
 * Derive pitch/yaw/roll from the velocity vector so the wireframe model
 * visibly banks into its turns. Before this, meshes rendered yaw-only and
 * enemies always appeared dead level regardless of manoeuvre.
 */
function updateVisualOrientation(t: AirborneTarget) {
    const horizSpeed = Math.hypot(t.velocity.x, t.velocity.z) || 1;
    t.yaw = Math.atan2(t.velocity.x, t.velocity.z);
    t.pitch = Math.atan2(t.velocity.y, horizSpeed);
    const demand = t.aiTurnDemand ?? 0;
    t.roll = Math.max(-AI_TUNING.MAX_BANK, Math.min(AI_TUNING.MAX_BANK, demand * 1.5));
}
