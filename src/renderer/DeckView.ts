/**
 * CARRIER VECTOR: 1988 - Macro Flight Deck Display
 *
 * Moved out of GameLoop (which carried 137 lines of hardcoded-coordinate
 * fillText calls) and rebuilt on the responsive DeckLayout solver, with
 * proper instrument chrome: bracketed panel frames, segment bars, an
 * animated top-down deck plan, and a PPI threat rose.
 */

import type { DeckManager } from '../carrier/DeckManager';
import type { ScoreKeeper } from '../core/ScoreKeeper';
import type { Hint } from '../core/Tutorial';
import { computeDeckLayout } from './DeckLayout';
import type { PanelSpec, Rect } from './DeckLayout';
import { WireframeModels } from './VectorRenderer';

const PHOSPHOR = '#00ff66';
const DIM = '#00aa44';
const WARN = '#ffaa00';
const ALERT = '#ff3333';
const CAUTION = '#ffff33';

export class DeckView {
    private carrierMesh = WireframeModels.createCarrier();

    public draw(
        ctx: CanvasRenderingContext2D,
        deck: DeckManager,
        score: ScoreKeeper,
        hint: Hint | null,
        width: number,
        height: number,
        timeSec: number
    ) {
        const specs: PanelSpec[] = [
            { id: 'SCRAMBLE', minW: 420, rows: 1, pin: 'top', present: deck.scrambleAlert },
            { id: 'STATUS', minW: 300, rows: 6 },
            { id: 'TURNAROUND', minW: 300, rows: 4 },
            { id: 'DECK_PLAN', minW: 240, rows: 0, aspect: 0.78 },
            { id: 'CREW', minW: 290, rows: 4 },
            { id: 'PAYLOAD', minW: 290, rows: 4 },
            { id: 'THREATS', minW: 300, rows: 6 },
            { id: 'LOG', minW: 400, rows: 6, pin: 'bottom' }
        ];

        const layout = computeDeckLayout(specs, { width, height });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = PHOSPHOR;
        ctx.shadowBlur = 4;

        this.drawHeader(ctx, layout.header, deck, score);

        const p = layout.panels;
        if (p['SCRAMBLE']) this.drawScramble(ctx, p['SCRAMBLE']);
        if (p['STATUS']) this.drawStatus(ctx, p['STATUS'], deck);
        if (p['TURNAROUND']) this.drawTurnaround(ctx, p['TURNAROUND'], deck);
        if (p['DECK_PLAN']) this.drawDeckPlan(ctx, p['DECK_PLAN'], deck);
        if (p['CREW']) this.drawCrew(ctx, p['CREW'], deck);
        if (p['PAYLOAD']) this.drawPayload(ctx, p['PAYLOAD'], deck);
        if (p['THREATS']) this.drawThreatRose(ctx, p['THREATS'], deck, timeSec);
        if (p['LOG']) this.drawLog(ctx, p['LOG'], deck);

        this.drawFooter(ctx, layout.footer, hint);

        ctx.restore();
    }

    // -----------------------------------------------------------------
    // Chrome primitives
    // -----------------------------------------------------------------

