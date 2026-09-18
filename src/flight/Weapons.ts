/**
 * CARRIER VECTOR: 1988 - Ballistics & Combat Weapons System
 * Manages:
 * - 20mm Vulcan tracer rounds
 * - AIM-9 Sidewinder heat-seeking missiles
 * - Mk.82 500lb Iron Bombs (ballistic freefall)
 * - Vector wireframe explosion bursts
 * - Collision detection against aircraft & ground SAM nodes
 */

import { AircraftPhysics } from './AircraftPhysics';
import type { Vector3 } from './AircraftPhysics';
import { VectorRenderer } from '../renderer/VectorRenderer';
import { TacticalTerrain, SAMSite } from '../tactics/RadarLOS';
import type { AirborneTarget } from '../renderer/HUD';
import { soundFX } from '../audio/SoundFX';

export interface Bullet {
    pos: Vector3;
    vel: Vector3;
    life: number; // seconds
}

export interface PlayerMissile {
    pos: Vector3;
    vel: Vector3;
    targetId: string | null;
    life: number;
}

export interface Bomb {
    pos: Vector3;
    vel: Vector3;
    life: number;
}

export interface ExplosionParticle {
    p1: Vector3;
    p2: Vector3;
    vel: Vector3;
    life: number;
    maxLife: number;
    color: string;
}

export class WeaponsSystem {
    public bullets: Bullet[] = [];
    public missiles: PlayerMissile[] = [];
    public bombs: Bomb[] = [];
    public explosions: ExplosionParticle[] = [];

    public gunFireTimer: number = 0;
    public readonly gunFireRate = 0.05; // 20 rounds/sec (simulating 6000 rpm burst)

    public fireGun(physics: AircraftPhysics) {
        if (physics.loadout.vulcanAmmo <= 0) return;
        if (this.gunFireTimer > 0) return;

        this.gunFireTimer = this.gunFireRate;
        physics.loadout.vulcanAmmo = Math.max(0, physics.loadout.vulcanAmmo - 1);

        const fwd = physics.forwardVector;
        const muzzleSpeed = 1050; // m/s

        // Spawn bullet slightly in front and below nose
        this.bullets.push({
            pos: {
                x: physics.position.x + fwd.x * 6,
                y: physics.position.y + fwd.y * 6 - 0.5,
                z: physics.position.z + fwd.z * 6
            },
            vel: {
                x: physics.velocity.x + fwd.x * muzzleSpeed + (Math.random() - 0.5) * 6,
                y: physics.velocity.y + fwd.y * muzzleSpeed + (Math.random() - 0.5) * 6,
                z: physics.velocity.z + fwd.z * muzzleSpeed + (Math.random() - 0.5) * 6
            },
            life: 2.5
        });

        soundFX.playGunShot();
    }

    public fireSidewinder(physics: AircraftPhysics, targets: AirborneTarget[]) {
        if (physics.loadout.sidewinders <= 0) return;
        physics.loadout.sidewinders--;

        // Find closest target in front cone
        let bestTargetId: string | null = null;
        let bestDist = 8000;
        const fwd = physics.forwardVector;

        for (const t of targets) {
            if (!t.isAlive) continue;
            const dx = t.position.x - physics.position.x;
            const dy = t.position.y - physics.position.y;
            const dz = t.position.z - physics.position.z;
            const dist = Math.hypot(dx, dy, dz);

            if (dist < bestDist) {
                // Check cone angle
                const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist;
                if (dot > 0.85) { // within ~30 degree cone
                    bestDist = dist;
                    bestTargetId = t.id;
                }
            }
        }

        const missileSpeed = physics.airSpeed + 120;
        this.missiles.push({
            pos: { ...physics.position },
            vel: {
                x: fwd.x * missileSpeed,
                y: fwd.y * missileSpeed,
                z: fwd.z * missileSpeed
            },
            targetId: bestTargetId,
            life: 7.0
        });

        soundFX.playMissileLaunch();
    }

