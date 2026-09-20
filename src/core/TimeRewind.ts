/**
 * CARRIER VECTOR: 1988 - Arcade Time-Rewind ("Oops" Button)
 *
 * Stores a circular buffer of aircraft telemetry snapshots (5 seconds).
 * In ARCADE / ASSIST modes, pressing [BACKSPACE] rewinds the flight state
 * by up to 5 seconds, giving players a second chance after an accidental
 * terrain clip or incoming missile strike without ruining a 10-minute sortie.
 *
 * Hardcore SIM and MANUAL modes disable the rewind button to preserve purist challenge.
 * Pre-allocated circular ring buffer ensures zero memory allocation in the hot loop.
 */

import type { AircraftPhysics, Vector3 } from '../flight/AircraftPhysics';

export interface AircraftSnapshot {
    position: Vector3;
    velocity: Vector3;
    pitch: number;
    yaw: number;
    roll: number;
    airSpeed: number;
    throttle: number;
    fuel: number;
    damage: number;
    bayOpen: boolean;
}

export const REWIND_CONFIG = {
    BUFFER_SECONDS: 5.0,
    SAMPLE_RATE_HZ: 20, // 20 samples/sec = 100 entries for 5 seconds
    MAX_REWINDS_PER_SORTIE: 2
} as const;

export class TimeRewindBuffer {
    private readonly capacity: number;
    private readonly ring: AircraftSnapshot[];
    private head: number = 0;
    private count: number = 0;
    private sampleTimer: number = 0;
    private sampleInterval: number;

    public rewindsRemaining: number = REWIND_CONFIG.MAX_REWINDS_PER_SORTIE;
    public isRewindingEffect: number = 0; // Visual reverse-CRT flicker timer (seconds)

    constructor(seconds: number = REWIND_CONFIG.BUFFER_SECONDS, sampleHz: number = REWIND_CONFIG.SAMPLE_RATE_HZ) {
        this.capacity = Math.ceil(seconds * sampleHz);
        this.sampleInterval = 1.0 / sampleHz;
        this.ring = new Array(this.capacity);

        // Preallocate snapshots to guarantee zero garbage collection pauses
        for (let i = 0; i < this.capacity; i++) {
            this.ring[i] = {
                position: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                pitch: 0,
                yaw: 0,
                roll: 0,
                airSpeed: 0,
                throttle: 0,
                fuel: 0,
                damage: 0,
                bayOpen: false
            };
        }
    }

    /** Record current aircraft telemetry into the circular buffer */
    public update(dt: number, physics: AircraftPhysics): void {
        if (this.isRewindingEffect > 0) {
            this.isRewindingEffect = Math.max(0, this.isRewindingEffect - dt);
        }

        this.sampleTimer += dt;
        if (this.sampleTimer < this.sampleInterval) {
            return;
        }
        this.sampleTimer -= this.sampleInterval;

        const slot = this.ring[this.head];
        slot.position.x = physics.position.x;
        slot.position.y = physics.position.y;
        slot.position.z = physics.position.z;

        slot.velocity.x = physics.velocity.x;
        slot.velocity.y = physics.velocity.y;
        slot.velocity.z = physics.velocity.z;

        slot.pitch = physics.pitch;
        slot.yaw = physics.yaw;
        slot.roll = physics.roll;
        slot.airSpeed = physics.airSpeed;
        slot.throttle = physics.throttle;
        slot.fuel = physics.fuel;
        slot.damage = physics.damage;
        slot.bayOpen = physics.bayOpen;

        this.head = (this.head + 1) % this.capacity;
        if (this.count < this.capacity) {
            this.count++;
        }
    }

    public canRewind(): boolean {
        return this.rewindsRemaining > 0 && this.count > 5;
    }

    /**
     * Restore aircraft telemetry from 5 seconds ago (or earliest available).
     * Returns true if rewind succeeded.
     */
    public triggerRewind(physics: AircraftPhysics): boolean {
        if (!this.canRewind()) {
            return false;
        }

        // Oldest snapshot in circular buffer:
        // When full: head is oldest. When not full: index 0 is oldest.
        const targetIdx = this.count < this.capacity ? 0 : this.head;
        const target = this.ring[targetIdx];

        // Restore physics
        physics.position.x = target.position.x;
        physics.position.y = target.position.y;
        physics.position.z = target.position.z;

        physics.velocity.x = target.velocity.x;
        physics.velocity.y = target.velocity.y;
        physics.velocity.z = target.velocity.z;

        physics.pitch = target.pitch;
        physics.yaw = target.yaw;
        physics.roll = target.roll;
        physics.throttle = target.throttle;
        physics.fuel = target.fuel;
        physics.damage = Math.min(target.damage, physics.damage); // Don't increase damage
        physics.bayOpen = target.bayOpen;

        // Reset buffer and decrement uses
        this.rewindsRemaining--;
        this.count = 0;
        this.head = 0;
        this.sampleTimer = 0;
        this.isRewindingEffect = 0.35; // 350ms CRT reverse strobe

        return true;
    }

    public reset(maxRewinds: number = REWIND_CONFIG.MAX_REWINDS_PER_SORTIE): void {
        this.rewindsRemaining = maxRewinds;
        this.count = 0;
        this.head = 0;
        this.sampleTimer = 0;
        this.isRewindingEffect = 0;
    }
}
