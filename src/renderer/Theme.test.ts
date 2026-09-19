import { describe, it, expect } from 'vitest';
import { fitText, THEME, WORLD, font } from './Theme';

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
