import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    DEFAULT_DISPLAY_MODE,
    DISPLAY_MODES,
    applyDisplayModeToDocument,
    displayModeSpec,
    loadDisplayMode,
    nextDisplayMode,
    saveDisplayMode
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
        expect(clean.vectorGlow).toBe(0);
        expect(clean.persistenceTau).toBe(0);
        expect(clean.scanlines).toBe(0);
        expect(clean.vignette).toBe(0);
    });

    /**
     * A per-stroke Canvas2D shadow is the most expensive thing the renderer
     * does (measured: 23.7ms/frame with it at 1600x900, 16.7ms without), and
     * the bloom pass already produces a vector glow far more cheaply. Only the
     * full retro mode is allowed to pay for both.
     */
    it('reserves the per-stroke vector glow for RETRO only', () => {
        expect(displayModeSpec('CLEAN').vectorGlow).toBe(0);
        expect(displayModeSpec('MODERN').vectorGlow).toBe(0);
        expect(displayModeSpec('RETRO').vectorGlow).toBeGreaterThan(0);
        // MODERN still glows - it just buys it from the bloom pass.
        expect(displayModeSpec('MODERN').bloom).toBeGreaterThan(0);
    });

    it('orders the ladder from least to most texture', () => {
        const ids = DISPLAY_MODES.map(m => m.id);
        expect(ids).toEqual(['CLEAN', 'MODERN', 'RETRO']);
        for (let i = 1; i < DISPLAY_MODES.length; i++) {
            expect(DISPLAY_MODES[i].bloom).toBeGreaterThanOrEqual(DISPLAY_MODES[i - 1].bloom);
            expect(DISPLAY_MODES[i].vignette).toBeGreaterThanOrEqual(DISPLAY_MODES[i - 1].vignette);
            expect(DISPLAY_MODES[i].persistenceTau).toBeGreaterThanOrEqual(DISPLAY_MODES[i - 1].persistenceTau);
            expect(DISPLAY_MODES[i].vectorGlow).toBeGreaterThanOrEqual(DISPLAY_MODES[i - 1].vectorGlow);
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

    it('falls back to the default spec for an unknown id', () => {
        expect(displayModeSpec('NOPE' as never).id).toBe('MODERN');
    });
});

describe('display mode persistence', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function stubStorage(initial: Record<string, string> = {}) {
        const store = { ...initial };
        const localStorage = {
            getItem: (k: string) => (k in store ? store[k] : null),
            setItem: (k: string, v: string) => { store[k] = v; }
        };
        vi.stubGlobal('localStorage', localStorage);
        return store;
    }

    it('round-trips the chosen mode', () => {
        const store = stubStorage();
        saveDisplayMode('RETRO');
        expect(Object.values(store)).toContain('RETRO');
        expect(loadDisplayMode()).toBe('RETRO');
    });

    it('returns the default when nothing has been stored', () => {
        stubStorage();
        expect(loadDisplayMode()).toBe(DEFAULT_DISPLAY_MODE);
    });

    it('ignores a stored value that is not a known mode', () => {
        stubStorage({ 'carrier-vector-1988.displayMode': 'ULTRA' });
        expect(loadDisplayMode()).toBe(DEFAULT_DISPLAY_MODE);
    });

    // Safari private mode and blocked third-party storage both throw here,
    // and the game still has to boot.
    it('survives storage that throws in either direction', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('SecurityError'); },
            setItem: () => { throw new Error('SecurityError'); }
        });
        expect(loadDisplayMode()).toBe(DEFAULT_DISPLAY_MODE);
        expect(() => saveDisplayMode('CLEAN')).not.toThrow();
    });

    it('survives an environment with no storage at all', () => {
        vi.stubGlobal('localStorage', undefined);
        expect(loadDisplayMode()).toBe(DEFAULT_DISPLAY_MODE);
        expect(() => saveDisplayMode('CLEAN')).not.toThrow();
    });
});
