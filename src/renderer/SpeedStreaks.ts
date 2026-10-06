/**
 * CARRIER VECTOR: 1988 - Speed Streaks
 *
 * At 2,500 ft over open water the wireframe world barely moves: the sea grid
 * is far below, the ridges are kilometres off, and 450 knots read like a
 * hover. Every arcade flier sells speed with particles streaming past the
 * canopy; this is that, in the game's own vocabulary - short vector dashes,
 * in world space, that the jet flies through.
 *
 * A fixed pool of points lives in a box round the camera. Each frame they are
 * drawn as a dash along the jet's velocity (longer the faster it goes), and a
 * point that falls behind or out of the box is re-seeded ahead. Pure state
 * plus one draw call per streak; nothing touches the simulation.
 */

import type { Vector3 } from '../flight/AircraftPhysics';

export const STREAK_TUNING = {
    count: 70,
    /** Half-size of the box the streaks live in, metres. */
    radius: 260,
    /** Streak length per m/s of airspeed, metres. */
    lengthPerSpeed: 0.12,
    /** Below this airspeed the streaks fade out entirely, m/s. */
    minSpeed: 90
} as const;

export class SpeedStreaks {
    public points: Vector3[] = [];
    private seed = 12345;

    private rand(): number {
        // Tiny LCG: deterministic, allocation-free, good enough for dust.
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }

    /** Place a point somewhere in the box round `cam`, biased ahead along `dir`. */
    private spawn(cam: Vector3, dir: Vector3, ahead: boolean): Vector3 {
        const r = STREAK_TUNING.radius;
        const lead = ahead ? r * (0.4 + this.rand() * 0.6) : (this.rand() * 2 - 1) * r;
        return {
            x: cam.x + dir.x * lead + (this.rand() * 2 - 1) * r,
            y: cam.y + dir.y * lead + (this.rand() * 2 - 1) * r * 0.6,
            z: cam.z + dir.z * lead + (this.rand() * 2 - 1) * r
        };
    }

    /**
     * Keep the pool inside the box. `velocity` is the jet's; a point more than
     * a box behind the camera, or outside it sideways, is re-seeded ahead.
     */
    public update(cam: Vector3, velocity: Vector3) {
        const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
        const dir = speed > 1
            ? { x: velocity.x / speed, y: velocity.y / speed, z: velocity.z / speed }
            : { x: 0, y: 0, z: 1 };
        if (this.points.length !== STREAK_TUNING.count) {
            this.points = Array.from({ length: STREAK_TUNING.count }, () => this.spawn(cam, dir, false));
        }
        const r = STREAK_TUNING.radius;
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            const dx = p.x - cam.x;
            const dy = p.y - cam.y;
            const dz = p.z - cam.z;
            const along = dx * dir.x + dy * dir.y + dz * dir.z;
            if (along < -r * 0.3 || Math.abs(dx) > r * 1.6 || Math.abs(dy) > r * 1.6 || Math.abs(dz) > r * 1.6) {
                this.points[i] = this.spawn(cam, dir, true);
            }
        }
    }

    /** 0..1 visibility for this airspeed. */
    public static intensity(speed: number): number {
        return Math.max(0, Math.min(1, (speed - STREAK_TUNING.minSpeed) / 200));
    }

    /** The dash for point `p` at this velocity: from p, back along the flight path. */
    public static tail(p: Vector3, velocity: Vector3): Vector3 {
        const k = STREAK_TUNING.lengthPerSpeed;
        return { x: p.x - velocity.x * k, y: p.y - velocity.y * k, z: p.z - velocity.z * k };
    }
}
