import { describe, it, expect, beforeEach } from 'vitest';
import { updateEnemyAI, decideBehavior, isBomber, AI_TUNING } from './EnemyAI';
import { AircraftPhysics } from '../flight/AircraftPhysics';
import type { AirborneTarget } from '../renderer/HUD';

function makeFighter(pos = { x: 0, y: 1000, z: 5000 }): AirborneTarget {
    return {
        id: 'W1-0-0',
        name: 'MiG-23 FLOGGER #1',
        position: { ...pos },
        velocity: { x: 0, y: 0, z: -200 },
        isAlive: true
    };
}

function makeBomber(pos = { x: 0, y: 1200, z: 9000 }): AirborneTarget {
    return {
        id: 'W1-1-0',
        name: 'Tu-22M BACKFIRE',
        position: { ...pos },
        velocity: { x: 0, y: 0, z: -200 },
        isAlive: true
    };
}

describe('Enemy behaviour classification', () => {
    it('identifies bombers by type', () => {
        expect(isBomber(makeBomber())).toBe(true);
        expect(isBomber(makeFighter())).toBe(false);
    });

    it('sends bombers to RTB regardless of how close the player is', () => {
        // A bomber's whole job is to reach the carrier - it must never be
        // baited into a dogfight, otherwise the player can trivially neutralise
        // the real threat just by flying near it.
        expect(decideBehavior(makeBomber(), 100)).toBe('RTB');
        expect(decideBehavior(makeBomber(), 50000)).toBe('RTB');
    });

    it('commits a fighter to ENGAGE inside engagement range', () => {
        expect(decideBehavior(makeFighter(), AI_TUNING.ENGAGE_RANGE - 1)).toBe('ENGAGE');
    });

    it('keeps a fighter on INGRESS beyond engagement range', () => {
        expect(decideBehavior(makeFighter(), AI_TUNING.ENGAGE_RANGE + 1)).toBe('INGRESS');
        expect(decideBehavior(makeFighter(), AI_TUNING.DETECTION_RANGE + 5000)).toBe('INGRESS');
    });
});

describe('updateEnemyAI', () => {
    let player: AircraftPhysics;

    beforeEach(() => {
        player = new AircraftPhysics();
        player.position = { x: 0, y: 1000, z: 0 };
        player.velocity = { x: 0, y: 0, z: 200 };
    });

    it('turns an engaging fighter toward the player', () => {
        // Fighter offset laterally, flying straight - should start steering
        // its velocity vector toward the player once engaged.
        const fighter = makeFighter({ x: 2000, y: 1000, z: 1000 });
        fighter.velocity = { x: 0, y: 0, z: -200 };

        const initialVx = fighter.velocity.x;
        for (let i = 0; i < 60; i++) {
            updateEnemyAI(1 / 60, [fighter], player);
        }

        expect(fighter.aiBehavior).toBe('ENGAGE');
        // Player is at -X relative to the fighter, so vx should trend negative.
        expect(fighter.velocity.x).toBeLessThan(initialVx);
    });

    it('drives a bomber toward the carrier at the origin', () => {
        const bomber = makeBomber({ x: 3000, y: 1200, z: 9000 });
        const startDist = Math.hypot(bomber.position.x, bomber.position.z);

        for (let i = 0; i < 120; i++) {
            updateEnemyAI(1 / 60, [bomber], player);
        }

        const endDist = Math.hypot(bomber.position.x, bomber.position.z);
        expect(bomber.aiBehavior).toBe('RTB');
        expect(endDist).toBeLessThan(startDist);
    });

    it('fires at the player when aligned and in range, respecting the cooldown', () => {
        // Place a fighter directly behind the player, pointing right at them.
        const fighter = makeFighter({ x: 0, y: 1000, z: -800 });
        fighter.velocity = { x: 0, y: 0, z: 200 }; // flying toward player at +Z

        let shots = 0;
        for (let i = 0; i < 60; i++) {
            updateEnemyAI(1 / 60, [fighter], player, () => { shots++; });
        }

        expect(shots).toBeGreaterThan(0);
        // One second of simulation with a 1.4s cooldown must not allow a stream.
        expect(shots).toBeLessThanOrEqual(1);
    });

    it('does not fire when the player is out of cannon range', () => {
        const fighter = makeFighter({ x: 0, y: 1000, z: -5000 });
        fighter.velocity = { x: 0, y: 0, z: 200 };

        let shots = 0;
        for (let i = 0; i < 60; i++) {
            updateEnemyAI(1 / 60, [fighter], player, () => { shots++; });
        }
        expect(shots).toBe(0);
    });

    it('derives bank angle and heading from the velocity vector for rendering', () => {
        const fighter = makeFighter({ x: 2000, y: 1000, z: 1000 });
        updateEnemyAI(1 / 60, [fighter], player);

        expect(typeof fighter.yaw).toBe('number');
        expect(typeof fighter.pitch).toBe('number');
        expect(typeof fighter.roll).toBe('number');
        expect(Math.abs(fighter.roll ?? 0)).toBeLessThanOrEqual(AI_TUNING.MAX_BANK);
    });

    it('ignores destroyed contacts entirely', () => {
        const fighter = makeFighter();
        fighter.isAlive = false;
        const before = { ...fighter.position };
        updateEnemyAI(1, [fighter], player);
        expect(fighter.position).toEqual(before);
    });
});

