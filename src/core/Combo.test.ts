import { describe, expect, it } from 'vitest';
import { COMBO_TUNING, ComboTracker, chainLabel, multiplierFor } from './Combo';

describe('ComboTracker', () => {
    it('pays a lone kill exactly its table value', () => {
        const c = new ComboTracker();
        const k = c.registerKill(250);
        expect(k).toEqual({ chain: 1, multiplier: 1, bonus: 0, label: 'SPLASH' });
    });

    it('climbs the multiplier for kills inside the window', () => {
        const c = new ComboTracker();
        c.registerKill(100);
        c.update(1);
        const second = c.registerKill(100);
        expect(second.chain).toBe(2);
        expect(second.multiplier).toBe(2);
        expect(second.bonus).toBe(100);
        expect(second.label).toBe('DOUBLE SPLASH');
        c.update(1);
        const third = c.registerKill(250);
        expect(third.label).toBe('TRIPLE SPLASH');
        expect(third.bonus).toBe(500);
    });

    it('lapses after the window and reports the lapse exactly once', () => {
        const c = new ComboTracker();
        c.registerKill(100);
        c.registerKill(100);
        expect(c.update(COMBO_TUNING.windowSeconds - 0.1)).toBe(false);
        expect(c.update(0.2)).toBe(true);
        expect(c.update(1)).toBe(false);
        expect(c.chain).toBe(0);
        expect(c.registerKill(100).multiplier).toBe(1);
    });

    it('caps the multiplier but keeps counting the chain', () => {
        const c = new ComboTracker();
        let last = c.registerKill(100);
        for (let i = 0; i < 8; i++) last = c.registerKill(100);
        expect(last.chain).toBe(9);
        expect(last.multiplier).toBe(COMBO_TUNING.maxMultiplier);
        expect(last.label).toBe('ACE STREAK');
        expect(c.best).toBe(9);
    });

    it('remembers the best chain through a broken one', () => {
        const c = new ComboTracker();
        c.registerKill(100);
        c.registerKill(100);
        c.registerKill(100);
        c.breakChain();
        expect(c.chain).toBe(0);
        expect(c.fraction).toBe(0);
        expect(c.best).toBe(3);
        c.reset();
        expect(c.best).toBe(0);
    });

    it('exposes the remaining window as a 0..1 fraction', () => {
        const c = new ComboTracker();
        expect(c.fraction).toBe(0);
        c.registerKill(100);
        expect(c.fraction).toBe(1);
        c.update(COMBO_TUNING.windowSeconds / 2);
        expect(c.fraction).toBeCloseTo(0.5);
    });
});

describe('chain naming', () => {
    it('names chains in order and never returns an empty label', () => {
        expect(chainLabel(0)).toBe('SPLASH');
        expect(chainLabel(2)).toBe('DOUBLE SPLASH');
        expect(chainLabel(4)).toBe('QUAD SPLASH');
        expect(chainLabel(40)).toBe('ACE STREAK');
        expect(multiplierFor(0)).toBe(1);
        expect(multiplierFor(3.7)).toBe(3);
    });
});
