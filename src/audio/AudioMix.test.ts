import { describe, it, expect } from 'vitest';
import { MIX, SPATIAL_TUNING, airflow, buffet, spatial, threatBed } from './AudioMix';

const at = (x: number, y: number, z: number) => ({ x, y, z });
const origin = at(0, 0, 0);

describe('mix structure', () => {
    /**
     * The continuous beds have to sit under the events, or a busy fight turns
     * into a wall. This is the one relationship that must never invert.
     */
    it('keeps the continuous beds below every event level', () => {
        for (const bed of [MIX.engine, MIX.airflow, MIX.threatBed]) {
            expect(bed).toBeLessThan(MIX.weapons);
            expect(bed).toBeLessThan(MIX.impacts);
            expect(bed).toBeLessThan(MIX.alerts);
        }
    });

    it('gives alerts the loudest bus, because they are instructions', () => {
        const others = [MIX.engine, MIX.airflow, MIX.threatBed, MIX.weapons, MIX.impacts, MIX.world, MIX.ui];
        for (const level of others) expect(MIX.alerts).toBeGreaterThanOrEqual(level);
    });

    it('leaves headroom on the master bus', () => {
        expect(MIX.master).toBeGreaterThan(0);
        expect(MIX.master).toBeLessThan(1);
    });
});

describe('spatial', () => {
    it('is loudest at the listener and falls away with distance', () => {
        const near = spatial(origin, 0, at(0, 0, 10)).gain;
        const mid = spatial(origin, 0, at(0, 0, 1000)).gain;
        const far = spatial(origin, 0, at(0, 0, 5000)).gain;
        expect(near).toBeGreaterThan(mid);
        expect(mid).toBeGreaterThan(far);
        expect(near).toBeLessThanOrEqual(1);
    });

    it('is half power at the reference distance', () => {
        const g = spatial(origin, 0, at(0, 0, SPATIAL_TUNING.referenceDistance)).gain;
        expect(g).toBeCloseTo(0.5, 6);
    });

    it('goes silent beyond the maximum distance', () => {
        expect(spatial(origin, 0, at(0, 0, SPATIAL_TUNING.maxDistance)).gain).toBe(0);
        expect(spatial(origin, 0, at(0, 0, 50000)).gain).toBe(0);
    });

    it('pans a contact off the right wing to the right, and vice versa', () => {
        expect(spatial(origin, 0, at(500, 0, 0)).pan).toBeGreaterThan(0.5);
        expect(spatial(origin, 0, at(-500, 0, 0)).pan).toBeLessThan(-0.5);
    });

    it('keeps something dead ahead or dead astern in the centre', () => {
        expect(spatial(origin, 0, at(0, 0, 900)).pan).toBeCloseTo(0, 6);
        expect(spatial(origin, 0, at(0, 0, -900)).pan).toBeCloseTo(0, 6);
    });

    it('pans relative to where the nose is pointing, not to the world', () => {
        // Nose 90 degrees right: a contact on the +X axis is now dead ahead.
        const ahead = spatial(origin, Math.PI / 2, at(900, 0, 0));
        expect(ahead.pan).toBeCloseTo(0, 6);
        // ...and one on +Z has moved to the left ear.
        expect(spatial(origin, Math.PI / 2, at(0, 0, 900)).pan).toBeLessThan(-0.5);
    });

    it('never exceeds the stereo field', () => {
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
            for (const yaw of [0, 1.2, 3.4, 5.9]) {
                const p = spatial(origin, yaw, at(Math.sin(a) * 800, 0, Math.cos(a) * 800)).pan;
                expect(p).toBeGreaterThanOrEqual(-1);
                expect(p).toBeLessThanOrEqual(1);
            }
        }
    });

    it('accounts for vertical separation in the distance', () => {
        const level = spatial(origin, 0, at(0, 0, 400)).gain;
        const above = spatial(origin, 0, at(0, 3000, 400)).gain;
        expect(above).toBeLessThan(level);
    });

    it('survives a degenerate source at the listener', () => {
        const s = spatial(origin, 0, origin);
        expect(s.gain).toBe(1);
        expect(s.pan).toBe(0);
    });
});

describe('threatBed', () => {
    it('is silent with a quiet scope', () => {
        expect(threatBed('SILENT').gain).toBe(0);
    });

    it('rises in level and pitch as the threat escalates', () => {
        const search = threatBed('SEARCH');
        const track = threatBed('TRACK');
        const launch = threatBed('LAUNCH');
        expect(search.gain).toBeLessThan(track.gain);
        expect(track.gain).toBeLessThan(launch.gain);
        expect(search.frequency).toBeLessThan(track.frequency);
        expect(track.frequency).toBeLessThan(launch.frequency);
    });

    it('stays a bed, never competing with an alert', () => {
        expect(threatBed('LAUNCH').gain).toBeLessThan(MIX.alerts);
    });

    it('stays in the low register where it is felt rather than heard', () => {
        for (const state of ['SEARCH', 'TRACK', 'LAUNCH'] as const) {
            expect(threatBed(state).frequency).toBeLessThan(120);
        }
    });
});

describe('airflow', () => {
    it('is silent on the deck and at taxi speed', () => {
        expect(airflow(0).gain).toBe(0);
        expect(airflow(40).gain).toBe(0);
    });

    it('builds with speed and opens up as it builds', () => {
        const slow = airflow(120);
        const fast = airflow(300);
        expect(fast.gain).toBeGreaterThan(slow.gain);
        expect(fast.cutoff).toBeGreaterThan(slow.cutoff);
    });

    it('stops building past the top of the envelope', () => {
        expect(airflow(500).gain).toBeCloseTo(airflow(340).gain, 6);
    });

    it('never rises above its bus level', () => {
        for (let v = 0; v < 600; v += 25) {
            expect(airflow(v).gain).toBeLessThanOrEqual(MIX.airflow);
        }
    });

    it('survives nonsense speed', () => {
        expect(airflow(Number.NaN).gain).toBe(0);
        expect(airflow(-50).gain).toBe(0);
    });
});

describe('buffet', () => {
    it('is silent in normal flight', () => {
        expect(buffet(0.05, false)).toBe(0);
        expect(buffet(0.1, false)).toBe(0);
    });

    /**
     * The buffet has to start BEFORE the stall, or it is a death notice
     * rather than a warning.
     */
    it('starts before the wing lets go and builds to the limit', () => {
        const early = buffet(0.20, false);
        const late = buffet(0.25, false);
        expect(early).toBeGreaterThan(0);
        expect(late).toBeGreaterThan(early);
        expect(late).toBeLessThanOrEqual(1);
    });

    it('is full once stalled, whatever alpha reads', () => {
        expect(buffet(0, true)).toBe(1);
        expect(buffet(0.9, true)).toBe(1);
    });

    it('treats a negative alpha the same way', () => {
        expect(buffet(-0.25, false)).toBeGreaterThan(0);
    });

    it('never exceeds full scale', () => {
        expect(buffet(5, false)).toBe(1);
    });
});
