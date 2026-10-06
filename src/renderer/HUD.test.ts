import { describe, it, expect } from 'vitest';
import { HUD, assistCaption, goHereRelativeBearing, scoreTargetOptions, scoreWithTarget } from './HUD';
import type { AircraftPhysics } from '../flight/AircraftPhysics';

/** isOnApproach only reads position and velocity. */
function jet(pos: [number, number, number], vel: [number, number, number]): AircraftPhysics {
    return {
        position: { x: pos[0], y: pos[1], z: pos[2] },
        velocity: { x: vel[0], y: vel[1], z: vel[2] }
    } as AircraftPhysics;
}

describe('HUD.isOnApproach', () => {
    it('shows the landing aids when closing on the boat inside 3 km', () => {
        // 2 km astern, descending through 120 m, flying at the ship.
        expect(HUD.isOnApproach(jet([0, 120, -2000], [0, -4, 80]))).toBe(true);
    });

    // REGRESSION: the whole approach panel used to appear during the catapult
    // stroke, when the jet is ~300 m from the boat and accelerating AWAY.
    it('stays hidden while departing the carrier on the catapult stroke', () => {
        expect(HUD.isOnApproach(jet([5, 22, 140], [0, 0, 160]))).toBe(false);
    });

    it('stays hidden beyond 3 km', () => {
        expect(HUD.isOnApproach(jet([0, 120, -5000], [0, 0, 120]))).toBe(false);
    });

    it('stays hidden above the 400 m pattern ceiling', () => {
        expect(HUD.isOnApproach(jet([0, 900, -2000], [0, -10, 100]))).toBe(false);
    });

    it('stays hidden when merely loitering nearby', () => {
        // Flying across the boat rather than at it: closing rate is ~0.
        expect(HUD.isOnApproach(jet([0, 100, -1500], [120, 0, 0]))).toBe(false);
    });

    it('does not divide by zero directly overhead', () => {
        expect(() => HUD.isOnApproach(jet([0, 50, 0], [0, 0, 0]))).not.toThrow();
        expect(HUD.isOnApproach(jet([0, 50, 0], [0, 0, 0]))).toBe(false);
    });
});

describe('assistCaption', () => {
    it('shouts about the ground and only warns about alpha', () => {
        expect(assistCaption('TERRAIN')!.tone).toBe('ALERT');
        expect(assistCaption('STALL')!.tone).toBe('CAUTION');
    });

    it('tells a player on autopilot with an empty scope what to do next', () => {
        const caption = assistCaption('AUTOPILOT', false);
        expect(caption!.tone).toBe('INFO');
        // The one moment a player is guaranteed to be reading the glass with
        // nothing to do is the moment to teach them the designation key.
        expect(caption!.text).toContain('PRESS T');
    });

    it('stops telling them to press T once they have', () => {
        const caption = assistCaption('AUTOPILOT', true);
        expect(caption!.text).not.toContain('PRESS T');
        expect(caption!.text).toContain('AUTOPILOT');
    });

    /**
     * Auto-levelling happens on every frame the stick is centred. A caption
     * for it would be permanently lit, and a permanently lit annunciator is
     * one the pilot stops seeing - including when it says TERRAIN.
     */
    it('says nothing about routine auto-levelling or normal flight', () => {
        expect(assistCaption('LEVEL')).toBeNull();
        expect(assistCaption('NONE')).toBeNull();
    });

    /**
     * Down in the valley on purpose reads exactly like failing to climb
     * unless the glass says which it is.
     */
    it('marks terrain following on the autopilot caption', () => {
        expect(assistCaption('AUTOPILOT', true, true)!.text).toContain('TF');
        expect(assistCaption('AUTOPILOT', true, false)!.text).not.toContain('TF');
    });

    it('does not put TF on a caption that is not the autopilot', () => {
        expect(assistCaption('TERRAIN', true, true)!.text).not.toContain('TF');
        expect(assistCaption('STALL', true, true)!.text).not.toContain('TF');
    });
});

describe('goHereRelativeBearing', () => {
    it('is zero dead ahead, positive to the right, and wraps', () => {
        expect(goHereRelativeBearing(0, 0)).toBeCloseTo(0, 9);
        expect(goHereRelativeBearing(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
        expect(goHereRelativeBearing(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9);
        expect(goHereRelativeBearing(0.1, 2 * Math.PI + 0.3)).toBeCloseTo(0.2, 9);
        expect(Math.abs(goHereRelativeBearing(0, Math.PI))).toBeCloseTo(Math.PI, 9);
    });
});

describe('scoreWithTarget (v2.3.0)', () => {
    it('reads as a scoreboard, never as a fraction', () => {
        expect(scoreWithTarget(4200, null)).toBe('4,200 PTS');
        const anna = { score: 12345, who: 'ANNA', challenge: true, passed: false };
        expect(scoreWithTarget(4200, anna)).toBe('ANNA 12,345 · YOU 4,200');
        expect(scoreWithTarget(-80, anna)).toBe('ANNA 12,345 · YOU -80');
        expect(scoreWithTarget(13100, { ...anna, passed: true })).toBe('YOU 13,100 · AHEAD OF ANNA');
        expect(scoreWithTarget(4200, { ...anna, who: 'A FRIEND' })).toBe('TO BEAT 12,345 · YOU 4,200');
        expect(scoreWithTarget(13100, { ...anna, who: 'A FRIEND', passed: true })).toBe('YOU 13,100 · AHEAD');
        const best = { score: 8000, who: 'YOUR BEST', challenge: false, passed: false };
        expect(scoreWithTarget(4200, best)).toBe('BEST 8,000 · NOW 4,200');
        expect(scoreWithTarget(9000, { ...best, passed: true })).toBe('NOW 9,000 · NEW BEST');
    });

    it('shortens by dropping the name first and the pilot\'s own score never', () => {
        const anna = { score: 12345, who: 'GRANDPA MARGARET', challenge: true, passed: false };
        const chasing = scoreTargetOptions(4200, anna);
        expect(chasing).toEqual(['GRANDPA MARGARET 12,345 · YOU 4,200', 'TO BEAT 12,345 · YOU 4,200', 'BEAT 12,345 · YOU 4,200', 'YOU 4,200']);
        const ahead = scoreTargetOptions(13100, { ...anna, passed: true });
        expect(ahead).toEqual(['YOU 13,100 · AHEAD OF GRANDPA MARGARET', 'YOU 13,100 · AHEAD', 'YOU 13,100']);
        for (const list of [chasing, ahead]) {
            for (let i = 1; i < list.length; i++) expect(list[i].length).toBeLessThan(list[i - 1].length);
            for (const option of list) expect(option).toContain('YOU');
        }
        expect(scoreTargetOptions(4200, { score: 8000, who: 'YOUR BEST', challenge: false, passed: false }))
            .toEqual(['BEST 8,000 · NOW 4,200', 'NOW 4,200']);
    });
});
