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
import { formatEta } from '../core/Objectives';
import type { StrikeTarget } from '../tactics/StrikeTarget';
import type { TargetSolution } from '../tactics/TargetDesignation';
import type { ControlDemand } from '../flight/FlightAssist';
import type { Callout } from '../core/Callouts';
import { angleDelta } from '../flight/FlightAssist';
import { HUD_METRICS, solveHudLayout, solveArcadeBar } from './HudLayout';
import type { HudLayout, HudReserve, ArcadeBarSlotId } from './HudLayout';
import { motionSettings, blinkVisible } from '../core/Accessibility';
import { timeToImpact } from '../tactics/MissileGuidance';
import type { MotionSettings } from '../core/Accessibility';
import { radarProject, relativeHeading, formatNm, RADAR_RANGE_M } from './RadarMath';
import { placeLabels } from './LabelDeclutter';
import type { LabelBox, LabelCandidate, PlacedLabel } from './LabelDeclutter';
import {
    THEME,
    fitText,
    font,
    glow,
    keycap,
    keycapWidth,
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
     * Structural integrity, 0-100. Optional and defaulted to full by the
     * weapons system, so a plain target literal still works.
     *
     * It exists because a single 20 mm round inside an eighteen-metre radius
     * used to destroy any aircraft instantly. That made the cannon both
     * trivially easy and completely weightless: there was no such thing as
     * hitting something, only killing it, so there was nothing to give the
     * player feedback about.
     */
    integrity?: number;
    /** Seconds remaining on the hit flash the renderer draws. */
    hitFlash?: number;

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
    /** Seconds this fighter has held a guns solution on the player. */
    aiAimTimer?: number;
    aiTurnDemand?: number;
}

export interface HudContext {
    hint: Hint | null;
    score: ScoreKeeper;
    objective: ObjectiveStep;
    checklist: ChecklistItem[];
    /** Hardened ground targets the active scenario wants destroyed. */
    strikeTargets?: StrikeTarget[];
    /** Where the currently selected Mk.82 would land, if one is selected. */
    bombImpactPoint?: Vector3 | null;
    /** The contact the pilot designated, if any. */
    designated?: TargetSolution | null;
    /** MANUAL / ASSIST / AUTOPILOT, shown on the key bar. */
    assistLabel?: string;
    /** Which flight-control protection is taking authority this frame. */
    assistOverride?: ControlDemand['override'];
    /** "That worked": kills, traps, losses. Newest first. */
    callouts?: readonly Callout[];
    /** Seconds left on the cannon hit marker, 0 when no round has connected. */
    hitMarker?: number;
    /** Wire grade to stamp over the deck while the trap payoff plays. */
    trapStamp?: string | null;
    /** Screen edges the thumb controls occupy, in touch mode. */
    touchReserve?: HudReserve;
    touchMode?: boolean;
    /**
     * Flash and motion limits. Supplied by the game loop; defaulted here so
     * a caller that forgets still gets the WCAG-safe rate rather than the
     * old 4.5 Hz one.
     */
    motion?: MotionSettings;
    /**
     * What the pilot can see. A bracket on a contact behind a mountain is the
     * same information leak as being able to designate it.
     */
    visibleContacts?: { isVisible(id: string): boolean };
    /** Whether the autopilot is hugging the terrain, for the annunciator. */
    terrainFollowing?: boolean;
    /**
     * What the recovery assist is doing, when it is doing anything. It takes
     * the assist band over the ordinary autopilot caption: while the assist is
     * flying you home, that IS what the autopilot is doing, and the handover
     * line is the single most important thing on the glass at the moment it
     * appears.
     */
    recovery?: { text: string; handover: boolean } | null;
    /** True when padlock camera is slaved to designated target */
    isPadlocked?: boolean;
    padlockActive?: boolean;
    hudDensity?: 'ARCADE' | 'PRO';
    pitchInverted?: boolean;
    /** Remaining arcade 5-second time rewinds */
    rewindsRemaining?: number;
}

/**
 * What the flight-control annunciator should say, if anything.
 *
 * Pure, because the decision is the interesting part and it is easy to get
 * wrong in a way nobody notices: LEVEL is the assist doing its normal job on
 * every frame the stick is centred, so annunciating it would pin a permanent
 * caption to the glass and train the player to ignore the one line that
 * matters when the jet really is about to hit something.
 */
export function assistCaption(
    override: ControlDemand['override'],
    hasDesignation = false,
    terrainFollowing = false
): { text: string; tone: 'ALERT' | 'CAUTION' | 'INFO' } | null {
    switch (override) {
        case 'TERRAIN':
            return { text: 'TERRAIN — AUTO PULL-UP', tone: 'ALERT' };
        case 'STALL':
            return { text: 'ALPHA LIMIT', tone: 'CAUTION' };
        case 'AUTOPILOT': {
            // The suffix, not a separate line: the player needs to know the
            // autopilot is deliberately down in the valley rather than failing
            // to climb, and a second caption competing for the same band is
            // how the one that matters gets ignored.
            const tf = terrainFollowing ? ' · TF' : '';
            return hasDesignation
                ? { text: `AUTOPILOT — FLYING THE INTERCEPT${tf}`, tone: 'INFO' }
                : { text: `AUTOPILOT FLYING — PRESS T TO PICK A TARGET${tf}`, tone: 'INFO' };
        }
        default:
            return null;
    }
}

/**
 * Width kept clear on each side of the objective strip for the score chip
 * (right) and symmetry (left).
 */
const OBJECTIVE_SIDE_RESERVE = 150;

/**
 * Half-width kept clear for the assist annunciator. Generous: the longest
 * caption it draws is the recovery's, and a tag clipping its end is as bad as
 * a tag through its middle.
 */
const ASSIST_BAND_HALF_W = 210;

/**
 * Width kept clear on each side of the objective strip in touch mode: the two
 * top-corner buttons (menu, and the recovery assist) plus their edge gaps.
 */
const TOUCH_TOP_RIGHT_RESERVE = 104;

/** Vertical instrument bands, in CSS px from top of screen. */
const BAND = {
    top: 20,
    objective: 54,
    compass: 96,
    warning: 132,
    coach: 168
};

