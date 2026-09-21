import { describe, it, expect } from 'vitest';
import { radarProject, relativeHeading, formatNm, RADAR_RANGE_M } from './RadarMath';

const origin = { x: 0, z: 0 };

describe('radarProject (heading-up)', () => {
    it('puts something dead ahead straight up the scope', () => {
        const p = radarProject(origin, 0, { x: 0, z: 6000 }, 12000, 60);
        expect(p.x).toBeCloseTo(0, 6);
        expect(p.y).toBeCloseTo(-30, 6);
        expect(p.clamped).toBe(false);
    });

    it('puts something to the right of the nose on the right of the scope', () => {
        // Heading north (0), target due east (+X).
        const p = radarProject(origin, 0, { x: 6000, z: 0 }, 12000, 60);
        expect(p.x).toBeCloseTo(30, 6);
        expect(p.y).toBeCloseTo(0, 6);
    });

    it('rotates with the player: turn east and the eastern target is now dead ahead', () => {
        const p = radarProject(origin, Math.PI / 2, { x: 6000, z: 0 }, 12000, 60);
        expect(p.x).toBeCloseTo(0, 6);
        expect(p.y).toBeCloseTo(-30, 6);
    });

    it('puts something behind the player at the bottom', () => {
        const p = radarProject(origin, 0, { x: 0, z: -6000 }, 12000, 60);
        expect(p.y).toBeGreaterThan(0);
    });

    it('pins a contact beyond range to the rim, on the right bearing', () => {
        const p = radarProject(origin, 0, { x: 30000, z: 30000 }, 12000, 60);
        expect(p.clamped).toBe(true);
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(60, 6);
        expect(p.x).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(0);
    });

    it('measures from the player, not from the origin', () => {
        const p = radarProject({ x: 1000, z: 1000 }, 0, { x: 1000, z: 4000 }, 12000, 60);
        expect(p.distance).toBeCloseTo(3000, 6);
        expect(p.x).toBeCloseTo(0, 6);
    });
});

describe('relativeHeading', () => {
    it('is 0 for a contact flying the same way as the player', () => {
        expect(relativeHeading(0.7, { x: Math.sin(0.7) * 200, z: Math.cos(0.7) * 200 })).toBeCloseTo(0, 6);
    });
    it('is pi for a head-on contact', () => {
        expect(Math.abs(relativeHeading(0, { x: 0, z: -200 }))).toBeCloseTo(Math.PI, 6);
    });
    it('is +90 degrees for a contact crossing left to right', () => {
        expect(relativeHeading(0, { x: 200, z: 0 })).toBeCloseTo(Math.PI / 2, 6);
    });
});

describe('formatNm', () => {
    it('shows one decimal under ten miles and none above', () => {
        expect(formatNm(15550)).toBe('8.4NM');
        expect(formatNm(37040)).toBe('20NM');
    });
    it('has a sane default scope range', () => {
        expect(RADAR_RANGE_M).toBeGreaterThan(5000);
    });
});
