import { describe, it, expect } from 'vitest';
import {
    MIN_BLINK_PERIOD_MS,
    blinkVisible,
    motionSettings,
    readMotionPreferences
} from './Accessibility';

const normal = motionSettings({ reducedMotion: false });
const reduced = motionSettings({ reducedMotion: true });

describe('flash safety', () => {
    /**
     * WCAG 2.3.1: no more than three flashes in any one second. The banners
     * shipped at 220 ms and 260 ms - 4.5 and 3.8 per second. This is the one
     * rule here that is not a preference.
     */
    it('never permits more than three flashes a second, for anybody', () => {
        for (const settings of [normal, reduced]) {
            const flashesPerSecond = 1000 / settings.blinkPeriodMs;
            expect(flashesPerSecond).toBeLessThanOrEqual(3);
        }
    });

    it('refuses a caller-supplied period faster than the floor', () => {
        // A caller asking for the old 220 ms gets the floor instead.
        const fast = [];
        for (let t = 0; t < 2000; t += 10) fast.push(blinkVisible(t, normal, 220));
        let transitions = 0;
        for (let i = 1; i < fast.length; i++) if (fast[i] !== fast[i - 1]) transitions++;
        // Two transitions per cycle, two seconds: at 400 ms that is 10.
        expect(transitions).toBeLessThanOrEqual(10);
    });

    it('does blink at the permitted rate', () => {
        expect(blinkVisible(0, normal)).toBe(true);
        expect(blinkVisible(MIN_BLINK_PERIOD_MS + 1, normal)).toBe(false);
        expect(blinkVisible(MIN_BLINK_PERIOD_MS * 2 + 1, normal)).toBe(true);
    });

    /**
     * A warning that vanishes is worse than one that fails to flash, so
     * switching blinking off leaves it lit rather than hidden.
     */
    it('leaves a warning steady and visible when blinking is off', () => {
        for (let t = 0; t < 5000; t += 37) expect(blinkVisible(t, reduced)).toBe(true);
    });
});

describe('reduced motion', () => {
    it('turns the camera shake off entirely', () => {
        expect(reduced.shakeScale).toBe(0);
        expect(normal.shakeScale).toBe(1);
    });

    it('damps the impact flash without removing the cue', () => {
        expect(reduced.flashScale).toBeGreaterThan(0);
        expect(reduced.flashScale).toBeLessThan(normal.flashScale);
    });

    it('stops the HUD blinking', () => {
        expect(reduced.allowBlink).toBe(false);
        expect(normal.allowBlink).toBe(true);
    });
});

describe('readMotionPreferences', () => {
    const withMatchMedia = (matches: boolean | 'throws', run: () => void) => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                matchMedia: (q: string) => {
                    if (matches === 'throws') throw new Error('unsupported');
                    return { matches: matches && q.includes('reduced-motion') };
                }
            }
        });
        try {
            run();
        } finally {
            if (original) Object.defineProperty(globalThis, 'window', original);
            else delete (globalThis as Record<string, unknown>).window;
        }
    };

    it('reads the platform preference', () => {
        withMatchMedia(true, () => expect(readMotionPreferences().reducedMotion).toBe(true));
        withMatchMedia(false, () => expect(readMotionPreferences().reducedMotion).toBe(false));
    });

    it('assumes full motion when the platform cannot say', () => {
        withMatchMedia('throws', () => expect(readMotionPreferences().reducedMotion).toBe(false));
        expect(() => readMotionPreferences()).not.toThrow();
    });
});
