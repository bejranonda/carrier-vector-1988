/**
 * CARRIER VECTOR: 1988 - Kill Effects (shockwave ring + score pop)
 *
 * A kill at two kilometres was a puff of orange dots the size of a fingernail
 * and a banner at the bottom of the screen - the reward was drawn somewhere
 * other than where the player was looking. This puts it where they were
 * looking: an expanding phosphor ring at the wreck, and the points it earned
 * rising off it ("+500 x2"), the way every arcade shooter since the
 * eighties has paid out a hit.
 *
 * The ring has a minimum on-screen size, so a far kill still reads as an
 * event, and the effect lives in world space, so it stays pinned to the wreck
 * while the jet manoeuvres. State and timing are pure; `drawKillFx` is the
 * only part that touches a canvas.
 */

import type { Vector3 } from '../flight/AircraftPhysics';
import { MONO } from './Theme';

export interface KillFx {
    position: Vector3;
    /** Seconds since spawn. */
    age: number;
    /** Total lifetime, seconds. */
    life: number;
    /** Text that rises off the wreck, e.g. "+500 x2". Empty = ring only. */
    text: string;
    color: string;
    /** Bigger for chains and bombers. 1 = a lone fighter. */
    weight: number;
}

export const KILL_FX_TUNING = {
    life: 1.1,
    /** World radius the ring expands to, metres, at weight 1. */
    ringMetres: 140,
    /** Never smaller than this on screen, px - a far kill must still read. */
    minRingPx: 26,
    maxRingPx: 220,
    /** How far the score text rises over its life, px. */
    risePx: 46,
    maxLive: 8
} as const;

export class KillFxSystem {
    public live: KillFx[] = [];

    public spawn(position: Vector3, text: string, color: string, weight = 1) {
        this.live.push({ position: { ...position }, age: 0, life: KILL_FX_TUNING.life, text, color, weight });
        if (this.live.length > KILL_FX_TUNING.maxLive) this.live.shift();
    }

    /** Advanced on real (frame) time, so a hit-stop does not freeze the reward. */
    public update(dt: number) {
        for (const fx of this.live) fx.age += dt;
        this.live = this.live.filter(fx => fx.age < fx.life);
    }

    public clear() {
        this.live.length = 0;
    }
}

/** Eased 0..1 expansion: fast out, slow settle - reads as a blast, not a zoom. */
export function ringProgress(age: number, life: number): number {
    const t = Math.min(1, Math.max(0, age / life));
    return 1 - (1 - t) ** 3;
}

/** On-screen ring radius for a fx at camera depth `z` with focal length `fov`. */
export function ringRadiusPx(fx: KillFx, z: number, fov: number): number {
    const metres = KILL_FX_TUNING.ringMetres * fx.weight * ringProgress(fx.age, fx.life);
    const px = z > 1 ? (metres * fov) / z : KILL_FX_TUNING.maxRingPx;
    const floor = KILL_FX_TUNING.minRingPx * ringProgress(fx.age, fx.life) * Math.sqrt(fx.weight);
    return Math.min(KILL_FX_TUNING.maxRingPx, Math.max(floor, px));
}

export interface Projector {
    /** World point to screen, or null when it is behind the camera. */
    (p: Vector3): { x: number; y: number; z: number } | null;
}

export function drawKillFx(ctx: CanvasRenderingContext2D, system: KillFxSystem, project: Projector, fov: number) {
    if (system.live.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const fx of system.live) {
        const s = project(fx.position);
        if (!s) continue;
        const t = fx.age / fx.life;
        const fade = 1 - t;
        const r = ringRadiusPx(fx, s.z, fov);

        ctx.globalAlpha = Math.max(0, fade * 0.9);
        ctx.strokeStyle = fx.color;
        ctx.shadowColor = fx.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5 * fade + 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.stroke();
        // A second, thinner ring trailing the first sells the shock front.
        ctx.globalAlpha = Math.max(0, fade * 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 0.62, 0, Math.PI * 2);
        ctx.stroke();

        if (fx.text) {
            const pop = t < 0.12 ? 1 + (0.12 - t) * 4 : 1;
            const size = Math.round((15 + 5 * Math.min(2, fx.weight - 1)) * pop);
            ctx.globalAlpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);
            ctx.font = `700 ${size}px ${MONO}`;
            ctx.fillStyle = fx.color;
            ctx.shadowBlur = 10;
            ctx.fillText(fx.text, s.x, s.y - r - 10 - KILL_FX_TUNING.risePx * ringProgress(fx.age, fx.life));
        }
    }
    ctx.restore();
}
