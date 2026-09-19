import { describe, it, expect } from 'vitest';
import {
    TOUCH_MAX_LONG_EDGE,
    detectScheme,
    loadSchemePreference,
    needsRotation,
    nextSchemePreference,
    resolveScheme,
    saveSchemePreference,
    type PlatformSignals
} from './Platform';

const device = (over: Partial<PlatformSignals> = {}): PlatformSignals => ({
    maxTouchPoints: 0,
    coarsePointer: false,
    canHover: true,
    width: 1440,
    height: 900,
    ...over
});

const phone = (w = 844, h = 390) => device({ maxTouchPoints: 5, coarsePointer: true, canHover: false, width: w, height: h });

function withStorage(store: Map<string, string> | null | 'throws', run: () => void) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const value = store === null ? undefined
        : store === 'throws' ? {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        }
            : {
                getItem: (k: string) => store.get(k) ?? null,
                setItem: (k: string, v: string) => { store.set(k, v); }
            };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
    try {
        run();
    } finally {
        if (original) Object.defineProperty(globalThis, 'localStorage', original);
        else delete (globalThis as Record<string, unknown>).localStorage;
    }
}

describe('detectScheme', () => {
    it('gives a plain desktop the keyboard', () => {
        expect(detectScheme(device())).toBe('KEYBOARD');
    });

    it('gives a phone the touch layout, in either orientation', () => {
        expect(detectScheme(phone(844, 390))).toBe('TOUCH');
        expect(detectScheme(phone(390, 844))).toBe('TOUCH');
    });

    /**
     * A laptop with a touchscreen has a keyboard attached and a pointer that
     * hovers. Handing it thumb controls would take away the better input it
     * already has.
     */
    it('leaves a touchscreen laptop on the keyboard', () => {
        expect(detectScheme(device({
            maxTouchPoints: 10, coarsePointer: false, canHover: true, width: 1512, height: 982
        }))).toBe('KEYBOARD');
    });

    it('leaves a large tablet with a hovering pointer on the keyboard', () => {
        // iPad with a trackpad case: coarse-ish, but it hovers.
        expect(detectScheme(device({
            maxTouchPoints: 5, coarsePointer: true, canHover: true, width: 1180, height: 820
        }))).toBe('KEYBOARD');
    });

    it('treats a big touchscreen with no hover as a kiosk, not a phone', () => {
        expect(detectScheme(device({
            maxTouchPoints: 10, coarsePointer: true, canHover: false,
            width: TOUCH_MAX_LONG_EDGE + 200, height: 1080
        }))).toBe('KEYBOARD');
    });

    it('takes a tablet at the boundary', () => {
        expect(detectScheme(device({
            maxTouchPoints: 5, coarsePointer: true, canHover: false,
            width: TOUCH_MAX_LONG_EDGE, height: 820
        }))).toBe('TOUCH');
    });

    it('never guesses touch for a device that reports no touch points', () => {
        expect(detectScheme(device({ coarsePointer: true, canHover: false, width: 500, height: 400 })))
            .toBe('KEYBOARD');
    });
});

describe('resolveScheme', () => {
    it('follows detection on AUTO', () => {
        expect(resolveScheme('AUTO', phone())).toBe('TOUCH');
        expect(resolveScheme('AUTO', device())).toBe('KEYBOARD');
    });

    it('lets a player override detection in both directions', () => {
        // Detection is a heuristic, and a heuristic is wrong for somebody.
        expect(resolveScheme('KEYBOARD', phone())).toBe('KEYBOARD');
        expect(resolveScheme('TOUCH', device())).toBe('TOUCH');
    });

    it('cycles AUTO -> TOUCH -> KEYBOARD -> AUTO', () => {
        expect(nextSchemePreference('AUTO')).toBe('TOUCH');
        expect(nextSchemePreference('TOUCH')).toBe('KEYBOARD');
        expect(nextSchemePreference('KEYBOARD')).toBe('AUTO');
    });
});

describe('needsRotation', () => {
    it('asks a phone held upright to turn', () => {
        expect(needsRotation('TOUCH', 390, 844)).toBe(true);
    });

    it('says nothing once it is on its side', () => {
        expect(needsRotation('TOUCH', 844, 390)).toBe(false);
    });

    it('never asks a keyboard player to rotate their monitor', () => {
        expect(needsRotation('KEYBOARD', 800, 1200)).toBe(false);
    });

    it('treats an exactly square viewport as usable', () => {
        expect(needsRotation('TOUCH', 700, 700)).toBe(false);
    });
});

describe('persistence', () => {
    it('round-trips a preference', () => {
        const store = new Map<string, string>();
        withStorage(store, () => {
            saveSchemePreference('TOUCH');
            expect(loadSchemePreference()).toBe('TOUCH');
        });
    });

    it('defaults to AUTO with nothing stored or a corrupt value', () => {
        withStorage(new Map(), () => expect(loadSchemePreference()).toBe('AUTO'));
        withStorage(new Map([['carrier-vector-1988.controlScheme', 'JOYSTICK']]), () => {
            expect(loadSchemePreference()).toBe('AUTO');
        });
    });

    it('survives storage that throws and storage that is absent', () => {
        withStorage('throws', () => {
            expect(loadSchemePreference()).toBe('AUTO');
            expect(() => saveSchemePreference('TOUCH')).not.toThrow();
        });
        withStorage(null, () => {
            expect(loadSchemePreference()).toBe('AUTO');
            expect(() => saveSchemePreference('AUTO')).not.toThrow();
        });
    });
});
