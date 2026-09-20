/**
 * CARRIER VECTOR: 1988 - Motion & Flash Safety
 *
 * WHY THIS EXISTS
 * Two problems, one of them a safety issue rather than a preference.
 *
 * 1. **Flash rate.** The stall banner blinked on a 220 ms period and the
 *    missile-launch banner on 260 ms - 4.5 and 3.8 flashes per second. WCAG
 *    2.3.1 sets the threshold at three per second, because faster flashing of
 *    a large or high-contrast area can trigger photosensitive seizures. That
 *    is not a taste question and it is not opt-in: the rate is capped for
 *    everybody.
 *
 * 2. **Motion.** The camera shake and the full-screen impact flash added in
 *    the feel pass are exactly the kind of thing that causes trouble for
 *    people with vestibular disorders, and the CSS already honours
 *    `prefers-reduced-motion` for the CRT flicker while the canvas quietly
 *    ignored it.
 *
 * Pure functions of the preference and the clock, so the rates can be
 * asserted rather than eyeballed.
 */

export interface MotionPreferences {
    /** The platform's `prefers-reduced-motion: reduce` setting. */
    reducedMotion: boolean;
}

export interface MotionSettings {
    /** Multiplier on camera-shake trauma. */
    shakeScale: number;
    /** Multiplier on the full-screen impact flash. */
    flashScale: number;
    /** Whether anything on the HUD may blink at all. */
    allowBlink: boolean;
    /** Period of a permitted blink, milliseconds. */
    blinkPeriodMs: number;
}

/**
 * The floor on a blink period, for everyone.
 *
 * 400 ms is 2.5 flashes per second, comfortably inside the WCAG 2.3.1 limit
 * of three. The banners were at 220 ms.
 */
export const MIN_BLINK_PERIOD_MS = 400;

export function motionSettings(prefs: MotionPreferences): MotionSettings {
    if (prefs.reducedMotion) {
        return {
            shakeScale: 0,
            // Not zero: a hit still needs to register, it just does not
            // strobe the whole screen.
            flashScale: 0.25,
            allowBlink: false,
            blinkPeriodMs: MIN_BLINK_PERIOD_MS
        };
    }
    return {
        shakeScale: 1,
        flashScale: 1,
        allowBlink: true,
        blinkPeriodMs: MIN_BLINK_PERIOD_MS
    };
}

/** Read the platform preference. Safe defaults when there is no DOM. */
export function readMotionPreferences(): MotionPreferences {
    try {
        const win = globalThis.window as (Window & typeof globalThis) | undefined;
        return { reducedMotion: win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true };
    } catch {
        return { reducedMotion: false };
    }
}

/**
 * Whether a blinking element is visible right now.
 *
 * Never faster than `MIN_BLINK_PERIOD_MS`, and always visible - not hidden -
 * when blinking is switched off, because the thing that blinks is a warning
 * and a warning that vanishes is worse than one that fails to flash.
 */
export function blinkVisible(nowMs: number, settings: MotionSettings, periodMs?: number): boolean {
    if (!settings.allowBlink) return true;
    const period = Math.max(MIN_BLINK_PERIOD_MS, periodMs ?? settings.blinkPeriodMs);
    return Math.floor(nowMs / period) % 2 === 0;
}
