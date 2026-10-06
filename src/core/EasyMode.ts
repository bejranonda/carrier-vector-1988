/**
 * CARRIER VECTOR: 1988 - EASY flying (v2.1.0)
 *
 * WHO THIS IS FOR
 * Not every player is a gamer. Many - older players especially - have the
 * patience and the interest but not the fast hands: holding a turn with one
 * key while lining up with another while watching a range readout is three
 * skills at once, and failing at it feels like failing at the game. The
 * v2.1.0 measurement of a "relaxed" player (slow reactions, no steering,
 * presses SPACE when told) found exactly that wall: the first kill came fast,
 * then minute after minute on "LOCKED - TURN TOWARD THE BANDIT".
 *
 * WHAT EASY DOES
 * One idea: **the plane flies itself and aims for you; you decide when to
 * fire.** Concretely:
 *
 *   - the autopilot flies every intercept, and the lock is always on;
 *   - SPACE, a mouse click or the FIRE button is a smart trigger: it fires the
 *     missile when a missile shot will land, the cannon when the target is
 *     close and dead ahead, and otherwise says "not yet" in plain words;
 *     holding it keeps firing whenever a shot is good;
 *   - the world runs at 80% speed, so there is time to read and react;
 *   - you take half damage, the boat takes half from bombers, fighters miss
 *     more, and a SCRAMBLE run has five jets instead of three;
 *   - messages stay on screen longer, the camera shakes less, and the coach
 *     never tells you to steer when the plane is steering for you.
 *
 * Nothing about the flight model changes - EASY is a set of control laws and
 * a gentler fight on top of the same simulation, like every assist before it.
 *
 * Pure: tuning, the trigger decision, the coach rewrite, persistence.
 */

import type { Hint } from './Tutorial';

export type FlyStyle = 'EASY' | 'STANDARD';

export const EASY_TUNING = {
    /** World speed while EASY, as a fraction of real time. */
    timeScale: 0.8,
    /** Damage the player's jet takes, multiplier. */
    damageTaken: 0.5,
    /** Hull the carrier loses to a bomber that gets through, multiplier. */
    carrierDamage: 0.5,
    /** Extra share of fighter hits that miss (on top of the wave ramp). */
    fighterAccuracy: 0.5,
    /** SCRAMBLE jets per run. */
    lives: 5,
    /** How much longer callouts hold, multiplier. */
    calloutHold: 1.7,
    /** Camera shake, multiplier. */
    shake: 0.5,
    /** Seconds between automatic shots while the trigger is held. */
    triggerInterval: 0.9,
    /** SCRAMBLE: one Sidewinder trickles back onto the rail this often, s. */
    missileTrickleSeconds: 6,
    /** How long a single click keeps the cannon firing, s. */
    gunBurstSeconds: 0.6,
    /**
     * EASY's missile cone, as a cosine off the nose: anything ahead of the
     * wing line (90 deg), against STANDARD's ~50 deg seeker cone. Measured: a
     * relaxed EASY pilot spent most of wave 4 with a fighter at 100-140 deg
     * that the standard cone never offered, while the autopilot turned circles.
     */
    missileAspect: 0,
    missileMinRange: 300,
    missileMaxRange: 3500
} as const;

export type TriggerChoice = 'MISSILE' | 'GUN' | 'NOT_YET';

export interface TriggerState {
    /**
     * The locked target's geometry, or null with nothing locked. `range` and
     * `aspect` (cosine off the nose) open EASY's wider missile cone; without
     * them only the standard envelope counts.
     */
    target: {
        kind: 'AIR' | 'SAM' | 'STRUCTURE';
        inMissileEnvelope: boolean;
        inGunEnvelope: boolean;
        range?: number;
        aspect?: number;
    } | null;
    sidewinders: number;
    /** A missile is already on its way to this target. */
    missileInbound: boolean;
}

/**
 * What one press of the smart trigger does. A missile only when it will land
 * and one is not already on its way (a second round at the same target was
 * the commonest waste in the v2.0.0 bot log); the cannon when the target is
 * close and on the nose; otherwise nothing, and the game says why.
 */
export function easyTrigger(s: TriggerState): TriggerChoice {
    const t = s.target;
    if (!t) return 'NOT_YET';
    const easyCone = t.range !== undefined && t.aspect !== undefined
        && t.aspect >= EASY_TUNING.missileAspect
        && t.range >= EASY_TUNING.missileMinRange
        && t.range <= EASY_TUNING.missileMaxRange;
    if (t.kind === 'AIR' && (t.inMissileEnvelope || easyCone) && s.sidewinders > 0 && !s.missileInbound) return 'MISSILE';
    if (t.inGunEnvelope) return 'GUN';
    return 'NOT_YET';
}

/**
 * The coach, re-worded for a pilot whose plane is flying itself. Telling that
 * pilot to "turn toward the bandit" or "press T to lock" asks for a skill EASY
 * exists to remove, so those lines become what is actually happening.
 */
export function easyHint(hint: Hint | null, canFire = false): Hint | null {
    // The one instruction an EASY pilot needs, the moment it is true -
    // unless something genuinely dangerous outranks it.
    if (canFire && hint?.severity !== 'CRITICAL') return { text: 'FIRE NOW - PRESS SPACE OR CLICK', severity: 'INFO' };
    if (!hint) return null;
    const t = hint.text;
    // Order matters: the "locked, turn toward it" line itself mentions FIRE NOW.
    if (/TURN TOWARD/.test(t)) return { text: 'THE PLANE IS TURNING TO THE TARGET - WAIT FOR "FIRE NOW"', severity: 'INFO' };
    // "Fire now" from the STANDARD coach is only true if the trigger agrees.
    if (/IN RANGE|FIRE NOW/.test(t)) return canFire ? { text: 'FIRE NOW - PRESS SPACE OR CLICK', severity: hint.severity } : null;
    if (/TO LOCK ON/.test(t)) return null;
    if (/BEHIND YOU|ON YOUR TAIL/.test(t)) return { text: 'ENEMY BEHIND YOU - THE PLANE WILL TURN TO FIGHT', severity: hint.severity };
    if (/STALL|PULL UP|THROTTLE|AIRSPEED/.test(t)) return null; // the autopilot is already handling it
    return hint;
}

/**
 * Ask a brand-new pilot how they want to fly - once. A returning pilot from
 * an earlier version (any mission attempted) is not interrupted.
 */
export function shouldAskFlyStyle(stored: FlyStyle | null, anyAttempts: boolean): boolean {
    return stored === null && !anyAttempts;
}

const STORAGE_KEY = 'carrier-vector-1988.flyStyle';

export function loadFlyStyle(): FlyStyle | null {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        return raw === 'EASY' || raw === 'STANDARD' ? raw : null;
    } catch {
        return null;
    }
}

export function saveFlyStyle(style: FlyStyle) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, style);
    } catch {
        // Best effort.
    }
}
