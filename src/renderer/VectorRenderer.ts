/**
 * CARRIER VECTOR: 1988 - 3D Wireframe Vector Projection Engine
 * Pure linear algebra 3D pipeline with near-plane line clipping,
 * camera rotation matrices, perspective divide, and wireframe model generators.
 */

import type { Vector3 } from '../flight/AircraftPhysics';

export interface Vector2 {
    x: number;
    y: number;
}

export interface WireframeLine {
    p1: Vector3;
    p2: Vector3;
    color?: string;
}

export interface WireframeMesh {
    lines: WireframeLine[];
}

export class VectorRenderer {
    private ctx: CanvasRenderingContext2D;
    public width: number;
    public height: number;
    public fov: number; // focal length
    public readonly nearPlane: number = 2.0; // meters

    // CRT Phosphor palette
    public phosphorColor: string = '#00ff66';
    public alertColor: string = '#ff3333';
    public warningColor: string = '#ffaa00';
    public dimColor: string = '#005522';

    constructor(canvas: HTMLCanvasElement, fov: number = 380) {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;
        this.width = canvas.width;
        this.height = canvas.height;
        this.fov = fov;
    }

    /**
     * Distance fade window (metres) matching TacticalTerrain's 8000m draw
     * cull, so lines fade out before they'd be culled rather than popping.
     */
    public static readonly NEAR_FADE = 600;
    public static readonly FAR_FADE = 8000;
    public static readonly MIN_FADE_ALPHA = 0.12;

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    /**
     * Hard-clear to the base background color. Used on resize/view switches.
     * NOT used for the per-frame cockpit clear once phosphor persistence is
     * active - see decayClear().
     */
    public clear() {
        this.ctx.fillStyle = '#051008';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Phosphor-persistence "clear": instead of wiping the frame, composite a
     * low-alpha dark rectangle over it so previous strokes decay exponentially
     * rather than vanishing, producing the glowing trails of a real vector
     * CRT. Frame-rate independent: alpha is derived from elapsed time and a
     * decay time constant, not a fixed per-frame value (otherwise trails
     * would be 2x longer at 120Hz than at 60Hz).
     *
     * IMPORTANT: the decay target color must be strictly DARKER than the
     * nominal background (#051008). Decaying toward a color equal to or
     * brighter than the resting background does not converge under 8-bit
     * channel rounding - e.g. a channel at 6 decaying toward a floor of 5
     * rounds right back to 6 forever, leaving a permanent low-level ghost
     * everywhere the beam has ever been. #030a04 is strictly below every
     * channel of #051008, so the iteration is strictly decreasing and
     * actually reaches the floor.
     */
    public decayClear(dt: number, tau: number = 0.06) {
        const alpha = Math.min(1, Math.max(0.02, 1 - Math.exp(-dt / tau)));
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.fillStyle = `rgba(3, 10, 4, ${alpha})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Transform a world 3D point into camera space (Translation -> Yaw -> Pitch -> Roll)
     */
    public transformToCamera(p: Vector3, camPos: Vector3, camPitch: number, camYaw: number, camRoll: number): Vector3 {
        // Translation
        const dx = p.x - camPos.x;
        const dy = p.y - camPos.y;
        const dz = p.z - camPos.z;

        // 1. Yaw (around Y)
        const cy = Math.cos(-camYaw);
        const sy = Math.sin(-camYaw);
        const x1 = dx * cy + dz * sy;
        const z1 = dz * cy - dx * sy;

        // 2. Pitch (around X)
        const cp = Math.cos(-camPitch);
        const sp = Math.sin(-camPitch);
        const y2 = dy * cp - z1 * sp;
        const z2 = z1 * cp + dy * sp;

        // 3. Roll (around Z)
        const cr = Math.cos(-camRoll);
        const sr = Math.sin(-camRoll);
        const x3 = x1 * cr - y2 * sr;
        const y3 = x1 * sr + y2 * cr;

        return { x: x3, y: y3, z: z2 };
    }

    /**
     * Perspective divide from camera space to 2D screen coordinates
     */
    public projectCameraPoint(camPoint: Vector3): Vector2 {
        const scale = this.fov / camPoint.z;
        const x0 = this.width / 2;
        const y0 = this.height / 2;

        return {
            x: camPoint.x * scale + x0,
            y: -camPoint.y * scale + y0 // Invert Y for canvas
        };
    }

    /**
     * Draw a 3D line segment with near-plane clipping
     */
    public drawLine(
        p1: Vector3,
        p2: Vector3,
        camPos: Vector3,
        camPitch: number,
        camYaw: number,
        camRoll: number,
        color: string = this.phosphorColor,
        lineWidth: number = 1.4
    ) {
        // Transform both points into camera space
        let c1 = this.transformToCamera(p1, camPos, camPitch, camYaw, camRoll);
        let c2 = this.transformToCamera(p2, camPos, camPitch, camYaw, camRoll);

        // Near-plane clipping: z must be >= nearPlane
        const zNear = this.nearPlane;

        if (c1.z < zNear && c2.z < zNear) {
            return; // Both behind camera
        }

        if (c1.z < zNear) {
            // Clip c1 against zNear
            const t = (zNear - c1.z) / (c2.z - c1.z);
            c1 = {
                x: c1.x + t * (c2.x - c1.x),
                y: c1.y + t * (c2.y - c1.y),
                z: zNear
            };
        } else if (c2.z < zNear) {
            // Clip c2 against zNear
            const t = (zNear - c2.z) / (c1.z - c2.z);
            c2 = {
                x: c2.x + t * (c1.x - c2.x),
                y: c2.y + t * (c1.y - c2.y),
                z: zNear
            };
        }

        const s1 = this.projectCameraPoint(c1);
        const s2 = this.projectCameraPoint(c2);

        // Distance haze: fade line opacity with midpoint camera-space depth
        // so the canyon reads as three-dimensional instead of a flat grid of
        // uniformly bright lines. Fades out fully by the terrain's own draw
        // cull distance so nothing "pops" into existence.
        const zMid = (c1.z + c2.z) / 2;
        const fade = VectorRenderer.depthFade(zMid);

        // Vector glow stroke
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth * (0.6 + 0.4 * fade);
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 4;
        this.ctx.globalAlpha = fade;
        this.ctx.moveTo(s1.x, s1.y);
        this.ctx.lineTo(s2.x, s2.y);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    /** Pure depth->opacity falloff. Exposed static so it is unit-testable. */
    public static depthFade(z: number): number {
        if (z <= VectorRenderer.NEAR_FADE) return 1.0;
        if (z >= VectorRenderer.FAR_FADE) return VectorRenderer.MIN_FADE_ALPHA;
        const t = (z - VectorRenderer.NEAR_FADE) / (VectorRenderer.FAR_FADE - VectorRenderer.NEAR_FADE);
        return 1.0 - t * (1.0 - VectorRenderer.MIN_FADE_ALPHA);
    }

    /**
     * Render a wireframe mesh with world transformation.
     *
     * pitch/roll default to 0, matching the original yaw-only behaviour
     * exactly (verified algebraically: with pitch=roll=0 the basis-vector
     * formulation below reduces to the original two-term yaw rotation), so
     * every existing call site is unaffected. Passing non-zero pitch/roll
     * lets enemy aircraft actually bank and dive instead of always flying
     * dead level.
     */
    public renderMesh(
        mesh: WireframeMesh,
        worldPos: Vector3,
        yaw: number,
        camPos: Vector3,
        camPitch: number,
        camYaw: number,
        camRoll: number,
        overrideColor?: string,
        pitch: number = 0,
        roll: number = 0
    ) {
        const { forward, up, right } = VectorRenderer.basisVectors(pitch, yaw, roll);

        const toWorld = (local: Vector3): Vector3 => ({
            x: worldPos.x + local.x * right.x + local.y * up.x + local.z * forward.x,
            y: worldPos.y + local.x * right.y + local.y * up.y + local.z * forward.y,
            z: worldPos.z + local.x * right.z + local.y * up.z + local.z * forward.z
        });

        for (const line of mesh.lines) {
            this.drawLine(
                toWorld(line.p1),
                toWorld(line.p2),
                camPos,
                camPitch,
                camYaw,
                camRoll,
                overrideColor || line.color || this.phosphorColor
            );
        }
    }

    /**
     * Object-space basis vectors for a given pitch/yaw/roll, matching the
     * same rotation convention as AircraftPhysics.forwardVector/upVector/
     * rightVector (duplicated here rather than imported, since the renderer
     * must stay independent of any one aircraft instance).
     */
    private static basisVectors(pitch: number, yaw: number, roll: number) {
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cr = Math.cos(roll), sr = Math.sin(roll);

        const forward: Vector3 = { x: cp * sy, y: sp, z: cp * cy };
        const up: Vector3 = {
            x: -sr * cy - sp * sy * cr,
            y: cp * cr,
            z: sr * sy - sp * cy * cr
        };
        const right: Vector3 = {
            x: cr * cy - sp * sy * sr,
            y: -cp * sr,
            z: -cr * sy - sp * cy * sr
        };
        return { forward, up, right };
    }
}

// -------------------------------------------------------------
// 3D Wireframe Models
// -------------------------------------------------------------

export class WireframeModels {
    /**
     * Carrier CV-68 Nimitz-class flight deck wireframe model
     */
    public static createCarrier(): WireframeMesh {
        const lines: WireframeLine[] = [];
        const deckCol = '#00ee55';
        const runwayCol = '#ffff33';
        const towerCol = '#00aa44';

        // Deck perimeter (approx 330m length, 78m width)
        const halfL = 165;
        const halfW = 40;
        const deckY = 20;

        // Outer flight deck outline
        const dPts: Vector3[] = [
            { x: -halfW + 10, y: deckY, z: -halfL },
            { x: halfW - 10, y: deckY, z: -halfL },
            { x: halfW, y: deckY, z: -halfL + 40 },
            { x: halfW, y: deckY, z: halfL - 30 },
            { x: 0, y: deckY, z: halfL }, // Bow
            { x: -halfW - 5, y: deckY, z: halfL - 60 },
            { x: -halfW - 5, y: deckY, z: -halfL + 40 }
        ];

        for (let i = 0; i < dPts.length; i++) {
            lines.push({ p1: dPts[i], p2: dPts[(i + 1) % dPts.length], color: deckCol });
        }

        // Catapult 1 track (running down the bow)
        lines.push({
            p1: { x: 5, y: deckY + 0.2, z: -40 },
            p2: { x: 5, y: deckY + 0.2, z: halfL - 10 },
            color: runwayCol
        });
        // Catapult 2 track
        lines.push({
            p1: { x: 18, y: deckY + 0.2, z: -30 },
            p2: { x: 18, y: deckY + 0.2, z: halfL - 20 },
            color: runwayCol
        });

        // Angled deck landing strip
        lines.push({
            p1: { x: -halfW + 5, y: deckY + 0.2, z: -halfL },
            p2: { x: 8, y: deckY + 0.2, z: 40 },
            color: runwayCol
        });
        lines.push({
            p1: { x: -10, y: deckY + 0.2, z: -halfL },
            p2: { x: 25, y: deckY + 0.2, z: 40 },
            color: runwayCol
        });

        // Arresting gear wires
        for (let w = -120; w <= -80; w += 10) {
            lines.push({
                p1: { x: -28, y: deckY + 0.3, z: w },
                p2: { x: 5, y: deckY + 0.3, z: w + 4 },
                color: '#ffaa00'
            });
        }

        // Island Superstructure (Starboard tower)
        const tx = 28;
        const tz = -10;
        const tw = 8;
        const tl = 28;
        const th = 22;

        // Base box
        lines.push({ p1: { x: tx - tw, y: deckY, z: tz - tl }, p2: { x: tx + tw, y: deckY, z: tz - tl }, color: towerCol });
        lines.push({ p1: { x: tx + tw, y: deckY, z: tz - tl }, p2: { x: tx + tw, y: deckY, z: tz + tl }, color: towerCol });
        lines.push({ p1: { x: tx + tw, y: deckY, z: tz + tl }, p2: { x: tx - tw, y: deckY, z: tz + tl }, color: towerCol });
        lines.push({ p1: { x: tx - tw, y: deckY, z: tz + tl }, p2: { x: tx - tw, y: deckY, z: tz - tl }, color: towerCol });

        // Top box
        lines.push({ p1: { x: tx - tw, y: deckY + th, z: tz - tl }, p2: { x: tx + tw, y: deckY + th, z: tz - tl }, color: towerCol });
        lines.push({ p1: { x: tx + tw, y: deckY + th, z: tz - tl }, p2: { x: tx + tw, y: deckY + th, z: tz + tl }, color: towerCol });
        lines.push({ p1: { x: tx + tw, y: deckY + th, z: tz + tl }, p2: { x: tx - tw, y: deckY + th, z: tz + tl }, color: towerCol });
        lines.push({ p1: { x: tx - tw, y: deckY + th, z: tz + tl }, p2: { x: tx - tw, y: deckY + th, z: tz - tl }, color: towerCol });

        // Vertical pillars
        lines.push({ p1: { x: tx - tw, y: deckY, z: tz - tl }, p2: { x: tx - tw, y: deckY + th, z: tz - tl }, color: towerCol });
        lines.push({ p1: { x: tx + tw, y: deckY, z: tz - tl }, p2: { x: tx + tw, y: deckY + th, z: tz - tl }, color: towerCol });
        lines.push({ p1: { x: tx + tw, y: deckY, z: tz + tl }, p2: { x: tx + tw, y: deckY + th, z: tz + tl }, color: towerCol });
        lines.push({ p1: { x: tx - tw, y: deckY, z: tz + tl }, p2: { x: tx - tw, y: deckY + th, z: tz + tl }, color: towerCol });

        // Radar Mast
        lines.push({ p1: { x: tx, y: deckY + th, z: tz }, p2: { x: tx, y: deckY + th + 15, z: tz }, color: '#ffffff' });
        lines.push({ p1: { x: tx - 4, y: deckY + th + 12, z: tz }, p2: { x: tx + 4, y: deckY + th + 12, z: tz }, color: '#ffffff' });

        return { lines };
    }

    /**
     * MiG-23 Flogger wireframe model (Fast Soviet Interceptor)
     */
    public static createMiG23(): WireframeMesh {
        const lines: WireframeLine[] = [];
        const c = '#ff3333';

        // Fuselage: Nose to Tail
        const nose: Vector3 = { x: 0, y: 0, z: 8.5 };
        const cockpit: Vector3 = { x: 0, y: 1.2, z: 4.5 };
        const midBody: Vector3 = { x: 0, y: 0.3, z: -1.0 };
        const tail: Vector3 = { x: 0, y: 0.5, z: -7.5 };

        // Left & Right intakes
        const lIntake: Vector3 = { x: -1.2, y: 0.2, z: 2.0 };
        const rIntake: Vector3 = { x: 1.2, y: 0.2, z: 2.0 };

        // Spine
        lines.push({ p1: nose, p2: cockpit, color: c });
        lines.push({ p1: cockpit, p2: midBody, color: c });
        lines.push({ p1: midBody, p2: tail, color: c });

        // Nose to intakes
        lines.push({ p1: nose, p2: lIntake, color: c });
        lines.push({ p1: nose, p2: rIntake, color: c });

        // Wing tips (Variable sweep delta)
        const lWingTip: Vector3 = { x: -4.8, y: 0.1, z: -3.5 };
        const rWingTip: Vector3 = { x: 4.8, y: 0.1, z: -3.5 };

        lines.push({ p1: lIntake, p2: lWingTip, color: c });
        lines.push({ p1: lWingTip, p2: { x: -1.0, y: 0.1, z: -6.0 }, color: c });
        lines.push({ p1: rIntake, p2: rWingTip, color: c });
        lines.push({ p1: rWingTip, p2: { x: 1.0, y: 0.1, z: -6.0 }, color: c });

        // Vertical Tail fin
        const finTop: Vector3 = { x: 0, y: 3.2, z: -6.5 };
        lines.push({ p1: midBody, p2: finTop, color: c });
        lines.push({ p1: finTop, p2: tail, color: c });

        // Horizontal stabilators
        lines.push({ p1: tail, p2: { x: -2.2, y: 0.2, z: -7.0 }, color: c });
        lines.push({ p1: tail, p2: { x: 2.2, y: 0.2, z: -7.0 }, color: c });

        return { lines };
    }

    /**
     * Tu-22M Backfire / Blinder wireframe bomber
     */
    public static createBomber(): WireframeMesh {
        const lines: WireframeLine[] = [];
        const c = '#ffaa33';

        // Heavy fuselage
        const nose: Vector3 = { x: 0, y: 0, z: 18 };
        const cockpit: Vector3 = { x: 0, y: 2.0, z: 12 };
        const mid: Vector3 = { x: 0, y: 1.5, z: 0 };
        const tail: Vector3 = { x: 0, y: 1.0, z: -16 };

        lines.push({ p1: nose, p2: cockpit, color: c });
        lines.push({ p1: cockpit, p2: mid, color: c });
        lines.push({ p1: mid, p2: tail, color: c });

        // Large swept wings
        const lTip: Vector3 = { x: -14, y: 0.5, z: -6 };
        const rTip: Vector3 = { x: 14, y: 0.5, z: -6 };

        lines.push({ p1: { x: -2.5, y: 0.5, z: 4 }, p2: lTip, color: c });
        lines.push({ p1: lTip, p2: { x: -3.0, y: 0.5, z: -10 }, color: c });
        lines.push({ p1: { x: 2.5, y: 0.5, z: 4 }, p2: rTip, color: c });
        lines.push({ p1: rTip, p2: { x: 3.0, y: 0.5, z: -10 }, color: c });

        // Huge vertical fin
        const finTop: Vector3 = { x: 0, y: 6.5, z: -14 };
        lines.push({ p1: mid, p2: finTop, color: c });
        lines.push({ p1: finTop, p2: tail, color: c });

        return { lines };
    }

    /**
     * SAM Site Launcher wireframe model
     */
    public static createSAMLauncher(): WireframeMesh {
        const lines: WireframeLine[] = [];
        const c = '#ff5522';

        // Base frame
        lines.push({ p1: { x: -4, y: 0, z: -4 }, p2: { x: 4, y: 0, z: -4 }, color: c });
        lines.push({ p1: { x: 4, y: 0, z: -4 }, p2: { x: 4, y: 0, z: 4 }, color: c });
        lines.push({ p1: { x: 4, y: 0, z: 4 }, p2: { x: -4, y: 0, z: 4 }, color: c });
        lines.push({ p1: { x: -4, y: 0, z: 4 }, p2: { x: -4, y: 0, z: -4 }, color: c });

        // Elevated missile rails
        lines.push({ p1: { x: -2, y: 1.5, z: -5 }, p2: { x: -2, y: 4.5, z: 4 }, color: '#ffffff' });
        lines.push({ p1: { x: 2, y: 1.5, z: -5 }, p2: { x: 2, y: 4.5, z: 4 }, color: '#ffffff' });
        lines.push({ p1: { x: 0, y: 2.5, z: -5 }, p2: { x: 0, y: 5.5, z: 5 }, color: '#ffffff' });

        // Radar dish octagonal wireframe
        const dishY = 6;
        lines.push({ p1: { x: 0, y: 0, z: -2 }, p2: { x: 0, y: dishY, z: -2 }, color: c });
        lines.push({ p1: { x: -3, y: dishY - 1, z: -2 }, p2: { x: 3, y: dishY - 1, z: -2 }, color: c });
        lines.push({ p1: { x: -3, y: dishY + 2, z: -2 }, p2: { x: 3, y: dishY + 2, z: -2 }, color: c });

        return { lines };
    }
}
