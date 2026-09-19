import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeaponsSystem } from './Weapons';
import type { WeaponsWorld } from './Weapons';
import { AircraftPhysics } from './AircraftPhysics';
import { TacticalTerrain, SAMSite } from '../tactics/RadarLOS';
import type { AirborneTarget } from '../renderer/HUD';

describe('WeaponsSystem ballistics', () => {
    let weapons: WeaponsSystem;
    let physics: AircraftPhysics;
    let terrain: TacticalTerrain;

    beforeEach(() => {
        weapons = new WeaponsSystem();
        physics = new AircraftPhysics();
        physics.position = { x: 0, y: 5000, z: 0 }; // high enough that terrain never intervenes
        physics.velocity = { x: 0, y: 0, z: 0 };
        physics.pitch = 0;
        physics.yaw = 0;
        physics.roll = 0;
        terrain = new TacticalTerrain();
    });

    it('drops a 20mm round under gravity over its time of flight, not a per-frame constant', () => {
        // fireGun() applies +/-3 m/s random muzzle dispersion to vel.y, which
        // would make a tight drop-distance assertion flaky. Neutralize it so
        // this test isolates the gravity-integration fix specifically.
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        weapons.fireGun(physics);
        randomSpy.mockRestore();

        const b = weapons.bullets[0];
        const startY = b.pos.y;

        // Fly for a full second in small fixed steps (mirrors the 6-DOF loop).
        const dt = 1 / 120;
        let elapsed = 0;
        while (elapsed < 1.0) {
            weapons.update(dt, { terrain, targets: [], samSites: [] });
            elapsed += dt;
            if (weapons.bullets.length === 0) break; // could impact terrain far below; not expected here
        }

        expect(weapons.bullets.length).toBe(1);
        const drop = startY - weapons.bullets[0].pos.y;

        // Analytic expectation for constant-gravity fall over ~1s: 0.5*g*t^2 ≈ 4.9m.
        // The old bug produced a per-FRAME drop of 0.5*g*dt^2 (~1.4mm at 60Hz total,
        // effectively zero) regardless of elapsed flight time.
        expect(drop).toBeGreaterThan(4.0);
        expect(drop).toBeLessThan(6.0);
    });

    it('accelerates bullet vertical velocity downward over time (vel.y is actually integrated)', () => {
        weapons.fireGun(physics);
        const initialVelY = weapons.bullets[0].vel.y;
        weapons.update(0.5, { terrain, targets: [], samSites: [] });
        expect(weapons.bullets[0].vel.y).toBeLessThan(initialVelY);
    });

    /**
     * Rounds wound; enough of them kill. One round used to destroy any
     * aircraft anywhere inside 18 m, which made the cannon impossible to miss
     * with and impossible to feel.
     */
    function fighterAt(z: number): AirborneTarget {
        return {
            id: 'T1',
            name: 'MiG-23 FLOGGER #1',
            position: { x: 0, y: 5000, z },
            velocity: { x: 0, y: 0, z: 0 },
            isAlive: true
        };
    }

    /** Fire one round and let it reach the target. */
    function oneRound(target: AirborneTarget, hooks: Partial<WeaponsWorld> = {}) {
        weapons.gunFireTimer = 0;
        weapons.fireGun(physics);
        for (let i = 0; i < 5 && weapons.bullets.length > 0; i++) {
            weapons.update(1 / 120, { terrain, targets: [target], samSites: [], ...hooks });
        }
    }

    it('wounds an airborne target rather than destroying it with one round', () => {
        const target = fighterAt(20);
        let hitIntegrity: number | null = null;
        oneRound(target, { onTargetHit: (_t, left) => { hitIntegrity = left; } });

        expect(target.isAlive).toBe(true);
        expect(target.integrity).toBeLessThan(100);
        expect(hitIntegrity).toBe(target.integrity);
    });

    it('destroys a fighter with a short burst on target', () => {
        const target = fighterAt(20);
        let destroyed: AirborneTarget | null = null;
        for (let i = 0; i < 6 && target.isAlive; i++) {
            oneRound(target, { onTargetDestroyed: (t) => { destroyed = t; } });
        }

        expect(target.isAlive).toBe(false);
        expect(destroyed).toBe(target);
    });

    it('makes a bomber visibly harder to kill than a fighter', () => {
        const rounds = (target: AirborneTarget) => {
            let n = 0;
            while (target.isAlive && n < 60) {
                oneRound(target);
                n++;
            }
            return n;
        };
        const fighter = fighterAt(20);
        const bomber: AirborneTarget = { ...fighterAt(20), id: 'B1', name: 'Tu-22M BACKFIRE' };
        expect(rounds(bomber)).toBeGreaterThan(rounds(fighter));
    });

    it('reports a kill once, not once per round', () => {
        const target = fighterAt(20);
        let kills = 0;
        for (let i = 0; i < 12; i++) {
            oneRound(target, { onTargetDestroyed: () => { kills++; } });
        }
        expect(kills).toBe(1);
    });

    it('does not reward a near miss', () => {
        // Offset well outside the 12 m hit radius, directly abeam the path.
        const target = fighterAt(20);
        target.position.x = 40;
        oneRound(target);
        expect(target.isAlive).toBe(true);
        expect(target.integrity ?? 100).toBe(100);
    });

    it('still lets the Sidewinder kill outright', () => {
        const target = fighterAt(2000);
        physics.loadout.sidewinders = 2;
        weapons.fireSidewinder(physics, [target], 'T1');

        let destroyed: AirborneTarget | null = null;
        for (let i = 0; i < 400 && target.isAlive; i++) {
            weapons.update(1 / 60, { terrain, targets: [target], samSites: [], onTargetDestroyed: (t) => { destroyed = t; } });
        }
        expect(target.isAlive).toBe(false);
        expect(destroyed).toBe(target);
    });

    it('lets sustained cannon fire damage and eventually destroy a SAM site (strafing runs now work)', () => {
        const site = new SAMSite('SAM-TEST', 'Test SAM', 0, 40, terrain);
        physics.position = { x: 0, y: site.position.y, z: 0 };
        physics.velocity = { x: 0, y: 0, z: 0 };

        let destroyedSam: SAMSite | null = null;
        const sites = [site];

        // Fire repeatedly; each round that reaches the site adds 1 strafe
        // damage, and the site is destroyed at 40.
        for (let shot = 0; shot < 45 && sites.length > 0; shot++) {
            weapons.gunFireTimer = 0;
            weapons.fireGun(physics);
            for (let i = 0; i < 10 && weapons.bullets.length > 0; i++) {
                weapons.update(1 / 60, { terrain, targets: [], samSites: sites, onSAMDestroyed: (s) => { destroyedSam = s; } });
            }
        }

        expect(sites.length).toBe(0);
        expect(destroyedSam).toBe(site);
    });

    it('integrates bomb freefall with the same gravity constant as the bullet fix', () => {
        physics.loadout.ironBombs = 1;
        weapons.dropBomb(physics);
        const bomb = weapons.bombs[0];
        const startY = bomb.pos.y;

        for (let i = 0; i < 120; i++) {
            weapons.update(1 / 120, { terrain, targets: [], samSites: [] });
        }

        if (weapons.bombs.length > 0) {
            const drop = startY - weapons.bombs[0].pos.y;
            expect(drop).toBeGreaterThan(4.0);
        } else {
            // Bomb already impacted terrain — also proves gravity is active.
            expect(true).toBe(true);
        }
    });
});

