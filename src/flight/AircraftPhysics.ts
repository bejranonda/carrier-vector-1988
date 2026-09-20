/**
 * CARRIER VECTOR: 1988 - 6-DOF Flight Dynamics & Aerodynamics Engine
 * Pure linear algebra physics: Lift, Drag, Thrust, Gravity, Dynamic AoA,
 * G-load induced drag, stall control authority loss, afterburner fuel burn, and bay door dynamics.
 */

import { CM_TUNING } from './Countermeasures';

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface AircraftLoadout {
    vulcanAmmo: number; // rounds (e.g. 500)
    sidewinders: number; // count (e.g. 4)
    ironBombs: number; // count (e.g. 2)
    chaff: number; // countermeasure cartridges (e.g. 12)
}

export class AircraftPhysics {
    // 1. State Vector
    public position: Vector3 = { x: 0, y: 1000, z: 0 };
    public velocity: Vector3 = { x: 0, y: 0, z: 220 }; // m/s (~420 knots)

    public pitch: number = 0; // radians (positive = nose up)
    public roll: number = 0;  // radians (positive = roll right)
    public yaw: number = 0;   // radians (positive = nose right / heading clockwise)

    // Mass & Propulsion
    public emptyMass: number = 11000; // kg (F/A-18 or F-14 class)
    public fuel: number = 4500;       // liters (~3600 kg)
    public maxFuel: number = 5000;
    public throttle: number = 0.6;    // 0.0 -> 1.5 (1.0 = Mil, >1.0 = Afterburner)

    // Loadout
    public loadout: AircraftLoadout = {
        vulcanAmmo: 500,
        sidewinders: 4,
        ironBombs: 2,
        chaff: CM_TUNING.capacity
    };

    // Aerodynamic states
    public bayOpen: boolean = false;
    public alpha: number = 0; // Angle of attack (radians)
    public beta: number = 0;  // Sideslip angle (radians)
    public gLoad: number = 1.0;
    public isStalled: boolean = false;
    public controlAuthority: number = 1.0; // 0.0 -> 1.0 (drops during stall)

    // Battle damage state. Accumulated from SAM proximity fuzing and enemy
    // cannon fire. Degrades control authority and opens a fuel leak, so a
    // damaged jet is a race to get back aboard before the tanks run dry.
    public damage: number = 0;        // 0 (pristine) -> 100 (destroyed)
    public fuelLeakRate: number = 0;  // extra L/s drain caused by damage

    // Thermal signature multiplier (1.0 idle, 1.5 mil, 4.0 afterburner)
    public thermalSignature: number = 1.0;

    // Constants
    public static readonly GRAVITY = 9.80665;
    public static readonly CRITICAL_ALPHA = 18.0 * (Math.PI / 180); // 18 degrees
    public static readonly MAX_MIL_THRUST = 95000; // N (~21,000 lbf)
    public static readonly MAX_AB_THRUST = 145000; // N (~32,500 lbf)
    public static readonly WING_AREA = 38.0; // m^2
    public static readonly SEA_LEVEL_DENSITY = 1.225; // kg/m^3
    public static readonly BASE_FUEL_BURN_RATE = 1.6; // L/s at 100% military power
    public static readonly AB_FUEL_BURN_MULT = 3.5;

    public get totalMass(): number {
        const fuelMass = this.fuel * 0.8; // ~0.8 kg/L for JP-5
        const ordnanceMass = (this.loadout.vulcanAmmo * 0.25) + 
                             (this.loadout.sidewinders * 86) + 
                             (this.loadout.ironBombs * 227);
        return this.emptyMass + fuelMass + ordnanceMass;
    }

