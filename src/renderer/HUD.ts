/**
 * CARRIER VECTOR: 1988 - Vector Cockpit HUD Overlay
 *
 * Pure vector drawing:
 * - Objective strip (what this sortie is asking of you, right now)
 * - Rotating pitch ladder and velocity vector (Flight Path Marker)
 * - Airspeed / altitude blocks and a 360-degree compass tape
 * - Target box & 20mm Vulcan lead computing reticle
 * - Radar Warning Receiver (RWR) azimuth display
 * - Systems block, weapon selector, and carrier approach aids
 * - First-sortie training checklist
 *
 * READABILITY RULES this file follows (the previous version broke all four):
 *  1. Body text is drawn with NO shadow glow. Glow fattens 12px monospace
 *     strokes until they smear into each other, and it was previously left
 *     armed on the context for every single readout.
 *  2. Every text cluster sits on a translucent backplate, so legibility
 *     never depends on what part of the wireframe canyon is behind it.
 *  3. Nothing overlaps. The old layout stacked the approach data block on
 *     top of the pitch ladder, and put the coach ticker and the missile
 *     warning banner at the same y.
 *  4. Colour carries meaning: neutral grey for labels, bright ink for
 *     values, cyan only for keys, amber for caution, red for lethal.
 */

import type { AircraftPhysics, Vector3 } from '../flight/AircraftPhysics';
import type { SensorTacticsManager } from '../tactics/RadarLOS';
import type { VectorRenderer } from './VectorRenderer';
import type { Hint, ChecklistItem } from '../core/Tutorial';
import type { ScoreKeeper } from '../core/ScoreKeeper';
import type { ObjectiveStep } from '../core/Objectives';
import { HUD_METRICS, solveHudLayout } from './HudLayout';
import type { HudLayout } from './HudLayout';
import {
    THEME,
    fitText,
    font,
    glow,
    keycap,
    noGlow,
    plate,
    roundRect
} from './Theme';

export interface AirborneTarget {
    id: string;
    name: string;
    position: Vector3;
    velocity: Vector3;
    isAlive: boolean;

    /**
     * Visual orientation, derived from the velocity vector by EnemyAI so
     * wireframe models bank and pitch into their manoeuvres. Optional and
     * defaulted to 0 by the renderer, so plain target literals still work.
     */
    pitch?: number;
    roll?: number;
    yaw?: number;

    /** Enemy AI state, stored on the contact itself to avoid a parallel map. */
    aiBehavior?: 'INGRESS' | 'ENGAGE' | 'RTB';
    aiFireCooldown?: number;
    aiTurnDemand?: number;
}

export interface HudContext {
    hint: Hint | null;
    score: ScoreKeeper;
    objective: ObjectiveStep;
    checklist: ChecklistItem[];
    displayModeLabel: string;
}

/** Vertical anchors, so no two overlays can be given the same band. */
const BAND = {
    objective: 18,
    compass: 96,
    warning: 132,
    coach: 168
};

export class HUD {
    public width: number;
    public height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public draw(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        sensors: SensorTacticsManager,
        targets: AirborneTarget[],
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB',
        renderer: VectorRenderer,
        context: HudContext
    ) {
        const layout = this.solveLayout(physics, context.checklist.length > 0);

        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.textBaseline = 'alphabetic';
        noGlow(ctx);

        // --- Flight symbology (centre of the screen, drawn in the beam colour) ---
        this.drawPitchLadder(ctx, physics, renderer, layout);
        this.drawFlightPathMarker(ctx, physics, renderer);
        this.drawWaterline(ctx, layout.cx, layout.cy);
        this.drawCombatReticles(ctx, physics, targets, renderer);

        // --- Instruments (all on backplates, all outside the centre box) ---
        this.drawObjectiveStrip(ctx, context.objective, layout.cx);
        this.drawCompassTape(ctx, physics, layout.cx);
        this.drawSpeedBlock(ctx, physics, layout);
        this.drawAltitudeBlock(ctx, physics, sensors, layout);
        this.drawSystemsBlock(ctx, physics, selectedWeapon, layout);
        this.drawRWR(ctx, sensors, layout);
        if (layout.showApproach) this.drawLandingAids(ctx, physics, layout);
        const shown = this.drawWarnings(ctx, physics, sensors, layout.cx, layout.cy);

        // One message per condition. The banner, the ticker and the objective
        // strip all used to shout "missile inbound" simultaneously.
        const duplicated = context.hint !== null && (
            (shown.rwr && /MISSILE|RADAR LOCK/.test(context.hint.text)) ||
            (shown.stall && /STALL/.test(context.hint.text))
        );
        if (context.hint && !duplicated) this.drawCoachTicker(ctx, context.hint, layout.cx);
        if (layout.showChecklist) this.drawChecklist(ctx, context.checklist);
        this.drawScoreChip(ctx, context.score);
        this.drawKeyBar(ctx, context.displayModeLabel);

        ctx.restore();
    }