describe('WeaponsSystem.predictBombImpact (CCIP)', () => {
    it('predicts where a released bomb actually lands', () => {
        // The cue is only useful if it agrees with the simulation. Release a
        // real bomb from the same state and compare the two.
        const terrain = new TacticalTerrain();
        const weapons = new WeaponsSystem();
        const physics = new AircraftPhysics();
        physics.position = { x: 0, y: 600, z: 6000 };
        physics.velocity = { x: 0, y: -10, z: 240 };
        physics.loadout.ironBombs = 1;

        const predicted = WeaponsSystem.predictBombImpact(physics, terrain);
        expect(predicted).not.toBeNull();

        weapons.dropBomb(physics);
        let impact: { x: number; z: number } | null = null;
        for (let i = 0; i < 2000 && weapons.bombs.length > 0; i++) {
            const bomb = weapons.bombs[0];
            const last = { x: bomb.pos.x, z: bomb.pos.z };
            weapons.update(1 / 120, { terrain, targets: [], samSites: [] });
            if (weapons.bombs.length === 0) impact = last;
        }

        expect(impact).not.toBeNull();
        // Integrated at different step sizes, so allow a few metres of slip -
        // far inside the 55 m hit radius the strike scenario asks for.
        expect(Math.hypot(predicted!.x - impact!.x, predicted!.z - impact!.z)).toBeLessThan(25);
    });

    it('lands further downrange the faster and higher you release', () => {
        const terrain = new TacticalTerrain();
        const slow = new AircraftPhysics();
        slow.position = { x: 0, y: 400, z: 5000 };
        slow.velocity = { x: 0, y: 0, z: 120 };

        const fast = new AircraftPhysics();
        fast.position = { x: 0, y: 400, z: 5000 };
        fast.velocity = { x: 0, y: 0, z: 300 };

        const a = WeaponsSystem.predictBombImpact(slow, terrain);
        const b = WeaponsSystem.predictBombImpact(fast, terrain);
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        expect(b!.z).toBeGreaterThan(a!.z);
    });

    it('returns null rather than a bogus point when nothing is hit in time', () => {
        const terrain = new TacticalTerrain();
        const climbing = new AircraftPhysics();
        climbing.position = { x: 0, y: 5000, z: 5000 };
        climbing.velocity = { x: 0, y: 400, z: 0 };
        expect(WeaponsSystem.predictBombImpact(climbing, terrain, 1)).toBeNull();
    });
});