/**
 * v2.2.0 regression: the steering law bled speed on every turn. Measured in a
 * SCRAMBLE run, two MiGs fell from ~185 m/s to 3 m/s after their first pass
 * and hung a kilometre below the jet until the wave timed out.
 */
describe('enemy steering keeps its speed', () => {
    const speedOf = (t: AirborneTarget) => Math.hypot(t.velocity.x, t.velocity.y, t.velocity.z);
    const run = (t: AirborneTarget, player: AircraftPhysics, seconds: number, onStep?: () => void) => {
        for (let i = 0; i < seconds * 120; i++) {
            updateEnemyAI(1 / 120, [t], player);
            onStep?.();
        }
    };
    let player: AircraftPhysics;

    beforeEach(() => {
        player = new AircraftPhysics();
        player.position = { x: 0, y: 1000, z: 0 };
        player.velocity = { x: 0, y: 0, z: 200 };
    });

    it('holds speed through a reversal after a head-on pass', () => {
        // Just past the merge: the player is dead astern of the fighter.
        const fighter = makeFighter({ x: 0, y: 1000, z: -600 });
        fighter.velocity = { x: 0, y: 0, z: -185 };
        fighter.huntsPlayer = true;
        let slowest = Infinity;
        run(fighter, player, 20, () => { slowest = Math.min(slowest, speedOf(fighter)); });
        expect(slowest).toBeGreaterThan(184);
        // ...and it did come round: now flying back toward the player.
        const back = -(fighter.position.z) * fighter.velocity.z + -(fighter.position.x) * fighter.velocity.x;
        expect(back).toBeGreaterThan(0);
    });

    it('holds speed while climbing toward a player a kilometre above it', () => {
        const fighter = makeFighter({ x: 1500, y: 0, z: 1500 });
        fighter.velocity = { x: 185, y: 0, z: 0 };
        fighter.huntsPlayer = true;
        run(fighter, player, 30);
        expect(speedOf(fighter)).toBeCloseTo(185, 3);
    });

    it('turns no faster than MAX_TURN_RATE', () => {
        const fighter = makeFighter({ x: 0, y: 1000, z: -600 });
        fighter.velocity = { x: 0, y: 0, z: -185 };
        fighter.huntsPlayer = true;
        let heading = Math.atan2(fighter.velocity.x, fighter.velocity.z);
        let fastest = 0;
        for (let i = 0; i < 600; i++) {
            updateEnemyAI(1 / 120, [fighter], player);
            const h = Math.atan2(fighter.velocity.x, fighter.velocity.z);
            let d = h - heading;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            fastest = Math.max(fastest, Math.abs(d) * 120);
            heading = h;
        }
        expect(fastest).toBeGreaterThan(AI_TUNING.MAX_TURN_RATE * 0.9);
        expect(fastest).toBeLessThanOrEqual(AI_TUNING.MAX_TURN_RATE * 1.001);
    });

    it('banks into the turn it is making, whichever way it is heading', () => {
        // Heading south (-z) with the player to the east (+x): that is a LEFT
        // turn, so a negative bank. The old cue read the world x axis and
        // banked this one to the right.
        const southbound = makeFighter({ x: -2000, y: 1000, z: 0 });
        southbound.velocity = { x: 0, y: 0, z: -185 };
        southbound.huntsPlayer = true;
        updateEnemyAI(1 / 120, [southbound], player);
        expect(southbound.roll ?? 0).toBeLessThan(0);

        const northbound = makeFighter({ x: -2000, y: 1000, z: 0 });
        northbound.velocity = { x: 0, y: 0, z: 185 };
        northbound.huntsPlayer = true;
        updateEnemyAI(1 / 120, [northbound], player);
        expect(northbound.roll ?? 0).toBeGreaterThan(0);
    });
});