    /**
     * Is the pilot on an approach? Only then are the landing aids useful -
     * without the closing-rate test the whole panel appeared during the
     * catapult stroke, when the jet is 300 m from the boat and accelerating
     * away from it. Exported shape kept tiny so it is cheap to call twice.
     */
    public static isOnApproach(physics: AircraftPhysics): boolean {
        const range = Math.hypot(physics.position.x, physics.position.z);
        if (range > 3000 || physics.position.y > 400) return false;
        const closingRate = -(
            physics.velocity.x * physics.position.x + physics.velocity.z * physics.position.z
        ) / Math.max(1, range);
        return closingRate >= 5;
    }

    /** Solve instrument placement for the current viewport. */
    private solveLayout(physics: AircraftPhysics, hasChecklist: boolean): HudLayout {
        return solveHudLayout({
            width: this.width,
            height: this.height,
            showApproach: HUD.isOnApproach(physics),
            hasChecklist
        });
    }

    // -----------------------------------------------------------------
    // Objective / guidance
    // -----------------------------------------------------------------

    /**
     * The single most important addition to the cockpit: a line that says
     * what this sortie wants from you. Everything else on screen is state;
     * this is intent.
     */
    private drawObjectiveStrip(ctx: CanvasRenderingContext2D, objective: ObjectiveStep, cx: number) {
        const accent = objective.urgency === 'URGENT' ? THEME.alert
            : objective.urgency === 'ACTION' ? THEME.caution
                : THEME.phosphor;

        ctx.save();
        noGlow(ctx);
        ctx.font = font(17, 700);
        const titleW = ctx.measureText(objective.title).width;
        ctx.font = font(11);
        const detailW = ctx.measureText(objective.detail).width;

        const keyW = objective.key ? 58 : 0;
        const w = Math.min(this.width - 2 * HUD_METRICS.edge, Math.max(titleW + keyW, detailW) + 36);
        const h = 54;
        const x = cx - w / 2;
        const y = BAND.objective;

        plate(ctx, { x, y, w, h }, { fill: 'rgba(6,13,17,0.78)', border: accent, radius: 5 });

        // Left accent rail
        ctx.fillStyle = accent;
        roundRect(ctx, x + 1, y + 1, 3, h - 2, 1.5);
        ctx.fill();

        let textX = x + 16;
        if (objective.key) {
            textX += keycap(ctx, textX, y + 20, objective.key, { size: 12 }) + 10;
        }

        ctx.textAlign = 'left';
        ctx.font = font(17, 700);
        ctx.fillStyle = objective.urgency === 'NORMAL' ? THEME.ink : accent;
        ctx.fillText(fitText(ctx, objective.title, x + w - 14 - textX), textX, y + 25);

        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(fitText(ctx, objective.detail, w - 32), x + 16, y + 43);
        ctx.restore();
    }

