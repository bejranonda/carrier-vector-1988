import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    DEFAULT_DISPLAY_MODE,
    DISPLAY_MODES,
    applyDisplayModeToDocument,
    displayModeSpec,
    loadDisplayMode,
    nextDisplayMode,
    saveDisplayMode,
    storedDisplayMode
} from './DisplayMode';

describe('the single screen style', () => {
    // The game used to offer CLEAN / MODERN / RETRO CRT behind a key, and a
    // beginner had to choose a look before flying. One style, chosen for them.
    it('offers exactly one style', () => {
        expect(DISPLAY_MODES).toHaveLength(1);
        expect(DEFAULT_DISPLAY_MODE).toBe('MODERN');
    });

    it('keeps the legible look - some glow, never the heavy per-stroke shadow', () => {
        const spec = displayModeSpec('MODERN');
        expect(spec.bloom).toBeGreaterThan(0);
        expect(spec.bloom).toBeLessThanOrEqual(0.55);
        // The per-stroke shadow is the expensive thing (GUIDELINES §3).
        expect(spec.vectorGlow).toBe(0);
        expect(spec.vignette).toBeLessThan(0.5);
    });

    it('has nowhere else to cycle to', () => {
        expect(nextDisplayMode('MODERN')).toBe('MODERN');
    });

    it('falls back to the one style for an unknown id', () => {
        expect(displayModeSpec('NOPE' as never).id).toBe('MODERN');
    });

    it('publishes the style to CSS custom properties', () => {
        const setProperty = vi.fn();
        const root = { dataset: {} as Record<string, string>, style: { setProperty } } as unknown as HTMLElement;

        applyDisplayModeToDocument(displayModeSpec('MODERN'), root);

        expect(root.dataset.display).toBe('MODERN');
        expect(setProperty).toHaveBeenCalledWith('--fx-vignette', '0.28');
    });
});

describe('display style persistence', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function stubStorage(initial: Record<string, string> = {}) {
        const store = { ...initial };
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => (k in store ? store[k] : null),
            setItem: (k: string, v: string) => { store[k] = v; }
        });
        return store;
    }

    it('round-trips the style', () => {
        stubStorage();
        saveDisplayMode('MODERN');
        expect(loadDisplayMode()).toBe('MODERN');
    });

    // A player who had picked RETRO or CLEAN under the old ladder must not
    // boot into an unknown mode.
    it('treats a stored value from the retired ladder as unset', () => {
        stubStorage({ 'carrier-vector-1988.displayMode': 'RETRO' });
        expect(storedDisplayMode()).toBeNull();
        expect(loadDisplayMode()).toBe(DEFAULT_DISPLAY_MODE);
    });

    it('survives storage that throws in either direction', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('SecurityError'); },
            setItem: () => { throw new Error('SecurityError'); }
        });
        expect(loadDisplayMode()).toBe(DEFAULT_DISPLAY_MODE);
        expect(() => saveDisplayMode('MODERN')).not.toThrow();
    });

    it('survives an environment with no storage at all', () => {
        vi.stubGlobal('localStorage', undefined);
        expect(loadDisplayMode()).toBe(DEFAULT_DISPLAY_MODE);
        expect(() => saveDisplayMode('MODERN')).not.toThrow();
    });
});
