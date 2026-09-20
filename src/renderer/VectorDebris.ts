/**
 * CARRIER VECTOR: 1988 - 3D Vector Line Fragmentation Debris Physics
 *
 * When an airborne aircraft, SAM launcher, or strike target is destroyed,
 * it shatters into physical 3D wireframe line segments that inherit parent
 * momentum, burst outward with explosive velocity, tumble in 3D space,
 * and arc ballistically toward the sea/terrain under gravity and drag.
 *
 * Pure physics & simulation logic decoupled from Canvas2D for 100% headless testing.
 */

import type { Vector3 } from '../flight/AircraftPhysics';
import type { WireframeLine } from './VectorRenderer';

export interface DebrisFragment {
    p1: Vector3;
    p2: Vector3;
    vel: Vector3;
    rotAxis: Vector3;
    rotSpeed: number; // rad/s
    life: number;     // seconds remaining
    maxLife: number;  // initial duration (seconds)
    color: string;
}

export const DEBRIS_CONFIG = {
    DEFAULT_LIFESPAN: 1.2, // seconds
    MIN_FRAGMENTS: 10,
    MAX_FRAGMENTS: 16,
    MIN_BLAST_SPEED: 15.0, // m/s
    MAX_BLAST_SPEED: 40.0, // m/s
    GRAVITY: 9.81,          // m/s^2
    DRAG_COEFFICIENT: 0.35, // 1/s
    MAX_ACTIVE_FRAGMENTS: 128
} as const;

/** Rotate vector v around unit axis by angle theta using Rodrigues' formula */
export function rotateAroundAxis(v: Vector3, axis: Vector3, theta: number): Vector3 {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const dot = v.x * axis.x + v.y * axis.y + v.z * axis.z;
    const crossX = axis.y * v.z - axis.z * v.y;
    const crossY = axis.z * v.x - axis.x * v.z;
    const crossZ = axis.x * v.y - axis.y * v.x;

    return {
        x: v.x * cosT + crossX * sinT + axis.x * dot * (1 - cosT),
        y: v.y * cosT + crossY * sinT + axis.y * dot * (1 - cosT),
        z: v.z * cosT + crossZ * sinT + axis.z * dot * (1 - cosT)
    };
}

export class VectorDebrisSystem {
    public fragments: DebrisFragment[] = [];

    /**
     * Shatter a destroyed object into 3D physical line fragments.
     * Takes existing wireframe lines if available, or generates synthetic lines
     * centered at the explosion position.
     */
    public spawnFromMesh(
        sourceLines: WireframeLine[],
        center: Vector3,
        parentVelocity: Vector3 = { x: 0, y: 0, z: 0 },
        defaultColor: string = '#ff5522',
        fragmentCount: number = 14
    ): void {
        const count = Math.min(
            DEBRIS_CONFIG.MAX_FRAGMENTS,
            Math.max(DEBRIS_CONFIG.MIN_FRAGMENTS, fragmentCount)
        );

        // If we exceed capacity, drop oldest fragments
        while (this.fragments.length + count > DEBRIS_CONFIG.MAX_ACTIVE_FRAGMENTS) {
            this.fragments.shift();
        }

        for (let i = 0; i < count; i++) {
            // Random unit radial blast vector
            const u = Math.random() * 2 - 1;
            const phi = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.max(0, 1 - u * u));
            const blastDir: Vector3 = {
                x: r * Math.cos(phi),
                y: Math.abs(u) * 0.7 + 0.3, // Bias slightly upward for explosive arc
                z: r * Math.sin(phi)
            };

            const blastSpeed = DEBRIS_CONFIG.MIN_BLAST_SPEED +
                Math.random() * (DEBRIS_CONFIG.MAX_BLAST_SPEED - DEBRIS_CONFIG.MIN_BLAST_SPEED);

            const vel: Vector3 = {
                x: parentVelocity.x + blastDir.x * blastSpeed,
                y: parentVelocity.y + blastDir.y * blastSpeed,
                z: parentVelocity.z + blastDir.z * blastSpeed
            };

            // Random rotation axis (normalized)
            const ru = Math.random() * 2 - 1;
            const rphi = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.max(0, 1 - ru * ru));
            const rotAxis: Vector3 = {
                x: rr * Math.cos(rphi),
                y: ru,
                z: rr * Math.sin(rphi)
            };
            const rotSpeed = 3.0 + Math.random() * 8.0; // rad/s