    /** Single-channel contextual coaching line (immediate threats/actions). */
    private drawCoachTicker(ctx: CanvasRenderingContext2D, hint: Hint, cx: number) {
        const color = hint.severity === 'CRITICAL' ? THEME.alert
            : hint.severity === 'WARNING' ? THEME.caution
                : THEME.phosphor;

        // Critical cues blink so they can't be tuned out.
        if (hint.severity === 'CRITICAL' && Math.floor(Date.now() / 300) % 2 !== 0) return;

        ctx.save();
        noGlow(ctx);
        ctx.font = font(13, 600);
        const text = fitText(ctx, hint.text, this.width - 80);
        const w = ctx.measureText(text).width + 26;
        const x = cx - w / 2;

        plate(ctx, { x, y: BAND.coach, w, h: 26 }, { fill: 'rgba(6,13,17,0.7)', border: color, radius: 13 });
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, BAND.coach + 14);
        ctx.restore();
    }

    /**
     * First-sortie checklist. The old build showed one training prompt at a
     * time with no sense of how long the sequence was; six steps with ticks
     * turn "the game is nagging me" into "I am making progress".
     */
    private drawChecklist(ctx: CanvasRenderingContext2D, items: ChecklistItem[]) {
        const w = HUD_METRICS.checklistW;
        const rowH = 21;
        const h = 30 + items.length * rowH;
        const x = HUD_METRICS.edge;
        const y = Math.max(BAND.coach + 40, this.height / 2 - h / 2 - 90);

        plate(ctx, { x, y, w, h }, { border: THEME.edgeSoft, radius: 5 });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.muted;
        const done = items.filter(i => i.state === 'DONE').length;
        ctx.fillText(`FLIGHT CHECKOUT  ${done}/${items.length}`, x + 12, y + 16);

        items.forEach((item, i) => {
            const ry = y + 34 + i * rowH;
            const active = item.state === 'ACTIVE';
            const color = item.state === 'DONE' ? THEME.phosphor : active ? THEME.caution : THEME.muted;

            // Tick / current marker
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.6;
            if (item.state === 'DONE') {
                ctx.beginPath();
                ctx.moveTo(x + 12, ry);
                ctx.lineTo(x + 15, ry + 4);
                ctx.lineTo(x + 21, ry - 4);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(x + 16, ry, active ? 4.5 : 3, 0, Math.PI * 2);
                if (active) {
                    ctx.fillStyle = color;
                    ctx.fill();
                } else {
                    ctx.stroke();
                }
            }

            ctx.font = font(11, active ? 600 : 400);
            ctx.fillStyle = color;
            ctx.fillText(item.label, x + 28, ry);

            if (active) {
                let kx = x + 28 + ctx.measureText(item.label).width + 8;
                for (const k of item.keys) {
                    if (kx > x + w - 26) break;
                    kx += keycap(ctx, kx, ry, k, { size: 9 }) + 3;
                }
            }
        });
        ctx.restore();
    }

    // -----------------------------------------------------------------
    // Primary flight instruments
    // -----------------------------------------------------------------

    private drawSpeedBlock(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, layout: HudLayout) {
        const knots = Math.floor(physics.airSpeed * 1.94384);
        const mach = physics.airSpeed / 340;
        const w = HUD_METRICS.speedW;
        const x = layout.speedX;
        const y = layout.cy - 34;

        plate(ctx, { x, y, w, h: 68 }, { border: THEME.edgeSoft });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'center';
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('AIRSPEED KT', x + w / 2, y + 16);

        ctx.font = font(26, 700);
        ctx.fillStyle = physics.isStalled ? THEME.alert : THEME.ink;
        ctx.fillText(`${knots}`, x + w / 2, y + 44);

        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(`M ${mach.toFixed(2)}   ${Math.round(physics.airSpeed)} M/S`, x + w / 2, y + 60);
        ctx.restore();
    }

    private drawAltitudeBlock(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        sensors: SensorTacticsManager,
        layout: HudLayout
    ) {
        const altMsl = Math.floor(physics.position.y * 3.28084);
        const terrainAlt = sensors.terrain.getElevation(physics.position.x, physics.position.z);
        const aglM = Math.max(0, physics.position.y - terrainAlt);
        const aglFt = Math.floor(aglM * 3.28084);
        const lowAgl = aglM < 150;

        const w = HUD_METRICS.altW;
        const x = layout.altX;
        const y = layout.cy - 34;

        plate(ctx, { x, y, w, h: 68 }, { border: THEME.edgeSoft });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'center';
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('ALTITUDE FT', x + w / 2, y + 16);

        ctx.font = font(26, 700);
        ctx.fillStyle = THEME.ink;
        ctx.fillText(`${altMsl}`, x + w / 2, y + 44);

        ctx.font = font(11, lowAgl ? 600 : 400);
        ctx.fillStyle = lowAgl ? THEME.caution : THEME.muted;
        ctx.fillText(`RADAR ${aglFt} AGL`, x + w / 2, y + 60);
        ctx.restore();
    }

    private drawSystemsBlock(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB',
        layout: HudLayout
    ) {
        if (layout.compactSystems) {
            this.drawSystemsStrip(ctx, physics, selectedWeapon);
            return;
        }

        const w = HUD_METRICS.systemsW;
        const h = 150;
        const x = HUD_METRICS.edge;
        const y = this.height - h - 54;

        plate(ctx, { x, y, w, h }, { border: THEME.edgeSoft });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const label = (text: string, value: string, ry: number, color: string) => {
            ctx.font = font(10, 600);
            ctx.fillStyle = THEME.muted;
            ctx.textAlign = 'left';
            ctx.fillText(text, x + 12, ry);
            ctx.font = font(12, 600);
            ctx.fillStyle = color;
            ctx.textAlign = 'right';
            ctx.fillText(value, x + w - 12, ry);
        };

        const ab = physics.throttle > 1.0;
        label('THROTTLE', `${Math.floor(physics.throttle * 100)}%${ab ? ' AB' : ''}`, y + 18,
            ab ? THEME.caution : THEME.ink);

        // Throttle bar with a marked military-power detent at 100%.
        const tbX = x + 12;
        const tbW = w - 24;
        ctx.fillStyle = THEME.edgeSoft;
        ctx.fillRect(tbX, y + 26, tbW, 4);
        ctx.fillStyle = ab ? THEME.caution : THEME.phosphor;
        ctx.fillRect(tbX, y + 26, tbW * Math.min(1, physics.throttle / 1.5), 4);
        ctx.fillStyle = THEME.muted;
        ctx.fillRect(tbX + tbW * (1 / 1.5), y + 23, 1, 10);

        const fuelLow = physics.fuel < 800;
        label('FUEL', `${Math.floor(physics.fuel)} L`, y + 48, fuelLow ? THEME.alert : THEME.ink);
        label('G-LOAD', `${physics.gLoad.toFixed(1)} G`, y + 68,
            Math.abs(physics.gLoad) > 7 ? THEME.caution : THEME.ink);

        const hull = Math.max(0, Math.round(100 - physics.damage));
        label('AIRFRAME', `${hull}%`, y + 88,
            hull > 60 ? THEME.ink : hull > 30 ? THEME.caution : THEME.alert);

        label('WEAPONS BAY', physics.bayOpen ? 'OPEN · RCS x4' : 'CLOSED', y + 108,
            physics.bayOpen ? THEME.caution : THEME.muted);

        // Weapon selector: three chips make it obvious that 1/2/3 switch stores.
        const chips: [string, 'GUN' | 'AIM9' | 'BOMB', string][] = [
            [`1 GUN ${physics.loadout.vulcanAmmo}`, 'GUN', '1'],
            [`2 AIM9 ${physics.loadout.sidewinders}`, 'AIM9', '2'],
            [`3 MK82 ${physics.loadout.ironBombs}`, 'BOMB', '3']
        ];
        let chipX = x + 12;
        const chipY = y + h - 18;
        for (const [text, id] of chips) {
            ctx.font = font(10, 600);
            const cw = ctx.measureText(text).width + 12;
            const selected = selectedWeapon === id;
            roundRect(ctx, chipX, chipY - 9, cw, 18, 3);
            ctx.fillStyle = selected ? 'rgba(95,216,255,0.2)' : 'rgba(255,255,255,0.04)';
            ctx.fill();
            ctx.strokeStyle = selected ? THEME.key : THEME.edgeSoft;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = selected ? THEME.ink : THEME.muted;
            ctx.textAlign = 'center';
            ctx.fillText(text, chipX + cw / 2, chipY);
            chipX += cw + 6;
        }
        ctx.restore();
    }

    /**
     * Short-window fallback for the systems readout: one line along the
     * bottom. The 150px panel would otherwise eat a third of the screen and
     * climb into the centre instrument band.
     */
    private drawSystemsStrip(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB'
    ) {
        const h = 26;
        const y = this.height - 54;
        const x = HUD_METRICS.edge;
        const w = this.width - HUD_METRICS.edge * 2;
        plate(ctx, { x, y: y - h / 2, w, h }, { border: THEME.edgeSoft, radius: 4 });

        const ab = physics.throttle > 1.0;
        const hull = Math.max(0, Math.round(100 - physics.damage));
        const wpn = selectedWeapon === 'GUN' ? `GUN ${physics.loadout.vulcanAmmo}`
            : selectedWeapon === 'AIM9' ? `AIM9 ${physics.loadout.sidewinders}`
                : `MK82 ${physics.loadout.ironBombs}`;
        const cells: [string, string, string][] = [
            ['THR', `${Math.floor(physics.throttle * 100)}%${ab ? ' AB' : ''}`, ab ? THEME.caution : THEME.ink],
            ['FUEL', `${Math.floor(physics.fuel)}L`, physics.fuel < 800 ? THEME.alert : THEME.ink],
            ['G', physics.gLoad.toFixed(1), THEME.ink],
            ['HULL', `${hull}%`, hull > 60 ? THEME.ink : hull > 30 ? THEME.caution : THEME.alert],
            ['BAY', physics.bayOpen ? 'OPEN' : 'SHUT', physics.bayOpen ? THEME.caution : THEME.muted],
            ['WPN', wpn, THEME.ink]
        ];

        ctx.save();
        noGlow(ctx);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        let cursor = x + 12;
        for (const [label, value, color] of cells) {
            ctx.font = font(9, 600);
            ctx.fillStyle = THEME.muted;
            ctx.fillText(label, cursor, y);
            cursor += ctx.measureText(label).width + 5;
            ctx.font = font(11, 600);
            ctx.fillStyle = color;
            ctx.fillText(value, cursor, y);
            cursor += ctx.measureText(value).width + 16;
            if (cursor > x + w - 40) break;
        }
        ctx.restore();
    }

    /** Bottom key bar so the flight controls are never more than a glance away. */
    private drawKeyBar(ctx: CanvasRenderingContext2D, displayModeLabel: string) {
        ctx.save();
        noGlow(ctx);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        const y = this.height - 22;
        const pairs: [string, string][] = [
            ['WASD', 'fly'],
            ['SHIFT', 'power'],
            ['SPACE', 'fire'],
            ['TAB', 'deck'],
            ['H', 'controls'],
            ['P', displayModeLabel]
        ];
        let x = 24;
        for (const [key, text] of pairs) {
            x += keycap(ctx, x, y, key, { size: 10 }) + 5;
            ctx.font = font(10);
            ctx.fillStyle = THEME.muted;
            ctx.fillText(text, x, y);
            x += ctx.measureText(text).width + 14;
        }
        ctx.restore();
    }

    private drawScoreChip(ctx: CanvasRenderingContext2D, score: ScoreKeeper) {
        ctx.save();
        noGlow(ctx);
        ctx.font = font(11, 600);
        const text = `${score.totalScore} PTS · ${score.rank}`;
        const w = ctx.measureText(text).width + 22;
        const x = this.width - w - 20;
        plate(ctx, { x, y: 18, w, h: 26 }, { border: THEME.edgeSoft, radius: 13 });
        ctx.fillStyle = score.totalScore < 0 ? THEME.alert : THEME.phosphor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, 31);
        ctx.restore();
    }

    // -----------------------------------------------------------------
    // Carrier approach
    // -----------------------------------------------------------------

    /**
     * Fresnel lens "meatball" glideslope, AoA approach indexer and deck
     * lineup cue, shown inside 3 km. Grouped into one labelled panel on the
     * left of the screen; it previously floated loose over the pitch ladder
     * with an approach data line drawn straight through it.
     */
    private drawLandingAids(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, layout: HudLayout) {
        const rangeToShip = Math.hypot(physics.position.x, physics.position.z);

        const DECK_Y = 20;
        const GLIDESLOPE_RAD = 3.5 * (Math.PI / 180);
        const desiredAlt = DECK_Y + Math.tan(GLIDESLOPE_RAD) * rangeToShip;
        const error = physics.position.y - desiredAlt;

        const w = HUD_METRICS.approachW;
        const h = 178;
        const x = layout.approachX;
        const y = layout.cy - h / 2;

        plate(ctx, { x, y, w, h }, { border: THEME.edgeSoft });

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.muted;
        ctx.fillText('CALL THE BALL', x + w / 2, y + 16);

        // --- Meatball: 5 cells, datum bars either side ---
        const ballX = x + 44;
        const ballY = y + h / 2 - 4;
        const cell = 15;
        const index = Math.max(-2, Math.min(2, Math.round(error / 6)));

        ctx.strokeStyle = THEME.phosphor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ballX - 24, ballY); ctx.lineTo(ballX - 11, ballY);
        ctx.moveTo(ballX + 11, ballY); ctx.lineTo(ballX + 24, ballY);
        ctx.stroke();

        ctx.strokeStyle = THEME.edgeSoft;
        ctx.lineWidth = 1;
        ctx.strokeRect(ballX - 9, ballY - cell * 2.5, 18, cell * 5);

        const low = index <= -2;
        const ballColor = low ? THEME.alert : index >= 2 ? THEME.caution : '#ffe066';
        ctx.fillStyle = ballColor;
        glow(ctx, ballColor, 8);
        ctx.beginPath();
        ctx.arc(ballX, ballY - index * cell, 6, 0, Math.PI * 2);
        ctx.fill();
        noGlow(ctx);

        ctx.font = font(9);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(index > 0 ? 'HIGH' : index < 0 ? 'LOW' : 'ON SLOPE', ballX, y + h - 40);

        // --- AoA approach indexer (carrier-standard 3 symbols) ---
        const idxX = x + w - 38;
        const alphaDeg = physics.alpha * (180 / Math.PI);
        const onSpeed = Math.abs(alphaDeg - 8.1) <= 1.2;
        const fast = alphaDeg < 8.1 - 1.2;
        const slow = alphaDeg > 8.1 + 1.2;
        const off = THEME.edgeSoft;

        ctx.lineWidth = 2;
        ctx.strokeStyle = fast ? THEME.caution : off;
        ctx.beginPath();
        ctx.moveTo(idxX - 8, ballY - 30); ctx.lineTo(idxX, ballY - 22); ctx.lineTo(idxX + 8, ballY - 30);
        ctx.stroke();

        ctx.strokeStyle = onSpeed ? THEME.phosphor : off;
        ctx.beginPath();
        ctx.arc(idxX, ballY, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = slow ? THEME.alert : off;
        ctx.beginPath();
        ctx.moveTo(idxX - 8, ballY + 30); ctx.lineTo(idxX, ballY + 22); ctx.lineTo(idxX + 8, ballY + 30);
        ctx.stroke();

        ctx.font = font(9);
        ctx.fillStyle = fast ? THEME.caution : slow ? THEME.alert : THEME.phosphor;
        ctx.fillText(fast ? 'FAST' : slow ? 'SLOW' : 'ON SPEED', idxX, y + h - 40);

        // --- Approach data ---
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.ink;
        ctx.fillText(
            `${(rangeToShip / 1000).toFixed(1)} KM   ${Math.round(physics.airSpeed)} M/S`,
            x + w / 2,
            y + h - 20
        );
        ctx.restore();
    }

    // -----------------------------------------------------------------
    // Threat symbology
    // -----------------------------------------------------------------

    private drawWarnings(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        sensors: SensorTacticsManager,
        cx: number,
        cy: number
    ): { rwr: boolean; stall: boolean } {
        const banner = (text: string, color: string, blinkMs: number) => {
            if (blinkMs > 0 && Math.floor(Date.now() / blinkMs) % 2 !== 0) return;
            ctx.save();
            noGlow(ctx);
            ctx.font = font(16, 700);
            const w = ctx.measureText(text).width + 30;
            const x = cx - w / 2;
            plate(ctx, { x, y: BAND.warning, w, h: 28 }, { fill: 'rgba(24,6,8,0.8)', border: color, radius: 4 });
            ctx.fillStyle = color;
            glow(ctx, color, 8);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, cx, BAND.warning + 15);
            ctx.restore();
        };

        const rwrBanner = sensors.masterRwrState === 'LAUNCH' || sensors.masterRwrState === 'TRACK';
        if (sensors.masterRwrState === 'LAUNCH') {
            banner('MISSILE LAUNCH — GET LOW', THEME.alert, 260);
        } else if (sensors.masterRwrState === 'TRACK') {
            banner('RADAR LOCK — DESCEND TO MASK', THEME.caution, 0);
        } else {
            const masked = sensors.activeThreats.some(t => t.isTerrainMasked);
            if (masked && physics.position.y < 350) {
                ctx.save();
                noGlow(ctx);
                ctx.font = font(11, 600);
                ctx.fillStyle = THEME.phosphor;
                ctx.textAlign = 'center';
                ctx.fillText('TERRAIN MASKED', cx, BAND.warning + 18);
                ctx.restore();
            }
        }

        if (!physics.isStalled) return { rwr: rwrBanner, stall: false };

        if (Math.floor(Date.now() / 220) % 2 === 0) {
            ctx.save();
            noGlow(ctx);
            ctx.font = font(20, 700);
            const text = 'STALL — LOWER THE NOSE';
            const w = ctx.measureText(text).width + 32;
            plate(ctx, { x: cx - w / 2, y: cy - 108, w, h: 32 },
                { fill: 'rgba(30,5,5,0.85)', border: THEME.alert, radius: 4 });
            ctx.fillStyle = THEME.alert;
            glow(ctx, THEME.alert, 10);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, cx, cy - 92);
            ctx.restore();
        }
        return { rwr: rwrBanner, stall: true };
    }

    private drawRWR(ctx: CanvasRenderingContext2D, sensors: SensorTacticsManager, layout: HudLayout) {
        const size = layout.rwrSize;
        const x = this.width - size - HUD_METRICS.edge;
        const y = this.height - size - (layout.compactSystems ? 76 : 54);
        const rwrX = x + size / 2;
        const rwrY = y + size / 2 + 6;
        const rwrRadius = size / 2 - 16;

        plate(ctx, { x, y, w: size, h: size }, { border: THEME.edgeSoft });

        ctx.save();
        noGlow(ctx);
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.muted;
        ctx.textAlign = 'center';
        ctx.fillText('RWR', rwrX, y + 16);

        ctx.strokeStyle = THEME.edgeSoft;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rwrX, rwrY, rwrRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rwrX, rwrY, rwrRadius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rwrX, rwrY - rwrRadius); ctx.lineTo(rwrX, rwrY + rwrRadius);
        ctx.moveTo(rwrX - rwrRadius, rwrY); ctx.lineTo(rwrX + rwrRadius, rwrY);
        ctx.stroke();

        ctx.textBaseline = 'middle';
        for (const threat of sensors.activeThreats) {
            if (threat.state === 'SILENT') continue;
            const rad = threat.azimuthDeg * (Math.PI / 180);
            const distRatio = Math.min(1.0, threat.distance / 12000);
            const contactR = (0.3 + distRatio * 0.6) * rwrRadius;
            const tx = rwrX + Math.sin(rad) * contactR;
            const ty = rwrY - Math.cos(rad) * contactR;

            const color = threat.state === 'LAUNCH' ? THEME.alert
                : threat.state === 'TRACK' ? THEME.caution
                    : THEME.phosphor;
            const symbol = threat.state === 'LAUNCH' ? 'M' : threat.state === 'TRACK' ? 'T' : 'S';

            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.font = font(11, 700);
            if (threat.state === 'LAUNCH') glow(ctx, color, 8);
            ctx.fillText(symbol, tx, ty);
            noGlow(ctx);
            if (threat.state !== 'SEARCH') {
                ctx.beginPath();
                ctx.arc(tx, ty, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    private drawCombatReticles(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        targets: AirborneTarget[],
        renderer: VectorRenderer
    ) {
        const bulletSpeed = 1050; // m/s for 20mm Vulcan M61A1

        ctx.save();
        noGlow(ctx);
        for (const target of targets) {
            if (!target.isAlive) continue;

            const dx = target.position.x - physics.position.x;
            const dy = target.position.y - physics.position.y;
            const dz = target.position.z - physics.position.z;
            const dist = Math.hypot(dx, dy, dz);
            if (dist > 7000) continue;

            const camPt = renderer.transformToCamera(
                target.position, physics.position, physics.pitch, physics.yaw, physics.roll
            );
            if (camPt.z < 2.0) continue;

            const proj = renderer.projectCameraPoint(camPt);

            // Target bracket: corner ticks read better over a wireframe than
            // a closed box, which competed with the terrain lines.
            const s = Math.max(16, Math.min(56, 24000 / dist)) / 2;
            const c = Math.max(4, s * 0.35);
            ctx.strokeStyle = THEME.hostile;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(proj.x - s, proj.y - s + c); ctx.lineTo(proj.x - s, proj.y - s); ctx.lineTo(proj.x - s + c, proj.y - s);
            ctx.moveTo(proj.x + s - c, proj.y - s); ctx.lineTo(proj.x + s, proj.y - s); ctx.lineTo(proj.x + s, proj.y - s + c);
            ctx.moveTo(proj.x + s, proj.y + s - c); ctx.lineTo(proj.x + s, proj.y + s); ctx.lineTo(proj.x + s - c, proj.y + s);
            ctx.moveTo(proj.x - s + c, proj.y + s); ctx.lineTo(proj.x - s, proj.y + s); ctx.lineTo(proj.x - s, proj.y + s - c);
            ctx.stroke();

            // Only the nearest handful of contacts get a text tag, and it is
            // a short type + range, not the full aircraft designation - a
            // screen full of "MiG-23 FLOGGER #2" labels was unreadable.
            if (dist < 4500) {
                ctx.font = font(10, 600);
                ctx.fillStyle = THEME.hostile;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${shortName(target.name)} ${(dist / 1000).toFixed(1)}KM`, proj.x + s + 6, proj.y);
            }

            // Lead computing pipper
            const timeToImpact = dist / bulletSpeed;
            const leadWorldPos: Vector3 = {
                x: target.position.x + target.velocity.x * timeToImpact,
                y: target.position.y + target.velocity.y * timeToImpact - 0.5 * 9.81 * (timeToImpact ** 2),
                z: target.position.z + target.velocity.z * timeToImpact
            };
            const leadCamPt = renderer.transformToCamera(
                leadWorldPos, physics.position, physics.pitch, physics.yaw, physics.roll
            );
            if (leadCamPt.z < 2.0) continue;

            const leadProj = renderer.projectCameraPoint(leadCamPt);
            const offsetToBore = Math.hypot(leadProj.x - this.width / 2, leadProj.y - this.height / 2);
            const inSolution = offsetToBore < 25 && dist < 2200;

            ctx.strokeStyle = inSolution ? THEME.caution : THEME.phosphor;
            ctx.lineWidth = inSolution ? 2 : 1.4;
            ctx.beginPath();
            ctx.arc(leadProj.x, leadProj.y, 13, 0, Math.PI * 2);
            ctx.moveTo(leadProj.x - 4, leadProj.y); ctx.lineTo(leadProj.x + 4, leadProj.y);
            ctx.moveTo(leadProj.x, leadProj.y - 4); ctx.lineTo(leadProj.x, leadProj.y + 4);
            ctx.stroke();

            if (inSolution) {
                ctx.font = font(13, 700);
                ctx.fillStyle = THEME.caution;
                ctx.textAlign = 'center';
                ctx.fillText('SHOOT', leadProj.x, leadProj.y + 30);
            }
        }
        ctx.restore();
    }

    // -----------------------------------------------------------------
    // Flight symbology
    // -----------------------------------------------------------------

    private drawWaterline(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        ctx.save();
        ctx.strokeStyle = THEME.phosphor;
        ctx.lineWidth = 2;
        glow(ctx, THEME.phosphor, 5);
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy);
        ctx.lineTo(cx - 10, cy);
        ctx.lineTo(cx - 10, cy + 6);
        ctx.moveTo(cx - 2, cy);
        ctx.lineTo(cx + 2, cy);
        ctx.moveTo(cx + 10, cy + 6);
        ctx.lineTo(cx + 10, cy);
        ctx.lineTo(cx + 30, cy);
        ctx.stroke();
        ctx.restore();
    }

    private drawFlightPathMarker(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        renderer: VectorRenderer
    ) {
        const speed = physics.airSpeed;
        if (speed < 5) return;

        const vNorm = {
            x: physics.velocity.x / speed,
            y: physics.velocity.y / speed,
            z: physics.velocity.z / speed
        };

        // Project a point far along the actual velocity vector through the
        // SAME camera pipeline the 3D world uses, so the marker always sits
        // on the real flight path by construction.
        const probe: Vector3 = {
            x: physics.position.x + vNorm.x * 5000,
            y: physics.position.y + vNorm.y * 5000,
            z: physics.position.z + vNorm.z * 5000
        };
        const camPt = renderer.transformToCamera(probe, physics.position, physics.pitch, physics.yaw, physics.roll);
        if (camPt.z < renderer.nearPlane) return; // velocity vector points behind the canopy

        const proj = renderer.projectCameraPoint(camPt);

        ctx.save();
        ctx.strokeStyle = THEME.phosphor;
        ctx.lineWidth = 1.8;
        glow(ctx, THEME.phosphor, 5);
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
        ctx.moveTo(proj.x - 8, proj.y); ctx.lineTo(proj.x - 18, proj.y);
        ctx.moveTo(proj.x + 8, proj.y); ctx.lineTo(proj.x + 18, proj.y);
        ctx.moveTo(proj.x, proj.y - 8); ctx.lineTo(proj.x, proj.y - 14);
        ctx.stroke();
        ctx.restore();
    }

    private drawPitchLadder(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        renderer: VectorRenderer,
        layout: HudLayout
    ) {
        const { cx, cy, symScale } = layout;

        ctx.save();
        // Clip to the space between the side instruments so the ladder can
        // never be drawn underneath the airspeed or altitude blocks.
        ctx.beginPath();
        ctx.rect(
            layout.speedX + HUD_METRICS.speedW + 6,
            BAND.coach + 30,
            Math.max(40, layout.altX - 6 - (layout.speedX + HUD_METRICS.speedW + 6)),
            Math.max(60, this.height - 130 - (BAND.coach + 30))
        );
        ctx.clip();

        ctx.translate(cx, cy);
        ctx.rotate(-physics.roll);
        noGlow(ctx);
        ctx.strokeStyle = THEME.phosphor;
        ctx.fillStyle = THEME.phosphor;
        ctx.font = font(11, 600);
        ctx.textBaseline = 'middle';

        const pitchDeg = physics.pitch * (180 / Math.PI);
        const startDeg = Math.floor((pitchDeg - 35) / 5) * 5;
        const endDeg = Math.floor((pitchDeg + 35) / 5) * 5;

        for (let deg = startDeg; deg <= endDeg; deg += 5) {
            if (deg < -85 || deg > 85) continue;

            // Exact projection: a world ray at angular depression delta from
            // boresight projects to fov*tan(delta) px from screen centre, the
            // same perspective divide VectorRenderer uses for the scene, so
            // each rung lands on the real horizon.
            const deltaRad = (pitchDeg - deg) * (Math.PI / 180);
            if (Math.abs(deltaRad) > 1.45) continue;
            const yOffset = renderer.fov * Math.tan(deltaRad);
            if (Math.abs(yOffset) > this.height) continue;

            const major = deg % 10 === 0;
            // Rungs fade away from the horizon so the ladder stops competing
            // with the terrain wireframe for attention.
            ctx.globalAlpha = deg === 0 ? 0.95 : major ? 0.6 : 0.34;

            if (deg === 0) {
                const far = 170 * symScale;
                const near = 46 * symScale;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-far, yOffset); ctx.lineTo(-near, yOffset);
                ctx.moveTo(near, yOffset); ctx.lineTo(far, yOffset);
                ctx.stroke();
                ctx.textAlign = 'right';
                ctx.fillText('00', -far - 8, yOffset);
                ctx.textAlign = 'left';
                ctx.fillText('00', far + 8, yOffset);
                continue;
            }

            const halfW = (major ? 48 : 30) * symScale;
            const gap = 30 * symScale;
            ctx.lineWidth = 1.3;
            ctx.save();
            if (deg < 0) ctx.setLineDash([6, 5]);
            ctx.beginPath();
            ctx.moveTo(-halfW - gap, yOffset); ctx.lineTo(-gap, yOffset);
            ctx.moveTo(halfW + gap, yOffset); ctx.lineTo(gap, yOffset);
            ctx.stroke();
            ctx.restore();

            const tick = deg > 0 ? 8 : -8;
            ctx.beginPath();
            ctx.moveTo(-gap, yOffset); ctx.lineTo(-gap, yOffset + tick);
            ctx.moveTo(gap, yOffset); ctx.lineTo(gap, yOffset + tick);
            ctx.stroke();

            if (major) {
                const text = Math.abs(deg).toString().padStart(2, '0');
                ctx.textAlign = 'right';
                ctx.fillText(text, -halfW - gap - 6, yOffset);
                ctx.textAlign = 'left';
                ctx.fillText(text, halfW + gap + 6, yOffset);
            }
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    private drawCompassTape(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, cx: number) {
        const topY = BAND.compass;
        const tapeWidth = Math.min(340, this.width - 120);
        const pxPerDegree = tapeWidth / 90;

        let headingDeg = (physics.yaw * (180 / Math.PI)) % 360;
        if (headingDeg < 0) headingDeg += 360;

        plate(
            ctx,
            { x: cx - tapeWidth / 2 - 8, y: topY - 20, w: tapeWidth + 16, h: 32 },
            { border: THEME.edgeSoft, radius: 4 }
        );

        ctx.save();
        noGlow(ctx);
        ctx.strokeStyle = THEME.edgeSoft;
        ctx.fillStyle = THEME.muted;
        ctx.lineWidth = 1;
        ctx.textBaseline = 'middle';

        const minHeading = headingDeg - (tapeWidth / 2) / pxPerDegree;
        const maxHeading = headingDeg + (tapeWidth / 2) / pxPerDegree;
        const startH = Math.floor(minHeading / 5) * 5;
        const endH = Math.ceil(maxHeading / 5) * 5;

        for (let h = startH; h <= endH; h += 5) {
            const normH = ((h % 360) + 360) % 360;
            const xOffset = cx + (h - headingDeg) * pxPerDegree;
            if (xOffset < cx - tapeWidth / 2 || xOffset > cx + tapeWidth / 2) continue;

            if (normH % 10 === 0) {
                ctx.beginPath();
                ctx.moveTo(xOffset, topY + 4);
                ctx.lineTo(xOffset, topY + 9);
                ctx.stroke();

                let label = (normH / 10).toString().padStart(2, '0');
                let cardinal = false;
                if (normH === 0) { label = 'N'; cardinal = true; }
                else if (normH === 90) { label = 'E'; cardinal = true; }
                else if (normH === 180) { label = 'S'; cardinal = true; }
                else if (normH === 270) { label = 'W'; cardinal = true; }

                ctx.font = font(11, cardinal ? 700 : 400);
                ctx.fillStyle = cardinal ? THEME.ink : THEME.muted;
                ctx.textAlign = 'center';
                ctx.fillText(label, xOffset, topY - 3);
            } else {
                ctx.beginPath();
                ctx.moveTo(xOffset, topY + 6);
                ctx.lineTo(xOffset, topY + 9);
                ctx.stroke();
            }
        }

        // Lubber line + numeric heading
        ctx.fillStyle = THEME.phosphor;
        ctx.beginPath();
        ctx.moveTo(cx - 5, topY + 12);
        ctx.lineTo(cx + 5, topY + 12);
        ctx.lineTo(cx, topY + 5);
        ctx.closePath();
        ctx.fill();

        ctx.font = font(11, 700);
        ctx.fillStyle = THEME.ink;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(headingDeg).toString().padStart(3, '0')}°`, cx, topY + 22);
        ctx.restore();
    }
}

/** "MiG-23 FLOGGER #2" -> "MIG-23". Keeps target tags to a glance. */
function shortName(name: string): string {
    return name.split(' ')[0].toUpperCase();
}
