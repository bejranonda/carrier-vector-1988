import { describe, it, expect } from 'vitest';
import { HUD, assistCaption } from './HUD';
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
});
