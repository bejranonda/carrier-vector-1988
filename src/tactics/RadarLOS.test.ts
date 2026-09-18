import { describe, it, expect, beforeEach } from 'vitest';
import { TacticalTerrain, SensorTacticsManager } from './RadarLOS';
import { AircraftPhysics } from '../flight/AircraftPhysics';

describe('Tactical Radar LOS & RCS Engine', () => {
    let terrain: TacticalTerrain;
    let sensors: SensorTacticsManager;
    let aircraft: AircraftPhysics;

    beforeEach(() => {
        terrain = new TacticalTerrain();
        sensors = new SensorTacticsManager(terrain);
        aircraft = new AircraftPhysics();
    });

    it('should generate lower elevation in canyon center and higher elevation on ridges', () => {
        const canyonAlt = terrain.getElevation(0, 2000); // Center canyon
        const ridgeAlt = terrain.getElevation(2500, 2000); // Ridge wall
        expect(canyonAlt).toBeLessThan(100);
        expect(ridgeAlt).toBeGreaterThan(400);
    });

    it('should detect terrain masking when flying below ridge lines', () => {
        // SAM-1 is at x=-1800, z=3500 on a ridge
        const samPos = sensors.samSites[0].position;

        // Place aircraft at x=1800 (opposite side of canyon), down in the canyon floor
        const maskedPos = { x: 1800, y: 30, z: 3500 };
        const hasLOSMasked = sensors.checkLOS(samPos, maskedPos);
        // Should be masked by the intervening ridges/walls
        expect(hasLOSMasked).toBe(false);

        // Place aircraft high in the sky (e.g. 3000m)
        const highPos = { x: 1800, y: 3000, z: 3500 };
        const hasLOSHigh = sensors.checkLOS(samPos, highPos);
        expect(hasLOSHigh).toBe(true);
    });

    it('should multiply effective RCS by 4.0 when weapons bay doors are open', () => {
        aircraft.position = { x: 0, y: 1000, z: 0 };
        aircraft.yaw = 0; // heading North (+Z)
        const radarPos = { x: 0, y: 100, z: 5000 }; // ahead of aircraft

        aircraft.bayOpen = false;
        const rcsClosed = sensors.calculateEffectiveRCS(aircraft, radarPos);

        aircraft.bayOpen = true;
        const rcsOpen = sensors.calculateEffectiveRCS(aircraft, radarPos);

        expect(rcsOpen / rcsClosed).toBeCloseTo(4.0, 2);
    });

    it('should update RWR state to LAUNCH when within SAM envelope and clear LOS', () => {
        // Place aircraft right near SAM-1 with high altitude so LOS is clear
        const sam1 = sensors.samSites[0];
        aircraft.position = { x: sam1.position.x + 500, y: sam1.position.y + 1000, z: sam1.position.z + 500 };
        aircraft.yaw = 0;

        sensors.update(0.1, aircraft);
        expect(sensors.masterRwrState).toBe('LAUNCH');
    });

    it('should break radar lock and return to SILENT when aircraft dives into terrain mask', () => {
        // Masked position
        aircraft.position = { x: 1800, y: 20, z: 3500 };
        sensors.update(0.1, aircraft);

        // For SAM-1, it should be terrain masked
        const sam1Contact = sensors.activeThreats.find(t => t.id === 'SAM-1');
        expect(sam1Contact?.isTerrainMasked).toBe(true);
        expect(sam1Contact?.state).toBe('SILENT');
    });
});
