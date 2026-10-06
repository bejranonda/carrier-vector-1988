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
    /**
     * Fastest any contact swings its velocity, rad/s (~16 deg/s): a little
     * better than the player's held-bank turn (~12 deg/s in ARCADE), so a
     * MiG is a threat in a turning fight - but one that overshoots and comes
     * back for another pass rather than snapping onto the jet's tail. The
     * uncapped steering law could swing 60+ deg/s.
     */
    MAX_TURN_RATE: 0.28,
    /**
     * A fighter that closes inside this range breaks off and extends straight
     * for EXTEND_SECONDS before coming round again - a strafing pass, not a
     * tail-sitter. With speed held (#105) and a better turn than the jet's,
     * pure pursuit parked MiGs 50-300 m behind an EASY jet, inside missile
     * minimum range and outside the gun cone, for most of a wave (v2.2.0).
     */
    EXTEND_RANGE: 450,       // m
    EXTEND_SECONDS: 4,
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
    // A SCRAMBLE fighter is sent for the jet, not the boat: it never wanders
    // off toward the carrier and leaves a wave stuck on one bandit nobody
    // can find (v2.0.0 bot playtest).
    if (target.huntsPlayer) return 'ENGAGE';
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

        if (t.aiBehavior === 'ENGAGE' && (t.aiExtendTimer ?? 0) > 0) {
            // Extending after a pass: wings level, guns cold, no steering.
            t.aiExtendTimer = Math.max(0, (t.aiExtendTimer ?? 0) - dt);
            t.aiAimTimer = 0;
            t.aiTurnDemand = 0;
        } else if (t.aiBehavior === 'ENGAGE' && dist < AI_TUNING.EXTEND_RANGE) {
            t.aiExtendTimer = AI_TUNING.EXTEND_SECONDS;
            t.aiAimTimer = 0;
        } else if (t.aiBehavior === 'ENGAGE') {
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

/**
 * Turn the velocity toward a desired direction - proportionally for a small
 * error, at no more than MAX_TURN_RATE for a big one - and keep the
 * contact's own speed.
 *
 * It used to blend the velocity vector straight toward `direction * speed`.
 * That bled speed every frame it turned, permanently: a straight-line blend
 * between two vectors is shorter than either, a reversal after a head-on
 * pass shrinks the vector almost to nothing before it swings round, and the
 * dogfight's halved climb component made the target vector shorter still.
 * Measured in v2.1.0 SCRAMBLE: fighters fell from 185 m/s to 1-8 m/s within
 * half a minute of their first pass and hung in the air a kilometre below
 * the jet, where nobody could reach them - 56% of all stalled wave time.
 */
function steerToward(
    t: AirborneTarget,
    dirX: number,
    dirY: number,
    dirZ: number,
    rate: number,
    dt: number
) {
    const speed = Math.hypot(t.velocity.x, t.velocity.y, t.velocity.z);
    // The speed the contact was given, remembered the first time it steers.
    if (t.aiCruiseSpeed === undefined) t.aiCruiseSpeed = speed > 1 ? speed : 200;
    const cruise = t.aiCruiseSpeed;

    const len = Math.hypot(dirX, dirY, dirZ);
    if (len < 1e-9) return;
    const ux = dirX / len, uy = dirY / len, uz = dirZ / len;
    let vx = ux, vy = uy, vz = uz;
    if (speed > 1e-6) {
        vx = t.velocity.x / speed;
        vy = t.velocity.y / speed;
        vz = t.velocity.z / speed;
    }

    const dot = Math.max(-1, Math.min(1, vx * ux + vy * uy + vz * uz));
    const angle = Math.acos(dot);
    const step = Math.min(angle, Math.min(AI_TUNING.MAX_TURN_RATE, rate * angle) * dt);

    // Rotation axis. Dead astern has none, so a reversal turns about the
    // vertical - flat round, like an aeroplane - instead of not at all.
    let ax = vy * uz - vz * uy;
    let ay = vz * ux - vx * uz;
    let az = vx * uy - vy * ux;
    let axisLen = Math.hypot(ax, ay, az);
    if (axisLen < 1e-6 && dot < 0) {
        ax = 0; ay = 1; az = 0;
        axisLen = 1;
    }

    let nx = vx, ny = vy, nz = vz;
    if (axisLen >= 1e-6 && step > 0) {
        ax /= axisLen; ay /= axisLen; az /= axisLen;
        // Rodrigues' rotation of v about the unit axis a by `step`.
        const c = Math.cos(step);
        const s = Math.sin(step);
        const aDotV = ax * vx + ay * vy + az * vz;
        nx = vx * c + (ay * vz - az * vy) * s + ax * aDotV * (1 - c);
        ny = vy * c + (az * vx - ax * vz) * s + ay * aDotV * (1 - c);
        nz = vz * c + (ax * vy - ay * vx) * s + az * aDotV * (1 - c);
    }
    const n = Math.hypot(nx, ny, nz) || 1;
    t.velocity.x = (nx / n) * cruise;
    t.velocity.y = (ny / n) * cruise;
    t.velocity.z = (nz / n) * cruise;

    // Bank cue: the signed horizontal turn, as a share of the fastest turn.
    // Positive is a right turn (yaw increasing) whichever way the contact is
    // heading; the old cue read the world x axis and banked a south-bound
    // contact the wrong way.
    const horizontalTurn = vz * ux - vx * uz;
    const turnRate = dt > 0 ? step / dt : 0;
    t.aiTurnDemand = Math.sign(horizontalTurn) * (turnRate / AI_TUNING.MAX_TURN_RATE);
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