    public get airSpeed(): number {
        return Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2 + this.velocity.z ** 2);
    }

    public get forwardVector(): Vector3 {
        return {
            x: Math.cos(this.pitch) * Math.sin(this.yaw),
            y: Math.sin(this.pitch),
            z: Math.cos(this.pitch) * Math.cos(this.yaw)
        };
    }

    public get upVector(): Vector3 {
        // Orthogonal vector pointing through the canopy
        const cp = Math.cos(this.pitch);
        const sp = Math.sin(this.pitch);
        const cy = Math.cos(this.yaw);
        const sy = Math.sin(this.yaw);
        const cr = Math.cos(this.roll);
        const sr = Math.sin(this.roll);

        return {
            x: -sr * cy - sp * sy * cr,
            y: cp * cr,
            z: sr * sy - sp * cy * cr
        };
    }

    public get rightVector(): Vector3 {
        const cp = Math.cos(this.pitch);
        const sp = Math.sin(this.pitch);
        const cy = Math.cos(this.yaw);
        const sy = Math.sin(this.yaw);
        const cr = Math.cos(this.roll);
        const sr = Math.sin(this.roll);

        return {
            x: cr * cy - sp * sy * sr,
            y: -cp * sr,
            z: -cr * sy - sp * cy * sr
        };
    }

    /**
     * Take battle damage. Punctured tanks leak progressively faster, and
     * shredded hydraulics bleed control authority, so damage compounds:
     * a badly hit aircraft is both harder to fly and shorter on fuel.
     */
    public applyDamage(amount: number) {
        if (amount <= 0) return;
        this.damage = Math.min(100, this.damage + amount);
        // Up to 8 L/s of leak at total structural failure.
        this.fuelLeakRate = (this.damage / 100) * 8.0;
    }

    /** Restore a fresh airframe (called when the deck crew issues a new jet). */
    public repair() {
        this.damage = 0;
        this.fuelLeakRate = 0;
    }

    /**
     * Apply pitch control command (-1 to +1).
     * Automatically scales by dynamic pressure and aerodynamic stall authority loss.
     */
    public applyPitchInput(input: number, dt: number) {
        const speed = this.airSpeed;
        const qFactor = Math.min(1.2, Math.max(0.1, speed / 150));
        const rate = 1.35 * qFactor * this.controlAuthority;
        this.pitch += input * rate * dt;

        // Limit pitch to avoid gymbal singularities in this arcade 6-DOF
        const maxPitch = 88 * (Math.PI / 180);
        if (this.pitch > maxPitch) this.pitch = maxPitch;
        if (this.pitch < -maxPitch) this.pitch = -maxPitch;
    }

    /**
     * Apply roll control command (-1 to +1).
     */
    public applyRollInput(input: number, dt: number) {
        const speed = this.airSpeed;
        const qFactor = Math.min(1.3, Math.max(0.2, speed / 150));
        const rate = 2.4 * qFactor * this.controlAuthority;
        this.roll += input * rate * dt;

        // Keep roll within [-pi, pi]
        if (this.roll > Math.PI) this.roll -= Math.PI * 2;
        if (this.roll < -Math.PI) this.roll += Math.PI * 2;
    }

    /**
     * Apply yaw rudder control command (-1 to +1).
     */
    public applyYawInput(input: number, dt: number) {
        const speed = this.airSpeed;
        const qFactor = Math.min(1.0, Math.max(0.1, speed / 150));
        const rate = 0.65 * qFactor * this.controlAuthority;
        this.yaw += input * rate * dt;

        if (this.yaw > Math.PI * 2) this.yaw -= Math.PI * 2;
        if (this.yaw < 0) this.yaw += Math.PI * 2;
    }

    /**
     * Step the 6-DOF flight simulation forward by dt seconds.
     */
    public update(dt: number) {
        if (dt <= 0) return;

        // 1. Fuel and engine thrust state
        if (this.fuel <= 0) {
            this.fuel = 0;
            this.throttle = 0;
        }

        // Throttle envelope
        let thrust = 0;
        if (this.throttle <= 1.0) {
            thrust = this.throttle * AircraftPhysics.MAX_MIL_THRUST;
            this.thermalSignature = 1.0 + this.throttle * 0.5;
        } else {
            const abFraction = (this.throttle - 1.0) / 0.5;
            thrust = AircraftPhysics.MAX_MIL_THRUST + abFraction * (AircraftPhysics.MAX_AB_THRUST - AircraftPhysics.MAX_MIL_THRUST);
            this.thermalSignature = 1.5 + abFraction * 2.5; // up to 4.0x in burner
        }

        // Fuel burn calculation
        if (this.throttle > 0 && this.fuel > 0) {
            const burnMultiplier = this.throttle > 1.0 ? AircraftPhysics.AB_FUEL_BURN_MULT : 1.0;
            const burnRate = AircraftPhysics.BASE_FUEL_BURN_RATE * Math.min(1.0, this.throttle) * burnMultiplier;
            this.fuel -= burnRate * dt;
            if (this.fuel < 0) this.fuel = 0;
        }

        // Punctured tanks leak regardless of throttle setting.
        if (this.fuelLeakRate > 0 && this.fuel > 0) {
            this.fuel = Math.max(0, this.fuel - this.fuelLeakRate * dt);
        }

        // 2. Air density profile with altitude
        const altitude = Math.max(0, this.position.y);
        const airDensity = AircraftPhysics.SEA_LEVEL_DENSITY * Math.exp(-altitude / 8500);

        // 3. Velocity and Angle of Attack (AoA)
        const speed = this.airSpeed;
        const fwd = this.forwardVector;
        const up = this.upVector;

        if (speed > 1.0) {
            const vNormX = this.velocity.x / speed;
            const vNormY = this.velocity.y / speed;
            const vNormZ = this.velocity.z / speed;

            // Dot product with forward vector
            const forwardDot = Math.max(-1, Math.min(1, vNormX * fwd.x + vNormY * fwd.y + vNormZ * fwd.z));
            const angleFromNose = Math.acos(forwardDot);

            // AoA is pitch difference between velocity vector and nose vector projected on pitch plane
            const upDot = vNormX * up.x + vNormY * up.y + vNormZ * up.z;
            this.alpha = -Math.asin(Math.max(-1, Math.min(1, upDot)));

            // If flying mostly backwards, treat as large AoA
            if (forwardDot < 0) {
                this.alpha = angleFromNose;
            }
        } else {
            this.alpha = 0;
        }

        // 4. Stall detection and control authority loss
        this.isStalled = Math.abs(this.alpha) > AircraftPhysics.CRITICAL_ALPHA;
        const stallAuthority = this.isStalled ? 0.22 : 1.0;

        // Battle damage compounds with stall: shredded hydraulics cost up to
        // 60% of remaining authority. An undamaged jet keeps exactly 1.0.
        const damageAuthority = 1.0 - (this.damage / 100) * 0.6;
        this.controlAuthority = stallAuthority * damageAuthority;

        // 5. Aerodynamic Coefficients: Lift & Drag
        const dynamicPressure = 0.5 * airDensity * (speed ** 2);

        // Lift curve slope (approx 0.09 per degree until stall)
        const alphaDeg = this.alpha * (180 / Math.PI);
        let liftCoeff = 0;
        if (!this.isStalled) {
            liftCoeff = Math.min(1.6, Math.max(-1.0, alphaDeg * 0.085));
        } else {
            // Post-stall lift cliff
            liftCoeff = Math.sign(alphaDeg) * 0.25;
        }

        const liftForceMagnitude = dynamicPressure * AircraftPhysics.WING_AREA * liftCoeff;

        // Parasitic drag base + bay doors open penalty
        let cd0 = 0.024;
        if (this.bayOpen) {
            cd0 += 0.035; // Significant drag increase when weapons bay open
        }

        // Induced drag increases quadratically with lift and with high G turns
        const aspectEfficiency = 0.78;
        const aspectMultiplier = 1 / (Math.PI * aspectEfficiency * 3.5);
        let inducedDragCoeff = (liftCoeff ** 2) * aspectMultiplier;

        // Current G-load
        const currentMass = this.totalMass;
        this.gLoad = Math.max(0.1, Math.abs(liftForceMagnitude) / (currentMass * AircraftPhysics.GRAVITY));

        // Hard banked turn induced drag multiplier (bleeds kinetic energy)
        if (this.gLoad > 1.5) {
            inducedDragCoeff *= 1.0 + ((this.gLoad - 1.0) ** 1.8) * 0.35;
        }

        const totalDragCoeff = cd0 + inducedDragCoeff + (this.isStalled ? 0.25 : 0);
        const totalDragForceMagnitude = dynamicPressure * AircraftPhysics.WING_AREA * totalDragCoeff;

        // 6. Force Decomposition
        // Thrust acts in forward direction
        const fxThrust = thrust * fwd.x;
        const fyThrust = thrust * fwd.y;
        const fzThrust = thrust * fwd.z;

        // Lift acts in aircraft local UP direction
        const fxLift = liftForceMagnitude * up.x;
        const fyLift = liftForceMagnitude * up.y;
        const fzLift = liftForceMagnitude * up.z;

        // Drag acts opposite to velocity vector
        let fxDrag = 0;
        let fyDrag = 0;
        let fzDrag = 0;
        if (speed > 0.1) {
            fxDrag = -totalDragForceMagnitude * (this.velocity.x / speed);
            fyDrag = -totalDragForceMagnitude * (this.velocity.y / speed);
            fzDrag = -totalDragForceMagnitude * (this.velocity.z / speed);
        }

        // Gravity acts purely along -Y
        const fyGravity = -currentMass * AircraftPhysics.GRAVITY;

        // Net Forces
        const netFx = fxThrust + fxLift + fxDrag;
        const netFy = fyThrust + fyLift + fyDrag + fyGravity;
        const netFz = fzThrust + fzLift + fzDrag;

        // Acceleration
        const ax = netFx / currentMass;
        const ay = netFy / currentMass;
        const az = netFz / currentMass;

        // Euler integration
        this.velocity.x += ax * dt;
        this.velocity.y += ay * dt;
        this.velocity.z += az * dt;

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // Subtle self-leveling aerodynamic roll damping
        this.roll *= Math.max(0, 1.0 - 0.2 * dt);
    }
}
