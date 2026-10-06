import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPilotName, savePilotName } from './PilotName';

describe('the pilot name (v2.3.0)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is kept on this device, cleaned, and forgotten when cleared', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v); },
            removeItem: (k: string) => { store.delete(k); }
        });
        expect(loadPilotName()).toBeNull();
        expect(savePilotName('  Grandpa   Joe ')).toBe('Grandpa Joe');
        expect(loadPilotName()).toBe('Grandpa Joe');
        expect(savePilotName('...')).toBeNull();
        expect(loadPilotName()).toBeNull();
        // A tampered store is cleaned on the way out too.
        store.set('carrier-vector-1988.pilotName', 'www.example.com');
        expect(loadPilotName()).toBe('wwwexamplecom');
    });

    it('still works for this share when storage is blocked', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); },
            removeItem: () => { throw new Error('blocked'); }
        });
        expect(loadPilotName()).toBeNull();
        expect(savePilotName('Anna')).toBe('Anna');
    });
});
