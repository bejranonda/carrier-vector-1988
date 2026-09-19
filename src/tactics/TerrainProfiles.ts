/**
 * CARRIER VECTOR: 1988 - Map Definitions
 *
 * The world used to be a single hardcoded height function with three SAM
 * sites nailed into the sensor manager's constructor. That meant every
 * mission, forever, was the same fjord with the same three launchers in the
 * same three places - so variety had to come entirely from objectives, and
 * learning the map once removed most of the tension from all of them.
 *
 * A map is now a piece of data: a height function, a SAM order of battle,
 * and the couple of landmarks a scenario needs to place things relative to.
 * Pure arithmetic, no canvas, no subsystem imports - the navigability
 * guarantees below are unit-tested rather than hoped for.
 *
 * INVARIANTS every map must satisfy (see TerrainProfiles.test.ts):
 *  1. There is a navigable corridor from the carrier at the origin to the
 *     far end of the map, low enough to fly and wide enough to turn in.
 *  2. The approach and departure tube along the deck centreline is clear, so
 *     launch and recovery are never into a cliff.
 *  3. Terrain masking works: somewhere on the corridor, terrain blocks line
 *     of sight to at least one SAM site. Masking is a core mechanic, and a
 *     map that cannot mask silently breaks it.
 */

export interface SamPlacement {
    id: string;
    name: string;
    x: number;
    z: number;
}

export interface TerrainProfile {
    id: MapId;
    name: string;
    /** One line for the mission selector. */
    blurb: string;
    /** Height in metres at any world (x, z). Must be >= 0. */
    heightAt: (x: number, z: number) => number;
    sams: SamPlacement[];
    /**
     * Half-width of the flyable corridor at the carrier's bearing, used by
     * tests and by scenarios placing targets.
     */
    corridorHalfWidth: number;
    /** How far up the corridor the map stays interesting. */
    corridorLength: number;
}

export type MapId = 'FJORD' | 'OPEN_SEA' | 'SHATTERED_RIDGE';

// ---------------------------------------------------------------------
// FJORD - the original map, preserved exactly
// ---------------------------------------------------------------------

/**
 * A single deep slot running north from the carrier with near-vertical
 * walls. One route, no choices, total commitment - which is what makes the
 * strike mission work.
 */
function fjordHeight(worldX: number, worldZ: number): number {
    const distFromCenter = Math.abs(worldX);

    let h = 0;
    if (distFromCenter < 500) {
        h = 15 + Math.sin(worldZ * 0.003) * 10;
    } else {
        const wallFactor = (distFromCenter - 500) / 2000;
        h = 50 + Math.min(1800, wallFactor ** 1.3 * 900);
        h += Math.sin(worldX * 0.002) * 180 + Math.cos(worldZ * 0.0018) * 220;
        h += Math.sin((worldX + worldZ) * 0.004) * 80;
    }

    // Ridge gaps / passes to duck through
    if (Math.sin(worldZ * 0.0012) > 0.7 && distFromCenter < 1800) {
        h *= 0.35;
    }

    return Math.max(0, h);
}

// ---------------------------------------------------------------------
// OPEN SEA - almost nothing to hit
// ---------------------------------------------------------------------

/**
 * Open water with a handful of low skerries. Nowhere to hide, which inverts
 * the fjord's problem: you cannot mask, so the answer to a radar lock is
 * speed, aspect and the bay doors rather than terrain. Also the only sane
 * place to learn to land.
 *
 * Its radars are deliberately SHIP-borne and sit on open water clear of the
 * skerries. A launcher parked on an island peak is masked by its own island
 * the moment it looks across it - which would have quietly given this map
 * the cover its whole identity says it does not have.
 */
function openSeaHeight(worldX: number, worldZ: number): number {
    // A few isolated skerries, each a smooth bump.
    const islands: [number, number, number, number][] = [
        // x, z, radius, peak height
        [-2600, 3200, 900, 260],
        [2300, 5200, 1100, 340],
        [-900, 8100, 800, 200],
        [3100, 9600, 1000, 290]
    ];

    let h = 0;
    for (const [ix, iz, radius, peak] of islands) {
        const d = Math.hypot(worldX - ix, worldZ - iz);
        if (d < radius) {
            // Cosine dome: smooth shoreline, no cliff edge to clip through.
            h = Math.max(h, peak * 0.5 * (1 + Math.cos((d / radius) * Math.PI)));
        }
    }

    // Gentle swell so the sea lattice is not perfectly flat.
    h += Math.sin(worldX * 0.0009) * 3 + Math.cos(worldZ * 0.0011) * 3;
    return Math.max(0, h);
}

