/**
 * CARRIER VECTOR: 1988 - HUD density and what each level shows
 *
 * WHY THIS EXISTS
 * Every "make it easier for beginners" feature this game shipped between v1.3
 * and v1.8 ADDED something to the screen - a ticker, a strip, a checklist, an
 * annunciator, nine pills, two corner buttons, a bigger radar - until four
 * pairs of them were being drawn into the same rectangle. A beginner did not
 * need more help on top of the screen; they needed a smaller screen.
 *
 * So there are three densities, and the first one is small on purpose:
 *
 *   FIRST_FLIGHT  horizon, speed, altitude, one objective line, one hint, the
 *                 targets, and a single "go here" cue. On by default until the
 *                 player has completed a mission.
 *   ARCADE        the full instrument set for a player who knows the jet.
 *   PRO           ARCADE plus the pitch ladder and the engineering readouts.
 *
 * What each level shows is ONE table (`hudVisibility`), not a scatter of
 * `if (density === ...)` checks through the renderer. That makes "how much is
 * on the glass" a number the tests can hold down: see `visibleRegionCount`.
 *
 * Pure - no canvas, no DOM - with storage injected, so all of it is tested
 * headlessly.
 */

export type HudDensity = 'FIRST_FLIGHT' | 'ARCADE' | 'PRO';

export const HUD_DENSITIES: readonly HudDensity[] = ['FIRST_FLIGHT', 'ARCADE', 'PRO'];

/** Short label for the density button and the callout. */
export const HUD_DENSITY_LABEL: Record<HudDensity, string> = {
    FIRST_FLIGHT: 'FIRST FLIGHT',
    ARCADE: 'ARCADE',
    PRO: 'PRO'
};

/**
 * Every HUD region that a density can switch off. Regions that are never
 * optional - the objective strip, speed, altitude, warnings, the coach ticker,
 * target brackets, callouts, landing aids on approach - are not listed: no
 * density hides the instruments you fly by or the thing that is shooting you.
 */
export interface HudVisibility {
    /** The single-line artificial horizon with a pitch number. */
    horizon: boolean;
    /** The full pitch ladder. */
    pitchLadder: boolean;
    /** The flight path marker. */
    flightPathMarker: boolean;
    /** The heading tape under the objective strip. */
    compass: boolean;
    /** The tactical radar / RWR scope. */
    radar: boolean;
    /** The full weapon / chaff / assist pill bar. */
    pillBar: boolean;
    /** One compact chip naming the armed weapon and its rounds. */
    armedWeaponChip: boolean;
    /** Score and rank. */
    scoreChip: boolean;
    /** The DECK / HUD / STICK buttons in the top-right corner. */
    cornerButtons: boolean;
    /** Captions for routine assist modes (terrain following, autopilot...). */
    routineAnnunciator: boolean;
    /** The one-line "U for more instruments / H for controls" hint. */
    graduationHint: boolean;
}

const VISIBILITY: Record<HudDensity, HudVisibility> = {
    FIRST_FLIGHT: {
        horizon: true,
        pitchLadder: false,
        flightPathMarker: false,
        compass: false,
        radar: false,
        pillBar: false,
        armedWeaponChip: true,
        scoreChip: false,
        cornerButtons: false,
        routineAnnunciator: false,
        graduationHint: true
    },
    ARCADE: {
        horizon: true,
        pitchLadder: false,
        flightPathMarker: true,
        compass: true,
        radar: true,
        pillBar: true,
        armedWeaponChip: false,
        scoreChip: true,
        cornerButtons: true,
        routineAnnunciator: true,
        graduationHint: false
    },
    PRO: {
        horizon: false,
        pitchLadder: true,
        flightPathMarker: true,
        compass: true,
        radar: true,
        pillBar: false,
        armedWeaponChip: false,
        scoreChip: true,
        cornerButtons: true,
        routineAnnunciator: true,
        graduationHint: false
    }
};

export function hudVisibility(density: HudDensity): HudVisibility {
    return VISIBILITY[density];
}

/**
 * Optional regions switched on at a density. The always-on set (objective,
 * speed, altitude, warnings, coach, targets, callouts) is constant across
 * densities, so this is the number that actually moves.
 */
export function visibleRegionCount(density: HudDensity): number {
    return Object.values(VISIBILITY[density]).filter(Boolean).length;
}

export function nextHudDensity(density: HudDensity): HudDensity {
    const i = HUD_DENSITIES.indexOf(density);
    return HUD_DENSITIES[(i + 1) % HUD_DENSITIES.length];
}

/**
 * The density a player gets when they have never chosen one.
 *
 * FIRST_FLIGHT until they have completed any mission. A completion is the
 * earliest honest evidence that the player can fly the jet with the small
 * screen; attempts alone are not - a pilot who has crashed three times is the
 * one who most needs it to stay small.
 */
export function defaultHudDensity(hasCompletedAMission: boolean): HudDensity {
    return hasCompletedAMission ? 'ARCADE' : 'FIRST_FLIGHT';
}

export interface DensityStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'carrier-vector-1988.hud-density';

function isDensity(value: unknown): value is HudDensity {
    return value === 'FIRST_FLIGHT' || value === 'ARCADE' || value === 'PRO';
}

function defaultStore(): DensityStore | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/** The density the player chose, or null if they never have. */
export function storedHudDensity(store: DensityStore | null = defaultStore()): HudDensity | null {
    try {
        const raw = store?.getItem(STORAGE_KEY) ?? null;
        return isDensity(raw) ? raw : null;
    } catch {
        return null;
    }
}

export function saveHudDensity(density: HudDensity, store: DensityStore | null = defaultStore()) {
    try {
        store?.setItem(STORAGE_KEY, density);
    } catch {
        // Best effort: the choice still holds for this session.
    }
}

/**
 * The density to use right now: the player's own choice if they have made
 * one, otherwise the default for their experience.
 */
export function resolveHudDensity(
    hasCompletedAMission: boolean,
    store: DensityStore | null = defaultStore()
): HudDensity {
    return storedHudDensity(store) ?? defaultHudDensity(hasCompletedAMission);
}
