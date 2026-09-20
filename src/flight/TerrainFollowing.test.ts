import { describe, it, expect } from 'vitest';
import {
    DEFAULT_TERRAIN_FOLLOWING,
    TF_TUNING,
    lookaheadDistance,
    sampleGroundTrack,
    loadTerrainFollowing,
    saveTerrainFollowing,
    terrainFollowingAltitude,
    type GroundSample
} from './TerrainFollowing';

const flat = (elevation: number, count: number = TF_TUNING.samples, reach = 4000): GroundSample[] =>
    Array.from({ length: count }, (_, i) => ({
        distance: (reach * (i + 1)) / count,
        elevation
    }));

describe('lookaheadDistance', () => {
    it('scales with speed', () => {
        const slow = lookaheadDistance(100);
        const fast = lookaheadDistance(300);
        expect(fast).toBeGreaterThan(slow);
    });

    it('never looks less far than the minimum, however slow', () => {
        expect(lookaheadDistance(0)).toBe(TF_TUNING.minLookahead);
        expect(lookaheadDistance(-50)).toBe(TF_TUNING.minLookahead);
    });

    it('never looks further than the maximum, however fast', () => {
        expect(lookaheadDistance(10000)).toBe(TF_TUNING.maxLookahead);
    });
});

describe('sampleGroundTrack', () => {
    /**
     * Along the heading, not the velocity vector: sampling the velocity vector
     * makes the commanded altitude swing with the roll in a banked turn.
     */
    it('walks the heading, in order, out to the lookahead', () => {
        const seen: Array<[number, number]> = [];
        const samples = sampleGroundTrack(
            { x: 0, z: 0 },
            0, // due +Z
            200,
            (x, z) => { seen.push([x, z]); return 0; }
        );

        expect(samples.length).toBe(TF_TUNING.samples);
        expect(samples[0].distance).toBeLessThan(samples[samples.length - 1].distance);
        expect(samples[samples.length - 1].distance).toBeCloseTo(lookaheadDistance(200), 5);
        // Heading 0 is +Z, so x never moves.
        for (const [x] of seen) expect(Math.abs(x)).toBeLessThan(1e-9);
        expect(seen[seen.length - 1][1]).toBeCloseTo(lookaheadDistance(200), 5);
    });

    it('follows a heading of 90 degrees down +X', () => {
        const samples = sampleGroundTrack(
            { x: 0, z: 0 },
            Math.PI / 2,
            200,
            (x) => x / 10
        );
        // Elevation grew with x, so the far sample is the high one.
        expect(samples[samples.length - 1].elevation).toBeGreaterThan(samples[0].elevation);
    });

    it('starts ahead of the aircraft, never behind or underneath it', () => {
        const samples = sampleGroundTrack({ x: 0, z: 0 }, 0, 200, () => 0);
        for (const s of samples) expect(s.distance).toBeGreaterThan(0);
    });
});

