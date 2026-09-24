/**
 * CARRIER VECTOR: 1988 - Operational Tempo
 *
 * WHY THIS EXISTS
 * The deck loop was timed like the thing it simulates. Measured on the shipped
 * build: the first sortie launches straight away, but the jet then flies about
 * thirty-five seconds to reach a contact spawned 8.3 km out, while the HUD
 * announces that the first package is a hundred and fifty seconds away. Every
 * sortie after the first was worse - a trap or a crash put the aircraft
 * through de-rig, hangar maintenance and re-arming, some thirty-two seconds of
 * watching progress bars before the player could fly again.
 *
 * None of that is wrong as simulation. It is wrong as an opening. A browser
 * game has about thirty seconds to justify itself, and this one was spending
 * them on a progress bar.
 *
 * So the timings become data with two settings. ARCADE is the default - the
 * deck works fast, the enemy arrives early, and a lost jet is replaced in
 * seconds. SIM restores every original number for the player who wants the
 * deliberate version, and is one key away.
 *
 * Nothing here changes what the simulation DOES: the same state machine runs
 * the same phases in the same order, and a scenario's own clocks (the canyon
 * strike's four-minute window) are untouched. Only the durations move.
 *
 * Pure data plus best-effort persistence, following DisplayMode and
 * FlightAssist.
 */

export type PacingId = 'ARCADE' | 'SIM';

/** Deck-crew task durations, in seconds. Injected into DeckManager. */
export interface DeckTiming {
    /** HANGAR_MAINTENANCE: moving the jet up to the roof. */
    maintenanceSeconds: number;
    /** ARMING_REFUELING: fuel and ordnance. */
    armingSeconds: number;
    /** DAMAGED_REPAIR: battle damage. */
    repairSeconds: number;
    /** RECOVERY_TRAP: de-rigging after a trap. */
    derigSeconds: number;
}

export interface PacingSpec extends DeckTiming {
    id: PacingId;
    label: string;
    blurb: string;
    /**
     * Seconds to put a spare airframe on the catapult after a loss. Zero means
     * the full hangar cycle, which is what the simulation always did.
     */
    respawnSeconds: number;
    /** Multiplier on the scripted opening timeline's ETAs. */
    openingEtaScale: number;
    /** Multiplier on how far out airborne contacts are spawned. */
    spawnDistanceScale: number;
    /**
     * Multiplier on the wing's lift - the airframe the tempo flies.
     *
     * SIM keeps the original 1.0. ARCADE flies 1.7, and that number is not a
     * feel knob picked by taste. The recovery assist flies the approach at
     * 70 m/s and the AoA indexer's on-speed band is 8.1 deg +- 1.2 (the real
     * F-14 figure). At 1.0 the jet needs 15.5 deg of AoA for 1 g at 70 m/s -
     * 2.5 deg from the stall, with the indexer reading SLOW all the way down.
     * At 1.7 the same approach needs 9.3 deg, inside the band. It also turns a
     * held 75-degree bank into a LEVEL 12 deg/s turn (was 8 deg/s and
     * descending 280 m in 16 s). Measured - see KNOWLEDGE.md section 21.
     */
    liftScale: number;
}

export const PACING_SPECS: readonly PacingSpec[] = [
    {
        id: 'ARCADE',
        label: 'ARCADE',
        blurb: 'fast deck, early contacts, an agile jet',
        maintenanceSeconds: 4,
        armingSeconds: 5,
        repairSeconds: 8,
        derigSeconds: 1.5,
        respawnSeconds: 3,
        // 150 / 280 / 440 s becomes roughly 52 / 98 / 154 - a package every
        // fifty seconds instead of every two and a half minutes.
        openingEtaScale: 0.35,
        // 8.3 km becomes 4.6 km: about twenty seconds of transit at 230 m/s.
        spawnDistanceScale: 0.55,
        liftScale: 1.7
    },
    {
        id: 'SIM',
        label: 'SIM',
        blurb: 'the original deliberate deck cycle and threat timeline',
        maintenanceSeconds: 18,
        armingSeconds: 14,
        repairSeconds: 30,
        derigSeconds: 3,
        respawnSeconds: 0,
        openingEtaScale: 1,
        spawnDistanceScale: 1,
        liftScale: 1
    }
];

/**
 * ARCADE. The deliberate version is the better simulation and the worse first
 * impression, and a first impression is the only one most players will form.
 */
export const DEFAULT_PACING: PacingId = 'ARCADE';

export function pacingSpec(id: PacingId): PacingSpec {
    return PACING_SPECS.find(p => p.id === id) ?? PACING_SPECS[0];
}

export function nextPacing(id: PacingId): PacingId {
    const i = PACING_SPECS.findIndex(p => p.id === id);
    return PACING_SPECS[(i + 1) % PACING_SPECS.length].id;
}

/** The deck-crew durations alone, for handing to DeckManager. */
export function deckTiming(id: PacingId): DeckTiming {
    const { maintenanceSeconds, armingSeconds, repairSeconds, derigSeconds } = pacingSpec(id);
    return { maintenanceSeconds, armingSeconds, repairSeconds, derigSeconds };
}

/** Scale a scripted timeline's ETAs, never below a floor that stays flyable. */
export function scaleOpeningEta(etaSeconds: number, id: PacingId): number {
    return Math.max(20, Math.round(etaSeconds * pacingSpec(id).openingEtaScale));
}

const STORAGE_KEY = 'carrier-vector-1988.pacing';

function isPacingId(value: unknown): value is PacingId {
    return value === 'ARCADE' || value === 'SIM';
}

export function loadPacing(): PacingId {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        return isPacingId(raw) ? raw : DEFAULT_PACING;
    } catch {
        return DEFAULT_PACING;
    }
}

export function savePacing(id: PacingId) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, id);
    } catch {
        // The setting still holds for this session.
    }
}
