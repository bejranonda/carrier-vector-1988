import { describe, it, expect, vi } from 'vitest';
import {
    DEFAULT_DISPLAY_MODE,
    DISPLAY_MODES,
    applyDisplayModeToDocument,
    displayModeSpec,
    nextDisplayMode
} from './DisplayMode';

describe('display modes', () => {
    it('defaults to the legible middle setting, not the full CRT', () => {
        // The original build shipped the scanline mask and a 92%-black
        // vignette permanently enabled with no way to turn them down.
        expect(DEFAULT_DISPLAY_MODE).toBe('MODERN');
        expect(displayModeSpec('MODERN').scanlines).toBe(0);
        expect(displayModeSpec('MODERN').vignette).toBeLessThan(0.35);
    });

    it('CLEAN disables every screen effect', () => {
        const clean = displayModeSpec('CLEAN');
        expect(clean.bloom).toBe(0);
        expect(clean.persistenceTau).toBe(0);
        expect(clean.scanlines).toBe(0);
        expect(clean.vignette).toBe(0);
    });

    it('orders the ladder from least to most texture', () => {
        const ids = DISPLAY_MODES.map(m => m.id);
        expect(ids).toEqual(['CLEAN', 'MODERN', 'RETRO']);
        for (let i = 1; i < DISPLAY_MODES.length; i++) {
            expect(DISPLAY_MODES[i].bloom).toBeGreaterThanOrEqual(DISPLAY_MODES[i - 1].bloom);
            expect(DISPLAY_MODES[i].vignette).toBeGreaterThanOrEqual(DISPLAY_MODES[i - 1].vignette);
            expect(DISPLAY_MODES[i].persistenceTau).toBeGreaterThanOrEqual(DISPLAY_MODES[i - 1].persistenceTau);
        }
    });

    it('cycles round the full ladder and back', () => {
        expect(nextDisplayMode('CLEAN')).toBe('MODERN');
        expect(nextDisplayMode('MODERN')).toBe('RETRO');
        expect(nextDisplayMode('RETRO')).toBe('CLEAN');
    });

    it('falls back to the default spec for an unknown id', () => {
        expect(displayModeSpec('NOPE' as never).id).toBe('MODERN');
    });

    it('publishes the mode to CSS custom properties', () => {
        const setProperty = vi.fn();
        const root = { dataset: {} as Record<string, string>, style: { setProperty } } as unknown as HTMLElement;

        applyDisplayModeToDocument(displayModeSpec('RETRO'), root);

        expect(root.dataset.display).toBe('RETRO');
        expect(setProperty).toHaveBeenCalledWith('--fx-scanlines', '0.5');
        expect(setProperty).toHaveBeenCalledWith('--fx-vignette', '0.7');
    });
});
