import { describe, it, expect } from 'vitest';
import { DEFAULT_MAP, MAPS, mapById } from './TerrainProfiles';
import { TacticalTerrain, SensorTacticsManager } from './RadarLOS';

describe('map catalogue', () => {
    it('has unique ids and names, and a usable default', () => {
        expect(new Set(MAPS.map(m => m.id)).size).toBe(MAPS.length);
        expect(new Set(MAPS.map(m => m.name)).size).toBe(MAPS.length);
        expect(mapById(DEFAULT_MAP).id).toBe(DEFAULT_MAP);
    });

    it('falls back to the first map for an unknown id', () => {
        expect(mapById('NOWHERE' as never).id).toBe(MAPS[0].id);
    });

    it('describes every map for the selector', () => {
        for (const m of MAPS) {
            expect(m.blurb.length, m.id).toBeGreaterThan(0);
            expect(m.sams.length, m.id).toBeGreaterThan(0);
            expect(new Set(m.sams.map(s => s.id)).size, `${m.id} sam ids`).toBe(m.sams.length);
        }
    });
});

/**
 * These are the guarantees that make a map safe to ship. The original single
 * map satisfied them by construction; a new one can quietly break any of them
 * and the failure looks like "the game is broken", not "the map is wrong".
 */
describe('map invariants', () => {
    it('never produces a negative or non-finite height', () => {
        for (const m of MAPS) {
            for (let x = -6000; x <= 6000; x += 250) {
                for (let z = -1000; z <= 13000; z += 250) {
                    const h = m.heightAt(x, z);
                    expect(Number.isFinite(h), `${m.id} @ ${x},${z}`).toBe(true);
                    expect(h, `${m.id} @ ${x},${z}`).toBeGreaterThanOrEqual(0);
                }
            }
        }
    });

    // Launch and recovery both happen at the origin, along the deck centreline.
    // Terrain in that tube is fatal on every single sortie. (The fjord's walls
    // legitimately start 500m off the centreline, so the tube is the deck
    // corridor, not a box around the whole ship.)
    it('keeps the approach and departure tube clear', () => {
        for (const m of MAPS) {
            for (let x = -300; x <= 300; x += 50) {
                for (let z = -3000; z <= 1500; z += 100) {
                    expect(m.heightAt(x, z), `${m.id} @ ${x},${z}`).toBeLessThan(40);
                }
            }
        }
    });

    it('leaves a low, continuous corridor from the carrier up the map', () => {
        for (const m of MAPS) {
            for (let z = 0; z <= m.corridorLength; z += 250) {
                // Somewhere within the corridor half-width there must be a
                // height a jet can fly over comfortably.
                let lowest = Infinity;
                for (let x = -m.corridorHalfWidth; x <= m.corridorHalfWidth; x += 100) {
                    lowest = Math.min(lowest, m.heightAt(x, z));
                }
                expect(lowest, `${m.id} corridor @ z=${z}`).toBeLessThan(220);
            }
        }
    });

    it('gives the corridor room to manoeuvre, not a one-metre slot', () => {
        for (const m of MAPS) {
            for (let z = 500; z <= m.corridorLength; z += 500) {
                let flyableWidth = 0;
                for (let x = -m.corridorHalfWidth; x <= m.corridorHalfWidth; x += 50) {
                    if (m.heightAt(x, z) < 220) flyableWidth += 50;
                }
                expect(flyableWidth, `${m.id} flyable width @ z=${z}`).toBeGreaterThanOrEqual(300);
            }
        }
    });

    it('samples onto the terrain grid without losing the corridor', () => {
        for (const m of MAPS) {
            const terrain = new TacticalTerrain(m.id);
            for (let z = 0; z <= 11000; z += 500) {
                let lowest = Infinity;
                for (let x = -m.corridorHalfWidth; x <= m.corridorHalfWidth; x += 125) {
                    lowest = Math.min(lowest, terrain.getElevation(x, z));
                }
                expect(lowest, `${m.id} sampled corridor @ z=${z}`).toBeLessThan(260);
            }
        }
    });

    it('places every SAM site on its own map, above the waterline', () => {
        for (const m of MAPS) {
            const terrain = new TacticalTerrain(m.id);
            const sensors = new SensorTacticsManager(terrain);
            expect(sensors.samSites.map(s => s.id)).toEqual(m.sams.map(s => s.id));
            for (const site of sensors.samSites) {
                expect(site.position.y, `${m.id}/${site.id}`).toBeGreaterThan(0);
            }
        }
    });
});

/**
 * Terrain masking is a core mechanic: drop below a ridge and the lock breaks.
 * A map on which nothing ever blocks line of sight silently disables it.
 */
describe('terrain masking is possible on every map that claims cover', () => {
    it('blocks line of sight somewhere along the corridor', () => {
        for (const m of MAPS) {
            // OPEN_SEA is deliberately exposed - that is its whole identity -
            // so it is exempt, and the test says so rather than skipping it.
            if (m.id === 'OPEN_SEA') continue;

            const terrain = new TacticalTerrain(m.id);
            const sensors = new SensorTacticsManager(terrain);

            let maskedSomewhere = false;
            for (let z = 1000; z <= 11000 && !maskedSomewhere; z += 250) {
                for (let x = -m.corridorHalfWidth; x <= m.corridorHalfWidth; x += 250) {
                    const ground = terrain.getElevation(x, z);
                    const low = { x, y: ground + 40, z };
                    if (sensors.samSites.some(s => !sensors.checkLOS(s.position, low))) {
                        maskedSomewhere = true;
                        break;
                    }
                }
            }
            expect(maskedSomewhere, `${m.id} offers no terrain masking`).toBe(true);
        }
    });

    it('leaves the open sea exposed, as designed', () => {
        const terrain = new TacticalTerrain('OPEN_SEA');
        const sensors = new SensorTacticsManager(terrain);
        // Straight down the middle at 200m, every launcher should see you.
        const exposed = { x: 0, y: 200, z: 6000 };
        expect(sensors.samSites.every(s => sensors.checkLOS(s.position, exposed))).toBe(true);
    });
});
