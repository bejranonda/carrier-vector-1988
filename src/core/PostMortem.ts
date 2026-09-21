/**
 * CARRIER VECTOR: 1988 - Death Post-Mortem
 *
 * WHY THIS EXISTS
 * A player who dies without knowing why cannot get better - the mission
 * failure screen said "CV-68 was knocked out of the fight" or "Aircraft lost
 * during training sortie" and stopped there. Every number needed to say more
 * was already being computed in the simulation and simply discarded.
 *
 * Deliberately narrow. This is not a combat log or a kill-cam - it is one
 * cause and one piece of advice, because a debrief screen is not the place
 * to teach a system, only to answer the one question the player actually has:
 * "what got me?"
 *
 * `detail` is left as free text rather than a further enum because the two
 * sources that populate it (a SAM's name, an enemy aircraft's name) are
 * already meaningful strings elsewhere in the game and forcing them through
 * a second classification would be exactly the kind of parallel data model
 * GUIDELINES §9 warns against.
 *
 * Pure and DOM-free, so the mapping from cause to advice is asserted rather
 * than eyeballed on the debrief screen.
 */

export type LossCauseKind = 'SAM' | 'CANNON' | 'TERRAIN' | 'STALL' | 'FUEL' | 'OCEAN';

export interface LossCause {
    kind: LossCauseKind;
    /** Who or what did it, e.g. a SAM site's name or an enemy aircraft's. */
    detail: string;
}

/** "KILLED BY SA-6 SAM-2", or null when no cause is on record. */
export function formatLossCause(cause: LossCause | null): string | null {
    if (!cause) return null;
    if (cause.kind === 'TERRAIN') return 'LOST TO TERRAIN IMPACT';
    if (cause.kind === 'STALL') return 'LOST TO AERODYNAMIC STALL / SPIN';
    if (cause.kind === 'FUEL') return 'LOST TO FUEL EXHAUSTION';
    if (cause.kind === 'OCEAN') return 'DITCHED IN THE OCEAN';
    return `KILLED BY ${cause.detail}`;
}

/** One line of advice keyed to how the aeroplane was actually lost. */
export function postMortemTip(cause: LossCause | null): string | null {
    if (!cause) return null;
    switch (cause.kind) {
        case 'SAM':
            return 'Break away from a launch early, or press [X] to chaff a tracking site.';
        case 'CANNON':
            return "Don't let a bandit close inside 1,600 m on your tail - break before it gets a guns solution.";
        case 'TERRAIN':
            return 'Watch altitude AGL below 300 m - pull up before the ridge fills the windscreen, not after.';
        case 'STALL':
            return 'Push nose DOWN [S] and advance throttle [SHIFT] to recover airflow before pulling up.';
        case 'FUEL':
            return 'Afterburner burns fuel 3.5× faster. Manage power and return to CV-68 before tanks run dry.';
        case 'OCEAN':
            return 'Maintain at least 150 m altitude over water until established on the carrier glideslope.';
        default:
            return null;
    }
}
