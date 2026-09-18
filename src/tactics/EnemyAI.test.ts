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
