/**
 * CARRIER VECTOR: 1988 - Tactical Terrain, Radar Line-of-Sight & RWR Engine
 * Implements:
 * - Procedural wireframe terrain (canyons, ridges, valleys)
 * - Ground SAM radar nodes
 * - Line-of-Sight (LOS) raycasting for terrain masking
 * - Effective Radar Cross Section (RCS) calculation based on aspect and bay door state:
 *   RCS_effective = RCS_base * Aspect Factor * (Bay Open ? 4.0 : 1.0)
 * - RWR threat detection and azimuth computation
 */

import { AircraftPhysics } from '../flight/AircraftPhysics';
import type { Vector3 } from '../flight/AircraftPhysics';
import { VectorRenderer } from '../renderer/VectorRenderer';

export type RadarThreatState = 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH';

export interface ThreatContact {
    id: string;
    name: string;
    position: Vector3;
    state: RadarThreatState;
    azimuthDeg: number; // -180 to +180 relative to aircraft nose
    distance: number;   // meters
    isTerrainMasked: boolean;
    missileActive: boolean;
    missilePos?: Vector3;
    missileVel?: Vector3;
}

export class TacticalTerrain {
    public readonly widthCells = 40;
    public readonly depthCells = 50;
    public readonly cellSize = 250; // 250m per cell -> 10km x 12.5km terrain
    public heights: number[][] = [];

    constructor() {
        this.generateTerrain();
    }

    private generateTerrain() {
        for (let x = 0; x <= this.widthCells; x++) {
            this.heights[x] = [];
            for (let z = 0; z <= this.depthCells; z++) {
                const worldX = (x - this.widthCells / 2) * this.cellSize;
                const worldZ = z * this.cellSize;

                // Valley corridor down the center (X ~ 0)
                const distFromCenter = Math.abs(worldX);
                
                // Canyon walls rise steeply outside the 800m center slot
                let h = 0;
                if (distFromCenter < 500) {
                    // Sea level / canyon floor
                    h = 15 + Math.sin(worldZ * 0.003) * 10;
                } else {
                    const wallFactor = (distFromCenter - 500) / 2000;
                    h = 50 + Math.min(1800, wallFactor ** 1.3 * 900);
                    // Add mountain ridges & peaks
                    h += Math.sin(worldX * 0.002) * 180 + Math.cos(worldZ * 0.0018) * 220;
                    h += Math.sin((worldX + worldZ) * 0.004) * 80;
                }

                // Ridge gaps / passes to duck through
                if (Math.sin(worldZ * 0.0012) > 0.7 && distFromCenter < 1800) {
                    h *= 0.35; // Valley pass
                }

                this.heights[x][z] = Math.max(0, h);
            }
        }
    }

    /**
     * Continuous bilinear interpolation of terrain height at any world (x, z)
     */
    public getElevation(x: number, z: number): number {
        const originX = -(this.widthCells * this.cellSize) / 2;
        const gridX = (x - originX) / this.cellSize;
        const gridZ = z / this.cellSize;

        if (gridX < 0 || gridX >= this.widthCells || gridZ < 0 || gridZ >= this.depthCells) {
            return 0; // Sea / baseline
        }

        const x0 = Math.floor(gridX);
        const x1 = Math.min(this.widthCells, x0 + 1);
        const z0 = Math.floor(gridZ);
        const z1 = Math.min(this.depthCells, z0 + 1);

        const fx = gridX - x0;
        const fz = gridZ - z0;

        const h00 = this.heights[x0][z0];
        const h10 = this.heights[x1][z0];
        const h01 = this.heights[x0][z1];
        const h11 = this.heights[x1][z1];

        // Bilinear interpolation
        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;
        return h0 * (1 - fz) + h1 * fz;
    }

