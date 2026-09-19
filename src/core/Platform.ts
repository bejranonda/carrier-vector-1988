/**
 * CARRIER VECTOR: 1988 - Platform & Control Scheme
 *
 * WHY THIS EXISTS
 * The game is keyboard-only, and roughly half of casual web traffic is a
 * phone. That is not a missing feature so much as a closed door: a player on
 * a phone cannot begin, and no amount of polish behind that door matters.
 *
 * Two previous passes accidentally built most of the answer. The AUTOPILOT
 * assist flies the aeroplane, and target designation chooses what to shoot -
 * which together are a complete game that needs a thumb rather than ten
 * fingers. Touch mode is therefore not a parallel implementation of the
 * game; it is a different way into the same one.
 *
 * This module answers only "which scheme should this device get", as pure
 * functions of what the browser reports, so the decision is testable without
 * a device lab. A manual override is persisted, because detection is a
 * heuristic and a heuristic is wrong for somebody: a Surface owner with a
 * keyboard, or a desktop player who wants to try the touch layout.
 */

export type ControlScheme = 'KEYBOARD' | 'TOUCH';
export type SchemePreference = 'AUTO' | 'KEYBOARD' | 'TOUCH';

/** The subset of the environment the decision depends on. */
export interface PlatformSignals {
    /** navigator.maxTouchPoints, or 0. */
    maxTouchPoints: number;
    /** Whether the primary pointer is coarse (a finger), from a media query. */
    coarsePointer: boolean;
    /** Whether the device can hover, from a media query. Mice can; fingers cannot. */
    canHover: boolean;
    /** Viewport width and height in CSS pixels. */
    width: number;
    height: number;
}

/**
 * The longest edge below which a landscape cockpit cannot hold its
 * instruments. Phones sit under it; small laptops do not.
 */
export const TOUCH_MAX_LONG_EDGE = 1180;

/**
 * Decide the scheme from what the browser reports.
 *
 * The rule is deliberately conservative in one direction: a device that
 * cannot hover and has a coarse primary pointer is a touchscreen, and a
 * touchscreen with a laptop-sized viewport is a hybrid, which gets the
 * keyboard layout because it has one. Getting this wrong hands somebody a
 * layout they cannot use, so the override below is not optional polish.
 */
export function detectScheme(signals: PlatformSignals): ControlScheme {
    const touchCapable = signals.maxTouchPoints > 0;
    if (!touchCapable) return 'KEYBOARD';

    // A trackpad is coarse-ish but hovers; a finger does neither.
    const fingerPrimary = signals.coarsePointer && !signals.canHover;
    if (!fingerPrimary) return 'KEYBOARD';

    const longEdge = Math.max(signals.width, signals.height);
    return longEdge <= TOUCH_MAX_LONG_EDGE ? 'TOUCH' : 'KEYBOARD';
}

/** Read the live environment. Returns safe defaults when there is no DOM. */
export function readPlatformSignals(): PlatformSignals {
    const nav = globalThis.navigator as Navigator | undefined;
    const win = globalThis.window as (Window & typeof globalThis) | undefined;
    const media = (query: string) => {
        try {
            return win?.matchMedia?.(query).matches === true;
        } catch {
            return false;
        }
    };

    return {
        maxTouchPoints: nav?.maxTouchPoints ?? 0,
        coarsePointer: media('(pointer: coarse)'),
        canHover: media('(hover: hover)'),
        width: win?.innerWidth ?? 1280,
        height: win?.innerHeight ?? 800
    };
}

export function resolveScheme(preference: SchemePreference, signals: PlatformSignals): ControlScheme {
    if (preference === 'AUTO') return detectScheme(signals);
    return preference;
}

/**
 * The cockpit needs a landscape viewport: at phone-portrait widths the
 * instrument solver has nowhere to put the airspeed and altitude blocks, and
 * the pitch ladder collapses to its minimum. Rather than ship an unreadable
 * cockpit, touch mode asks for the device to be turned.
 */
export function needsRotation(scheme: ControlScheme, width: number, height: number): boolean {
    return scheme === 'TOUCH' && height > width;
}

const STORAGE_KEY = 'carrier-vector-1988.controlScheme';

function isPreference(value: unknown): value is SchemePreference {
    return value === 'AUTO' || value === 'KEYBOARD' || value === 'TOUCH';
}

export function loadSchemePreference(): SchemePreference {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        return isPreference(raw) ? raw : 'AUTO';
    } catch {
        return 'AUTO';
    }
}

export function saveSchemePreference(preference: SchemePreference) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, preference);
    } catch {
        // The choice still holds for this session.
    }
}

/** AUTO -> TOUCH -> KEYBOARD -> AUTO, for the settings key. */
export function nextSchemePreference(preference: SchemePreference): SchemePreference {
    return preference === 'AUTO' ? 'TOUCH' : preference === 'TOUCH' ? 'KEYBOARD' : 'AUTO';
}
