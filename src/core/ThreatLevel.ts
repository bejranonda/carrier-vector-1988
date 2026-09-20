/**
 * CARRIER VECTOR: 1988 - Threat Level
 *
 * WHY THIS EXISTS
 * Every scenario had exactly one difficulty, baked into its threat profile.
 * There was no way to ask for a harder carrier defence or an easier canyon
 * strike - and those are different requests from the two settings that already
 * existed. Flight assist changes how much of the AEROPLANE you fly. Ops tempo
 * changes how long you WAIT. Neither changes how hard the fight is, which is
 * the thing a returning player actually wants to turn up.
 *
 * The lever is where on the escalation curve a scenario starts. Wave
 * generation is already a function of wave number - packages get more
 * numerous, faster and better escorted as it climbs - so shifting the starting
 * point moves the whole campaign along a curve that is already tuned and
 * already tested, rather than inventing a second set of difficulty numbers to
 * keep in sync with the first.
 *
 * DELIBERATELY NOT A SCORE MULTIPLIER. Per-mission records would stop meaning
 * anything the moment the same number could be earned three ways, and the
 * daily sortie - whose entire point is that everybody flies the same run -
 * forces REGULAR for the same reason it forces arcade pacing.
 *
 * Pure, with best-effort persistence, mirroring `core/Pacing.ts`.
 */

export type ThreatLevelId = 'CADET' | 'REGULAR' | 'VETERAN';

export interface ThreatLevelSpec {
    id: ThreatLevelId;
    label: string;
    blurb: string;
    /**
     * Waves added to (or taken off) a scenario's starting point.
     *
     * Asymmetric on purpose. Two waves down is a noticeably gentler opening
     * without making the first package a formality; four waves up is a fight
     * from the catapult, because a player who has asked for VETERAN has
     * already flown the easy version and does not want it again with slightly
     * more of it.
     */
    waveOffset: number;
}

export const THREAT_LEVELS: readonly ThreatLevelSpec[] = [
    {
        id: 'CADET',
        label: 'CADET',
        blurb: 'Lighter packages. Room to learn the aeroplane.',
        waveOffset: -2
    },
    {
        id: 'REGULAR',
        label: 'REGULAR',
        blurb: 'The fight as designed.',
        waveOffset: 0
    },
    {
        id: 'VETERAN',
        label: 'VETERAN',
        blurb: 'Late-campaign packages from the first cat shot.',
        waveOffset: 4
    }
];

export const DEFAULT_THREAT_LEVEL: ThreatLevelId = 'REGULAR';

export function threatLevelSpec(id: ThreatLevelId): ThreatLevelSpec {
    return THREAT_LEVELS.find(t => t.id === id) ?? THREAT_LEVELS[1];
}

export function nextThreatLevel(id: ThreatLevelId): ThreatLevelId {
    const i = THREAT_LEVELS.findIndex(t => t.id === id);
    return THREAT_LEVELS[(i + 1) % THREAT_LEVELS.length].id;
}

/**
 * The wave a scenario starts on at a given threat level.
 *
 * Never below zero: wave 0 is the hand-curated opening act, and a negative
 * wave number is not a gentler fight, it is an index into nothing.
 */
export function startWaveFor(scenarioStartWave: number, level: ThreatLevelId): number {
    return Math.max(0, scenarioStartWave + threatLevelSpec(level).waveOffset);
}

// ---------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------

const STORAGE_KEY = 'carrier-vector-1988.threatLevel';

function isThreatLevelId(value: unknown): value is ThreatLevelId {
    return typeof value === 'string' && THREAT_LEVELS.some(t => t.id === value);
}

/** Best-effort restore; storage can throw or be blocked and the game must boot. */
export function loadThreatLevel(): ThreatLevelId {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        return isThreatLevelId(raw) ? raw : DEFAULT_THREAT_LEVEL;
    } catch {
        return DEFAULT_THREAT_LEVEL;
    }
}

export function saveThreatLevel(id: ThreatLevelId) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, id);
    } catch {
        // The setting still holds for this session.
    }
}