    /**
     * Render the vector wireframe terrain
     */
    public render(renderer: VectorRenderer, camPos: Vector3, camPitch: number, camYaw: number, camRoll: number) {
        const originX = -(this.widthCells * this.cellSize) / 2;
        const maxDrawDist = 8000;

        // Draw Z longitudinal lines
        for (let x = 0; x <= this.widthCells; x += 2) {
            const wx = originX + x * this.cellSize;
            for (let z = 0; z < this.depthCells; z += 2) {
                const wz1 = z * this.cellSize;
                const wz2 = (z + 2) * this.cellSize;

                // Distance culling
                const d1 = Math.hypot(wx - camPos.x, wz1 - camPos.z);
                if (d1 > maxDrawDist) continue;

                const p1: Vector3 = { x: wx, y: this.heights[x][z], z: wz1 };
                const p2: Vector3 = { x: wx, y: this.heights[x][Math.min(this.depthCells, z + 2)], z: wz2 };

                // Color depends on altitude: bright green for high ridges, dark amber/green for valleys
                const isRidge = p1.y > 600 || p2.y > 600;
                const color = isRidge ? '#33aa33' : '#004400';
                renderer.drawLine(p1, p2, camPos, camPitch, camYaw, camRoll, color);
            }
        }

        // Draw X transversal lines
        for (let z = 0; z <= this.depthCells; z += 2) {
            const wz = z * this.cellSize;
            if (Math.abs(wz - camPos.z) > maxDrawDist) continue;

            for (let x = 0; x < this.widthCells; x += 2) {
                const wx1 = originX + x * this.cellSize;
                const wx2 = originX + (x + 2) * this.cellSize;

                const p1: Vector3 = { x: wx1, y: this.heights[x][z], z: wz };
                const p2: Vector3 = { x: wx2, y: this.heights[Math.min(this.widthCells, x + 2)][z], z: wz };

                const isRidge = p1.y > 600 || p2.y > 600;
                const color = isRidge ? '#33aa33' : '#004400';
                renderer.drawLine(p1, p2, camPos, camPitch, camYaw, camRoll, color);
            }
        }
    }
}

export class SAMSite {
    public id: string;
    public name: string;
    public position: Vector3;
    public maxSearchRange = 12000;
    public maxTrackRange = 7500;
    public maxLaunchRange = 5000;
    public missileActive = false;
    public missilePos: Vector3 = { x: 0, y: 0, z: 0 };
    public missileVel: Vector3 = { x: 0, y: 0, z: 0 };
    public missileFuel = 12.0; // seconds

    constructor(id: string, name: string, x: number, z: number, terrain: TacticalTerrain) {
        this.id = id;
        this.name = name;
        const elevation = terrain.getElevation(x, z);
        this.position = { x, y: elevation + 5, z };
    }
}

export class SensorTacticsManager {
    public terrain: TacticalTerrain;
    public samSites: SAMSite[] = [];
    public baseRCS: number = 2.4; // m^2 (F/A-18 clean)

    // Current threat status
    public activeThreats: ThreatContact[] = [];
    public masterRwrState: RadarThreatState = 'SILENT';
    public highestThreatAzimuth: number = 0;

    constructor(terrain: TacticalTerrain) {
        this.terrain = terrain;
        // Place SAM sites on ridges overlooking the canyon
        this.samSites.push(new SAMSite('SAM-1', 'SA-6 GAINFUL', -1800, 3500, terrain));
        this.samSites.push(new SAMSite('SAM-2', 'SA-8 GECKO', 1600, 6000, terrain));
        this.samSites.push(new SAMSite('SAM-3', 'SA-11 GADFLY', -1200, 8500, terrain));
    }

    /**
     * Ray-terrain intersection for line-of-sight check
     * Returns true if clear line-of-sight, false if occluded (Terrain Masked).
     */
    public checkLOS(radarPos: Vector3, targetPos: Vector3): boolean {
        const dx = targetPos.x - radarPos.x;
        const dy = targetPos.y - radarPos.y;
        const dz = targetPos.z - radarPos.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 10) return true;

        const stepSize = 40; // sample every 40m
        const steps = Math.max(2, Math.floor(dist / stepSize));

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const rx = radarPos.x + dx * t;
            const ry = radarPos.y + dy * t;
            const rz = radarPos.z + dz * t;

