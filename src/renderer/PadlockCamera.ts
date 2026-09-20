/**
 * CARRIER VECTOR: 1988 - Padlock Target-Tracking Camera Mode ('V' Key)
 *
 * In aerial combat, "Lose sight, lose the fight." The padlock camera mode
 * slaves the pilot's visual line-of-sight toward the currently designated
 * hostile contact, allowing the player to maintain visual tracking through
 * high-G scissor maneuvers and turning dogfights.
 *
 * Critical architectural rules:
 * 1. Physical 6-DOF aircraft basis remains strictly invariant (camera offsets only).
 * 2. Slaved angles are clamped to human canopy physical boundaries
 *    (-110° to +110° azimuth, -30° to +60° elevation).
 * 3. Smooth 250ms ease-out cubic transition when engaging or disengaging.
 * 4. 100% pure linear algebra, decoupled from Canvas2D for headless testing.
 */

import type { Vector3 } from '../flight/AircraftPhysics';

export const PADLOCK_LIMITS = {
    MAX_AZIMUTH_RAD: (110 * Math.PI) / 180, // +/- 110 deg
    MIN_ELEVATION_RAD: (-30 * Math.PI) / 180, // -30 deg
    MAX_ELEVATION_RAD: (60 * Math.PI) / 180, // +60 deg
    TRANSITION_TIME_SEC: 0.25
} as const;

export interface CameraBasisVectors {
    forward: Vector3;
    up: Vector3;
    right: Vector3;
}

export function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

/** Ease-out cubic interpolation curve f(t) = 1 - (1 - t)^3 */
export function easeOutCubic(t: number): number {
    const clampedT = clamp(t, 0, 1);
    const inv = 1 - clampedT;
    return 1 - inv * inv * inv;
}

export class PadlockCamera {
    public isEnabled: boolean = false;
    public isPadlocked: boolean = false;
    public currentYawOffset: number = 0;   // radians relative to body boresight
    public currentPitchOffset: number = 0; // radians relative to body boresight

    private fromYaw: number = 0;
    private fromPitch: number = 0;
    private targetYaw: number = 0;
    private targetPitch: number = 0;
    private transitionElapsed: number = PADLOCK_LIMITS.TRANSITION_TIME_SEC;

    public toggle(): boolean {
        this.setEnabled(!this.isEnabled);
        return this.isEnabled;
    }

    public setEnabled(enabled: boolean): void {
        if (this.isEnabled !== enabled) {
            this.isEnabled = enabled;
            this.fromYaw = this.currentYawOffset;
            this.fromPitch = this.currentPitchOffset;
            this.transitionElapsed = 0;
        }
    }

    /**
     * Calculate body-relative target angles in radians.
     */
    public calculateTargetAngles(
        aircraftPos: Vector3,
        basis: CameraBasisVectors,
        targetPos: Vector3
    ): { azimuth: number; elevation: number } {
        const dx = targetPos.x - aircraftPos.x;
        const dy = targetPos.y - aircraftPos.y;
        const dz = targetPos.z - aircraftPos.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 0.001) {
            return { azimuth: 0, elevation: 0 };
        }

        // Project relative line-of-sight onto body basis
        const losX = dx / dist;
        const losY = dy / dist;
        const losZ = dz / dist;

        const fwdProj = losX * basis.forward.x + losY * basis.forward.y + losZ * basis.forward.z;
        const rightProj = losX * basis.right.x + losY * basis.right.y + losZ * basis.right.z;
        const upProj = losX * basis.up.x + losY * basis.up.y + losZ * basis.up.z;

        const rawAzimuth = Math.atan2(rightProj, fwdProj);
        const rawElevation = Math.asin(clamp(upProj, -1.0, 1.0));

        // Clamp to canopy limits
        const azimuth = clamp(
            rawAzimuth,
            -PADLOCK_LIMITS.MAX_AZIMUTH_RAD,
            PADLOCK_LIMITS.MAX_AZIMUTH_RAD
        );
        const elevation = clamp(
            rawElevation,
            PADLOCK_LIMITS.MIN_ELEVATION_RAD,
            PADLOCK_LIMITS.MAX_ELEVATION_RAD
        );

        return { azimuth, elevation };
    }

    /**
     * Advance padlock camera interpolation.
     * Returns camera pitch and yaw offsets to add to the cockpit camera.
     */
    public update(
        dt: number,
        aircraftPos: Vector3,
        basis: CameraBasisVectors,
        targetPos: Vector3 | null
    ): { pitchOffset: number; yawOffset: number; isPadlocked: boolean } {
        const active = this.isEnabled && targetPos !== null;

        if (active) {
            const angles = this.calculateTargetAngles(aircraftPos, basis, targetPos);
            this.targetYaw = angles.azimuth;
            this.targetPitch = angles.elevation;
        } else {
            // Return to cockpit boresight
            this.targetYaw = 0;
            this.targetPitch = 0;
        }

        // Advance transition timer
        this.transitionElapsed += dt;
        const progress = Math.min(1.0, this.transitionElapsed / PADLOCK_LIMITS.TRANSITION_TIME_SEC);
        const ease = easeOutCubic(progress);

        // Smoothly interpolate between starting pose and dynamic target
        this.currentYawOffset = this.fromYaw + (this.targetYaw - this.fromYaw) * ease;
        this.currentPitchOffset = this.fromPitch + (this.targetPitch - this.fromPitch) * ease;

        // If transition is complete, track target continuously
        if (progress >= 1.0) {
            this.fromYaw = this.targetYaw;
            this.fromPitch = this.targetPitch;
            this.currentYawOffset = this.targetYaw;
            this.currentPitchOffset = this.targetPitch;
        }

        const isPadlocked = active && Math.hypot(this.currentYawOffset, this.currentPitchOffset) > 0.05;
        this.isPadlocked = isPadlocked;

        return {
            pitchOffset: this.currentPitchOffset,
            yawOffset: this.currentYawOffset,
            isPadlocked
        };
    }

    public reset(): void {
        this.isEnabled = false;
        this.currentYawOffset = 0;
        this.currentPitchOffset = 0;
        this.fromYaw = 0;
        this.fromPitch = 0;
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.transitionElapsed = PADLOCK_LIMITS.TRANSITION_TIME_SEC;
    }
}
