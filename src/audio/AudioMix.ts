/**
 * CARRIER VECTOR: 1988 - Mix Structure & Spatialisation
 *
 * WHY THIS EXISTS
 * Every voice in the game connected straight to `AudioContext.destination`.
 * There was no bus, no compression and no level structure, which has three
 * consequences a player feels without being able to name:
 *
 *  1. A furball clips. Six overlapping voices at 0.05-0.16 gain sum past
 *     unity and the output distorts exactly when the game is at its loudest.
 *  2. Nothing has priority. A missile-launch warning - the one sound that
 *     must cut through - competed on equal terms with the engine bed.
 *  3. Everything happens inside your head. Mono, unattenuated: a SAM firing
 *     eight kilometres behind you was as loud and as central as your own
 *     cannon, so audio carried no tactical information at all.
 *
 * This module holds the decisions: how loud each category sits, and how a
 * world event's distance and bearing become a gain and a pan. It is pure
 * arithmetic - no AudioContext - so the mix can be reasoned about and tested,
 * and `SoundFX` is left holding only the synthesis.
 */

/**
 * Bus levels. These are relative and deliberately conservative: the master bus
 * runs through a compressor, and headroom is what keeps a busy moment from
 * turning to mush.
 */
export const MIX = {
    /** Final trim before the compressor. */
    master: 0.85,
    /** Continuous beds sit UNDER everything - they are context, not events. */
    engine: 0.055,
    airflow: 0.05,
    /** The threat drone is felt more than heard. */
    threatBed: 0.10,
    /** Your own weapons: present, but they fire twenty times a second. */
    weapons: 0.30,
    /** Things hitting you or your target. The game's punctuation. */
    impacts: 0.55,
    /** RWR and master caution. Loudest on purpose: these are instructions. */
    alerts: 0.62,
    /** Events out in the world, before distance attenuation. */
    world: 0.50,
    /** Menus and confirmations. */
    ui: 0.38
} as const;

export interface SpatialResult {
    /** 0..1 level multiplier from distance. */
    gain: number;
    /** -1 hard left, +1 hard right. */
    pan: number;
}

export const SPATIAL_TUNING = {
    /** Distance at which a sound is at half power, metres. */
    referenceDistance: 320,
    /** Beyond this, silence - it saves voices and it is honest. */
    maxDistance: 7000,
    /** How hard the stereo field is driven. 1 = full width. */
    panWidth: 0.85
} as const;

export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where a world event sits relative to the pilot: how loud, and how far left
 * or right.
 *
 * Bearing uses the same convention as everything else in this project - yaw 0
 * is +Z, positive is to the right - so a contact off the right wing pans
 * right, and one directly behind pans centre and simply sounds distant, which
 * is what a pair of ears in a helmet would actually report.
 */
export function spatial(
    listener: Vec3Like,
    listenerYaw: number,
    source: Vec3Like
): SpatialResult {
    const dx = source.x - listener.x;
    const dy = source.y - listener.y;
    const dz = source.z - listener.z;
    const distance = Math.hypot(dx, dy, dz);

    if (!Number.isFinite(distance) || distance >= SPATIAL_TUNING.maxDistance) {
        return { gain: 0, pan: 0 };
    }

    // Inverse-square with a reference distance, so close things are loud
    // without a point source at zero range being infinitely loud.
    const ratio = distance / SPATIAL_TUNING.referenceDistance;
    const gain = clamp(1 / (1 + ratio * ratio), 0, 1);

    // Component of the source direction along the aircraft's right wing.
    const horizontal = Math.hypot(dx, dz);
    if (horizontal < 1e-6) return { gain, pan: 0 };
    const rightX = Math.cos(listenerYaw);
    const rightZ = -Math.sin(listenerYaw);
    const lateral = (dx * rightX + dz * rightZ) / horizontal;

    return { gain, pan: clamp(lateral * SPATIAL_TUNING.panWidth, -1, 1) };
}

/**
 * The threat bed: a low drone that tracks the RWR. It is the closest thing
 * this game has to a score, and it is generated from the tactical situation
 * rather than composed - so the tension is always telling the truth.
 */
export function threatBed(state: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH'): { gain: number; frequency: number } {
    switch (state) {
        case 'SEARCH': return { gain: MIX.threatBed * 0.45, frequency: 54 };
        case 'TRACK': return { gain: MIX.threatBed * 0.8, frequency: 68 };
        case 'LAUNCH': return { gain: MIX.threatBed, frequency: 92 };
        default: return { gain: 0, frequency: 48 };
    }
}

/**
 * Airflow over the canopy. The single cheapest cue for speed: without it,
 * 250 kt and 500 kt sound identical and the only evidence of acceleration is
 * a number on a tape.
 */
export function airflow(airSpeedMs: number): { gain: number; cutoff: number } {
    if (!Number.isFinite(airSpeedMs) || airSpeedMs <= 60) return { gain: 0, cutoff: 300 };
    const t = clamp((airSpeedMs - 60) / 280, 0, 1);
    return {
        gain: MIX.airflow * t,
        // Opens up as it builds, so fast air is bright as well as loud.
        cutoff: 300 + 2400 * t
    };
}

/**
 * Buffet at the edge of the envelope: a low rumble that starts before the
 * wing actually lets go, which is what a real one does and what makes it
 * useful rather than decorative.
 */
export function buffet(alpha: number, isStalled: boolean, alphaLimit = 0.26): number {
    if (isStalled) return 1;
    const onset = alphaLimit * 0.7;
    if (!Number.isFinite(alpha) || Math.abs(alpha) <= onset) return 0;
    return clamp((Math.abs(alpha) - onset) / (alphaLimit - onset), 0, 1);
}
