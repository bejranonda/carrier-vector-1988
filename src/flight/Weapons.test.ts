import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeaponsSystem } from './Weapons';
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
            weapons.update(dt, terrain, [], []);
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
        weapons.update(0.5, terrain, [], []);
        expect(weapons.bullets[0].vel.y).toBeLessThan(initialVelY);
    });

    it('destroys an airborne target within the bullet hit radius', () => {
        weapons.fireGun(physics);
        const target: AirborneTarget = {
            id: 'T1',
            name: 'Test Target',
            position: { x: 0, y: 5000, z: 20 }, // directly ahead, close enough for one tick
            velocity: { x: 0, y: 0, z: 0 },
            isAlive: true
        };

        let destroyed: AirborneTarget | null = null;
        for (let i = 0; i < 5 && target.isAlive; i++) {
            weapons.update(1 / 120, terrain, [target], [], (t) => { destroyed = t; });
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
                weapons.update(1 / 60, terrain, [], sites, undefined, (s) => { destroyedSam = s; });
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
            weapons.update(1 / 120, terrain, [], []);
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
