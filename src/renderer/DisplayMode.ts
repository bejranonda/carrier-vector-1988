/**
 * CARRIER VECTOR: 1988 - Display Mode
 *
 * One switch for every "screen texture" effect in the game: canvas-side
 * phosphor persistence and bloom, and the CSS-side scanline mask, vignette
 * and flicker.
 *
 * WHY: those effects used to be split across three places (a CSS overlay
 * that was always on at full strength, a canvas bloom pass behind the `P`
 * key, and a hardcoded persistence constant) and there was no way for a
 * player who simply wanted to READ the screen to turn them down. They are
 * now one ordered ladder, defaulting to the legible middle setting.
 *
 * Pure data + a single DOM attribute write, so the table is unit-testable.
 */

/**
 * There is exactly one screen style. It used to be a three-step ladder
 * (CLEAN / MODERN / RETRO CRT) behind the `P` key, and a beginner had to
 * understand and choose between three looks before flying. MODERN - bloom,
 * a light phosphor trail and a soft vignette - is the look the game is known
 * for and it costs a fraction of RETRO's per-stroke shadow, so it is the one
 * that stayed. A stored value from the old ladder falls back to it.
 */
export type DisplayModeId = 'MODERN';

export interface DisplayModeSpec {
    id: DisplayModeId;
    label: string;
    /** Short blurb shown when the player cycles modes. */
    description: string;
    /** Additive bloom strength on composite. 0 disables the whole pass. */
    bloom: number;
    /**
     * Per-stroke shadow radius on the world layer, in pixels.
     *
     * This is the single most expensive thing the renderer does: a Canvas2D
     * shadow is applied per `stroke()`, and the terrain mesh alone issues
     * thousands of them per frame (measured at 1600x900 on a software
     * rasteriser: 23.7ms/frame with it, 16.7ms without). The bloom pass
     * already produces a vector glow far more cheaply, at 1/4 resolution over
     * the whole layer, so only RETRO pays for both.
     */
    vectorGlow: number;
    /**
     * Phosphor decay time constant in seconds. 0 means a hard clear every
     * frame (no vector trails at all).
     */
    persistenceTau: number;
    /** Scanline / phosphor-mask opacity applied by CSS. */
    scanlines: number;
    /** Vignette strength applied by CSS. */
    vignette: number;
}

export const DISPLAY_MODES: readonly DisplayModeSpec[] = [
    {
        id: 'MODERN',
        label: 'MODERN',
        description: 'crisp symbology with a light vector glow',
        bloom: 0.42,
        vectorGlow: 0,
        persistenceTau: 0.035,
        scanlines: 0,
        vignette: 0.28
    }
];

export const DEFAULT_DISPLAY_MODE: DisplayModeId = 'MODERN';

export function displayModeSpec(id: DisplayModeId): DisplayModeSpec {
    return DISPLAY_MODES.find(m => m.id === id) ?? DISPLAY_MODES[0];
}

/** Next mode in the CLEAN -> MODERN -> RETRO -> CLEAN ladder. */
export function nextDisplayMode(id: DisplayModeId): DisplayModeId {
    const i = DISPLAY_MODES.findIndex(m => m.id === id);
    return DISPLAY_MODES[(i + 1) % DISPLAY_MODES.length].id;
}

const STORAGE_KEY = 'carrier-vector-1988.displayMode';

/**
 * Remember the player's choice across reloads. Someone who finds the retro
 * texture hard to read should not have to press `P` twice every session.
 *
 * Storage can throw (Safari private mode, blocked third-party storage), and
 * the game must still boot, so both directions are best-effort.
 */
export function storedDisplayMode(): DisplayModeId | null {
    try {
        const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (stored && DISPLAY_MODES.some(m => m.id === stored)) return stored as DisplayModeId;
    } catch {
        // Storage unavailable.
    }
    return null;
}

export function loadDisplayMode(): DisplayModeId {
    try {
        const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (stored && DISPLAY_MODES.some(m => m.id === stored)) {
            return stored as DisplayModeId;
        }
    } catch {
        // Storage unavailable - fall through to the default.
    }
    return DEFAULT_DISPLAY_MODE;
}

export function saveDisplayMode(id: DisplayModeId): void {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, id);
    } catch {
        // Nothing to do: the mode still applies for this session.
    }
}

/**
 * Publish the mode to CSS. The stylesheet reads `data-display` plus the two
 * custom properties, so the overlay strength is data-driven rather than a
 * fixed `.crt::before` rule.
 */
export function applyDisplayModeToDocument(spec: DisplayModeSpec, root?: HTMLElement) {
    const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el) return;
    el.dataset.display = spec.id;
    el.style.setProperty('--fx-scanlines', String(spec.scanlines));
    el.style.setProperty('--fx-vignette', String(spec.vignette));
}