            let p1: Vector3;
            let p2: Vector3;
            let color = defaultColor;

            if (sourceLines.length > 0) {
                const src = sourceLines[i % sourceLines.length];
                color = src.color || defaultColor;
                // Offset source segment to world center
                p1 = {
                    x: center.x + src.p1.x,
                    y: center.y + src.p1.y,
                    z: center.z + src.p1.z
                };
                p2 = {
                    x: center.x + src.p2.x,
                    y: center.y + src.p2.y,
                    z: center.z + src.p2.z
                };
            } else {
                // Synthesize a 3-8 meter tumbling line segment
                const len = 3.0 + Math.random() * 5.0;
                p1 = {
                    x: center.x - rotAxis.x * (len * 0.5),
                    y: center.y - rotAxis.y * (len * 0.5),
                    z: center.z - rotAxis.z * (len * 0.5)
                };
                p2 = {
                    x: center.x + rotAxis.x * (len * 0.5),
                    y: center.y + rotAxis.y * (len * 0.5),
                    z: center.z + rotAxis.z * (len * 0.5)
                };
            }

            this.fragments.push({
                p1,
                p2,
                vel,
                rotAxis,
                rotSpeed,
                life: DEBRIS_CONFIG.DEFAULT_LIFESPAN,
                maxLife: DEBRIS_CONFIG.DEFAULT_LIFESPAN,
                color
            });
        }
    }

    /** Advance debris simulation by dt seconds */
    public update(dt: number, getElevation?: (x: number, z: number) => number): void {
        const g = DEBRIS_CONFIG.GRAVITY;
        const drag = Math.max(0, 1.0 - DEBRIS_CONFIG.DRAG_COEFFICIENT * dt);

        for (let i = 0; i < this.fragments.length; i++) {
            const f = this.fragments[i];

            // 1. Semi-implicit Euler integration for velocity
            f.vel.y -= g * dt;
            f.vel.x *= drag;
            f.vel.y *= drag;
            f.vel.z *= drag;

            // 2. Translation
            const dx = f.vel.x * dt;
            const dy = f.vel.y * dt;
            const dz = f.vel.z * dt;
            f.p1.x += dx; f.p1.y += dy; f.p1.z += dz;
            f.p2.x += dx; f.p2.y += dy; f.p2.z += dz;

            // 3. 3D Angular Tumble around segment midpoint
            const mx = (f.p1.x + f.p2.x) * 0.5;
            const my = (f.p1.y + f.p2.y) * 0.5;
            const mz = (f.p1.z + f.p2.z) * 0.5;

            const h1: Vector3 = { x: f.p1.x - mx, y: f.p1.y - my, z: f.p1.z - mz };
            const rotH = rotateAroundAxis(h1, f.rotAxis, f.rotSpeed * dt);

            f.p1.x = mx + rotH.x;
            f.p1.y = my + rotH.y;
            f.p1.z = mz + rotH.z;

            f.p2.x = mx - rotH.x;
            f.p2.y = my - rotH.y;
            f.p2.z = mz - rotH.z;

            // 4. Ground/Water collision handling
            if (getElevation) {
                const elev = getElevation(mx, mz);
                if (my <= elev) {
                    // Hit ground: accelerate decay
                    f.life -= dt * 2.5;
                    f.vel.x *= 0.2;
                    f.vel.z *= 0.2;
                    f.vel.y = 0;
                }
            } else if (my <= 0) {
                // Sea level impact
                f.life -= dt * 2.5;
                f.vel.x *= 0.2;
                f.vel.z *= 0.2;
                f.vel.y = 0;
            }

            // 5. Lifespan decay
            f.life -= dt;
        }

        // Remove dead fragments
        this.fragments = this.fragments.filter(f => f.life > 0);
    }

    public clear(): void {
        this.fragments = [];
    }
}