// ---------------------------------------------------------------------
// SHATTERED RIDGE - several routes, all of them awkward
// ---------------------------------------------------------------------

/**
 * Parallel ridges running across the ingress track with gaps offset from
 * each other, so the low route weaves instead of running straight. Masking
 * is available but only briefly and only if you are in the right gap - the
 * opposite trade from the fjord, where cover is total but the route is
 * fixed.
 */
function shatteredRidgeHeight(worldX: number, worldZ: number): number {
    // Ridges every ~1800m of Z, each with a gap that walks sideways.
    const ridgePitch = 1800;
    const nearestRidge = Math.round(worldZ / ridgePitch);
    const distToRidge = Math.abs(worldZ - nearestRidge * ridgePitch);

    // Gap centre walks across the map ridge by ridge, but stays inside the
    // corridor half-width this profile advertises - a gap outside it is a gap
    // the mission director and the autopilot will never route you through.
    const gapCentre = Math.sin(nearestRidge * 1.7) * 1000;
    const distToGap = Math.abs(worldX - gapCentre);
    const gapWidth = 800;

    /**
     * The ridge field fades in over open water rather than being clamped off
     * near the boat. A hard clamp left a 300m step at its edge - a wall 1.2km
     * off the bow that appeared out of flat sea on every launch.
     */
    const seaward = Math.min(1, Math.max(0, (worldZ - 2200) / 1200));
    if (seaward <= 0) return 0;

    let h = 0;
    if (distToRidge < 620) {
        const across = 1 - distToRidge / 620;          // 0 at the edge, 1 on the crest
        const ridgeHeight = 620 + Math.sin(worldX * 0.0016 + nearestRidge) * 200;
        h = ridgeHeight * across ** 0.7;

        // Carve the gap: a smooth notch, not a square hole.
        if (distToGap < gapWidth) {
            h *= 0.12 + 0.88 * (distToGap / gapWidth) ** 2;
        }
    }

    // Broken low ground between the ridges.
    h += 20 + Math.sin(worldX * 0.0031) * 18 + Math.cos(worldZ * 0.0027) * 14;

    return Math.max(0, h * seaward);
}

// ---------------------------------------------------------------------

export const MAPS: readonly TerrainProfile[] = [
    {
        id: 'FJORD',
        name: 'BJORNFJORD',
        blurb: 'One deep slot, vertical walls, no second route.',
        heightAt: fjordHeight,
        sams: [
            { id: 'SAM-1', name: 'SA-6 GAINFUL', x: -1800, z: 3500 },
            { id: 'SAM-2', name: 'SA-8 GECKO', x: 1600, z: 6000 },
            { id: 'SAM-3', name: 'SA-11 GADFLY', x: -1200, z: 8500 }
        ],
        corridorHalfWidth: 500,
        corridorLength: 12000
    },
    {
        id: 'OPEN_SEA',
        name: 'NORWEGIAN SEA',
        blurb: 'Open water and a few skerries. Nowhere to hide.',
        heightAt: openSeaHeight,
        sams: [
            { id: 'SAM-1', name: 'SA-N-6 PICKET', x: 2600, z: 6400 },
            { id: 'SAM-2', name: 'SA-N-6 ESCORT', x: -2500, z: 9700 }
        ],
        corridorHalfWidth: 1800,
        corridorLength: 12000
    },
    {
        id: 'SHATTERED_RIDGE',
        name: 'KVITOYA RIDGES',
        blurb: 'Ridge after ridge, each gap offset from the last.',
        heightAt: shatteredRidgeHeight,
        sams: [
            { id: 'SAM-1', name: 'SA-6 GAINFUL', x: 900, z: 3100 },
            { id: 'SAM-2', name: 'SA-8 GECKO', x: -1500, z: 5400 },
            { id: 'SAM-3', name: 'SA-11 GADFLY', x: 400, z: 7900 },
            { id: 'SAM-4', name: 'SA-6 GAINFUL', x: -2100, z: 10200 }
        ],
        corridorHalfWidth: 1400,
        corridorLength: 12000
    }
];

export const DEFAULT_MAP: MapId = 'FJORD';

export function mapById(id: MapId): TerrainProfile {
    return MAPS.find(m => m.id === id) ?? MAPS[0];
}