export class HUD {
    public width: number;
    public height: number;
    public hudDensity: 'ARCADE' | 'PRO' = 'ARCADE';
    /** Score handed through to the touch systems line for one frame. */
    private touchScore?: ScoreKeeper;
    /** Flash and motion limits for this frame. */
    private motion: MotionSettings = motionSettings({ reducedMotion: false });

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public toggleHudDensity(): 'ARCADE' | 'PRO' {
        this.hudDensity = this.hudDensity === 'ARCADE' ? 'PRO' : 'ARCADE';
        return this.hudDensity;
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
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' | 'HARM',
        renderer: VectorRenderer,
        context: HudContext
    ) {
        if (context.hudDensity) this.hudDensity = context.hudDensity;

        const layout = this.solveLayout(
            physics, context.checklist.length > 0, context.touchReserve, context.touchMode
        );
        this.motion = context.motion ?? motionSettings({ reducedMotion: false });

        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.textBaseline = 'alphabetic';
        noGlow(ctx);

        // --- Flight symbology (centre of the screen, drawn in the beam colour) ---
        this.drawPitchLadder(ctx, physics, renderer, layout);
        this.drawFlightPathMarker(ctx, physics, renderer);
        this.drawWaterline(ctx, layout.cx, layout.cy);
        this.drawCombatReticles(ctx, physics, targets, renderer, layout, context.visibleContacts);
        this.drawStrikeTargets(ctx, physics, context.strikeTargets ?? [], renderer);
        if (context.designated) this.drawDesignation(ctx, physics, context.designated, renderer, layout);
        if (context.bombImpactPoint) {
            this.drawBombImpactPoint(ctx, physics, context.bombImpactPoint, context.strikeTargets ?? [], renderer);
        }

        // --- Instruments (all on backplates, all outside the centre box) ---
        this.drawObjectiveStrip(ctx, context.objective, layout.cx, layout.touchMode);
        if (layout.showCompass) this.drawCompassTape(ctx, physics, layout.cx);
        this.drawSpeedBlock(ctx, physics, layout);
        this.drawAltitudeBlock(ctx, physics, sensors, layout);
        this.touchScore = layout.touchMode ? context.score : undefined;
        this.drawSystemsBlock(ctx, physics, selectedWeapon, layout, context, sensors);
        if (layout.showRwr) {
            this.drawRWR(
                ctx, physics, sensors, targets, context.strikeTargets ?? [],
                context.designated?.target.id ?? null, layout
            );
        }
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
        if (context.hitMarker) this.drawHitMarker(ctx, layout, context.hitMarker);
        this.drawCallouts(ctx, context.callouts ?? [], layout);
        if (context.trapStamp) this.drawTrapStamp(ctx, context.trapStamp, layout);
        if (!layout.touchMode) this.drawScoreChip(ctx, context.score, layout);
        this.drawAssistAnnunciator(
            ctx, context.assistOverride ?? 'NONE', Boolean(context.designated), layout.cx,
            context.terrainFollowing ?? false, context.recovery ?? null
        );
        if (!layout.touchMode) this.drawKeyBar(ctx, context.assistLabel);
        this.drawTopRightControls(ctx, layout, context);

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

    /**
     * The rectangles a floating label must not cover. Derived from the same
     * layout the instruments are drawn from, so it cannot drift from them.
     */
    private instrumentBoxes(layout: HudLayout): LabelBox[] {
        const boxes: LabelBox[] = [
            // Objective strip and the compass band across the top.
            { x: 0, y: 0, w: this.width, h: layout.showCompass ? 130 : 78 },
            { x: layout.speedX, y: layout.cy - 34, w: HUD_METRICS.speedW, h: 68 },
            { x: layout.altX, y: layout.cy - 34, w: HUD_METRICS.altW, h: 68 }
        ];
        if (layout.showRwr) {
            boxes.push({
                x: this.width - layout.rwrSize - HUD_METRICS.edge,
                y: this.height - layout.rwrSize - 54,
                w: layout.rwrSize,
                h: layout.rwrSize
            });
        }

        // The boresight itself: the waterline, the flight path marker and the
        // gun pipper all live here, and a range tag through them is a tag
        // over the three symbols you fly by.
        boxes.push({ x: layout.cx - 54, y: layout.cy - 26, w: 108, h: 52 });

        /**
         * The assist annunciator band, across the bottom centre.
         *
         * It used to be a line that appeared rarely, so nothing reserved space
         * for it. The recovery assist made it a line that is up for most of the
         * way home, and a contact tag landed straight through "RECOVERY - GET
         * ASTERN OF THE BOAT" the first time it was looked at on a phone.
         */
        boxes.push({
            x: layout.cx - ASSIST_BAND_HALF_W,
            y: this.height - 56,
            w: ASSIST_BAND_HALF_W * 2,
            h: 30
        });

        if (layout.touchMode) {
            // The touch systems line, which sits where a tag would otherwise
            // happily land on a short screen.
            boxes.push({
                x: HUD_METRICS.edge + layout.reserve.left,
                y: this.height - layout.reserve.bottom - 26,
                w: this.width - layout.reserve.left - layout.reserve.right,
                h: 24
            });
        }
        return boxes;
    }

    /** Solve instrument placement for the current viewport. */
    public solveLayout(
        physics: AircraftPhysics,
        hasChecklist: boolean,
        reserve?: HudReserve,
        touchMode?: boolean
    ): HudLayout {
        return solveHudLayout({
            width: this.width,
            height: this.height,
            showApproach: HUD.isOnApproach(physics),
            hasChecklist,
            reserve,
            touchMode
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
    private drawObjectiveStrip(
        ctx: CanvasRenderingContext2D,
        objective: ObjectiveStep,
        cx: number,
        touchMode = false
    ) {
        // "Press SPACE" is not advice you can act on without a keyboard.
        const showKey = objective.key !== undefined && !touchMode;
        const accent = objective.urgency === 'URGENT' ? THEME.alert
            : objective.urgency === 'ACTION' ? THEME.caution
                : THEME.phosphor;

        const countdown = objective.countdownSeconds;
        const showClock = countdown !== undefined;
        const clockText = showClock ? formatEta(countdown) : '';
        // The clock turns red inside a minute: a deadline is only useful if
        // the player can feel it closing.
        const clockColor = showClock && countdown < 60 ? THEME.alert
            : showClock && countdown < 120 ? THEME.caution
                : THEME.ink;

        ctx.save();
        noGlow(ctx);
        ctx.font = font(17, 700);
        const titleW = ctx.measureText(objective.title).width;
        ctx.font = font(11);
        const detailW = ctx.measureText(objective.detail).width;
        ctx.font = font(22, 700);
        const clockW = showClock ? ctx.measureText(clockText).width + 22 : 0;

        const keyW = showKey ? 58 : 0;
        // The strip is centred, so its half-width has to clear the score chip
        // in the same band on the right. Without this reserve the plate ran
        // under the chip on anything narrower than about 1000px.
        //
        // In touch mode the chip is not there - the score rides in the systems
        // line - so the strip gets most of that width back, which is what lets
        // a phone read the whole objective instead of "descend...". It cannot
        // have all of it: the menu and the recovery button live in that corner,
        // and 52 px covered one of them. Adding the second put the strip
        // straight under RCVY on the smallest handset.
        const sideReserve = touchMode ? TOUCH_TOP_RIGHT_RESERVE : OBJECTIVE_SIDE_RESERVE;
        const w = Math.min(
            this.width - 2 * (HUD_METRICS.edge + sideReserve),
            Math.max(titleW + keyW, detailW) + 36 + clockW
        );
        const h = 54;
        const x = cx - w / 2;
        const y = BAND.objective;

        plate(ctx, { x, y, w, h }, { fill: 'rgba(6,13,17,0.78)', border: accent, radius: 5 });

        // Left accent rail
        ctx.fillStyle = accent;
        roundRect(ctx, x + 1, y + 1, 3, h - 2, 1.5);
        ctx.fill();

        let textX = x + 16;
        if (showKey && objective.key) {
            textX += keycap(ctx, textX, y + 20, objective.key, { size: 12 }) + 10;
        }

        const textLimit = x + w - 14 - clockW;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = font(17, 700);
        ctx.fillStyle = objective.urgency === 'NORMAL' ? THEME.ink : accent;
        ctx.fillText(fitText(ctx, objective.title, textLimit - textX), textX, y + 25);

        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(fitText(ctx, objective.detail, textLimit - (x + 16)), x + 16, y + 43);

        if (showClock) {
            ctx.textAlign = 'right';
            ctx.font = font(22, 700);
            ctx.fillStyle = clockColor;
            if (countdown < 60 && blinkVisible(Date.now(), this.motion, 500)) glow(ctx, clockColor, 8);
            ctx.fillText(clockText, x + w - 14, y + 28);
            noGlow(ctx);
            ctx.font = font(9, 600);
            ctx.fillStyle = THEME.muted;
            ctx.fillText('WINDOW', x + w - 14, y + 44);
        }
        ctx.restore();
    }

    /** Single-channel contextual coaching line (immediate threats/actions). */
    private drawCoachTicker(ctx: CanvasRenderingContext2D, hint: Hint, cx: number) {
        const color = hint.severity === 'CRITICAL' ? THEME.alert
            : hint.severity === 'WARNING' ? THEME.caution
                : THEME.phosphor;

        // Critical cues blink so they can't be tuned out.
        // 300 ms was 3.3 flashes a second, over the WCAG limit.
        if (hint.severity === 'CRITICAL' && !blinkVisible(Date.now(), this.motion, 400)) return;

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
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' | 'HARM',
        layout: HudLayout,
        context: HudContext,
        sensors: SensorTacticsManager
    ) {
        if (layout.touchMode) {
            this.drawTouchSystemsLine(ctx, physics, layout, this.touchScore);
            return;
        }
        if (this.hudDensity === 'ARCADE') {
            this.drawArcadeBottomBar(ctx, physics, selectedWeapon, context, sensors);
            return;
        }
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
        const chips: [string, 'GUN' | 'AIM9' | 'BOMB' | 'HARM', string][] = [
            [`1 GUN ${physics.loadout.vulcanAmmo}`, 'GUN', '1'],
            [`2 AIM9 ${physics.loadout.sidewinders}`, 'AIM9', '2'],
            [`3 MK82 ${physics.loadout.ironBombs}`, 'BOMB', '3'],
            [`4 HARM ${physics.loadout.harms}`, 'HARM', '4']
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
    /**
     * Touch mode's systems readout: fuel, hull and G only.
     *
     * Throttle, armed weapon and rounds remaining are all drawn on the thumb
     * controls themselves, so repeating them in a strip across the bottom
     * both wastes the scarcest screen in the game and puts text under the
     * stick. What is left is what the controls cannot show.
     */
    private drawTouchSystemsLine(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        layout: HudLayout,
        score?: ScoreKeeper
    ) {
        ctx.save();
        noGlow(ctx);
        ctx.font = font(10, 600);
        const fuelLow = physics.fuel < 900;
        const hurt = physics.damage > 25;
        // The score rides here too: a separate chip in the top-right corner
        // collided with the objective strip on a narrow screen, and this
        // plate is already paid for.
        const text = `FUEL ${Math.round(physics.fuel)}L   HULL ${Math.round(100 - physics.damage)}%   ${physics.gLoad.toFixed(1)}G`
            + (score ? `   ${score.totalScore} PTS` : '');
        const w = ctx.measureText(text).width + 20;
        const x = HUD_METRICS.edge + layout.reserve.left;
        const y = this.height - layout.reserve.bottom - 24;

        plate(ctx, { x, y, w, h: 20 }, { fill: 'rgba(6,13,17,0.7)', border: THEME.edgeSoft, radius: 4 });
        ctx.fillStyle = fuelLow || hurt ? THEME.caution : THEME.muted;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 10, y + 10);
        ctx.restore();
    }

    private drawSystemsStrip(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' | 'HARM'
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
                : selectedWeapon === 'BOMB' ? `MK82 ${physics.loadout.ironBombs}`
                    : `HARM ${physics.loadout.harms}`;
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

    private drawArcadeBottomBar(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' | 'HARM',
        context: HudContext,
        sensors: SensorTacticsManager
    ) {
        ctx.save();
        noGlow(ctx);
        ctx.textBaseline = 'middle';

        // The status pill's width depends on measured text, so it has to be
        // known before the solver runs - it decides whether STATUS fits.
        const ab = physics.throttle > 1.0;
        const hull = Math.max(0, Math.round(100 - physics.damage));
        const statusText = `THR ${Math.floor(physics.throttle * 100)}%${ab ? ' AB' : ''}  ·  FUEL ${Math.floor(physics.fuel)}L  ·  HULL ${hull}%`;
        ctx.font = font(11, 600);
        const statusTextWidth = ctx.measureText(statusText).width;

        const bar = solveArcadeBar({
            width: this.width,
            height: this.height,
            weaponCount: 4,
            showCountermeasure: true,
            showRewind: true,
            showPadlock: true,
            statusTextWidth
        });
        const slot = (id: ArcadeBarSlotId) => bar.find(s => s.id === id)?.rect;

        // 1. Weapon Pills
        const wpns: [ArcadeBarSlotId, string, 'GUN' | 'AIM9' | 'BOMB' | 'HARM'][] = [
            ['WEAPON_0', `1 GUN ${physics.loadout.vulcanAmmo}`, 'GUN'],
            ['WEAPON_1', `2 AIM9 ${physics.loadout.sidewinders}`, 'AIM9'],
            ['WEAPON_2', `3 MK82 ${physics.loadout.ironBombs}`, 'BOMB'],
            ['WEAPON_3', `4 HARM ${physics.loadout.harms}`, 'HARM']
        ];
        for (const [slotId, text, weaponId] of wpns) {
            const rect = slot(slotId);
            if (!rect) continue;
            const selected = selectedWeapon === weaponId;
            plate(ctx, rect, {
                fill: selected ? 'rgba(95,216,255,0.22)' : 'rgba(9,19,25,0.7)',
                border: selected ? THEME.key : THEME.edgeSoft,
                radius: 4
            });
            if (selected) glow(ctx, THEME.key, 6);
            ctx.font = font(11, 700);
            ctx.fillStyle = selected ? THEME.ink : THEME.muted;
            ctx.textAlign = 'center';
            ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
            noGlow(ctx);
        }

        // 1b. Chaff. Not a weapon - it is the answer to one - so it sits
        // apart from the weapon row and turns amber the moment a seeker is
        // actually looking, which is the only moment it matters.
        const cmRect = slot('COUNTERMEASURE');
        if (cmRect) {
            const chaff = physics.loadout.chaff;
            const threatened = sensors.masterRwrState === 'LAUNCH';
            const dry = chaff <= 0;
            const accent = dry ? THEME.alert : threatened ? THEME.caution : THEME.muted;
            plate(ctx, cmRect, {
                fill: threatened && !dry ? 'rgba(255,176,32,0.18)' : 'rgba(9,19,25,0.7)',
                border: threatened ? accent : THEME.edgeSoft,
                radius: 4
            });
            if (threatened && !dry) glow(ctx, THEME.caution, 6);
            ctx.font = font(11, 700);
            ctx.fillStyle = accent;
            ctx.textAlign = 'center';
            ctx.fillText(`X CHAFF ${chaff}`, cmRect.x + cmRect.w / 2, cmRect.y + cmRect.h / 2);
            noGlow(ctx);
        }

        // 2. Assist Mode Pill
        const assistRect = slot('ASSIST');
        if (assistRect) {
            const assistText = `ASSIST: ${context.assistLabel ?? 'AUTO'}`.toUpperCase();
            plate(ctx, assistRect, {
                fill: 'rgba(9,19,25,0.7)',
                border: THEME.edgeSoft,
                radius: 4
            });
            ctx.font = font(10, 600);
            ctx.fillStyle = THEME.phosphor;
            ctx.textAlign = 'center';
            ctx.fillText(assistText, assistRect.x + assistRect.w / 2, assistRect.y + assistRect.h / 2);
        }

        // 3. Rewind Pill
        const rewindRect = slot('REWIND');
        if (rewindRect) {
            plate(ctx, rewindRect, {
                fill: 'rgba(9,19,25,0.7)',
                border: THEME.edgeSoft,
                radius: 4
            });
            ctx.font = font(10, 600);
            ctx.fillStyle = THEME.caution;
            ctx.textAlign = 'center';
            ctx.fillText('REWIND 5S', rewindRect.x + rewindRect.w / 2, rewindRect.y + rewindRect.h / 2);
        }

        // 4. Padlock Pill
        const padlockRect = slot('PADLOCK');
        if (padlockRect) {
            const lockOn = context.padlockActive === true || context.isPadlocked === true;
            plate(ctx, padlockRect, {
                fill: lockOn ? 'rgba(255,180,50,0.2)' : 'rgba(9,19,25,0.7)',
                border: lockOn ? THEME.caution : THEME.edgeSoft,
                radius: 4
            });
            ctx.font = font(10, 600);
            ctx.fillStyle = lockOn ? THEME.caution : THEME.muted;
            ctx.textAlign = 'center';
            ctx.fillText(lockOn ? 'LOCK: ON' : 'PADLOCK', padlockRect.x + padlockRect.w / 2, padlockRect.y + padlockRect.h / 2);
        }

        // 5. Status Telemetry Pill (Throttle, Fuel, Hull) - omitted by the
        // solver when it would overflow the right edge of the viewport.
        const statusRect = slot('STATUS');
        if (statusRect) {
            plate(ctx, statusRect, {
                fill: 'rgba(9,19,25,0.7)',
                border: THEME.edgeSoft,
                radius: 4
            });
            ctx.font = font(11, 600);
            ctx.fillStyle = hull < 30 || physics.fuel < 800 ? THEME.caution : THEME.muted;
            ctx.textAlign = 'center';
            ctx.fillText(statusText, statusRect.x + statusRect.w / 2, statusRect.y + statusRect.h / 2);
        }

        ctx.restore();
    }

    private drawTopRightControls(ctx: CanvasRenderingContext2D, layout: HudLayout, context?: HudContext) {
        if (layout.touchMode) return;
        ctx.save();
        noGlow(ctx);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        const btnW = 100;
        const btnH = 28;
        const y = 16;

        // [DECK (TAB)]
        const deckX = this.width - btnW - 20;
        plate(ctx, { x: deckX, y, w: btnW, h: btnH }, {
            fill: 'rgba(9,19,25,0.75)',
            border: THEME.edgeSoft,
            radius: 4
        });
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.ink;
        ctx.fillText('DECK (TAB)', deckX + btnW / 2, y + btnH / 2);

        // [HUD: ARCADE / PRO]
        const modeX = deckX - btnW - 8;
        const isArcade = this.hudDensity === 'ARCADE';
        plate(ctx, { x: modeX, y, w: btnW, h: btnH }, {
            fill: isArcade ? 'rgba(95,216,255,0.18)' : 'rgba(255,180,50,0.18)',
            border: isArcade ? THEME.key : THEME.caution,
            radius: 4
        });
        ctx.font = font(10, 700);
        ctx.fillStyle = isArcade ? THEME.key : THEME.caution;
        ctx.fillText(isArcade ? 'HUD: ARCADE' : 'HUD: PRO', modeX + btnW / 2, y + btnH / 2);

        // [STICK: REAL (I) / STICK: DIR (I)]
        const stickBtnW = 104;
        const stickX = modeX - stickBtnW - 8;
        const isInverted = context?.pitchInverted ?? false;
        plate(ctx, { x: stickX, y, w: stickBtnW, h: btnH }, {
            fill: isInverted ? 'rgba(95,216,255,0.18)' : 'rgba(9,19,25,0.75)',
            border: isInverted ? THEME.key : THEME.edgeSoft,
            radius: 4
        });
        ctx.font = font(10, 600);
        ctx.fillStyle = isInverted ? THEME.key : THEME.ink;
        ctx.fillText(isInverted ? 'STICK: REAL (I)' : 'STICK: DIR (I)', stickX + stickBtnW / 2, y + btnH / 2);

        ctx.restore();
    }

    /** Bottom key bar so the flight controls are never more than a glance away. */
    private drawKeyBar(ctx: CanvasRenderingContext2D, assistLabel?: string) {
        ctx.save();
        noGlow(ctx);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        const y = this.height - 22;
        const pairs: [string, string][] = [
            ['WASD', 'fly'],
            ['SHIFT', 'power'],
            ['T', 'target'],
            ['V', 'padlock'],
            ['SPACE', 'fire'],
            ['F', assistLabel ?? 'assist'],
            ['U', 'hud density'],
            ['I', 'invert pitch'],
            ['TAB', 'deck'],
            ['H', 'controls']
        ];

        let x = 24;
        const limit = this.width - 24;
        for (const [key, text] of pairs) {
            ctx.font = font(10);
            const cap = keycapWidth(ctx, key, 10);
            const width = cap + 5 + ctx.measureText(text).width + 14;
            if (x + width > limit) break;

            x += keycap(ctx, x, y, key, { size: 10 }) + 5;
            ctx.font = font(10);
            ctx.fillStyle = THEME.muted;
            ctx.fillText(text, x, y);
            x += ctx.measureText(text).width + 14;
        }
        ctx.restore();
    }

    /**
     * A round connected. Four short strokes around the boresight, drawn for a
     * fifth of a second. Without it the cannon has exactly two states -
     * nothing and an explosion - and at 1.5 km through a wireframe a player
     * cannot tell a hit from a miss.
     */
    private drawHitMarker(ctx: CanvasRenderingContext2D, layout: HudLayout, life: number) {
        const strength = Math.min(1, life / 0.18);
        ctx.save();
        noGlow(ctx);
        ctx.globalAlpha = strength;
        ctx.strokeStyle = THEME.caution;
        ctx.lineWidth = 2.4;
        const inner = 9;
        const outer = 9 + 9 * strength;
        const { cx, cy } = layout;
        ctx.beginPath();
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
            ctx.moveTo(cx + sx * inner, cy + sy * inner);
            ctx.lineTo(cx + sx * outer, cy + sy * outer);
        }
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Kill / trap / loss callouts. Their own band, deliberately below the
     * waterline and above the systems block: the warning band answers "what is
     * about to kill me" and must never queue behind "that worked".
     */
    private drawCallouts(ctx: CanvasRenderingContext2D, callouts: readonly Callout[], layout: HudLayout) {
        if (callouts.length === 0) return;

        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let y = layout.cy + 118;
        for (const c of callouts) {
            const progress = 1 - c.life / c.span;
            // Hold, then fade in the last third.
            const alpha = progress < 0.66 ? 1 : Math.max(0, 1 - (progress - 0.66) / 0.34);
            const color = c.tone === 'LOSS' ? THEME.alert
                : c.tone === 'PRAISE' ? THEME.caution
                    : c.tone === 'MODE' ? THEME.muted
                        : THEME.phosphor;

            ctx.globalAlpha = alpha;
            ctx.font = font(c.tone === 'PRAISE' ? 22 : 18, 700);
            const w = Math.max(ctx.measureText(c.text).width, c.detail ? ctx.measureText(c.detail).width : 0) + 34;
            const h = c.detail ? 44 : 30;
            plate(ctx, { x: layout.cx - w / 2, y, w, h },
                { fill: 'rgba(6,13,17,0.72)', border: color, radius: 4 });

            ctx.fillStyle = color;
            ctx.fillText(c.text, layout.cx, y + (c.detail ? 17 : 15));
            if (c.detail) {
                ctx.font = font(10, 600);
                ctx.fillStyle = THEME.muted;
                ctx.fillText(fitText(ctx, c.detail, w - 20), layout.cx, y + 33);
            }

            y += h + 6;
        }
        ctx.restore();
    }

    /** The wire grade, stamped over the deck while the trap payoff plays. */
    private drawTrapStamp(ctx: CanvasRenderingContext2D, grade: string, layout: HudLayout) {
        const bolter = grade === 'BOLTER';
        const color = bolter ? THEME.alert : THEME.caution;
        ctx.save();
        noGlow(ctx);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(Math.min(64, Math.max(34, this.width / 20)), 700);
        const w = ctx.measureText(grade).width + 80;
        const y = layout.cy - 150;
        plate(ctx, { x: layout.cx - w / 2, y: y - 44, w, h: 88 },
            { fill: 'rgba(6,13,17,0.82)', border: color, radius: 6 });
        ctx.fillStyle = color;
        glow(ctx, color, 14);
        ctx.fillText(grade, layout.cx, y - 6);
        noGlow(ctx);
        ctx.font = font(12, 600);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(bolter ? 'GO AROUND' : 'TRAPPED ABOARD CV-68', layout.cx, y + 26);
        ctx.restore();
    }

    /**
     * One line, just above the key bar, for a protection that is currently
     * taking authority away from the pilot. Deliberately NOT in the warning
     * band: a stall warning and "the assist is holding your nose up" are
     * different kinds of news and must not queue for the same slot.
     */
    private drawAssistAnnunciator(
        ctx: CanvasRenderingContext2D,
        override: ControlDemand['override'],
        hasDesignation: boolean,
        cx: number,
        terrainFollowing: boolean,
        recovery: { text: string; handover: boolean } | null
    ) {
        const caption = recovery
            ? { text: recovery.text, tone: recovery.handover ? 'CAUTION' as const : 'INFO' as const }
            : assistCaption(override, hasDesignation, terrainFollowing);
        if (!caption) return;

        const color = caption.tone === 'ALERT' ? THEME.alert
            : caption.tone === 'CAUTION' ? THEME.caution
                : THEME.phosphor;

        ctx.save();
        noGlow(ctx);
        ctx.font = font(11, 700);
        const w = ctx.measureText(caption.text).width + 24;
        const y = this.height - 52;
        plate(ctx, { x: cx - w / 2, y, w, h: 22 }, { border: color, radius: 11 });
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(caption.text, cx, y + 11);
        ctx.restore();
    }

    /**
     * The designated target. Everything about it is deliberately louder than
     * the generic contact brackets: a solid box in the key colour, a data line
     * with the weapon the geometry actually supports, and - when it is not on
     * screen - a chevron round the boresight pointing the way to turn. Before
     * this there was no way to tell which of five identical brackets you had
     * chosen, which made choosing pointless.
     */
    private drawDesignation(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        solution: TargetSolution,
        renderer: VectorRenderer,
        layout: HudLayout
    ) {
        const camPt = renderer.transformToCamera(
            solution.target.position, physics.position, physics.pitch, physics.yaw, physics.roll
        );

        ctx.save();
        noGlow(ctx);

        const label = `${shortName(solution.target.name)} · ${(solution.range / 1000).toFixed(1)}KM · ${solution.recommendedWeapon}`;
        const shootable = solution.inMissileEnvelope || solution.inGunEnvelope;
        const color = shootable ? THEME.caution : THEME.key;

        const onScreen = camPt.z >= 2.0;
        const proj = onScreen ? renderer.projectCameraPoint(camPt) : null;
        const visible = proj !== null
            && proj.x > -40 && proj.x < this.width + 40
            && proj.y > -40 && proj.y < this.height + 40;

        if (proj && visible) {
            const s = Math.max(20, Math.min(70, 30000 / Math.max(1, solution.range))) / 2;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.2;
            ctx.strokeRect(proj.x - s, proj.y - s, s * 2, s * 2);

            // Tick marks on the box edges, so the lock reads as a lock and not
            // as another piece of terrain.
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(proj.x, proj.y - s - 7); ctx.lineTo(proj.x, proj.y - s);
            ctx.moveTo(proj.x, proj.y + s); ctx.lineTo(proj.x, proj.y + s + 7);
            ctx.moveTo(proj.x - s - 7, proj.y); ctx.lineTo(proj.x - s, proj.y);
            ctx.moveTo(proj.x + s, proj.y); ctx.lineTo(proj.x + s + 7, proj.y);
            ctx.stroke();

            ctx.font = font(11, 700);
            const w = ctx.measureText(label).width + 18;
            const plateX = Math.max(8, Math.min(this.width - w - 8, proj.x - w / 2));
            const plateY = proj.y + s + 10;
            plate(ctx, { x: plateX, y: plateY, w, h: 20 }, { border: color, radius: 4 });
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, plateX + w / 2, plateY + 10);
        } else {
            // Off the glass: put the data line under the boresight and a
            // chevron on the ring pointing where to turn.
            const bearingOff = angleDelta(physics.yaw, solution.bearing);
            const radius = Math.min(layout.symHalf + 40, Math.min(this.width, this.height) / 2 - 30);
            const ax = layout.cx + Math.sin(bearingOff) * radius;
            const ay = layout.cy - Math.cos(bearingOff) * radius * 0.35;

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            const dir = bearingOff >= 0 ? 1 : -1;
            ctx.moveTo(ax - dir * 9, ay - 9);
            ctx.lineTo(ax + dir * 5, ay);
            ctx.lineTo(ax - dir * 9, ay + 9);
            ctx.stroke();

            ctx.font = font(11, 700);
            const text = `${label} · TURN ${bearingOff >= 0 ? 'RIGHT' : 'LEFT'}`;
            const w = ctx.measureText(text).width + 18;
            const plateX = Math.max(8, Math.min(this.width - w - 8, layout.cx - w / 2));
            const plateY = layout.cy + 66;
            plate(ctx, { x: plateX, y: plateY, w, h: 20 }, { border: color, radius: 4 });
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, plateX + w / 2, plateY + 10);
        }

        ctx.restore();
    }

    private drawScoreChip(ctx: CanvasRenderingContext2D, score: ScoreKeeper, layout: HudLayout) {
        ctx.save();
        noGlow(ctx);
        ctx.font = font(11, 600);
        const text = `${score.totalScore} PTS · ${score.rank}`;
        const w = ctx.measureText(text).width + 22;
        // The menu button lives in the top-right corner in touch mode; the
        // chip has to clear it rather than sit underneath it.
        const x = this.width - w - 20 - (layout.touchMode ? 58 : 0);
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
            if (blinkMs > 0 && !blinkVisible(Date.now(), this.motion, blinkMs)) return;
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
            // Time to impact from the nearest missile actually in flight -
            // not just "in LAUNCH state", which can mean the site is about to
            // fire rather than already has. A player told "inbound" with
            // nothing to time it against cannot decide whether to keep
            // attacking for one more second or bail immediately.
            let soonest: number | null = null;
            for (const threat of sensors.activeThreats) {
                if (!threat.missileActive || !threat.missilePos || !threat.missileVel) continue;
                const tti = timeToImpact(threat.missilePos, threat.missileVel, physics.position);
                if (tti !== null && (soonest === null || tti < soonest)) soonest = tti;
            }
            const suffix = soonest !== null ? ` — ${soonest.toFixed(1)}s — BREAK OR CHAFF [X]` : '';
            banner(`▼ MISSILE INBOUND${suffix} — DIVE BELOW RIDGE ▼`, THEME.alert, 400);
        } else if (sensors.masterRwrState === 'TRACK') {
            banner('▼ RADAR LOCK: DIVE INTO VALLEYS TO BREAK LOCK ▼', THEME.caution, 0);
        } else {
            const masked = sensors.activeThreats.some(t => t.isTerrainMasked);
            if (masked && physics.position.y < 350) {
                ctx.save();
                noGlow(ctx);
                ctx.font = font(11, 700);
                ctx.fillStyle = THEME.phosphor;
                glow(ctx, THEME.phosphor, 4);
                ctx.textAlign = 'center';
                ctx.fillText('✓ TERRAIN MASKED · RADAR LINE-OF-SIGHT BROKEN', cx, BAND.warning + 18);
                ctx.restore();
            }
        }

        if (!physics.isStalled) return { rwr: rwrBanner, stall: false };

        if (blinkVisible(Date.now(), this.motion, 440)) {
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

    /**
     * The tactical radar. Heading-up: the top of the scope is where the nose
     * points. It shows the things a player looks for on a round scope in the
     * corner of a flight game - where home is, where the enemy is, where the
     * objective is - and keeps the SAM warning on the same glass as a red arc
     * on the rim pointing at the site, so the pilot reads one instrument.
     *
     * (It replaced a scope that was only a radar warning receiver: letters for
     * radiating SAM sites and nothing else. Nobody could find the carrier on
     * it, and nobody knew what an "S" was.)
     */
    private drawRWR(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        sensors: SensorTacticsManager,
        targets: AirborneTarget[],
        strikeTargets: StrikeTarget[],
        designatedId: string | null,
        layout: HudLayout
    ) {
        const size = layout.rwrSize;
        const x = this.width - size - HUD_METRICS.edge;
        // In touch mode the bottom-right corner is the fire button, so the
        // scope hangs under the altitude block instead.
        const y = layout.touchMode
            ? Math.min(layout.cy + 40, this.height - layout.reserve.bottom - size - 4)
            : this.height - size - layout.reserve.bottom
                - (layout.compactSystems ? 76 : 54);
        const cx = x + size / 2;
        const cy = y + size / 2 + 2;
        const radius = size / 2 - 17;
        const yaw = physics.yaw;
        const me = { x: physics.position.x, z: physics.position.z };
        const HOME = '#e8fff0';

        plate(ctx, { x, y, w: size, h: size }, { border: THEME.edgeSoft });

        ctx.save();
        noGlow(ctx);
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.muted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('RADAR', cx, y + 12);

        // Rings, and the fan the nose is covering - point a contact into it
        // and it is in front of you.
        ctx.strokeStyle = THEME.edgeSoft;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        const fan = 25 * (Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(-fan) * radius, cy - Math.cos(-fan) * radius);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(fan) * radius, cy - Math.cos(fan) * radius);
        ctx.stroke();

        // North stays north: the letter rides the rim as the jet turns.
        ctx.fillStyle = THEME.muted;
        ctx.font = font(9, 700);
        ctx.textBaseline = 'middle';
        ctx.fillText('N', cx + Math.sin(-yaw) * (radius - 7), cy - Math.cos(-yaw) * (radius - 7));

        // SAM warnings: a red arc on the rim toward the site, thicker the
        // closer it is to a shot. The bearing is already relative to the nose.
        for (const threat of sensors.activeThreats) {
            if (threat.state === 'SILENT') continue;
            const rad = threat.azimuthDeg * (Math.PI / 180);
            const live = !threat.isDecoyed;
            const color = threat.isDecoyed ? THEME.muted
                : threat.state === 'LAUNCH' ? THEME.alert
                : threat.state === 'TRACK' ? THEME.caution
                    : THEME.phosphor;
            ctx.strokeStyle = color;
            ctx.lineWidth = threat.state === 'LAUNCH' && live ? 4 : threat.state === 'TRACK' ? 3 : 2;
            if (threat.state === 'LAUNCH' && live) glow(ctx, color, 8);
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 1, rad - Math.PI / 2 - 0.35, rad - Math.PI / 2 + 0.35);
            ctx.stroke();
            noGlow(ctx);

            const distRatio = Math.min(1.0, threat.distance / 12000);
            const contactR = (0.3 + distRatio * 0.6) * radius;
            const tx = cx + Math.sin(rad) * contactR;
            const ty = cy - Math.cos(rad) * contactR;
            ctx.fillStyle = color;
            ctx.font = font(9, 700);
            ctx.fillText(threat.isDecoyed ? 'X' : 'SAM', tx, ty);
        }
        ctx.lineWidth = 1;

        // Objective: a yellow diamond for each hardened target still standing.
        ctx.strokeStyle = THEME.caution;
        for (const st of strikeTargets) {
            if (st.destroyed) continue;
            const pt = radarProject(me, yaw, st.position, RADAR_RANGE_M, radius);
            const px = cx + pt.x;
            const py = cy + pt.y;
            ctx.beginPath();
            ctx.moveTo(px, py - 5); ctx.lineTo(px + 5, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 5, py);
            ctx.closePath();
            ctx.stroke();
        }

        // Bandits: red triangles that point the way each one is flying, so a
        // triangle pointing at the middle of the scope is coming for you.
        for (const t of targets) {
            if (!t.isAlive) continue;
            const pt = radarProject(me, yaw, t.position, RADAR_RANGE_M, radius);
            const px = cx + pt.x;
            const py = cy + pt.y;
            const heading = relativeHeading(yaw, t.velocity);
            const designated = designatedId !== null && t.id === designatedId;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(heading);
            ctx.fillStyle = THEME.alert;
            ctx.strokeStyle = THEME.alert;
            const r = pt.clamped ? 3.5 : 5;
            ctx.beginPath();
            ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, r * 0.8); ctx.lineTo(-r * 0.8, r * 0.8);
            ctx.closePath();
            if (pt.clamped) ctx.stroke(); else ctx.fill();
            ctx.restore();
            if (designated) {
                ctx.strokeStyle = THEME.caution;
                ctx.beginPath();
                ctx.arc(px, py, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Home: the carrier, drawn last of the contacts so it is never hidden,
        // with the distance below the scope so the pilot never has to guess
        // how far the boat is.
        const home = radarProject(me, yaw, { x: 0, z: 0 }, RADAR_RANGE_M, radius);
        const hx = cx + home.x;
        const hy = cy + home.y;
        ctx.fillStyle = HOME;
        ctx.strokeStyle = HOME;
        if (home.clamped) {
            ctx.strokeRect(hx - 3, hy - 3, 6, 6);
        } else {
            ctx.fillRect(hx - 4, hy - 4, 8, 8);
        }

        // You: a small arrow at the centre.
        ctx.fillStyle = THEME.phosphor;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 4, cy + 4); ctx.lineTo(cx - 4, cy + 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = HOME;
        ctx.font = font(10, 700);
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('CV ' + formatNm(home.distance), cx, y + size - 4);
        ctx.restore();
    }

    /**
     * Ground-target designator. A hardened structure is a small, static,
     * wireframe-coloured box in a canyon full of wireframe: without a marker
     * and a range readout the strike scenario is a hunt rather than an attack.
     */
    private drawStrikeTargets(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        strikeTargets: readonly StrikeTarget[],
        renderer: VectorRenderer
    ) {
        if (strikeTargets.length === 0) return;

        ctx.save();
        noGlow(ctx);
        for (const target of strikeTargets) {
            const aim: Vector3 = {
                x: target.position.x,
                y: target.position.y + 24,
                z: target.position.z
            };
            const camPt = renderer.transformToCamera(
                aim, physics.position, physics.pitch, physics.yaw, physics.roll
            );
            if (camPt.z < 2.0) continue;

            const proj = renderer.projectCameraPoint(camPt);
            const range = target.horizontalDistanceTo(physics.position);
            const color = target.destroyed ? THEME.muted : THEME.caution;
            const s = Math.max(10, Math.min(40, 30000 / Math.max(1, range)));

            // Diamond designator - deliberately a different shape from the
            // air-to-air corner brackets, so the two never read as the same thing.
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(proj.x, proj.y - s);
            ctx.lineTo(proj.x + s, proj.y);
            ctx.lineTo(proj.x, proj.y + s);
            ctx.lineTo(proj.x - s, proj.y);
            ctx.closePath();
            ctx.stroke();

            ctx.font = font(11, 700);
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                target.destroyed ? 'DESTROYED' : `TGT ${(range / 1000).toFixed(1)}KM`,
                proj.x + s + 8,
                proj.y
            );
        }
        ctx.restore();
    }

    /**
     * CCIP: where the Mk.82 would land if released now, from the same
     * ballistic integration the live bomb uses. The strike scenario asks for
     * a bomb inside 55 m at 250 m/s over a wireframe canyon - without this
     * the delivery is a guess, and a guess is not a skill.
     */
    private drawBombImpactPoint(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        impact: Vector3,
        strikeTargets: readonly StrikeTarget[],
        renderer: VectorRenderer
    ) {
        const camPt = renderer.transformToCamera(
            impact, physics.position, physics.pitch, physics.yaw, physics.roll
        );
        if (camPt.z < 2.0) return;

        const proj = renderer.projectCameraPoint(camPt);

        // Green until the predicted impact is inside a target's hit radius,
        // then amber: that transition IS the release cue.
        const onTarget = strikeTargets.some(
            t => !t.destroyed && t.horizontalDistanceTo(impact) <= t.hitRadius
        );
        const color = onTarget ? THEME.caution : THEME.phosphor;

        ctx.save();
        noGlow(ctx);
        ctx.strokeStyle = color;
        ctx.lineWidth = onTarget ? 2.2 : 1.5;
        if (onTarget) glow(ctx, color, 8);

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 9, 0, Math.PI * 2);
        ctx.moveTo(proj.x - 15, proj.y); ctx.lineTo(proj.x - 9, proj.y);
        ctx.moveTo(proj.x + 9, proj.y); ctx.lineTo(proj.x + 15, proj.y);
        ctx.moveTo(proj.x, proj.y - 15); ctx.lineTo(proj.x, proj.y - 9);
        ctx.moveTo(proj.x, proj.y + 9); ctx.lineTo(proj.x, proj.y + 15);
        ctx.stroke();
        noGlow(ctx);

        if (onTarget) {
            ctx.font = font(13, 700);
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RELEASE', proj.x, proj.y + 30);
        }
        ctx.restore();
    }

    private drawCombatReticles(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        targets: AirborneTarget[],
        renderer: VectorRenderer,
        layout: HudLayout,
        visible?: { isVisible(id: string): boolean }
    ) {
        const bulletSpeed = 1050; // m/s for 20mm Vulcan M61A1
        const canSee = (target: AirborneTarget) => !visible || visible.isVisible(target.id);

        ctx.save();
        noGlow(ctx);

        /**
         * Decide the range tags up front, before any are drawn.
         *
         * Three contacts in a loose trail used to print three tags inside
         * forty pixels of each other and across the altitude block, which is
         * worse than no tags: none of the three is readable and the
         * instrument behind them is gone. The brackets are always drawn - a
         * contact never disappears - but a tag has to earn its place.
         */
        ctx.font = font(10, 600);
        const candidates: LabelCandidate[] = [];
        for (const target of targets) {
            if (!target.isAlive || !canSee(target)) continue;
            const dist = Math.hypot(
                target.position.x - physics.position.x,
                target.position.y - physics.position.y,
                target.position.z - physics.position.z
            );
            if (dist >= 4500) continue;

            const camPt = renderer.transformToCamera(
                target.position, physics.position, physics.pitch, physics.yaw, physics.roll
            );
            if (camPt.z < 2.0) continue;
            const proj = renderer.projectCameraPoint(camPt);
            const text = `${shortName(target.name)} ${(dist / 1000).toFixed(1)}KM`;
            const half = Math.max(16, Math.min(56, 24000 / dist)) / 2;

            candidates.push({
                id: target.id,
                x: proj.x,
                y: proj.y,
                w: ctx.measureText(text).width + 4,
                h: 14,
                priority: dist,
                offset: half + 6
            });
        }

        const tags = new Map<string, PlacedLabel>();
        for (const placed of placeLabels(candidates, {
            viewportW: this.width,
            viewportH: this.height,
            maxVisible: layout.touchMode ? 3 : 5,
            avoid: this.instrumentBoxes(layout)
        })) {
            tags.set(placed.id, placed);
        }

        for (const target of targets) {
            if (!target.isAlive || !canSee(target)) continue;

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
            const tag = tags.get(target.id);
            if (tag) {
                ctx.font = font(10, 600);
                ctx.fillStyle = THEME.hostile;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    `${shortName(target.name)} ${(dist / 1000).toFixed(1)}KM`,
                    tag.x + 2,
                    tag.y + tag.h / 2
                );
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
        // In Arcade mode, keep the center of the screen clean and uncluttered!
        if (this.hudDensity === 'ARCADE') return;

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
