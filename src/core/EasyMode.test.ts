import { afterEach, describe, expect, it, vi } from 'vitest';
import { EASY_TUNING, easyHint, easyTrigger, loadFlyStyle, saveFlyStyle, shouldAskFlyStyle } from './EasyMode';

const air = (inMissileEnvelope: boolean, inGunEnvelope: boolean) =>
    ({ kind: 'AIR' as const, inMissileEnvelope, inGunEnvelope });

describe('EASY smart trigger', () => {
    it('fires a missile only when it will land and none is already on its way', () => {
        expect(easyTrigger({ target: air(true, false), sidewinders: 2, missileInbound: false })).toBe('MISSILE');
        expect(easyTrigger({ target: air(true, false), sidewinders: 2, missileInbound: true })).toBe('NOT_YET');
        expect(easyTrigger({ target: air(true, false), sidewinders: 0, missileInbound: false })).toBe('NOT_YET');
    });

    it('uses the cannon when the target is close and on the nose', () => {
        expect(easyTrigger({ target: air(false, true), sidewinders: 0, missileInbound: false })).toBe('GUN');
        expect(easyTrigger({ target: air(true, true), sidewinders: 0, missileInbound: false })).toBe('GUN');
    });

    it('waits with nothing locked or nothing that would hit', () => {
        expect(easyTrigger({ target: null, sidewinders: 4, missileInbound: false })).toBe('NOT_YET');
        expect(easyTrigger({ target: air(false, false), sidewinders: 4, missileInbound: false })).toBe('NOT_YET');
        expect(easyTrigger({ target: { kind: 'STRUCTURE', inMissileEnvelope: true, inGunEnvelope: false }, sidewinders: 4, missileInbound: false })).toBe('NOT_YET');
    });
});

describe('EASY wide missile cone', () => {
    it('offers a missile at anything ahead of the wing line in range, unlike the standard cone', () => {
        const wide = { kind: 'AIR' as const, inMissileEnvelope: false, inGunEnvelope: false, range: 1500, aspect: 0.1 };
        expect(easyTrigger({ target: wide, sidewinders: 2, missileInbound: false })).toBe('MISSILE');
        expect(easyTrigger({ target: { ...wide, aspect: -0.3 }, sidewinders: 2, missileInbound: false })).toBe('NOT_YET');
        expect(easyTrigger({ target: { ...wide, range: 200 }, sidewinders: 2, missileInbound: false })).toBe('NOT_YET');
        expect(easyTrigger({ target: { ...wide, range: 5000 }, sidewinders: 2, missileInbound: false })).toBe('NOT_YET');
    });

    it('says FIRE NOW exactly when the trigger would fire, unless something is critical', () => {
        expect(easyHint(null, true)?.text).toMatch(/FIRE NOW/);
        expect(easyHint({ text: 'FIRE NOW - PRESS SPACE', severity: 'INFO' }, false)).toBeNull();
        const crit = { text: 'MISSILE INBOUND - CHAFF [X]', severity: 'CRITICAL' as const };
        expect(easyHint(crit, true)).toBe(crit);
    });
});

describe('EASY coach', () => {
    const info = (text: string) => ({ text, severity: 'INFO' as const });

    it('never asks a pilot whose plane flies itself to steer or lock', () => {
        expect(easyHint(info('TARGET LOCKED - TURN TOWARD IT (A / D) UNTIL IT SAYS FIRE NOW'))?.text).toMatch(/PLANE IS TURNING/);
        expect(easyHint(info('ENEMY AHEAD - PRESS [T] TO LOCK ON'))).toBeNull();
        expect(easyHint(info('FIRE NOW - PRESS SPACE'), true)?.text).toMatch(/CLICK/);
        expect(easyHint({ text: 'STALL - PUSH NOSE DOWN', severity: 'CRITICAL' })).toBeNull();
    });

    it('passes everything else through', () => {
        const h = { text: 'MISSILE INBOUND - CHAFF [X]', severity: 'CRITICAL' as const };
        expect(easyHint(h)).toBe(h);
        expect(easyHint(null)).toBeNull();
    });
});

describe('EASY setup', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('asks a brand-new pilot once, and never interrupts a returning one', () => {
        expect(shouldAskFlyStyle(null, false)).toBe(true);
        expect(shouldAskFlyStyle(null, true)).toBe(false);
        expect(shouldAskFlyStyle('EASY', false)).toBe(false);
    });

    it('is gentler on every axis it touches', () => {
        expect(EASY_TUNING.timeScale).toBeLessThan(1);
        expect(EASY_TUNING.damageTaken).toBeLessThan(1);
        expect(EASY_TUNING.lives).toBeGreaterThan(3);
        expect(EASY_TUNING.calloutHold).toBeGreaterThan(1);
    });

    it('remembers the choice and ignores junk', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v); }
        });
        expect(loadFlyStyle()).toBeNull();
        saveFlyStyle('EASY');
        expect(loadFlyStyle()).toBe('EASY');
        store.set('carrier-vector-1988.flyStyle', 'nonsense');
        expect(loadFlyStyle()).toBeNull();
    });
});
