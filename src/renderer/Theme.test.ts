import { describe, it, expect } from 'vitest';
import {
    DEFAULT_PALETTE,
    PALETTES,
    THEME,
    WORLD,
    applyPalette,
    currentPalette,
    fitText,
    font,
    loadPalette,
    nextPalette,
    paletteSpec,
    savePalette,
    storedPalette
} from './Theme';

/**
 * Canvas is not available headlessly, but `fitText` only needs `measureText`
 * and `font`. A 7px-per-character stub is enough to pin the truncation rule.
 */
function stubCtx(charWidth = 7) {
    return {
        font: '',
        measureText: (t: string) => ({ width: t.length * charWidth })
    } as unknown as CanvasRenderingContext2D;
}

describe('fitText', () => {
    const ctx = stubCtx();

    it('returns short text unchanged', () => {
        expect(fitText(ctx, 'LAUNCH NOW', 1000)).toBe('LAUNCH NOW');
    });

    it('truncates with an ellipsis when the text is too wide', () => {
        // Canvas has no overflow handling, so without this a long objective
        // line paints straight through the edge of its panel.
        const out = fitText(ctx, 'SPLASH FIVE INBOUND CONTACTS RIGHT NOW', 70);
        expect(out.endsWith('…')).toBe(true);
        expect(ctx.measureText(out).width).toBeLessThanOrEqual(70);
    });

    it('never returns more than the available width allows', () => {
        for (const width of [0, 5, 7, 14, 40, 100, 400]) {
            const out = fitText(ctx, 'A'.repeat(120), width);
            expect(ctx.measureText(out).width, `width ${width}`).toBeLessThanOrEqual(width);
        }
    });

    it('returns empty rather than overflowing when even an ellipsis will not fit', () => {
        expect(fitText(ctx, 'ANYTHING', 3)).toBe('');
        expect(fitText(ctx, 'ANYTHING', 0)).toBe('');
        expect(fitText(ctx, 'ANYTHING', -20)).toBe('');
    });

    it('does not leave a trailing space before the ellipsis', () => {
        const out = fitText(ctx, 'LAUNCH NOW IMMEDIATELY', 84);
        expect(out).not.toMatch(/ …$/);
    });
});

