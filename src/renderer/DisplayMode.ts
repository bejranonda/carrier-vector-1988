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

export type DisplayModeId = 'CLEAN' | 'MODERN' | 'RETRO';

export interface DisplayModeSpec {
    id: DisplayModeId;
    label: string;
    /** Short blurb shown when the player cycles modes. */
    description: string;
    /** Additive bloom strength on composite. 0 disables the whole pass. */
    bloom: number;
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
        id: 'CLEAN',
        label: 'CLEAN',
        description: 'maximum legibility - no trails, bloom or scanlines',
        bloom: 0,
        persistenceTau: 0,
        scanlines: 0,
        vignette: 0
    },
    {
        id: 'MODERN',
        label: 'MODERN',
        description: 'crisp symbology with a light vector glow',
        bloom: 0.32,
        persistenceTau: 0.035,
        scanlines: 0,
        vignette: 0.28
    },
    {
        id: 'RETRO',
        label: 'RETRO CRT',
        description: 'full 1988 phosphor tube - trails, scanlines, vignette',
        bloom: 0.55,
        persistenceTau: 0.075,
        scanlines: 0.5,
        vignette: 0.7
    }
];

export const DEFAULT_DISPLAY_MODE: DisplayModeId = 'MODERN';

export function displayModeSpec(id: DisplayModeId): DisplayModeSpec {
    return DISPLAY_MODES.find(m => m.id === id) ?? DISPLAY_MODES[1];
}

/** Next mode in the CLEAN -> MODERN -> RETRO -> CLEAN ladder. */
export function nextDisplayMode(id: DisplayModeId): DisplayModeId {
    const i = DISPLAY_MODES.findIndex(m => m.id === id);
    return DISPLAY_MODES[(i + 1) % DISPLAY_MODES.length].id;
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