    /** Panel frame with bracketed corner ticks and a title notch. Returns the inner rect. */
    private frame(ctx: CanvasRenderingContext2D, r: Rect, title: string, accent: string = PHOSPHOR): Rect {
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 1;

        // Corner brackets
        const c = 12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + c); ctx.lineTo(r.x, r.y); ctx.lineTo(r.x + c, r.y);
        ctx.moveTo(r.x + r.w - c, r.y); ctx.lineTo(r.x + r.w, r.y); ctx.lineTo(r.x + r.w, r.y + c);
        ctx.moveTo(r.x + r.w, r.y + r.h - c); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x + r.w - c, r.y + r.h);
        ctx.moveTo(r.x + c, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x, r.y + r.h - c);
        ctx.stroke();

        // Title punched through the top border
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(title).width;
        ctx.fillStyle = '#051008';
        ctx.shadowBlur = 0;
        ctx.fillRect(r.x + 14, r.y - 7, tw + 10, 14);
        ctx.shadowBlur = 4;
        ctx.fillStyle = accent;
        ctx.fillText(title, r.x + 19, r.y + 4);

        return { x: r.x + 14, y: r.y + 20, w: r.w - 28, h: r.h - 32 };
    }

    private row(
        ctx: CanvasRenderingContext2D,
        inner: Rect,
        i: number,
        label: string,
        value: string,
        color: string = PHOSPHOR
    ) {
        const y = inner.y + 16 + i * 19;
        if (y > inner.y + inner.h + 6) return;
        ctx.font = '12px monospace';
        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.textAlign = 'left';
        ctx.fillText(label, inner.x, y);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.textAlign = 'right';
        ctx.fillText(value, inner.x + inner.w, y);
        ctx.textAlign = 'left';
    }

    /** Segmented bar - reads as a 1980s instrument rather than a flat rectangle. */
    private segmentBar(
        ctx: CanvasRenderingContext2D,
        r: Rect,
        frac: number,
        color: string = PHOSPHOR,
        segments: number = 14
    ) {
        const clamped = Math.max(0, Math.min(1, frac));
        const segW = r.w / segments;
        const lit = Math.round(clamped * segments);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        for (let i = 0; i < segments; i++) {
            ctx.globalAlpha = i < lit ? 1 : 0.18;
            ctx.fillRect(r.x + i * segW + 1, r.y, Math.max(1, segW - 2), r.h);
        }
        ctx.globalAlpha = 1;
    }

    // -----------------------------------------------------------------
    // Panels
    // -----------------------------------------------------------------

    private drawHeader(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager, score: ScoreKeeper) {
        ctx.fillStyle = PHOSPHOR;
        ctx.shadowColor = PHOSPHOR;
        ctx.font = 'bold 19px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('CV-68 USS NIMITZ  //  TACTICAL FLIGHT DECK LOGISTICS', r.x, r.y + 18);

        ctx.font = '12px monospace';
        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.fillText('NORWEGIAN SEA  ·  1988  ·  CARRIER STRIKE GROUP OPERATIONS', r.x, r.y + 36);

        ctx.textAlign = 'right';
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = PHOSPHOR;
        ctx.shadowColor = PHOSPHOR;
        ctx.fillText(`WAVE ${deck.waveNumber}   SCORE ${score.totalScore}   ${score.rank}`, r.x + r.w, r.y + 18);
        ctx.textAlign = 'left';

        ctx.strokeStyle = PHOSPHOR;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + r.h - 4);
        ctx.lineTo(r.x + r.w, r.y + r.h - 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    private drawScramble(ctx: CanvasRenderingContext2D, r: Rect) {
        const flash = Math.floor(Date.now() / 250) % 2 === 0;
        ctx.strokeStyle = ALERT;
        ctx.shadowColor = ALERT;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        if (flash) {
            ctx.fillStyle = ALERT;
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('>>>  GENERAL QUARTERS: SCRAMBLE ALERT  <<<', r.x + r.w / 2, r.y + r.h / 2 + 7);
            ctx.textAlign = 'left';
        }
    }

    private drawStatus(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = this.frame(ctx, r, 'STRIKE GROUP STATUS');
        const inv = deck.inventory;

        const hullColor = inv.carrierHealth > 60 ? PHOSPHOR : inv.carrierHealth > 30 ? WARN : ALERT;
        this.row(ctx, inner, 0, 'HULL INTEGRITY', `${inv.carrierHealth}%`, hullColor);
        this.segmentBar(ctx, { x: inner.x, y: inner.y + 22, w: inner.w, h: 6 }, inv.carrierHealth / 100, hullColor);

        this.row(ctx, inner, 1.7, 'SPARE AIRFRAMES', `${inv.spareAirframes}`, inv.spareAirframes > 1 ? PHOSPHOR : ALERT);
        this.row(ctx, inner, 2.7, 'JP-5 FUEL', `${inv.fuelLiters.toLocaleString()} L`);
        this.row(ctx, inner, 3.7, '20MM VULCAN', `${inv.vulcanRounds.toLocaleString()} RDS`);
        this.row(ctx, inner, 4.7, 'AIM-9L SIDEWINDER', `${inv.sidewinders}`);
        this.row(ctx, inner, 5.7, 'MK.82 IRON BOMB', `${inv.ironBombs}`);
    }

    private drawTurnaround(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const ready = deck.aircraftState === 'CATAPULT_READY';
        const inner = this.frame(ctx, r, 'AIRCRAFT TURNAROUND', ready ? CAUTION : PHOSPHOR);

        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = ready ? CAUTION : PHOSPHOR;
        ctx.shadowColor = ready ? CAUTION : PHOSPHOR;
        ctx.fillText(deck.aircraftState.replace(/_/g, ' '), inner.x, inner.y + 16);

        this.row(ctx, inner, 1.5, 'TASK PROGRESS', `${Math.floor(deck.currentTaskProgress)}%`);
        this.segmentBar(
            ctx,
            { x: inner.x, y: inner.y + 46, w: inner.w, h: 8 },
            deck.currentTaskProgress / 100,
            ready ? CAUTION : PHOSPHOR
        );

        if (ready && Math.floor(Date.now() / 400) % 2 === 0) {
            ctx.fillStyle = CAUTION;
            ctx.shadowColor = CAUTION;
            ctx.font = 'bold 13px monospace';
            ctx.fillText('READY CAT 1  ->  PRESS [ENTER]', inner.x, inner.y + 76);
        }
    }

    /**
     * Top-down orthographic plan of the deck, reusing the existing 3D
     * carrier wireframe rather than authoring new geometry, with the
     * aircraft glyph positioned by its state machine. Turns an opaque
     * status string into something you can actually watch happen.
     */
    private drawDeckPlan(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = this.frame(ctx, r, 'DECK PLAN');
        const cx = inner.x + inner.w / 2;
        const cy = inner.y + inner.h / 2;
        const scale = Math.min(inner.w / 110, inner.h / 380);

        ctx.strokeStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.85;
        for (const line of this.carrierMesh.lines) {
            ctx.beginPath();
            ctx.moveTo(cx + line.p1.x * scale, cy - line.p1.z * scale);
            ctx.lineTo(cx + line.p2.x * scale, cy - line.p2.z * scale);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Aircraft glyph position driven by the deck state machine
        let ax = 5;
        let az = -60;
        let color: string = PHOSPHOR;
        let label = '';
        switch (deck.aircraftState) {
            case 'HANGAR_MAINTENANCE': ax = -20; az = -140; color = DIM; label = 'HANGAR'; break;
            case 'ARMING_REFUELING': ax = 24; az = -70; color = WARN; label = 'ARMING'; break;
            case 'CATAPULT_READY': ax = 5; az = -30; color = CAUTION; label = 'CAT 1'; break;
            case 'CATAPULT_LAUNCHING': {
                const t = Math.min(1, deck.catapultTimer / 2.5);
                ax = 5;
                az = -30 + t * 170;
                color = CAUTION;
                label = 'LAUNCH';
                break;
            }
            case 'AIRBORNE': ax = 5; az = 175; color = PHOSPHOR; label = 'AIRBORNE'; break;
            case 'RECOVERY_TRAP': ax = -12; az = -105; color = WARN; label = 'TRAP'; break;
            case 'DAMAGED_REPAIR': ax = -20; az = -140; color = ALERT; label = 'REPAIR'; break;
        }

        const gx = cx + ax * scale;
        const gy = cy - az * scale;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, gy - 7);
        ctx.lineTo(gx - 5, gy + 5);
        ctx.lineTo(gx, gy + 2);
        ctx.lineTo(gx + 5, gy + 5);
        ctx.closePath();
        ctx.stroke();

        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, gx, gy + 18);
        ctx.textAlign = 'left';
    }

    private drawCrew(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = this.frame(ctx, r, 'DECK CREW STAMINA');
        let i = 0;
        for (const crew of deck.crews) {
            const y = inner.y + 16 + i * 20;
            if (y > inner.y + inner.h + 4) break;
            ctx.font = '11px monospace';
            ctx.fillStyle = DIM;
            ctx.shadowColor = DIM;
            ctx.fillText(crew.role, inner.x, y);

            const barX = inner.x + 80;
            const barW = Math.max(40, inner.w - 130);
            const color = crew.stamina > 50 ? PHOSPHOR : crew.stamina > 25 ? WARN : ALERT;
            this.segmentBar(ctx, { x: barX, y: y - 8, w: barW, h: 7 }, crew.stamina / 100, color, 10);

            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.floor(crew.stamina)}%`, inner.x + inner.w, y);
            ctx.textAlign = 'left';
            i++;
        }
    }

    private drawPayload(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = this.frame(ctx, r, 'NEXT SORTIE PAYLOAD');
        this.row(ctx, inner, 0, '[1/2]  JP-5 FUEL', `${deck.plannedFuel} L`);
        this.segmentBar(ctx, { x: inner.x, y: inner.y + 22, w: inner.w, h: 6 }, deck.plannedFuel / 5000);
        this.row(ctx, inner, 1.7, '[3]  AIM-9 SIDEWINDER', `${deck.plannedLoadout.sidewinders} / 6`);
        this.row(ctx, inner, 2.7, '[4]  MK.82 IRON BOMB', `${deck.plannedLoadout.ironBombs} / 4`);
        this.row(ctx, inner, 3.7, '20MM VULCAN', `${deck.plannedLoadout.vulcanAmmo} RDS`);
    }

    /**
     * PPI-style threat rose. Replaces the three wide text boxes that were
     * the panels running off the right edge of the screen, with a compact
     * 1988 radar scope that reads at a glance.
     */
    private drawThreatRose(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager, timeSec: number) {
        const inner = this.frame(ctx, r, 'EARLY WARNING RADAR');
        const cx = inner.x + inner.w / 2;
        const cy = inner.y + inner.h / 2;
        const radius = Math.min(inner.w, inner.h) / 2 - 10;
        if (radius <= 10) return;

        ctx.strokeStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.lineWidth = 1;
        for (const ring of [0.33, 0.66, 1.0]) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * ring, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius);
        ctx.lineTo(cx, cy + radius);
        ctx.moveTo(cx - radius, cy);
        ctx.lineTo(cx + radius, cy);
        ctx.stroke();

        // Rotating sweep line
        const sweep = (timeSec * 1.2) % (Math.PI * 2);
        ctx.strokeStyle = PHOSPHOR;
        ctx.shadowColor = PHOSPHOR;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(sweep) * radius, cy - Math.cos(sweep) * radius);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Plot each inbound package by bearing and ETA
        ctx.font = '10px monospace';
        for (const pkg of deck.strikeTimeline) {
            if (pkg.isIntercepted || pkg.hasAttacked) continue;
            const rad = pkg.bearingDeg * (Math.PI / 180);
            const etaRatio = Math.max(0.05, Math.min(1, pkg.etaSeconds / 480));
            const px = cx + Math.sin(rad) * radius * etaRatio;
            const py = cy - Math.cos(rad) * radius * etaRatio;

            const urgent = pkg.etaSeconds <= 120;
            const color = urgent ? ALERT : pkg.aircraftType === 'Tu-22' ? WARN : PHOSPHOR;
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.shadowColor = color;

            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
            if (urgent) {
                ctx.beginPath();
                ctx.arc(px, py, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillText(
                `${pkg.aircraftType === 'Tu-22' ? 'BOMBER' : 'MIG'} ${Math.max(0, Math.floor(pkg.etaSeconds))}s`,
                px + 8,
                py + 3
            );
        }

        const live = deck.strikeTimeline.filter(p => !p.isIntercepted && !p.hasAttacked).length;
        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.fillText(`${live} INBOUND`, inner.x, inner.y + inner.h);
    }

    private drawLog(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = this.frame(ctx, r, 'TACTICAL LOG & TELEMETRY');
        ctx.font = '11px monospace';
        let i = 0;
        for (const entry of deck.alertLog) {
            const y = inner.y + 12 + i * 15;
            if (y > inner.y + inner.h + 4) break;
            ctx.globalAlpha = Math.max(0.35, 1 - i * 0.11);
            const color = entry.includes('CRITICAL') || entry.includes('MAYDAY') ? ALERT
                : entry.includes('WARNING') ? WARN
                    : PHOSPHOR;
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.fillText(entry, inner.x, y);
            i++;
        }
        ctx.globalAlpha = 1;
    }

    private drawFooter(ctx: CanvasRenderingContext2D, r: Rect, hint: Hint | null) {
        if (hint) {
            const color = hint.severity === 'CRITICAL' ? ALERT : hint.severity === 'WARNING' ? WARN : PHOSPHOR;
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.font = 'bold 13px monospace';
            ctx.fillText(`>> ${hint.text}`, r.x, r.y + 14);
        }

        ctx.fillStyle = DIM;
        ctx.shadowColor = DIM;
        ctx.font = '12px monospace';
        ctx.fillText(
            '[TAB] COCKPIT   [ENTER] CATAPULT LAUNCH   [1-4] PAYLOAD   [H] HELP',
            r.x,
            r.y + 32
        );
    }
}