describe('enemy guns fairness', () => {
    it('gives a warning before the first burst, then fires after AIM_TIME', () => {
        const player = new AircraftPhysics();
        player.position = { x: 0, y: 1000, z: 0 };
        const fighter = {
            id: 'B1', name: 'MiG-23', position: { x: 0, y: 1000, z: -800 },
            velocity: { x: 0, y: 0, z: 200 }, isAlive: true
        } as AirborneTarget;
        const log: string[] = [];
        let t = 0;
        for (let i = 0; i < 120; i++) {
            t += 1 / 60;
            updateEnemyAI(1 / 60, [fighter], player,
                () => log.push(`fire@${t.toFixed(2)}`), () => log.push(`aim@${t.toFixed(2)}`), () => 0);
        }
        expect(log[0].startsWith('aim')).toBe(true);
        const firstFire = log.find(l => l.startsWith('fire'));
        expect(firstFire).toBeDefined();
        expect(parseFloat(firstFire!.split('@')[1])).toBeGreaterThanOrEqual(AI_TUNING.AIM_TIME);
    });

    it('a burst can miss: hit follows the injected rng against HIT_CHANCE', () => {
        const player = new AircraftPhysics();
        player.position = { x: 0, y: 1000, z: 0 };
        const mk = () => ({
            id: 'B1', name: 'MiG-23', position: { x: 0, y: 1000, z: -800 },
            velocity: { x: 0, y: 0, z: 200 }, isAlive: true
        } as AirborneTarget);
        const run = (roll: number) => {
            const f = mk(); const hits: boolean[] = [];
            for (let i = 0; i < 120; i++) updateEnemyAI(1 / 60, [f], player, (_t, hit) => hits.push(hit), undefined, () => roll);
            return hits;
        };
        expect(run(0.01)[0]).toBe(true);
        expect(run(0.99)[0]).toBe(false);
    });

    it('losing the solution resets the aim timer', () => {
        const player = new AircraftPhysics();
        player.position = { x: 0, y: 1000, z: 0 };
        const f = {
            id: 'B1', name: 'MiG-23', position: { x: 0, y: 1000, z: -800 },
            velocity: { x: 0, y: 0, z: 200 }, isAlive: true
        } as AirborneTarget;
        for (let i = 0; i < 10; i++) updateEnemyAI(1 / 60, [f], player);
        expect(f.aiAimTimer ?? 0).toBeGreaterThan(0);
        // Break turn: the fighter is now pointing well off the player.
        f.velocity = { x: 200, y: 0, z: 0 };
        updateEnemyAI(1 / 60, [f], player);
        expect(f.aiAimTimer).toBe(0);
    });
});

describe('SCRAMBLE hunters (v2.0.0)', () => {
    it('a hunting fighter engages from any range; a bomber still drives for the boat', () => {
        const mig = { id: 'W3-MIG-0', name: 'MiG-23 FLOGGER #1', position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, isAlive: true, huntsPlayer: true };
        expect(decideBehavior(mig, 20000)).toBe('ENGAGE');
        expect(decideBehavior({ ...mig, huntsPlayer: false }, 20000)).toBe('INGRESS');
        const bomber = { ...mig, id: 'W3-TU-22-0', name: 'Tu-22M BACKFIRE' };
        expect(decideBehavior(bomber, 100)).toBe('RTB');
    });
});

describe('strafing passes (v2.2.0)', () => {
    it('breaks off after a close pass instead of parking on the jet\'s tail', () => {
        // A MiG sitting 300 m behind a jet that is flying straight ahead.
        const player = new AircraftPhysics();
        player.position = { x: 0, y: 1000, z: 0 };
        player.velocity = { x: 0, y: 0, z: 180 };
        const fighter = makeFighter({ x: 0, y: 1000, z: -300 });
        fighter.velocity = { x: 0, y: 0, z: 185 };
        fighter.huntsPlayer = true;
        let shots = 0;
        let farthest = 0;
        for (let i = 0; i < 20 * 120; i++) {
            // The jet turns away steadily, as an EASY autopilot does.
            const yaw = (i / 120) * 0.2;
            player.velocity = { x: Math.sin(yaw) * 180, y: 0, z: Math.cos(yaw) * 180 };
            player.position.x += player.velocity.x / 120;
            player.position.z += player.velocity.z / 120;
            updateEnemyAI(1 / 120, [fighter], player, () => { shots++; });
            const d = Math.hypot(fighter.position.x - player.position.x, fighter.position.z - player.position.z);
            farthest = Math.max(farthest, d);
        }
        // It extended out past the pass range at some point...
        expect(farthest).toBeGreaterThan(AI_TUNING.EXTEND_RANGE * 1.5);
        // ...and held its speed throughout.
        expect(Math.hypot(fighter.velocity.x, fighter.velocity.y, fighter.velocity.z)).toBeCloseTo(185, 3);
    });

    it('holds fire while extending', () => {
        const player = new AircraftPhysics();
        player.position = { x: 0, y: 1000, z: 0 };
        const fighter = makeFighter({ x: 0, y: 1000, z: -200 });
        fighter.velocity = { x: 0, y: 0, z: 200 }; // dead astern, nose on
        fighter.huntsPlayer = true;
        let shots = 0;
        for (let i = 0; i < 120; i++) updateEnemyAI(1 / 120, [fighter], player, () => { shots++; });
        expect(fighter.aiExtendTimer ?? 0).toBeGreaterThan(0);
        expect(shots).toBe(0);
    });
});
