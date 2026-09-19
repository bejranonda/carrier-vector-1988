/**
 * CARRIER VECTOR: 1988 - Macro Flight Deck Display
 *
 * Built on the responsive DeckLayout solver and the shared Theme kit.
 *
 * DESIGN NOTES (why it looks the way it does):
 *  - The screen now opens with an ORDERS panel that states the one thing the
 *    player is supposed to do next, in plain English, with the key drawn as
 *    a keycap. Previously the only hint that [ENTER] launched the aircraft
 *    was 12px grey text in the page footer, under eight panels of inventory.
 *  - Labels are neutral grey, values carry the colour. When everything was
 *    green, nothing read as important.
 *  - The deck plan is drawn along the panel's long axis (bow to the right)
 *    instead of standing a narrow portrait ship inside a wide column, which
 *    wasted most of a screen column on empty space.
 *  - The radar rose lists contacts in a side table instead of stamping a
 *    text label next to each blip, which overlapped as soon as two packages
 *    shared a bearing.
 */

import type { DeckManager } from '../carrier/DeckManager';
import type { ScoreKeeper } from '../core/ScoreKeeper';
import type { Hint } from '../core/Tutorial';
import type { ObjectiveStep } from '../core/Objectives';
import { formatEta } from '../core/Objectives';
import { computeDeckLayout } from './DeckLayout';
import type { PanelSpec, Rect } from './DeckLayout';
import { WireframeModels } from './VectorRenderer';
import {
    THEME,
    bar,
    drawSegments,
    font,
    glow,
    keycap,
    noGlow,
    panel,
    plate,
    roundRect,
    row
} from './Theme';
import type { Segment } from './Theme';

export interface DeckViewContext {
    objective: ObjectiveStep;
    hint: Hint | null;
    displayModeLabel: string;
    trainingLine: string | null;
}

export class DeckView {
    private carrierMesh = WireframeModels.createCarrier();

    public draw(
        ctx: CanvasRenderingContext2D,
        deck: DeckManager,
        score: ScoreKeeper,
        context: DeckViewContext,
        width: number,
        height: number,
        timeSec: number
    ) {
        const specs: PanelSpec[] = [
            { id: 'ORDERS', minW: 420, rows: 2, pin: 'top', essential: true },
            { id: 'TURNAROUND', minW: 300, rows: 7, priority: 9, essential: true },
            { id: 'PAYLOAD', minW: 300, rows: 5, priority: 8 },
            { id: 'THREATS', minW: 300, rows: 7, priority: 7, minH: 190 },
            { id: 'STATUS', minW: 300, rows: 7, priority: 6 },
            { id: 'CREW', minW: 290, rows: 5, priority: 3 },
            { id: 'DECK_PLAN', minW: 280, rows: 0, aspect: 0.34, priority: 2, maxH: 190, minH: 120 },
            { id: 'LOG', minW: 400, rows: 5, pin: 'bottom', priority: 4 }
        ];

        const layout = computeDeckLayout(specs, { width, height });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        noGlow(ctx);

        this.drawBackdrop(ctx, width, height);
        this.drawHeader(ctx, layout.header, deck, score);

        const p = layout.panels;
        if (p['ORDERS']) this.drawOrders(ctx, p['ORDERS'], context.objective, deck.scrambleAlert);
        if (p['TURNAROUND']) this.drawTurnaround(ctx, p['TURNAROUND'], deck);
        if (p['PAYLOAD']) this.drawPayload(ctx, p['PAYLOAD'], deck);
        if (p['THREATS']) this.drawThreatRose(ctx, p['THREATS'], deck, timeSec);
        if (p['STATUS']) this.drawStatus(ctx, p['STATUS'], deck);
        if (p['CREW']) this.drawCrew(ctx, p['CREW'], deck);
        if (p['DECK_PLAN']) this.drawDeckPlan(ctx, p['DECK_PLAN'], deck);
        if (p['LOG']) this.drawLog(ctx, p['LOG'], deck);

        this.drawFooter(ctx, layout.footer, context);

        ctx.restore();
    }

