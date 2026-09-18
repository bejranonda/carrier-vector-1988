/**
 * CARRIER VECTOR: 1988 - Boot Sequence, Mission Briefing, Help & Debrief
 *
 * Onboarding rendering. Previously the game dropped the player straight
 * into a cockpit at 750m with zero explanation of the controls, the
 * objective, or even what the dual-loop structure was.
 */

import type { VectorRenderer } from './VectorRenderer';
import { WireframeModels } from './VectorRenderer';
import type { ScoreKeeper } from '../core/ScoreKeeper';
import { CONTROL_SCHEMA, bindingsFor } from '../core/Controls';
import type { ControlContext } from '../core/Controls';

const PHOSPHOR = '#00ff66';
const DIM = '#00aa44';
const CAUTION = '#ffff33';
const ALERT = '#ff3333';

export class BriefingScreen {
    private carrierMesh = WireframeModels.createCarrier();

    /**
     * CRT warm-up envelope. A real tube doesn't snap on: the beam strikes a
     * horizontal hairline first, which blooms vertically, then the raster
     * settles. Pure function of elapsed time so it's trivially testable.
     */
    public static warmupEnvelope(t: number): { lineW: number; lineH: number; noise: number; reveal: number } {
        if (t < 0.35) {
            return { lineW: t / 0.35, lineH: 0.01, noise: 1, reveal: 0 };
        }
        if (t < 0.8) {
            const k = (t - 0.35) / 0.45;
            // Ease-out-back for a slight vertical overshoot as the raster opens.
            const eased = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
            return { lineW: 1, lineH: Math.max(0.01, eased), noise: 1 - k * 0.5, reveal: 0 };
        }
        if (t < 1.4) {
            const k = (t - 0.8) / 0.6;
            return { lineW: 1, lineH: 1, noise: 0.5 * (1 - k), reveal: 0 };
        }
        const k = Math.min(1, (t - 1.4) / 0.4);
        return { lineW: 1, lineH: 1, noise: 0, reveal: k };
    }

    public static readonly WARMUP_DURATION = 1.8;

