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

    it('says FIRE NOW exactly when the trigger would fire, unless a real warning outranks it', () => {
        expect(easyHint(null, true)?.text).toMatch(/FIRE NOW/);
        expect(easyHint({ text: 'FIRE NOW - PRESS SPACE', severity: 'INFO' }, false)).toBeNull();
        const missile = { text: 'MISSILE INBOUND - CHAFF [X], THEN BREAK BEHIND A RIDGE', severity: 'CRITICAL' as const };
        expect(easyHint(missile, true)?.text).toBe('MISSILE INBOUND - DROP CHAFF [X]');
        const bay = { text: 'BAY DOORS OPEN - RCS x4.0, CLOSE THEM [B]', severity: 'WARNING' as const };
        expect(easyHint(bay, true)?.text).toMatch(/FIRE NOW/);
        expect(easyHint(bay, false)).toBe(bay);
    });

    it('lets FIRE NOW outrank "enemy behind you", which asks for nothing (v2.2.0, measured)', () => {
        // A shot sat in the cone for six seconds while this line held the coach.
        const behind = { text: 'ENEMY BEHIND YOU - TURN HARD (HOLD A OR D), DO NOT FLY STRAIGHT', severity: 'CRITICAL' as const };
        expect(easyHint(behind, true)?.text).toMatch(/FIRE NOW/);
        expect(easyHint(behind, false)?.text).toBe('ENEMY BEHIND YOU - THE PLANE WILL TURN TO FIGHT');
    });

    it('does not let a warning the autopilot made moot hide FIRE NOW (v2.2.0 review)', () => {
        // The stall line is dropped on EASY; it used to take FIRE NOW with it.
        expect(easyHint({ text: 'STALL - PUSH NOSE DOWN [S] AND ADD POWER [SHIFT]', severity: 'CRITICAL' }, true)?.text)
            .toMatch(/FIRE NOW/);
        expect(easyHint({ text: 'LOW AIRSPEED - ADVANCE THROTTLE [SHIFT]', severity: 'WARNING' }, true)?.text)
            .toMatch(/FIRE NOW/);
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
        const h = { text: 'BAY DOORS OPEN - RCS x4.0, CLOSE THEM [B]', severity: 'WARNING' as const };
        expect(easyHint(h)).toBe(h);
        expect(easyHint(null)).toBeNull();
    });

    it('never orders an EASY pilot to fly anywhere, in any mission (v2.2.0 review)', () => {
        // Every steering line the STANDARD coach can give, verbatim.
        const coach: [string, 'CRITICAL' | 'WARNING' | 'INFO'][] = [
            ['STALL - PUSH NOSE DOWN [S] AND ADD POWER [SHIFT]', 'CRITICAL'],
            ['TERRAIN - PULL UP [W]', 'CRITICAL'],
            ['MISSILE INBOUND - CHAFF [X], THEN BREAK BEHIND A RIDGE', 'CRITICAL'],
            ['ENEMY BEHIND YOU - TURN HARD (HOLD A OR D), DO NOT FLY STRAIGHT', 'CRITICAL'],
            ['HEAVY BATTLE DAMAGE - RETURN TO CARRIER IMMEDIATELY', 'CRITICAL'],
            ['BINGO FUEL - COME LEFT AND RETURN TO THE BOAT', 'WARNING'],
            ['RADAR LOCK - DESCEND INTO THE CANYON TO MASK', 'WARNING'],
            ['LOW AIRSPEED - ADVANCE THROTTLE [SHIFT]', 'WARNING'],
            ['TARGET LOCKED - TURN TOWARD IT (A / D) UNTIL IT SAYS FIRE NOW', 'INFO'],
            ['ENEMY AHEAD - PRESS [T] TO LOCK ON', 'INFO'],
            ['SAM RADAR SEARCHING - STAY LOW', 'INFO']
        ];
        const steering = /A \/ D|HOLD A OR D|TURN HARD|COME LEFT|DESCEND|BREAK|STAY LOW|PULL UP|\[W\]|\[S\]|\[SHIFT\]|\[T\]/;
        for (const [text, severity] of coach) {
            for (const canFire of [false, true]) {
                const out = easyHint({ text, severity }, canFire);
                if (out) expect(out.text, text).not.toMatch(steering);
            }
        }
        expect(easyHint({ text: 'HEAVY BATTLE DAMAGE - RETURN TO CARRIER IMMEDIATELY', severity: 'CRITICAL' })?.text)
            .toMatch(/TAKE ME HOME/);
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

describe('EASY trigger honesty (v2.2.0 review)', () => {
    const inCone = { kind: 'AIR' as const, inMissileEnvelope: true, inGunEnvelope: true, range: 800, aspect: 0.9 };

    it('promises nothing air-to-air while a bomb or HARM is selected', () => {
        expect(easyTrigger({ target: inCone, sidewinders: 2, missileInbound: false, heavyWeaponSelected: true })).toBe('NOT_YET');
    });

    it('does not offer the cannon with an empty magazine', () => {
        const gunOnly = { ...inCone, inMissileEnvelope: false, aspect: -0.5 };
        expect(easyTrigger({ target: gunOnly, sidewinders: 0, missileInbound: false, gunRounds: 0 })).toBe('NOT_YET');
        expect(easyTrigger({ target: gunOnly, sidewinders: 0, missileInbound: false, gunRounds: 40 })).toBe('GUN');
    });
});