    /** Faint reference grid so the panels sit on a surface, not a void. */
    private drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
        ctx.save();
        noGlow(ctx);
        ctx.strokeStyle = THEME.grid;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        const step = 64;
        ctx.beginPath();
        for (let x = step; x < w; x += step) {
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, h);
        }
        for (let y = step; y < h; y += step) {
            ctx.moveTo(0, Math.round(y) + 0.5);
            ctx.lineTo(w, Math.round(y) + 0.5);
        }
        ctx.stroke();
        ctx.restore();
    }

    private drawHeader(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager, score: ScoreKeeper) {
        ctx.save();
        noGlow(ctx);

        ctx.fillStyle = THEME.ink;
        ctx.font = font(20, 700);
        ctx.textAlign = 'left';
        ctx.fillText('FLIGHT DECK', r.x, r.y + 20);

        ctx.font = font(12);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('CV-68 USS NIMITZ  ·  NORWEGIAN SEA  ·  1988', r.x, r.y + 38);

        // Right-hand scoreboard chips
        const chips: [string, string, string][] = [
            ['WAVE', `${deck.waveNumber}`, THEME.ink],
            ['SCORE', `${score.totalScore}`, THEME.phosphor],
            ['RANK', score.rank, THEME.caution]
        ];
        let x = r.x + r.w;
        for (let i = chips.length - 1; i >= 0; i--) {
            const [label, value, color] = chips[i];
            ctx.font = font(15, 700);
            const vw = ctx.measureText(value).width;
            ctx.font = font(10, 600);
            const lw = ctx.measureText(label).width;
            const cw = Math.max(vw, lw) + 22;
            x -= cw;

            plate(ctx, { x, y: r.y, w: cw, h: 42 }, { border: THEME.edgeSoft, radius: 4 });
            ctx.textAlign = 'center';
            ctx.font = font(10, 600);
            ctx.fillStyle = THEME.muted;
            ctx.fillText(label, x + cw / 2, r.y + 15);
            ctx.font = font(15, 700);
            ctx.fillStyle = color;
            ctx.fillText(value, x + cw / 2, r.y + 34);
            x -= 8;
        }

        ctx.restore();
    }

    /**
     * The "what do I do now" panel. Always present, always the first thing
     * on screen, and the only place a call to action is rendered large.
     */
    private drawOrders(
        ctx: CanvasRenderingContext2D,
        r: Rect,
        objective: ObjectiveStep,
        scramble: boolean
    ) {
        const accent = objective.urgency === 'URGENT' ? THEME.alert
            : objective.urgency === 'ACTION' ? THEME.caution
                : THEME.phosphor;

        const title = scramble ? 'GENERAL QUARTERS · ' + objective.title : objective.title;
        const inner = panel(ctx, r, 'CURRENT ORDERS', { accent, emphasis: objective.urgency !== 'NORMAL' });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Key first, so the eye lands on the pressable thing.
        let textX = inner.x;
        if (objective.key) {
            const capW = keycap(ctx, inner.x, inner.y + 6, objective.key, { size: 15, color: THEME.key });
            textX = inner.x + capW + 14;
        }

        ctx.font = font(18, 700);
        ctx.fillStyle = objective.urgency === 'NORMAL' ? THEME.ink : accent;
        if (objective.urgency === 'URGENT') glow(ctx, accent, 10);
        ctx.fillText(title, textX, inner.y + 12);
        noGlow(ctx);

        ctx.font = font(12);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(objective.detail, inner.x, inner.y + 34);

        if (objective.waiting) {
            // A moving indeterminate strip: makes "the crews are working, you
            // cannot do anything yet" visibly different from "you are stuck".
            const t = (Date.now() / 900) % 1;
            const stripW = Math.min(120, inner.w * 0.2);
            ctx.save();
            roundRect(ctx, inner.x, inner.y + 44, inner.w, 3, 1.5);
            ctx.clip();
            ctx.fillStyle = THEME.edgeSoft;
            ctx.fillRect(inner.x, inner.y + 44, inner.w, 3);
            ctx.fillStyle = accent;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(inner.x + (inner.w + stripW) * t - stripW, inner.y + 44, stripW, 3);
            ctx.restore();
        }

        ctx.restore();
    }

    private drawTurnaround(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const ready = deck.aircraftState === 'CATAPULT_READY';
        const accent = ready ? THEME.caution : THEME.phosphor;
        const inner = panel(ctx, r, 'AIRCRAFT TURNAROUND', { accent, emphasis: ready });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'left';
        ctx.font = font(16, 700);
        ctx.fillStyle = ready ? THEME.caution : THEME.ink;
        ctx.fillText(deck.aircraftState.replace(/_/g, ' '), inner.x, inner.y + 14);

        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(STATE_BLURB[deck.aircraftState], inner.x, inner.y + 32);

        const barY = inner.y + 46;
        bar(ctx, { x: inner.x, y: barY, w: inner.w, h: 8 }, deck.currentTaskProgress / 100, accent);
        ctx.font = font(11, 600);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(`${Math.floor(deck.currentTaskProgress)}%`, inner.x, barY + 22);

        if (ready) {
            const segs: Segment[] = [{ key: 'ENTER' }, { text: 'CAT SHOT', color: THEME.caution, weight: 600 }];
            drawSegments(ctx, inner.x + 44, barY + 18, segs, 11);
        }

        // What is actually hanging on the jet right now, as opposed to the
        // PAYLOAD panel's plan for the next sortie.
        const loadBase = barY + 46;
        const loadStep = Math.max(16, Math.min(24, (inner.y + inner.h - loadBase) / 3));
        if (loadStep > 12) {
            row(ctx, inner, loadBase, 'LOADED FUEL', `${deck.plannedFuel} L`);
            row(ctx, inner, loadBase + loadStep, 'LOADED AIM-9', `${deck.plannedLoadout.sidewinders}`);
            row(ctx, inner, loadBase + loadStep * 2, 'LOADED MK.82', `${deck.plannedLoadout.ironBombs}`);
        }
        ctx.restore();
    }

    private drawPayload(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = panel(ctx, r, 'NEXT SORTIE PAYLOAD');
        ctx.save();
        noGlow(ctx);

        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('Heavier loads cost range and agility.', inner.x, inner.y + 10);

        // Row pitch is derived from the panel's ACTUAL height. Fixed 26px
        // offsets pushed the last row straight through the bottom border
        // once the layout solver compressed this panel on a short window.
        const top = inner.y + 26;
        const step = Math.max(17, Math.min(30, (inner.h - 34) / 4));
        const line = (i: number) => top + i * step;

        this.adjustable(ctx, inner, line(0), ['1', '2'], 'JP-5 FUEL', `${deck.plannedFuel} L`);
        if (step >= 22) {
            bar(
                ctx,
                { x: inner.x, y: line(0) + 8, w: inner.w, h: 5 },
                deck.plannedFuel / 5000,
                THEME.phosphor,
                16
            );
        }

        this.adjustable(ctx, inner, line(1), ['3'], 'AIM-9 SIDEWINDER', `${deck.plannedLoadout.sidewinders} / 6`);
        this.adjustable(ctx, inner, line(2), ['4'], 'MK.82 IRON BOMB', `${deck.plannedLoadout.ironBombs} / 4`);
        row(ctx, inner, line(3) + 4, '20MM VULCAN', `${deck.plannedLoadout.vulcanAmmo} RDS`);

        ctx.restore();
    }

    /** A payload row whose adjusting keys are drawn as keycaps on the left. */
    private adjustable(
        ctx: CanvasRenderingContext2D,
        inner: Rect,
        y: number,
        keys: string[],
        label: string,
        value: string
    ) {
        if (y > inner.y + inner.h + 6) return;
        let x = inner.x;
        for (const k of keys) {
            x += keycap(ctx, x, y, k, { size: 10 }) + 4;
        }
        ctx.save();
        noGlow(ctx);
        ctx.textBaseline = 'middle';
        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 4, y);
        ctx.font = font(12, 600);
        ctx.fillStyle = THEME.ink;
        ctx.textAlign = 'right';
        ctx.fillText(value, inner.x + inner.w, y);
        ctx.restore();
    }

    private drawStatus(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inv = deck.inventory;
        const hullColor = inv.carrierHealth > 60 ? THEME.phosphor
            : inv.carrierHealth > 30 ? THEME.caution
                : THEME.alert;
        const inner = panel(ctx, r, 'STRIKE GROUP STATUS', {
            accent: hullColor,
            emphasis: inv.carrierHealth <= 30
        });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'left';
        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('HULL INTEGRITY — mission ends at zero', inner.x, inner.y + 10);

        ctx.textAlign = 'right';
        ctx.font = font(13, 700);
        ctx.fillStyle = hullColor;
        ctx.fillText(`${inv.carrierHealth}%`, inner.x + inner.w, inner.y + 10);
        bar(ctx, { x: inner.x, y: inner.y + 16, w: inner.w, h: 8 }, inv.carrierHealth / 100, hullColor);

        const base = inner.y + 46;
        const step = Math.max(14, Math.min(30, (inner.h - 54) / 5));
        row(ctx, inner, base, 'SPARE AIRFRAMES', `${inv.spareAirframes}`,
            inv.spareAirframes > 1 ? THEME.ink : THEME.alert);
        row(ctx, inner, base + step, 'JP-5 FUEL', `${inv.fuelLiters.toLocaleString()} L`);
        row(ctx, inner, base + step * 2, '20MM VULCAN', `${inv.vulcanRounds.toLocaleString()} RDS`);
        row(ctx, inner, base + step * 3, 'AIM-9L SIDEWINDER', `${inv.sidewinders}`);
        row(ctx, inner, base + step * 4, 'MK.82 IRON BOMB', `${inv.ironBombs}`);
        ctx.restore();
    }

    private drawCrew(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = panel(ctx, r, 'DECK CREW STAMINA');
        ctx.save();
        noGlow(ctx);
        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('Tired crews turn aircraft around more slowly.', inner.x, inner.y + 8);

        const step = Math.max(17, Math.min(32, (inner.h - 30) / Math.max(1, deck.crews.length)));
        deck.crews.forEach((crew, i) => {
            const y = inner.y + 26 + i * step;
            if (y > inner.y + inner.h + 6) return;
            const color = crew.stamina > 50 ? THEME.phosphor : crew.stamina > 25 ? THEME.caution : THEME.alert;

            ctx.textBaseline = 'middle';
            ctx.font = font(11);
            ctx.fillStyle = THEME.muted;
            ctx.textAlign = 'left';
            ctx.fillText(crew.role, inner.x, y);

            const barX = inner.x + 76;
            const barW = Math.max(30, inner.w - 76 - 44);
            bar(ctx, { x: barX, y: y - 4, w: barW, h: 7 }, crew.stamina / 100, color, 12);

            ctx.font = font(11, 600);
            ctx.fillStyle = color;
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.floor(crew.stamina)}%`, inner.x + inner.w, y);
        });
        ctx.restore();
    }

    /**
     * Top-down plan of the deck, drawn along the panel's LONG axis (bow to
     * the right) so a wide panel is actually used, with the aircraft glyph
     * positioned by the deck state machine. Turns an opaque status string
     * into something you can watch happen.
     */
    private drawDeckPlan(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = panel(ctx, r, 'DECK PLAN');
        ctx.save();
        noGlow(ctx);

        const cx = inner.x + inner.w / 2;
        const cy = inner.y + inner.h / 2 + 4;
        // World Z runs bow-to-stern; map it to screen X so the ship lies flat.
        const scale = Math.min(inner.w / 400, (inner.h - 16) / 110);

        ctx.strokeStyle = THEME.edge;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.9;
        for (const line of this.carrierMesh.lines) {
            ctx.beginPath();
            ctx.moveTo(cx + line.p1.z * scale, cy - line.p1.x * scale);
            ctx.lineTo(cx + line.p2.z * scale, cy - line.p2.x * scale);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const spot = DECK_SPOTS[deck.aircraftState];
        let az = spot.z;
        if (deck.aircraftState === 'CATAPULT_LAUNCHING') {
            az = -30 + Math.min(1, deck.catapultTimer / 2.5) * 170;
        }

        const gx = cx + az * scale;
        const gy = cy - spot.x * scale;
        const color = spot.color === 'caution' ? THEME.caution
            : spot.color === 'alert' ? THEME.alert
                : spot.color === 'muted' ? THEME.muted
                    : THEME.phosphor;

        // Nose-right aircraft glyph
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        glow(ctx, color, 6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx + 8, gy);
        ctx.lineTo(gx - 5, gy - 5);
        ctx.lineTo(gx - 2, gy);
        ctx.lineTo(gx - 5, gy + 5);
        ctx.closePath();
        ctx.stroke();
        noGlow(ctx);

        ctx.font = font(10, 600);
        ctx.textAlign = 'center';
        ctx.fillText(spot.label, gx, gy - 12);

        ctx.font = font(9);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('STERN · WIRES', inner.x + inner.w * 0.18, inner.y + inner.h);
        ctx.fillText('CAT 1 · BOW', inner.x + inner.w * 0.82, inner.y + inner.h);
        ctx.restore();
    }

    /**
     * PPI-style threat rose plus a sorted contact table. The table exists
     * because stamping "BOMBER 266s" next to each blip made two packages on
     * a similar bearing overprint into an unreadable smear.
     */
    private drawThreatRose(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager, timeSec: number) {
        const live = deck.strikeTimeline
            .filter(p => !p.isIntercepted && !p.hasAttacked)
            .sort((a, b) => a.etaSeconds - b.etaSeconds);
        const soonest = live.length ? live[0].etaSeconds : null;
        const urgent = soonest !== null && soonest <= 120;

        const inner = panel(ctx, r, 'EARLY WARNING RADAR', {
            accent: urgent ? THEME.alert : THEME.phosphor,
            emphasis: urgent
        });

        ctx.save();
        noGlow(ctx);

        // Split: rose on the left, contact table on the right.
        const roseSide = Math.min(inner.h - 10, inner.w * 0.46);
        const radius = roseSide / 2 - 4;
        const cx = inner.x + roseSide / 2;
        const cy = inner.y + inner.h / 2 - 2;

        ctx.strokeStyle = THEME.edgeSoft;
        ctx.lineWidth = 1;
        for (const ring of [0.34, 0.67, 1.0]) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * ring, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
        ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
        ctx.stroke();

        // Sweep wedge (a gradient wedge reads as a sweep; a bare line did not)
        const sweep = (timeSec * 1.1) % (Math.PI * 2);
        ctx.save();
        ctx.globalAlpha = 0.35;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, 'rgba(87,227,155,0.35)');
        grad.addColorStop(1, 'rgba(87,227,155,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, sweep - Math.PI / 2 - 0.5, sweep - Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = THEME.muted;
        ctx.font = font(9, 600);
        ctx.textAlign = 'center';
        ctx.fillText('CV-68', cx, cy + radius + 12);

        for (const pkg of live) {
            const rad = pkg.bearingDeg * (Math.PI / 180);
            const etaRatio = Math.max(0.08, Math.min(1, pkg.etaSeconds / 480));
            const px = cx + Math.sin(rad) * radius * etaRatio;
            const py = cy - Math.cos(rad) * radius * etaRatio;
            const hot = pkg.etaSeconds <= 120;
            const color = hot ? THEME.alert : pkg.aircraftType === 'Tu-22' ? THEME.caution : THEME.phosphor;

            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            glow(ctx, color, hot ? 8 : 4);
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
            noGlow(ctx);
            if (hot) {
                ctx.beginPath();
                ctx.arc(px, py, 7 + Math.sin(timeSec * 6) * 1.5, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Contact table
        const tx = inner.x + roseSide + 12;
        const tw = inner.x + inner.w - tx;
        if (tw > 90) {
            ctx.textAlign = 'left';
            ctx.font = font(10, 600);
            ctx.fillStyle = THEME.muted;
            ctx.fillText(live.length ? `${live.length} INBOUND` : 'NO CONTACTS', tx, inner.y + 8);

            const rowsToShow = Math.min(live.length, Math.max(1, Math.floor((inner.h - 20) / 18)));
            for (let i = 0; i < rowsToShow; i++) {
                const pkg = live[i];
                const y = inner.y + 26 + i * 18;
                const hot = pkg.etaSeconds <= 120;
                const color = hot ? THEME.alert : pkg.aircraftType === 'Tu-22' ? THEME.caution : THEME.phosphor;
                ctx.font = font(11);
                ctx.fillStyle = THEME.muted;
                ctx.textAlign = 'left';
                ctx.fillText(
                    `${pkg.aircraftType === 'Tu-22' ? 'BOMBER' : 'FIGHTER'}${pkg.count > 1 ? ` x${pkg.count}` : ''}`,
                    tx,
                    y
                );
                ctx.font = font(11, 700);
                ctx.fillStyle = color;
                ctx.textAlign = 'right';
                ctx.fillText(formatEta(pkg.etaSeconds), inner.x + inner.w, y);
            }
            if (live.length > rowsToShow) {
                ctx.font = font(10);
                ctx.fillStyle = THEME.muted;
                ctx.textAlign = 'left';
                ctx.fillText(`+${live.length - rowsToShow} more`, tx, inner.y + 26 + rowsToShow * 18);
            }
        }

        ctx.restore();
    }

    private drawLog(ctx: CanvasRenderingContext2D, r: Rect, deck: DeckManager) {
        const inner = panel(ctx, r, 'TACTICAL LOG');
        ctx.save();
        noGlow(ctx);
        ctx.font = font(11);
        ctx.textAlign = 'left';
        const maxRows = Math.max(1, Math.floor(inner.h / 16));
        deck.alertLog.slice(0, maxRows).forEach((entry, i) => {
            const y = inner.y + 10 + i * 16;
            ctx.globalAlpha = Math.max(0.4, 1 - i * 0.14);
            ctx.fillStyle = /CRITICAL|MAYDAY|IMPACT/.test(entry) ? THEME.alert
                : /WARNING|DAMAGE/.test(entry) ? THEME.caution
                    : i === 0 ? THEME.ink : THEME.muted;
            ctx.fillText(entry, inner.x, y);
        });
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    private drawFooter(ctx: CanvasRenderingContext2D, r: Rect, context: DeckViewContext) {
        ctx.save();
        noGlow(ctx);

        if (context.hint) {
            const color = context.hint.severity === 'CRITICAL' ? THEME.alert
                : context.hint.severity === 'WARNING' ? THEME.caution
                    : THEME.phosphor;
            ctx.font = font(12, 600);
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(context.hint.text, r.x, r.y + 10);
        }

        const segs: Segment[] = [
            { key: 'TAB' }, { text: 'cockpit' },
            { key: 'ENTER' }, { text: 'cat shot' },
            { key: '1-4' }, { text: 'payload' },
            { key: 'H' }, { text: 'all controls' },
            { key: 'P' }, { text: context.displayModeLabel }
        ];
        drawSegments(ctx, r.x, r.y + 32, segs, 11);
        ctx.restore();
    }
}

/** One plain-English line per deck state, so the enum stops being jargon. */
const STATE_BLURB: Record<string, string> = {
    HANGAR_MAINTENANCE: 'A replacement airframe is coming up from the hangar.',
    ARMING_REFUELING: 'Ordnance and fuel crews are loading your jet.',
    CATAPULT_READY: 'Armed, fuelled and hooked to the shuttle.',
    CATAPULT_LAUNCHING: 'On the stroke.',
    AIRBORNE: 'Your aircraft is off the deck and in the fight.',
    RECOVERY_TRAP: 'Aircraft trapped aboard, being struck below.',
    DAMAGED_REPAIR: 'Battle damage is being repaired.'
};

interface DeckSpot {
    x: number;
    z: number;
    label: string;
    color: 'phosphor' | 'caution' | 'alert' | 'muted';
}

const DECK_SPOTS: Record<string, DeckSpot> = {
    HANGAR_MAINTENANCE: { x: -20, z: -140, label: 'HANGAR', color: 'muted' },
    ARMING_REFUELING: { x: 24, z: -70, label: 'ARMING', color: 'caution' },
    CATAPULT_READY: { x: 5, z: -30, label: 'CAT 1', color: 'caution' },
    CATAPULT_LAUNCHING: { x: 5, z: -30, label: 'LAUNCH', color: 'caution' },
    AIRBORNE: { x: 5, z: 175, label: 'AIRBORNE', color: 'phosphor' },
    RECOVERY_TRAP: { x: -12, z: -105, label: 'TRAP', color: 'caution' },
    DAMAGED_REPAIR: { x: -20, z: -140, label: 'REPAIR', color: 'alert' }
};
