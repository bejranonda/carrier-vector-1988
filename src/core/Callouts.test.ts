import { describe, it, expect } from 'vitest';
import { CALLOUT_TUNING, Callouts, splashLine } from './Callouts';

describe('Callouts', () => {
    it('starts empty', () => {
        expect(new Callouts().active()).toHaveLength(0);
    });

    it('shows the newest first, so a stack reads top-down in order', () => {
        const c = new Callouts();
        c.push('FIRST');
        c.push('SECOND');
        expect(c.active().map(x => x.text)).toEqual(['SECOND', 'FIRST']);
    });

    it('expires a callout after its lifetime', () => {
        const c = new Callouts();
        c.push('SPLASH ONE', 'KILL', 'MiG-23', 1.0);
        c.update(0.5);
        expect(c.active()).toHaveLength(1);
        c.update(0.6);
        expect(c.active()).toHaveLength(0);
    });

    /**
     * A furball produces kills faster than a player can read them. Six stacked
     * banners is worse than none, so the channel is capped.
     */
    it('never shows more than the cap, keeping the most recent', () => {
        const c = new Callouts();
        for (let i = 1; i <= 8; i++) c.push(`KILL ${i}`);
        expect(c.active()).toHaveLength(CALLOUT_TUNING.maxVisible);
        expect(c.active()[0].text).toBe('KILL 8');
    });

    it('keeps the span so the renderer can fade on progress', () => {
        const c = new Callouts();
        c.push('SAM DOWN', 'KILL', undefined, 2);
        c.update(0.5);
        const shown = c.active()[0];
        expect(shown.span).toBe(2);
        expect(shown.life).toBeCloseTo(1.5, 6);
    });

    it('carries a tone and an optional detail line', () => {
        const c = new Callouts();
        c.push('3-WIRE', 'PRAISE', 'PERFECT TRAP');
        expect(c.active()[0].tone).toBe('PRAISE');
        expect(c.active()[0].detail).toBe('PERFECT TRAP');
        c.push('AIRFRAME LOST', 'LOSS');
        expect(c.active()[0].tone).toBe('LOSS');
        expect(c.active()[0].detail).toBeUndefined();
    });

    it('clears on demand, so a new sortie does not inherit the last one', () => {
        const c = new Callouts();
        c.push('SPLASH ONE');
        c.clear();
        expect(c.active()).toHaveLength(0);
    });

    it('survives a long idle run without leaking entries', () => {
        const c = new Callouts();
        for (let i = 0; i < 600; i++) {
            if (i % 20 === 0) c.push('SPLASH ONE');
            c.update(1 / 60);
        }
        expect(c.active().length).toBeLessThanOrEqual(CALLOUT_TUNING.maxVisible);
    });
});

describe('splashLine', () => {
    it('counts in words, the way a pilot calls it', () => {
        expect(splashLine(1)).toBe('SPLASH ONE');
        expect(splashLine(3)).toBe('SPLASH THREE');
    });

    it('clamps rather than producing "SPLASH undefined"', () => {
        expect(splashLine(0)).toBe('SPLASH ONE');
        expect(splashLine(99)).toBe('SPLASH NINE');
        expect(splashLine(-4)).toBe('SPLASH ONE');
    });
});
