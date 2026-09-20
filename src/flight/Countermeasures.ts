/**
 * CARRIER VECTOR: 1988 - Countermeasures
 *
 * WHY THIS EXISTS
 * There was no defence. `grep -rn "chaff|flare|countermeasure" src/` returned
 * nothing at all: no dispenser, no decoy, no jammer. When the RWR screamed
 * LAUNCH the player's entire vocabulary was "find a ridge", and if no ridge
 * was within about eight seconds' flying, the correct play was to accept the
 * hit. A playtester reported exactly this and assumed they had missed a key.
 *
 * WHY CHAFF AND NOT FLARES
 * Every missile threat in this game is a radar SAM - the sites run the radar
 * range equation against the aeroplane's RCS (`calculateEffectiveRCS`) and
 * break lock on line of sight. Flares decoy infrared seekers, which nothing
 * here uses. Chaff is the honest answer, and naming it honestly keeps the
 * sensor model coherent: chaff works because it is a cloud of radar
 * reflectors, which is the same physics the rest of the file already models.
 *
 * WHY IT ALWAYS WORKS
 * A deliberate design decision, and the opposite of what a simulator would
 * do. `ThreatLevel.ts` refuses to invent "a second set of difficulty numbers
 * to keep in sync with the first", and an aspect-dependent break probability
 * would be exactly that - a parallel difficulty table, invisible to the
 * player, producing deaths they cannot account for.
 *
 * So the rule is one sentence a beginner learns in one sortie: *the banner
 * turns red, you press X, you live.* The cost is real and countable - twelve
 * cartridges, and a short blind spot while the dispenser recycles - so the
 * skill is husbanding them across a sortie rather than reading a dice roll.
 *
 * The depth lives in the missile's flight model instead (`MissileGuidance`),
 * where it is visible: a good break turn defeats a distant shot without
 * spending anything, and a pilot who can fly saves their chaff for the shots
 * that are genuinely unbeatable. Skill comes from geometry the player can
 * see, not from a hidden probability.
 *
 * Pure data and pure functions, following `core/Pacing.ts` and
 * `core/ThreatLevel.ts`.
 */

export const CM_TUNING = {
    /** Cartridges carried on a full load. */
    capacity: 12,
    /**
     * Seconds a cloud keeps a seeker busy.
     *
     * Long enough to matter: at 480 m/s a missile covers about 1.7 km while
     * decoyed, which reliably carries it past the aeroplane. Short enough
     * that a site can re-engage afterwards, so chaff buys an escape rather
     * than ending the engagement.
     */
    decoySeconds: 3.5,
    /**
     * Dispenser recycle time. The blind spot that makes the count matter -
     * without it a panicking player could hold the key down and be immune.
     */
    reloadSeconds: 1.2,
    /** Reflectors drawn per release. */
    puffCount: 14,
    /** How long the visible cloud lingers, seconds. */
    puffLifeSeconds: 2.4,
    /** Initial spread speed of the cloud, m/s. */
    puffSpreadSpeed: 22
} as const;

export interface CountermeasureState {
    /** Cartridges left. */
    remaining: number;
    /** Seconds until the dispenser can fire again. */
    reloadTimer: number;
}

export function createCountermeasureState(
    remaining: number = CM_TUNING.capacity
): CountermeasureState {
    return { remaining: Math.max(0, remaining), reloadTimer: 0 };
}

export function tickCountermeasures(state: CountermeasureState, dt: number): void {
    if (state.reloadTimer > 0) state.reloadTimer = Math.max(0, state.reloadTimer - dt);
}

export function canDispense(state: CountermeasureState): boolean {
    return state.remaining > 0 && state.reloadTimer <= 0;
}

/**
 * Spend one cartridge. Returns false when the dispenser is empty or still
 * recycling, so the caller can play a dry click rather than a release.
 */
export function dispense(state: CountermeasureState): boolean {
    if (!canDispense(state)) return false;
    state.remaining -= 1;
    state.reloadTimer = CM_TUNING.reloadSeconds;
    return true;
}

/**
 * The clock value a decoyed seeker stays confused until.
 *
 * Expressed as an absolute mission time rather than a countdown so that a
 * SAM's decoy state survives being written by one subsystem and read by
 * another without a per-site timer to tick.
 */
export function decoyExpiry(missionSeconds: number): number {
    return missionSeconds + CM_TUNING.decoySeconds;
}

export function isDecoyed(decoyedUntil: number, missionSeconds: number): boolean {
    return missionSeconds < decoyedUntil;
}