describe('theme tokens', () => {
    it('emits a canvas font string with weight, size and the mono stack', () => {
        expect(font(12)).toMatch(/^400 12px ui-monospace/);
        expect(font(17, 700)).toMatch(/^700 17px ui-monospace/);
    });

    /**
     * The old palette drew labels in a desaturated green that turned to mud
     * under the vignette. Every UI colour must now clear 4.5:1 on the ground.
     */
    it('keeps every UI colour at or above 4.5:1 contrast on the ground colour', () => {
        const lum = (hex: string) => {
            const n = parseInt(hex.slice(1), 16);
            const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
                .map(v => v / 255)
                .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
        };
        const contrast = (a: string, b: string) => {
            const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
        };

        for (const key of ['ink', 'phosphor', 'muted', 'key', 'caution', 'alert'] as const) {
            expect(contrast(THEME[key], THEME.ground), `${key} on ground`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('separates hostile world symbology from friendly phosphor', () => {
        expect(WORLD.hostile).not.toBe(WORLD.terrain);
        expect(WORLD.hostile).not.toBe(WORLD.carrier);
    });
});

describe('palettes', () => {
    const rgb = (hex: string) => {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const lum = (hex: string) => {
        const ch = rgb(hex)
            .map(v => v / 255)
            .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const contrast = (a: string, b: string) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    };

    /**
     * A simulation of how a deuteranope sees a colour: the red and green
     * channels collapse toward a common response, leaving blue intact. Crude -
     * the real transform is a matrix in LMS space - but it is the right SHAPE,
     * which is all that is needed to answer "would these two still be
     * different".
     */
    const deuteranopic = (hex: string): [number, number, number] => {
        const [r, g, b] = rgb(hex);
        const merged = 0.5 * r + 0.5 * g;
        return [merged, merged, b];
    };
    const perceivedDistance = (a: string, b: string) => {
        const [ar, ag, ab] = deuteranopic(a);
        const [br, bg, bb] = deuteranopic(b);
        return Math.hypot(ar - br, ag - bg, ab - bb);
    };

    it('offers a classic palette and an alternative to it', () => {
        expect(PALETTES.length).toBeGreaterThanOrEqual(2);
        expect(PALETTES.map(p => p.id)).toContain(DEFAULT_PALETTE);
    });

    it('cycles through every palette and comes back', () => {
        let id = DEFAULT_PALETTE;
        const seen = new Set<string>([id]);
        for (let i = 0; i < PALETTES.length; i++) {
            id = nextPalette(id);
            seen.add(id);
        }
        expect(seen.size).toBe(PALETTES.length);
        expect(id).toBe(DEFAULT_PALETTE);
    });

    /**
     * The contrast rule is a property of the PALETTE, not of whichever one
     * happens to be loaded when the test runs.
     */
    it('keeps every colour of every palette at or above 4.5:1 on its ground', () => {
        for (const p of PALETTES) {
            for (const key of ['ink', 'phosphor', 'muted', 'key', 'caution', 'alert'] as const) {
                expect(
                    contrast(p.ui[key], p.ui.ground),
                    `${p.id}: ${key} on ground`
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    /**
     * The whole point. Green instruments against red hostiles is the one
     * pairing a deuteranope cannot separate, and the classic palette is
     * expected to fail this - it is kept because it is the game's identity
     * and it is no longer the only option.
     */
    it('makes friendly and hostile separable without red against green', () => {
        const classic = PALETTES.find(p => p.id === 'CLASSIC')!;
        const alt = PALETTES.find(p => p.id === 'DEUTERAN')!;

        const classicGap = perceivedDistance(classic.ui.phosphor, classic.ui.hostile);
        const altGap = perceivedDistance(alt.ui.phosphor, alt.ui.hostile);

        expect(altGap).toBeGreaterThan(classicGap * 2);
        expect(altGap).toBeGreaterThan(100);
    });

    it('separates the two warning tones by lightness as well as hue', () => {
        for (const p of PALETTES) {
            const ratio = contrast(p.ui.caution, p.ui.alert);
            expect(ratio, `${p.id}: caution against alert`).toBeGreaterThan(1.3);
        }
    });

    it('never gives the keycap colour to the instruments', () => {
        for (const p of PALETTES) {
            expect(perceivedDistance(p.ui.key, p.ui.phosphor), `${p.id}: key vs phosphor`)
                .toBeGreaterThan(40);
        }
    });

    it('swaps the live palette in place, so every draw site picks it up', () => {
        const before = THEME.phosphor;
        applyPalette('DEUTERAN');
        expect(THEME.phosphor).toBe(paletteSpec('DEUTERAN').ui.phosphor);
        expect(WORLD.hostile).toBe(paletteSpec('DEUTERAN').world.hostile);
        expect(currentPalette()).toBe('DEUTERAN');

        applyPalette('CLASSIC');
        expect(THEME.phosphor).toBe(before);
    });
});

describe('palette persistence', () => {
    const store = () => {
        const map = new Map<string, string>();
        return {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => { map.set(k, v); }
        };
    };

    it('defaults to the classic palette', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        expect(loadPalette()).toBe(DEFAULT_PALETTE);
    });

    it('round-trips a choice', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        savePalette('DEUTERAN');
        expect(loadPalette()).toBe('DEUTERAN');
    });

    it('falls back to the default on a corrupt value', () => {
        const s = store();
        s.setItem('carrier-vector-1988.palette', 'TEAL');
        (globalThis as { localStorage?: unknown }).localStorage = s;
        expect(loadPalette()).toBe(DEFAULT_PALETTE);
    });

    it('survives storage that throws', () => {
        (globalThis as { localStorage?: unknown }).localStorage = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        };
        expect(loadPalette()).toBe(DEFAULT_PALETTE);
        expect(() => savePalette('DEUTERAN')).not.toThrow();
    });

    /**
     * `loadPalette()` collapses "never chosen" into the default, which is
     * right for booting the game and wrong for deciding whether to keep
     * hinting at the setting. `storedPalette()` is the one that has to tell
     * the two apart, or the hint either never appears or never goes away.
     */
    it('reports no stored choice until one is actually made', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        expect(storedPalette()).toBe(null);
    });

    it('reports a choice once made, even the default one', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        savePalette('CLASSIC');
        expect(storedPalette()).toBe('CLASSIC');
    });

    it('treats a corrupt stored value as no choice made', () => {
        const s = store();
        s.setItem('carrier-vector-1988.palette', 'TEAL');
        (globalThis as { localStorage?: unknown }).localStorage = s;
        expect(storedPalette()).toBe(null);
    });

    it('reports no stored choice when storage throws', () => {
        (globalThis as { localStorage?: unknown }).localStorage = {
            getItem: () => { throw new Error('blocked'); }
        };
        expect(storedPalette()).toBe(null);
    });
});