            const terrainAlt = this.terrain.getElevation(rx, rz);
            if (ry < terrainAlt) {
                return false; // Terrain occluded!
            }
        }
        return true;
    }

    /**
     * Calculate effective Radar Cross Section:
     * RCS_effective = RCS_base * Aspect Factor * (Bay Open ? 4.0 : 1.0)
     */
    public calculateEffectiveRCS(aircraft: AircraftPhysics, radarPos: Vector3): number {
        // Vector from aircraft to radar
        const toRadarX = radarPos.x - aircraft.position.x;
        const toRadarZ = radarPos.z - aircraft.position.z;
        const toRadarDist = Math.hypot(toRadarX, toRadarZ);

        if (toRadarDist < 1) return this.baseRCS;

        const dirX = toRadarX / toRadarDist;
        const dirZ = toRadarZ / toRadarDist;

        // Aircraft horizontal forward vector
        const fwdX = Math.sin(aircraft.yaw);
        const fwdZ = Math.cos(aircraft.yaw);

        // Dot product gives cosine of aspect angle
        const dot = Math.max(-1, Math.min(1, dirX * fwdX + dirZ * fwdZ));
        const aspectAngle = Math.acos(dot); // 0 = head on, pi = tail on, pi/2 = beam

        // Aspect factor:
        // Head-on (0): 0.7x
        // Beam (pi/2): 2.2x
        // Tail-on (pi): 1.4x
        const beamFactor = Math.abs(Math.sin(aspectAngle)) * 1.5;
        const headTailFactor = dot > 0 ? (1 - dot) * 0.7 + dot * 0.5 : Math.abs(dot) * 1.4;
        const aspectFactor = Math.max(0.5, headTailFactor + beamFactor);

        const bayMultiplier = aircraft.bayOpen ? 4.0 : 1.0;
        return this.baseRCS * aspectFactor * bayMultiplier;
    }

    /**
     * Update sensor network and calculate RWR signals
     */
    public update(dt: number, aircraft: AircraftPhysics) {
        this.activeThreats = [];
        let maxStateScore = 0;
        const stateScoreMap: Record<RadarThreatState, number> = {
            'SILENT': 0,
            'SEARCH': 1,
            'TRACK': 2,
            'LAUNCH': 3
        };

        for (const sam of this.samSites) {
            const dx = aircraft.position.x - sam.position.x;
            const dy = aircraft.position.y - sam.position.y;
            const dz = aircraft.position.z - sam.position.z;
            const distance = Math.hypot(dx, dy, dz);

            // 1. Line of Sight
            const hasLOS = this.checkLOS(sam.position, aircraft.position);
            const isTerrainMasked = !hasLOS;

            // 2. RCS
            const effectiveRCS = this.calculateEffectiveRCS(aircraft, sam.position);
            // Effective radar range scaled by 4th root of RCS (Radar range equation)
            const rcsScale = (effectiveRCS / this.baseRCS) ** 0.25;

            const searchRange = sam.maxSearchRange * rcsScale;
            const trackRange = sam.maxTrackRange * rcsScale;
            const launchRange = sam.maxLaunchRange * rcsScale;

            let threatState: RadarThreatState = 'SILENT';

            if (hasLOS) {
                if (distance <= launchRange) {
                    threatState = 'LAUNCH';
                    if (!sam.missileActive) {
                        sam.missileActive = true;
                        sam.missilePos = { ...sam.position };
                        sam.missileFuel = 10.0;
                    }
                } else if (distance <= trackRange) {
                    threatState = 'TRACK';
                } else if (distance <= searchRange) {
                    threatState = 'SEARCH';
                }
            } else {
                // Terrain masked breaks lock!
                threatState = 'SILENT';
            }

            // Update missile physics if in flight
            if (sam.missileActive && sam.missilePos) {
                sam.missileFuel -= dt;
                if (sam.missileFuel <= 0 || !hasLOS) {
                    // Lost track or burnt out
                    sam.missileActive = false;
                } else {
                    // Guide towards aircraft
                    const mdx = aircraft.position.x - sam.missilePos.x;
                    const mdy = aircraft.position.y - sam.missilePos.y;
                    const mdz = aircraft.position.z - sam.missilePos.z;
                    const mDist = Math.hypot(mdx, mdy, mdz);

                    const missileSpeed = 480; // m/s (~Mach 1.5)
                    sam.missileVel = {
                        x: (mdx / mDist) * missileSpeed,
                        y: (mdy / mDist) * missileSpeed,
                        z: (mdz / mDist) * missileSpeed
                    };

                    sam.missilePos.x += sam.missileVel.x * dt;
                    sam.missilePos.y += sam.missileVel.y * dt;
                    sam.missilePos.z += sam.missileVel.z * dt;
                }
            }

            // Calculate azimuth relative to aircraft heading
            const toSamX = sam.position.x - aircraft.position.x;
            const toSamZ = sam.position.z - aircraft.position.z;
            const worldBearing = Math.atan2(toSamX, toSamZ); // 0 = North(+Z), +pi/2 = East(+X)
            let relAzimuth = worldBearing - aircraft.yaw;

            // Wrap to [-pi, pi]
            while (relAzimuth > Math.PI) relAzimuth -= Math.PI * 2;
            while (relAzimuth < -Math.PI) relAzimuth += Math.PI * 2;
            const relAzimuthDeg = relAzimuth * (180 / Math.PI);

            this.activeThreats.push({
                id: sam.id,
                name: sam.name,
                position: sam.position,
                state: threatState,
                azimuthDeg: relAzimuthDeg,
                distance,
                isTerrainMasked,
                missileActive: sam.missileActive,
                missilePos: sam.missilePos,
                missileVel: sam.missileVel
            });

            const score = stateScoreMap[threatState];
            if (score > maxStateScore) {
                maxStateScore = score;
                this.masterRwrState = threatState;
                this.highestThreatAzimuth = relAzimuthDeg;
            }
        }

        if (maxStateScore === 0) {
            this.masterRwrState = 'SILENT';
        }
    }
}
