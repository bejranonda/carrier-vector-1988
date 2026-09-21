/**
 * CARRIER VECTOR: 1988 - Ballistics & Combat Weapons System
 * Manages:
 * - 20mm Vulcan tracer rounds
 * - AIM-9 Sidewinder heat-seeking missiles
 * - Mk.82 500lb Iron Bombs (ballistic freefall)
 * - AGM-88 HARM anti-radiation missiles (locks a radiating SAM only)
 * - Vector wireframe explosion bursts
 * - Collision detection against aircraft & ground SAM nodes
 */

import type { AircraftPhysics, Vector3 } from './AircraftPhysics';
import type { VectorRenderer } from '../renderer/VectorRenderer';
import type { TacticalTerrain, SAMSite, ThreatContact } from '../tactics/RadarLOS';
import type { StrikeTarget } from '../tactics/StrikeTarget';
import type { AirborneTarget } from '../renderer/HUD';
import { soundFX } from '../audio/SoundFX';
import { guideMissile } from '../tactics/MissileGuidance';

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

/**
 * AGM-88 HARM. `targetSamId` is the site it launched against; the seeker has
 * no boresight cone like the Sidewinder's - a HARM is passive RF homing, so
 * "in range and radiating" is the whole acquisition rule, not "in front of
 * the nose". `wentBallistic` latches once the site it is chasing stops
 * radiating: from that point the missile flies its last commanded heading
 * with no further correction, which is what "goes ballistic and misses"
 * means in practice for a round already close to its target.
 */
export interface PlayerHarm {
    pos: Vector3;
    vel: Vector3;
    targetSamId: string | null;
    life: number;
    wentBallistic: boolean;
}

export const HARM_TUNING = {
    /** m/s. Faster than the Sidewinder (580) - this is a rocket-boosted
     *  anti-radiation round with a top-attack profile, not a dogfight missile. */
    speed: 600,
    /**
     * Radians/second. More generous than the SAM's own 0.25 (MissileGuidance)
     * on purpose - decision D3: the player's ordnance stays forgiving even
     * where the enemy's does not, because asymmetry in the player's favour is
     * the point of the weapon existing at all.
     */
    maxTurnRateRadPerSec: 0.4,
    /** Motor burn, seconds. 600 m/s * 15s ~= 9 km, covering a site's own
     *  12 km search range from just inside its edge. */
    fuelSeconds: 15,
    /** Direct-hit radius, metres. Tighter than a bomb's 180 m splash - this
     *  is an actively guided PGM, not an area weapon. */
    hitRadius: 20
} as const;

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

/**
 * Everything the weapons tick needs to resolve against, plus the callbacks it
 * reports through. Bundled because the parameter list had already reached six
 * and adding hardened ground targets would have taken it to eight.
 */
export interface WeaponsWorld {
    terrain: TacticalTerrain;
    targets: AirborneTarget[];
    samSites: SAMSite[];
    /**
     * This tick's radar picture. Only the HARM reads it - to know whether the
     * site it launched against is still radiating - so it is optional rather
     * than forcing every caller (including every test that built a minimal
     * world before HARMs existed) to supply a full sensor snapshot.
     */
    threats?: ThreatContact[];
    /** Hardened structures a scenario wants destroyed. */
    strikeTargets?: StrikeTarget[];
    onTargetDestroyed?: (target: AirborneTarget) => void;
    /** A round connected but the aircraft is still flying. */
    onTargetHit?: (target: AirborneTarget, integrityLeft: number) => void;
    onSAMDestroyed?: (sam: SAMSite) => void;
    /** Fired for every bomb inside the hit radius, hit or kill. */
    onStrikeTargetHit?: (target: StrikeTarget, destroyed: boolean) => void;
}

/**
 * Bombers are built to absorb punishment; fighters are not. Expressed as a
 * damage divisor so the cannon's own number stays the one to tune.
 */
function toughnessFactor(target: AirborneTarget): number {
    return /Tu-22|BACKFIRE|BOMBER/i.test(target.name) ? 0.45 : 1;
}

export class WeaponsSystem {
    public bullets: Bullet[] = [];
    public missiles: PlayerMissile[] = [];
    public harms: PlayerHarm[] = [];
    public bombs: Bomb[] = [];
    public explosions: ExplosionParticle[] = [];

    public gunFireTimer: number = 0;

    /**
     * Cannon hit geometry. The radius is deliberately tighter than the old
     * 18 m - at that size the gun could not be missed with - and four hits
     * kill a fighter, which at 20 rounds/sec is a burst of about a fifth of a
     * second on target. A bomber takes roughly nine.
     */
    public static readonly GUN_HIT_RADIUS = 12;
    public static readonly GUN_DAMAGE = 25;
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

