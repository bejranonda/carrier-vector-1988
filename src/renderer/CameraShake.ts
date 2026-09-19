/**
 * CARRIER VECTOR: 1988 - Camera Shake
 *
 * Nothing in this game had any weight. A catapult stroke that accelerates the
 * aircraft to 160 m/s in two and a half seconds, a Sidewinder coming off the
 * rail, a 57 mm hit on the airframe - all of them looked like a number
 * changing on a panel. A vector display cannot do particles, screen-space
 * blur or a recoil animation, but it can do the one thing a real cockpit does
 * under load, which is move.
 *
 * The model is trauma rather than a fixed shake: events add trauma, trauma
 * decays on a clock, and the shake amplitude is trauma squared - so small
 * events are barely perceptible, a hit is violent, and two events in the same
 * second compound instead of resetting each other.
 *
 * CRITICAL: this is applied to the CAMERA only, never to the physics. The
 * simulation is a fixed-timestep, deterministic, unit-tested thing; a shake
 * that fed back into the flight model would make every timing test in the
 * project a coin flip. `GameLoop.drawCockpitSim()` adds these offsets to the
 * camera angles it passes to the renderer and to nothing else.
 *
 * Pure functions of (trauma, time), so the decay curve and the bounds are
 * testable without a canvas.
 */

export interface ShakeOffsets {
    pitch: number;
    yaw: number;
    roll: number;
}

export const SHAKE_TUNING = {
    /** Trauma lost per second. A hit is felt for roughly a second. */
    decayPerSecond: 1.35,
    /** Peak angular displacement at full trauma, radians. */
    maxPitch: 0.035,
    maxYaw: 0.030,
    maxRoll: 0.055,
    /** Oscillation rates, deliberately incommensurate so it never looks like a loop. */
    pitchHz: 17.3,
    yawHz: 13.1,
    rollHz: 9.7
} as const;

/** How much trauma each event contributes. */
export const SHAKE_SOURCES = {
    /** Per cannon round - tiny, but a held trigger accumulates into a rumble. */
    gun: 0.05,
    missileLaunch: 0.20,
    bombRelease: 0.12,
    /** Taking a hit. The loudest thing that can happen to you. */
    damageTaken: 0.55,
    catapultStroke: 0.45,
    wireCatch: 0.70,
    /** A kill you caused, at any range - a small punctuation, not an event. */
    killConfirmed: 0.10
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Add trauma, saturating at 1 so a held trigger cannot white out the screen. */
export function addTrauma(trauma: number, amount: number): number {
    return clamp01(trauma + Math.max(0, amount));
}

/**
 * Trauma from a blast, scaled by distance. Beyond `falloff` metres it is
 * inaudible; at zero range it is a full hit's worth.
 */
export function blastTrauma(distance: number, falloff = 700): number {
    if (!Number.isFinite(distance) || distance < 0) return 0;
    if (distance >= falloff) return 0;
    const near = 1 - distance / falloff;
    return clamp01(near * near * 0.6);
}

export function decayTrauma(trauma: number, dt: number): number {
    return clamp01(trauma - SHAKE_TUNING.decayPerSecond * Math.max(0, dt));
}

/**
 * Angular offsets for the current trauma at time `t` (seconds).
 *
 * Amplitude is trauma squared, which is what makes the difference between a
 * cannon burst and a missile strike legible: linear amplitude made everything
 * feel like the same medium-sized event.
 */
export function shakeOffsets(trauma: number, t: number): ShakeOffsets {
    const s = clamp01(trauma) ** 2;
    if (s <= 0) return { pitch: 0, yaw: 0, roll: 0 };

    const k = SHAKE_TUNING;
    return {
        pitch: Math.sin(t * k.pitchHz * Math.PI * 2) * k.maxPitch * s,
        yaw: Math.sin(t * k.yawHz * Math.PI * 2 + 1.7) * k.maxYaw * s,
        roll: Math.sin(t * k.rollHz * Math.PI * 2 + 3.1) * k.maxRoll * s
    };
}