describe('terrainFollowingAltitude', () => {
    it('holds the set clearance over flat ground', () => {
        const r = terrainFollowingAltitude(flat(0), 0, 220);
        expect(r.altitudeAgl).toBe(TF_TUNING.setClearance);
        expect(r.climbing).toBe(false);
        expect(r.drivenBy).toBe(null);
    });

    it('holds the set clearance over flat ground at any elevation', () => {
        const r = terrainFollowingAltitude(flat(900), 900, 220);
        expect(r.altitudeAgl).toBe(TF_TUNING.setClearance);
    });

    /**
     * The whole point: climb for the ridge BEFORE arriving at it, so the jet
     * crosses with clearance instead of being pulled up by the floor at the
     * last moment.
     */
    it('climbs for a ridge ahead', () => {
        const samples = flat(0);
        // A wall 800 m up, 2 km out.
        for (const s of samples) if (s.distance >= 2000) s.elevation = 800;

        const r = terrainFollowingAltitude(samples, 0, 220);
        expect(r.altitudeAgl).toBeGreaterThan(TF_TUNING.setClearance);
        expect(r.climbing).toBe(true);
        expect(r.drivenBy?.elevation).toBe(800);
    });

    /**
     * ...but not so early that it is cruising at ridge height for kilometres.
     * A ridge far enough away to be climbed for later must not raise the
     * altitude now.
     */
    it('ignores a ridge far enough away to out-climb later', () => {
        const samples = flat(0, TF_TUNING.samples, 7000);
        samples[samples.length - 1].elevation = 400;

        const r = terrainFollowingAltitude(samples, 0, 250);
        expect(r.altitudeAgl).toBe(TF_TUNING.setClearance);
    });

    it('commands a lower altitude the further away the same ridge is', () => {
        const near = flat(0, 4, 2000).map(s => ({ ...s, elevation: 1000 }));
        const far = flat(0, 4, 6000).map(s => ({ ...s, elevation: 1000 }));
        expect(terrainFollowingAltitude(near, 0, 220).altitudeAgl)
            .toBeGreaterThan(terrainFollowingAltitude(far, 0, 220).altitudeAgl);
    });

    /**
     * Descending again behind a ridge is half the mechanic. A follower that
     * only ever climbs is a follower that leaves you at ridge height with the
     * whole SAM belt looking at you.
     */
    it('sinks back to the set clearance once the ridge is behind', () => {
        const crossing = flat(0);
        for (const s of crossing) if (s.distance >= 1500) s.elevation = 700;
        const high = terrainFollowingAltitude(crossing, 0, 220).altitudeAgl;

        // Past it: the ground below is the ridge top, and everything ahead is
        // the valley floor on the far side.
        const past = terrainFollowingAltitude(flat(0), 700, 220);
        expect(past.altitudeAgl).toBe(TF_TUNING.setClearance);
        expect(high).toBeGreaterThan(past.altitudeAgl);
    });

    it('never commands less than the set clearance, even over a falling floor', () => {
        const falling = flat(-400);
        expect(terrainFollowingAltitude(falling, 0, 220).altitudeAgl)
            .toBeGreaterThanOrEqual(TF_TUNING.setClearance);
    });

    /**
     * A slower aeroplane has longer to climb for the same ridge, so it may fly
     * lower for longer. This falls out of the maths, and is worth pinning
     * because getting the division the wrong way round would invert it.
     */
    it('lets a slow aircraft stay lower for the same ridge', () => {
        const samples = flat(0);
        for (const s of samples) if (s.distance >= 2500) s.elevation = 900;

        const slow = terrainFollowingAltitude(samples, 0, 90).altitudeAgl;
        const fast = terrainFollowingAltitude(samples, 0, 300).altitudeAgl;
        expect(slow).toBeLessThan(fast);
    });

    it('does not divide by zero at a standstill', () => {
        const r = terrainFollowingAltitude(flat(0), 0, 0);
        expect(Number.isFinite(r.altitudeAgl)).toBe(true);
        expect(r.altitudeAgl).toBeGreaterThan(0);
    });

    it('takes the highest requirement when several ridges compete', () => {
        const samples = flat(0);
        samples[2].elevation = 300;
        samples[8].elevation = 1400;
        const r = terrainFollowingAltitude(samples, 0, 220);
        expect(r.drivenBy?.elevation).toBe(1400);
    });

    /**
     * The assumed climb rate is deliberately below what the jet can do. If it
     * were ever raised above the real one, the planner would command an
     * altitude the aeroplane cannot reach in time - which is a crash, not a
     * near miss - so the relationship is pinned here.
     */
    it('assumes a climb rate the aeroplane can beat', () => {
        expect(TF_TUNING.assumedClimbRate).toBeLessThan(40);
        expect(TF_TUNING.assumedClimbRate).toBeGreaterThan(0);
    });
});

describe('terrain following preference', () => {
    const store = () => {
        const map = new Map<string, string>();
        return {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => { map.set(k, v); }
        };
    };

    it('defaults to on', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        expect(loadTerrainFollowing()).toBe(DEFAULT_TERRAIN_FOLLOWING);
    });

    it('round-trips both states', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        saveTerrainFollowing(false);
        expect(loadTerrainFollowing()).toBe(false);
        saveTerrainFollowing(true);
        expect(loadTerrainFollowing()).toBe(true);
    });

    it('falls back to the default on a corrupt value', () => {
        const s = store();
        s.setItem('carrier-vector-1988.terrainFollowing', 'maybe');
        (globalThis as { localStorage?: unknown }).localStorage = s;
        expect(loadTerrainFollowing()).toBe(DEFAULT_TERRAIN_FOLLOWING);
    });

    it('survives storage that throws', () => {
        (globalThis as { localStorage?: unknown }).localStorage = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        };
        expect(loadTerrainFollowing()).toBe(DEFAULT_TERRAIN_FOLLOWING);
        expect(() => saveTerrainFollowing(false)).not.toThrow();
    });
});