    public dropBomb(physics: AircraftPhysics) {
        if (physics.loadout.ironBombs <= 0) return;
        physics.loadout.ironBombs--;

        // Released with aircraft forward velocity + slight downward nudge
        this.bombs.push({
            pos: {
                x: physics.position.x,
                y: physics.position.y - 1.5,
                z: physics.position.z
            },
            vel: {
                x: physics.velocity.x,
                y: physics.velocity.y - 5,
                z: physics.velocity.z
            },
            life: 15.0
        });

        soundFX.playGunShot();
    }

    public spawnExplosion(center: Vector3, count: number = 16, color: string = '#ffff33') {
        soundFX.playExplosion();
        for (let i = 0; i < count; i++) {
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = (Math.random() - 0.5) * Math.PI;
            const speed = 40 + Math.random() * 120;

            const vx = Math.cos(angle2) * Math.sin(angle1) * speed;
            const vy = Math.sin(angle2) * speed;
            const vz = Math.cos(angle2) * Math.cos(angle1) * speed;

            const len = 3 + Math.random() * 8;
            this.explosions.push({
                p1: { ...center },
                p2: { x: center.x + (vx / speed) * len, y: center.y + (vy / speed) * len, z: center.z + (vz / speed) * len },
                vel: { x: vx, y: vy, z: vz },
                life: 0.8 + Math.random() * 0.6,
                maxLife: 1.4,
                color
            });
        }
    }

    public update(
        dt: number,
        terrain: TacticalTerrain,
        targets: AirborneTarget[],
        samSites: SAMSite[],
        onTargetDestroyed?: (target: AirborneTarget) => void,
        onSAMDestroyed?: (sam: SAMSite) => void
    ) {
        if (this.gunFireTimer > 0) this.gunFireTimer -= dt;

        // 1. Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.life -= dt;
            b.pos.x += b.vel.x * dt;
            b.pos.y += b.vel.y * dt - 0.5 * 9.81 * (dt ** 2);
            b.pos.z += b.vel.z * dt;

            // Terrain hit
            const terrainY = terrain.getElevation(b.pos.x, b.pos.z);
            if (b.pos.y <= terrainY) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Target hit check
            let hit = false;
            for (const t of targets) {
                if (!t.isAlive) continue;
                const d = Math.hypot(b.pos.x - t.position.x, b.pos.y - t.position.y, b.pos.z - t.position.z);
                if (d < 18) { // 18m hit radius
                    t.isAlive = false;
                    this.spawnExplosion(t.position, 24, '#ff3333');
                    if (onTargetDestroyed) onTargetDestroyed(t);
                    hit = true;
                    break;
                }
            }
            if (hit) {
                this.bullets.splice(i, 1);
                continue;
            }

            if (b.life <= 0) {
                this.bullets.splice(i, 1);
            }
        }

        // 2. Sidewinder Missiles
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            m.life -= dt;

            // Target homing
            const target = targets.find(t => t.id === m.targetId && t.isAlive);
            const mSpeed = 580; // m/s
            if (target) {
                const tdx = target.position.x - m.pos.x;
                const tdy = target.position.y - m.pos.y;
                const tdz = target.position.z - m.pos.z;
                const dist = Math.hypot(tdx, tdy, tdz);

                if (dist < 25) {
                    // Hit!
                    target.isAlive = false;
                    this.spawnExplosion(target.position, 32, '#ffaa00');
                    if (onTargetDestroyed) onTargetDestroyed(target);
                    this.missiles.splice(i, 1);
                    continue;
                }

                // Turn towards target
                const turnRate = 4.5 * dt;
                const desiredVelX = (tdx / dist) * mSpeed;
                const desiredVelY = (tdy / dist) * mSpeed;
                const desiredVelZ = (tdz / dist) * mSpeed;

                m.vel.x += (desiredVelX - m.vel.x) * turnRate;
                m.vel.y += (desiredVelY - m.vel.y) * turnRate;
                m.vel.z += (desiredVelZ - m.vel.z) * turnRate;
            }