    public drawWarmUp(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
        const env = BriefingScreen.warmupEnvelope(t);

        ctx.save();
        ctx.fillStyle = '#030a04';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const bandH = Math.max(2, env.lineH * h);
        const bandW = env.lineW * w;

        // Raster band igniting
        const grad = ctx.createLinearGradient(0, cy - bandH / 2, 0, cy + bandH / 2);
        grad.addColorStop(0, 'rgba(0,255,102,0)');
        grad.addColorStop(0.5, `rgba(0,255,102,${0.10 + 0.35 * (1 - env.reveal)})`);
        grad.addColorStop(1, 'rgba(0,255,102,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - bandW / 2, cy - bandH / 2, bandW, bandH);

        // Bright scan hairline while the tube is still striking
        if (env.lineH < 1) {
            ctx.strokeStyle = '#aaffcc';
            ctx.shadowColor = PHOSPHOR;
            ctx.shadowBlur = 12;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - bandW / 2, cy);
            ctx.lineTo(cx + bandW / 2, cy);
            ctx.stroke();
        }

        // Rolling horizontal noise bar
        if (env.noise > 0.01) {
            ctx.globalAlpha = env.noise * 0.25;
            ctx.fillStyle = PHOSPHOR;
            const barY = (t * 420) % h;
            ctx.fillRect(0, barY, w, 3);
            ctx.globalAlpha = 1;
        }

        if (env.reveal > 0) {
            ctx.globalAlpha = env.reveal;
            ctx.fillStyle = PHOSPHOR;
            ctx.shadowColor = PHOSPHOR;
            ctx.shadowBlur = 6;
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('CV-68 TACTICAL DISPLAY SYSTEM', cx, cy - 10);
            ctx.font = '12px monospace';
            ctx.fillText('PHOSPHOR RASTER ONLINE', cx, cy + 12);
            ctx.textAlign = 'left';
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    /**
     * Mission briefing. Explains the situation, the objective and the
     * controls, over a slowly orbiting wireframe of the carrier reusing
     * the existing 3D pipeline.
     */
    /**
     * Draw the orbiting carrier backdrop into the renderer's (offscreen)
     * world layer. Must be called BEFORE compositing; the text overlay is
     * drawn separately afterwards so it stays crisp.
     */
    public drawBriefingBackdrop(renderer: VectorRenderer, timeSec: number) {
        const orbitYaw = timeSec * 0.16;
        const camPos = {
            x: Math.sin(orbitYaw) * 330,
            y: 95,
            z: Math.cos(orbitYaw) * 330
        };
        renderer.renderMesh(
            this.carrierMesh,
            { x: 0, y: 0, z: 0 },
            0,
            camPos,
            -0.16,
            orbitYaw + Math.PI,
            0
        );
    }

    public drawBriefing(
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        timeSec: number
    ) {
        ctx.save();

        // Dim the backdrop so text stays readable
        ctx.fillStyle = 'rgba(3,10,4,0.55)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';
        ctx.shadowColor = PHOSPHOR;
        ctx.shadowBlur = 6;

        ctx.fillStyle = PHOSPHOR;
        ctx.font = 'bold 42px monospace';
        ctx.fillText('CARRIER VECTOR: 1988', cx, 96);

        ctx.font = '14px monospace';
        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.fillText('CV-68 USS NIMITZ  ·  NORWEGIAN SEA  ·  CARRIER STRIKE GROUP', cx, 122);

        ctx.textAlign = 'left';
        const colW = Math.min(420, (w - 140) / 2);
        const leftX = cx - colW - 20;
        const rightX = cx + 20;
        let y = 180;

        this.section(ctx, leftX, y, colW, 'SITUATION', [
            'Soviet strike packages are inbound on your',
            'carrier group. Each package that reaches ETA',
            'zero hits the flight deck: bombers cost 35%',
            'hull integrity and an airframe, fighters 15%.',
            '',
            'Hull integrity at zero ends the mission.'
        ]);

        this.section(ctx, rightX, y, colW, 'YOUR JOB', [
            '1. Arm and fuel your jet on the deck',
            '2. Take the catapult shot [ENTER]',
            '3. Splash the inbounds before ETA zero',
            '4. Use the canyon to break SAM radar lock',
            '5. Trap back aboard: under 90 m/s,',
            '   18-28 m altitude, within 180 m'
        ]);

        y += 168;
        this.section(ctx, leftX, y, colW, 'FLIGHT CONTROLS',
            bindingsFor('FLIGHT').slice(0, 6).map(b => `${b.display.padEnd(12)} ${b.label}`)
        );

        this.section(ctx, rightX, y, colW, 'THREAT DOCTRINE', [
            'RWR SEARCH  a radar is sweeping for you',
            'RWR TRACK   you are locked - get low',
            'RWR LAUNCH  missile inbound - break and',
            '            descend below the ridge line',
            '',
            'Open bay doors quadruple your radar signature.'
        ]);

        // Blinking prompt
        if (Math.floor(timeSec * 2) % 2 === 0) {
            ctx.textAlign = 'center';
            ctx.fillStyle = CAUTION;
            ctx.shadowColor = CAUTION;
            ctx.font = 'bold 17px monospace';
            ctx.fillText('PRESS [ENTER] TO MAN YOUR AIRCRAFT', cx, h - 64);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.font = '12px monospace';
        ctx.fillText('[H] FULL CONTROL REFERENCE      [S] SKIP TO AIRBORNE QUICK START', cx, h - 36);
        ctx.textAlign = 'left';

        ctx.restore();
    }

    private section(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        title: string,
        lines: string[]
    ) {
        ctx.strokeStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(x, y - 18, w, 24 + lines.length * 17);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#030a04';
        ctx.shadowBlur = 0;
        const tw = ctx.measureText(title).width;
        ctx.fillRect(x + 12, y - 25, tw + 14, 14);
        ctx.shadowBlur = 6;

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = PHOSPHOR;
        ctx.shadowColor = PHOSPHOR;
        ctx.fillText(title, x + 18, y - 14);

        ctx.font = '12px monospace';
        let ly = y + 8;
        for (const line of lines) {
            ctx.fillStyle = line.startsWith('RWR LAUNCH') ? ALERT : PHOSPHOR;
            ctx.shadowColor = ctx.fillStyle;
            ctx.fillText(line, x + 14, ly);
            ly += 17;
        }
    }

    /** Full control reference, grouped, pausing the sim while it's open. */
    public drawHelp(ctx: CanvasRenderingContext2D, w: number, h: number, context: ControlContext) {
        ctx.save();
        ctx.fillStyle = 'rgba(3,10,4,0.88)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = PHOSPHOR;
        ctx.shadowColor = PHOSPHOR;
        ctx.shadowBlur = 6;
        ctx.font = 'bold 26px monospace';
        ctx.fillText('CONTROL REFERENCE', cx, 70);

        ctx.font = '12px monospace';
        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.fillText(
            context === 'DECK' ? 'FLIGHT DECK OPERATIONS' : 'COCKPIT / FLIGHT OPERATIONS',
            cx,
            92
        );
        ctx.textAlign = 'left';

        const bindings = bindingsFor(context);
        const groups = [...new Set(bindings.map(b => b.group))];

        const colW = Math.min(440, (w - 160) / 2);
        let col = 0;
        let y = 140;
        const startY = 140;

        for (const group of groups) {
            const items = bindings.filter(b => b.group === group);
            if (y + items.length * 19 + 40 > h - 70 && col === 0) {
                col = 1;
                y = startY;
            }
            const x = cx - colW - 20 + col * (colW + 40);

            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = CAUTION;
            ctx.shadowColor = CAUTION;
            ctx.fillText(group, x, y);
            y += 8;

            ctx.strokeStyle = DIM;
            ctx.shadowColor = DIM;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + colW, y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            y += 18;

            ctx.font = '12px monospace';
            for (const b of items) {
                ctx.fillStyle = PHOSPHOR;
                ctx.shadowColor = PHOSPHOR;
                ctx.fillText(b.display, x, y);
                ctx.fillStyle = DIM;
                ctx.shadowColor = DIM;
                ctx.fillText(b.label, x + 130, y);
                y += 19;
            }
            y += 22;
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = CAUTION;
        ctx.shadowColor = CAUTION;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('PRESS [H] OR [ESC] TO RESUME', cx, h - 40);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    /** End-of-mission debrief with final score and rank. */
    public drawDebrief(ctx: CanvasRenderingContext2D, w: number, h: number, score: ScoreKeeper, wave: number) {
        ctx.save();
        ctx.fillStyle = 'rgba(3,10,4,0.92)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 8;

        ctx.fillStyle = ALERT;
        ctx.shadowColor = ALERT;
        ctx.font = 'bold 40px monospace';
        ctx.fillText('MISSION FAILED', cx, 120);

        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.font = '14px monospace';
        ctx.fillText('CV-68 NIMITZ IS COMBAT INEFFECTIVE', cx, 150);

        const b = score.breakdown;
        const rows: [string, string][] = [
            ['WAVES SURVIVED', `${wave}`],
            ['FIGHTERS SPLASHED', `${b.fighterKills}`],
            ['BOMBERS SPLASHED', `${b.bomberKills}`],
            ['SAM SITES DESTROYED', `${b.samKills}`],
            ['CARRIER TRAPS', `${b.traps}`],
            ['PERFECT 3-WIRE TRAPS', `${b.perfectTraps}`],
            ['BOLTERS', `${b.bolters}`],
            ['AIRFRAMES LOST', `${b.airframesLost}`],
            ['HULL DAMAGE TAKEN', `${Math.round(b.hullDamageTaken)}%`]
        ];

        ctx.textAlign = 'left';
        ctx.font = '13px monospace';
        const boxW = 420;
        let y = 200;
        for (const [label, value] of rows) {
            ctx.fillStyle = DIM;
            ctx.shadowColor = DIM;
            ctx.fillText(label, cx - boxW / 2, y);
            ctx.fillStyle = PHOSPHOR;
            ctx.shadowColor = PHOSPHOR;
            ctx.textAlign = 'right';
            ctx.fillText(value, cx + boxW / 2, y);
            ctx.textAlign = 'left';
            y += 22;
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = CAUTION;
        ctx.shadowColor = CAUTION;
        ctx.font = 'bold 30px monospace';
        ctx.fillText(`${score.totalScore} PTS`, cx, y + 44);
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`FINAL RANK: ${score.rank}`, cx, y + 76);

        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.font = '13px monospace';
        ctx.fillText('PRESS [ENTER] TO RETURN TO BRIEFING', cx, h - 44);
        ctx.textAlign = 'left';
        ctx.restore();
    }
}

export { CONTROL_SCHEMA };