    /**
     * Launch an AIM-9. `designatedId` is the contact the pilot picked with the
     * designation key; the seeker takes it if it is alive, and only falls back
     * to auto-acquisition when there is no designation. Before this the
     * missile chose its own target from a 30-degree cone, so in a furball the
     * player could not shoot at a specific aeroplane at all.
     *
     * `canSee` gates the fallback only. Designation is already gated upstream
     * (`tactics/Visibility.ts`), but the fallback used to sweep the seeker cone
     * blind, so a missile could be sent after a contact behind a ridge - the
     * one path left where terrain masking did not cut both ways. A designation
     * the pilot made deliberately is honoured whatever the terrain does next:
     * losing the shot because a hill slid between you at the moment of pressing
     * the button would read as a broken trigger, and the missile's own
     * terrain-masking rules already decide whether it survives the flight.
     */
    public fireSidewinder(
        physics: AircraftPhysics,
        targets: AirborneTarget[],
        designatedId: string | null = null,
        canSee: (target: AirborneTarget) => boolean = () => true
    ) {
        if (physics.loadout.sidewinders <= 0) return;
        physics.loadout.sidewinders--;

        const fwd = physics.forwardVector;

        const designated = designatedId
            ? targets.find(t => t.id === designatedId && t.isAlive)
            : undefined;

        let bestTargetId: string | null = null;
        if (designated) {
            bestTargetId = designated.id;
        } else {
            // No designation: closest live contact inside the seeker cone.
            let bestDist = 8000;
            for (const t of targets) {
                if (!t.isAlive || !canSee(t)) continue;
                const dx = t.position.x - physics.position.x;
                const dy = t.position.y - physics.position.y;
                const dz = t.position.z - physics.position.z;
                const dist = Math.hypot(dx, dy, dz);

                if (dist < bestDist) {
                    const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist;
                    if (dot > 0.85) { // within ~30 degree cone
                        bestDist = dist;
                        bestTargetId = t.id;
                    }
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

    /**
     * Launch an AGM-88 HARM at the nearest currently-radiating SAM site.
     *
     * Deliberately no boresight cone, unlike the Sidewinder: a HARM is
     * passive radio-frequency homing rather than infrared, so "in front of
     * the nose" has no physical meaning for it. The seeker either hears a
     * site's radar or it doesn't - the only gate is whether one is emitting
     * within its own search-range envelope right now.
     *
     * Returns whether a round was actually launched, so the caller can play
     * a "no target" cue rather than silently expending nothing. Nothing is
     * spent when there is nothing to shoot at - a real HARM crew does not
     * jettison a $300k missile at empty sky either.
     */
    public fireHarm(
        physics: AircraftPhysics,
        samSites: SAMSite[],
        threats: ThreatContact[]
    ): boolean {
        if (physics.loadout.harms <= 0) return false;

        let bestId: string | null = null;
        let bestDist = Infinity;
        for (const sam of samSites) {
            const threat = threats.find(t => t.id === sam.id);
            if (!threat || threat.state === 'SILENT') continue;
            const dist = Math.hypot(
                sam.position.x - physics.position.x,
                sam.position.y - physics.position.y,
                sam.position.z - physics.position.z
            );
            if (dist < bestDist) {
                bestDist = dist;
                bestId = sam.id;
            }
        }
        if (bestId === null) return false;

        physics.loadout.harms--;

        // Launched pointed AT the site, not along the aircraft's nose - this
        // is the load-out computer committing the round to the target's
        // bearing at the moment of release, not a boresight lock. The
        // in-flight turn-rate limit (HARM_TUNING.maxTurnRateRadPerSec) then
        // governs every correction after this.
        //
        // Launching along `fwd` instead - matching the Sidewinder's
        // convention - was tried first and was wrong for this weapon
        // specifically: a Sidewinder only ever locks something already
        // inside a 30-degree cone, so starting along the nose is a fair
        // approximation. A HARM was deliberately given no such cone, so a
        // site anywhere - including behind or steeply below the aircraft -
        // is a legal target, and a slow bounded turn from a 90-degree-plus
        // initial heading error covers so much distance before it can
        // correct that the round diverges past the target rather than
        // curling onto it. The measured version of this failure is preserved
        // as a regression test.
        const target = samSites.find(s => s.id === bestId)!.position;
        const toTarget: Vector3 = {
            x: target.x - physics.position.x,
            y: target.y - physics.position.y,
            z: target.z - physics.position.z
        };
        const dist = Math.hypot(toTarget.x, toTarget.y, toTarget.z) || 1;

        this.harms.push({
            pos: { ...physics.position },
            vel: {
                x: (toTarget.x / dist) * HARM_TUNING.speed,
                y: (toTarget.y / dist) * HARM_TUNING.speed,
                z: (toTarget.z / dist) * HARM_TUNING.speed
            },
            targetSamId: bestId,
            life: HARM_TUNING.fuelSeconds,
            wentBallistic: false
        });

        soundFX.playMissileLaunch();
        return true;
    }

    /**
     * Continuously computed impact point for the currently loaded Mk.82.
     *
     * The strike scenario asks for a bomb inside a 55 m radius, which is not
     * something a player can eyeball from a wireframe canyon at 250 m/s. This
     * runs the same ballistic integration the live bomb uses, from the same
     * release state, and returns where it would land - so the HUD can draw a
     * CCIP cross and bombing becomes a skill rather than a guess.
     *
     * Pure apart from reading terrain heights; unit-tested against the real
     * bomb path.
     */
    public static predictBombImpact(
        physics: AircraftPhysics,
        terrain: TacticalTerrain,
        maxSeconds = 20,
        step = 1 / 30
    ): Vector3 | null {
        const pos: Vector3 = {
            x: physics.position.x,
            y: physics.position.y - 1.5,
            z: physics.position.z
        };
        const vel: Vector3 = {
            x: physics.velocity.x,
            y: physics.velocity.y - 5,
            z: physics.velocity.z
        };

        for (let t = 0; t < maxSeconds; t += step) {
            vel.y -= 9.81 * step;
            pos.x += vel.x * step;
            pos.y += vel.y * step;
            pos.z += vel.z * step;

            const ground = terrain.getElevation(pos.x, pos.z);
            if (pos.y <= ground) {
                return { x: pos.x, y: ground, z: pos.z };
            }
        }
        return null;
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

    public update(dt: number, world: WeaponsWorld) {
        const { terrain, targets, samSites, threats, onTargetDestroyed, onSAMDestroyed, onTargetHit } = world;
        if (this.gunFireTimer > 0) this.gunFireTimer -= dt;

        // 1. Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.life -= dt;

            // Semi-implicit Euler: integrate velocity first, then position,
            // matching the bomb integrator below. The previous version added
            // -0.5*g*dt^2 (a per-FRAME drop term, not accumulated time of
            // flight) and never updated vel.y, so tracers flew dead flat and
            // disagreed with the HUD's lead-computing pipper, which DOES
            // model gravity drop correctly.
            b.vel.y -= 9.81 * dt;
            b.pos.x += b.vel.x * dt;
            b.pos.y += b.vel.y * dt;
            b.pos.z += b.vel.z * dt;

            // Terrain hit
            const terrainY = terrain.getElevation(b.pos.x, b.pos.z);
            if (b.pos.y <= terrainY) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Target hit check. Rounds wound; enough of them kill. The old
            // behaviour - one round inside 18 m destroying anything - made the
            // gun both trivial and weightless, and left nothing to report back
            // to the player between "nothing happened" and "it exploded".
            let hit = false;
            for (const t of targets) {
                if (!t.isAlive) continue;
                const d = Math.hypot(b.pos.x - t.position.x, b.pos.y - t.position.y, b.pos.z - t.position.z);
                if (d < WeaponsSystem.GUN_HIT_RADIUS) {
                    hit = true;
                    const integrity = (t.integrity ?? 100) - WeaponsSystem.GUN_DAMAGE * toughnessFactor(t);
                    t.integrity = Math.max(0, integrity);
                    t.hitFlash = 0.12;

                    if (t.integrity <= 0) {
                        t.isAlive = false;
                        this.spawnExplosion(t.position, 24, '#ff3333');
                        if (onTargetDestroyed) onTargetDestroyed(t);
                    } else {
                        // A visible spark, not a fireball: the difference has
                        // to be readable at 1.5 km through a wireframe.
                        this.spawnExplosion(t.position, 4, '#ffdd88');
                        if (onTargetHit) onTargetHit(t, t.integrity);
                    }
                    break;
                }
            }
            if (hit) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Strafing run against ground SAM sites (previously only bombs
            // could damage them — cannon runs on the radar nodes had no effect).
            for (let s = samSites.length - 1; s >= 0 && !hit; s--) {
                const sam = samSites[s];
                const d = Math.hypot(b.pos.x - sam.position.x, b.pos.y - sam.position.y, b.pos.z - sam.position.z);
                if (d < 8) {
                    sam.strafeDamage += 1;
                    if (sam.strafeDamage >= 40) {
                        this.spawnExplosion(sam.position, 26, '#ff5500');
                        if (onSAMDestroyed) onSAMDestroyed(sam);
                        samSites.splice(s, 1);
                    }
                    hit = true;
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

        // 3. AGM-88 HARM anti-radiation missiles
        for (let i = this.harms.length - 1; i >= 0; i--) {
            const h = this.harms[i];
            h.life -= dt;

            const sam = h.targetSamId ? samSites.find(s => s.id === h.targetSamId) : undefined;
            const threat = threats?.find(t => t.id === h.targetSamId);
            const radiating = !!sam && !!threat && threat.state !== 'SILENT';

            if (sam && radiating && !h.wentBallistic) {
                // Ground target: zero velocity is the whole "lead" term.
                h.vel = guideMissile(h.pos, h.vel, sam.position, { x: 0, y: 0, z: 0 }, dt,
                    HARM_TUNING.speed, HARM_TUNING.maxTurnRateRadPerSec);
            } else if (sam && !radiating) {
                // The site shut down. No further correction from here - this
                // IS "goes ballistic and misses": the round keeps its last
                // commanded heading and speed, and only luck puts it within
                // the hit radius from here on.
                h.wentBallistic = true;
            }

            h.pos.x += h.vel.x * dt;
            h.pos.y += h.vel.y * dt;
            h.pos.z += h.vel.z * dt;

            if (sam) {
                const dist = Math.hypot(
                    h.pos.x - sam.position.x,
                    h.pos.y - sam.position.y,
                    h.pos.z - sam.position.z
                );
                if (dist < HARM_TUNING.hitRadius) {
                    this.spawnExplosion(sam.position, 30, '#cc88ff');
                    if (onSAMDestroyed) onSAMDestroyed(sam);
                    const idx = samSites.indexOf(sam);
                    if (idx >= 0) samSites.splice(idx, 1);
                    this.harms.splice(i, 1);
                    continue;
                }
            }

            if (h.pos.y <= terrain.getElevation(h.pos.x, h.pos.z) || h.life <= 0 || !sam) {
                this.spawnExplosion(h.pos, 14, '#cc88ff');
                this.harms.splice(i, 1);
            }
        }

        // 4. Mk.82 Bombs
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            bomb.life -= dt;
            bomb.vel.y -= 9.81 * dt; // Gravity
            bomb.pos.x += bomb.vel.x * dt;
            bomb.pos.y += bomb.vel.y * dt;
            bomb.pos.z += bomb.vel.z * dt;

            const terrY = terrain.getElevation(bomb.pos.x, bomb.pos.z);
            if (bomb.pos.y <= terrY) {
                const impact = { x: bomb.pos.x, y: terrY + 2, z: bomb.pos.z };
                this.spawnExplosion(impact, 28, '#ff5500');

                // Hardened structures first: their hit radius is far tighter
                // than a SAM site's, so a hit here is the precise one.
                let struckHardTarget = false;
                for (const target of world.strikeTargets ?? []) {
                    if (target.registerImpact(impact)) {
                        struckHardTarget = true;
                        // A secondary detonation inside the structure reads as
                        // "that went in", not "that landed nearby".
                        this.spawnExplosion(
                            { x: target.position.x, y: target.position.y + 12, z: target.position.z },
                            40,
                            target.destroyed ? '#ffdd33' : '#ff8800'
                        );
                        if (world.onStrikeTargetHit) world.onStrikeTargetHit(target, target.destroyed);
                        break;
                    }
                }

                // Check splash radius on SAM sites
                if (!struckHardTarget) {
                    for (let s = 0; s < samSites.length; s++) {
                        const sam = samSites[s];
                        const dist = Math.hypot(bomb.pos.x - sam.position.x, bomb.pos.z - sam.position.z);
                        if (dist < 180) { // 180m blast radius
                            if (onSAMDestroyed) onSAMDestroyed(sam);
                            samSites.splice(s, 1);
                            break;
                        }
                    }
                }

                this.bombs.splice(i, 1);
            } else if (bomb.life <= 0) {
                this.bombs.splice(i, 1);
            }
        }

        // 5. Explosions
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

        // Render HARMs (magenta line - distinct from the white Sidewinder,
        // since which weapon is in the air matters to a player reading the
        // screen mid-engagement)
        for (const h of this.harms) {
            const tail: Vector3 = {
                x: h.pos.x - (h.vel.x / HARM_TUNING.speed) * 7,
                y: h.pos.y - (h.vel.y / HARM_TUNING.speed) * 7,
                z: h.pos.z - (h.vel.z / HARM_TUNING.speed) * 7
            };
            renderer.drawLine(tail, h.pos, camPos, camPitch, camYaw, camRoll, '#cc88ff', 2.4);
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