            m.pos.x += m.vel.x * dt;
            m.pos.y += m.vel.y * dt;
            m.pos.z += m.vel.z * dt;

            if (m.pos.y <= terrain.getElevation(m.pos.x, m.pos.z) || m.life <= 0) {
                this.spawnExplosion(m.pos, 12, '#ffaa00');
                this.missiles.splice(i, 1);
            }
        }

        // 3. Mk.82 Bombs
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            bomb.life -= dt;
            bomb.vel.y -= 9.81 * dt; // Gravity
            bomb.pos.x += bomb.vel.x * dt;
            bomb.pos.y += bomb.vel.y * dt;
            bomb.pos.z += bomb.vel.z * dt;

            const terrY = terrain.getElevation(bomb.pos.x, bomb.pos.z);
            if (bomb.pos.y <= terrY) {
                // Ground impact explosion
                this.spawnExplosion({ x: bomb.pos.x, y: terrY + 2, z: bomb.pos.z }, 28, '#ff5500');

                // Check splash radius on SAM sites
                for (let s = 0; s < samSites.length; s++) {
                    const sam = samSites[s];
                    const dist = Math.hypot(bomb.pos.x - sam.position.x, bomb.pos.z - sam.position.z);
                    if (dist < 180) { // 180m blast radius
                        if (onSAMDestroyed) onSAMDestroyed(sam);
                        samSites.splice(s, 1);
                        break;
                    }
                }

                this.bombs.splice(i, 1);
            } else if (bomb.life <= 0) {
                this.bombs.splice(i, 1);
            }
        }

        // 4. Explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.life -= dt;
            exp.p1.x += exp.vel.x * dt;
            exp.p1.y += exp.vel.y * dt;
            exp.p1.z += exp.vel.z * dt;
            exp.p2.x += exp.vel.x * dt;
            exp.p2.y += exp.vel.y * dt;
            exp.p2.z += exp.vel.z * dt;

            if (exp.life <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }

    public render(renderer: VectorRenderer, camPos: Vector3, camPitch: number, camYaw: number, camRoll: number) {
        // Render 20mm Tracer lines
        for (const b of this.bullets) {
            const tail: Vector3 = {
                x: b.pos.x - (b.vel.x / 1050) * 8,
                y: b.pos.y - (b.vel.y / 1050) * 8,
                z: b.pos.z - (b.vel.z / 1050) * 8
            };
            renderer.drawLine(tail, b.pos, camPos, camPitch, camYaw, camRoll, '#ffff44', 2.0);
        }

        // Render Sidewinder missiles (white line with smoke)
        for (const m of this.missiles) {
            const tail: Vector3 = {
                x: m.pos.x - (m.vel.x / 580) * 6,
                y: m.pos.y - (m.vel.y / 580) * 6,
                z: m.pos.z - (m.vel.z / 580) * 6
            };
            renderer.drawLine(tail, m.pos, camPos, camPitch, camYaw, camRoll, '#ffffff', 2.2);
        }

        // Render Bombs (short diamond or cross)
        for (const bomb of this.bombs) {
            const p1: Vector3 = { x: bomb.pos.x, y: bomb.pos.y - 1.5, z: bomb.pos.z };
            const p2: Vector3 = { x: bomb.pos.x, y: bomb.pos.y + 1.5, z: bomb.pos.z };
            renderer.drawLine(p1, p2, camPos, camPitch, camYaw, camRoll, '#ffaa22', 2.5);
        }

        // Render Explosions
        for (const exp of this.explosions) {
            renderer.drawLine(exp.p1, exp.p2, camPos, camPitch, camYaw, camRoll, exp.color, 1.8);
        }
    }
}
