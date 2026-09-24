/**
 * CARRIER VECTOR: 1988 - Boot Sequence, Mission Briefing, Help & Debrief
 *
 * The briefing is the game's only chance to explain itself, and the old one
 * spent it on four bordered boxes of dense uppercase body copy in two
 * colours of green - 24 lines the player had to read before anything told
 * them what to press. It has been rebuilt as three numbered phase cards
 * (deck -> intercept -> recover) with the controls shown as keycaps, a
 * single one-line loss condition, and one unmistakable call to action.
 */

import type { VectorRenderer } from './VectorRenderer';
import { WireframeModels } from './VectorRenderer';
import type { ScoreKeeper } from '../core/ScoreKeeper';
import { formatLossCause, postMortemTip } from '../core/PostMortem';
import type { LossCause } from '../core/PostMortem';
import { CONTROL_SCHEMA, bindingsFor } from '../core/Controls';
import type { ControlContext } from '../core/Controls';
import { THEME, WORLD, fitText, font, glow, keycap, noGlow, plate, roundRect } from './Theme';
import type { Rect } from './Theme';
import { SCENARIOS, clearedCount, recommendScenario } from '../core/Scenarios';
import type { ScenarioCard, ScenarioDef } from '../core/Scenarios';
import { DEFAULT_MAP, mapById } from '../tactics/TerrainProfiles';
import type { MapId } from '../tactics/TerrainProfiles';
import { isCleared, recordFor } from '../core/MissionRecords';
import type { MissionRecords } from '../core/MissionRecords';
import type { DailyResult } from '../core/DailySortie';

/**
 * Where the briefing's interactive elements are.
 *
 * Extracted so that drawing and hit-testing read the same numbers. A touch
 * player taps the mission pill they want; if the layout and the hit test
 * computed their geometry separately they would drift apart on the first
 * change to either, and the symptom would be a menu that selects the wrong
 * mission on some screen sizes.
 */
export interface BriefingHitAreas {
    compact: boolean;
    selectorY: number;
    pills: Rect[];
    daily: Rect | null;
    cta: Rect;
}

export function briefingHitAreas(
    w: number,
    h: number,
    scenarioCount: number,
    hasDaily: boolean
): BriefingHitAreas {
    const cx = w / 2;
    const compact = h < 760 || w < 900;
    const selectorY = (compact ? 82 : 112) + (hasDaily ? 34 : 0);

    const gap = 8;
    const totalW = Math.min(w - 72, 1000);
    const pillW = (totalW - gap * (scenarioCount - 1)) / scenarioCount;
    const pillH = 44;
    const pills: Rect[] = [];
    for (let i = 0; i < scenarioCount; i++) {
        pills.push({ x: cx - totalW / 2 + i * (pillW + gap), y: selectorY, w: pillW, h: pillH });
    }

    const dailyW = Math.min(w - 72, 520);
    const daily: Rect | null = hasDaily
        ? { x: cx - dailyW / 2, y: compact ? 74 : 98, w: dailyW, h: 30 }
        : null;

    const ctaY = h - (compact ? 70 : 88);
    const ctaW = Math.min(w - 60, 420);
    const cta: Rect = { x: cx - ctaW / 2, y: ctaY - 24, w: ctaW, h: 48 };

    return { compact, selectorY, pills, daily, cta };
}

/**
 * The briefing's secondary options row, as data.
 *
 * Pure and exported so the one rule that matters here - which options appear,
 * and in what order - is testable without a canvas. `showPaletteHint` is true
 * only until the player has ever touched the palette setting (see
 * `Theme.storedPalette()`): the colour-blind palette shipped fully working and
 * entirely undiscoverable, reachable only through the full control reference.
 * The hint retires itself the moment the setting is touched, even to confirm
 * CLASSIC is what the player wants, so it never nags someone who has already
 * seen it.
 */
export function briefingSecondaryOptions(opts: {
    pacingLabel: string;
    threatLabel: string;
    mapChangeable: boolean;
    showPaletteHint: boolean;
    /** True until the stick setting has been touched. */
    showStickHint?: boolean;
}): [string, string][] {
    return [
        ['←  →', 'change mission'],
        ...(opts.mapChangeable
            ? [['↑  ↓', 'change map'] as [string, string]]
            : []),
        ['H', 'all controls'],
        ['S', 'skip to airborne'],
        ['O', opts.pacingLabel],
        ['V', opts.threatLabel],
        ...(opts.showPaletteHint
            ? [['C', 'try colour-blind palette'] as [string, string]]
            : []),
        ...(opts.showStickHint
            ? [['I', 'flight-sim stick (UP = dive)'] as [string, string]]
            : [])
    ];
}

/** Gap between two options in the briefing's secondary row. */
const SEC_GAP = 18;
/** Vertical pitch when that row has to wrap. */
const SEC_LINE_H = 19;

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
        noGlow(ctx);
        ctx.fillStyle = THEME.ground;
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const bandH = Math.max(2, env.lineH * h);
        const bandW = env.lineW * w;

        const grad = ctx.createLinearGradient(0, cy - bandH / 2, 0, cy + bandH / 2);
        grad.addColorStop(0, 'rgba(87,227,155,0)');
        grad.addColorStop(0.5, `rgba(87,227,155,${0.08 + 0.3 * (1 - env.reveal)})`);
        grad.addColorStop(1, 'rgba(87,227,155,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - bandW / 2, cy - bandH / 2, bandW, bandH);

        if (env.lineH < 1) {
            ctx.strokeStyle = '#d6fff0';
            glow(ctx, THEME.phosphor, 12);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - bandW / 2, cy);
            ctx.lineTo(cx + bandW / 2, cy);
            ctx.stroke();
            noGlow(ctx);
        }

        if (env.noise > 0.01) {
            ctx.globalAlpha = env.noise * 0.2;
            ctx.fillStyle = THEME.phosphor;
            ctx.fillRect(0, (t * 420) % h, w, 3);
            ctx.globalAlpha = 1;
        }

        if (env.reveal > 0) {
            ctx.globalAlpha = env.reveal;
            ctx.textAlign = 'center';
            ctx.fillStyle = THEME.ink;
            ctx.font = font(15, 700);
            ctx.fillText('CV-68 TACTICAL DISPLAY SYSTEM', cx, cy - 10);
            ctx.font = font(12);
            ctx.fillStyle = THEME.muted;
            ctx.fillText('DISPLAY ONLINE', cx, cy + 12);
            ctx.textAlign = 'left';
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    /**
     * Draw the orbiting carrier backdrop into the renderer's (offscreen)
     * world layer. Must be called BEFORE compositing; the text overlay is
     * drawn separately afterwards so it stays crisp.
     */
    public drawBriefingBackdrop(renderer: VectorRenderer, timeSec: number, viewportH = 900) {
        // Orbit radius and pitch are chosen so the camera actually LOOKS AT
        // the origin: the old values pointed 9 degrees down from a 95 m
        // height at 330 m range, which parked the ship low and small in the
        // lower third of the screen instead of filling the card gap.
        const orbitYaw = timeSec * 0.16;
        const radius = 205;
        const height = 66;
        const camPos = {
            x: Math.sin(orbitYaw) * radius,
            y: height,
            z: Math.cos(orbitYaw) * radius
        };
        renderer.renderMesh(
            this.carrierMesh,
            // Sunk so the ship sits in the gap between the loss-condition line
            // and the call to action rather than crossing either of them. A
            // compact layout puts that line higher, so the ship goes lower:
            // ~1.85 screen px per world metre at this orbit radius.
            { x: 0, y: viewportH < 760 ? -110 : -62, z: 0 },
            0,
            camPos,
            -Math.atan2(height, radius),
            orbitYaw + Math.PI,
            0,
            WORLD.carrier
        );
    }

    public drawBriefing(
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        timeSec: number,
        scenario: ScenarioDef,
        bestScore = 0,
        records: MissionRecords = {},
        pacingLabel = 'ops tempo',
        threatLabel = 'threat level',
        daily: DailyPanel | null = null,
        touchMode = false,
        /**
         * The map this mission would be flown on, and whether the player is
         * allowed to change it. Only the endless mode is - see
         * `ScenarioSetup.allowMapChoice`.
         */
        mapChoice: { id: MapId; changeable: boolean } | null = null,
        /** See `briefingSecondaryOptions` - true until the palette is touched. */
        showPaletteHint = false,
        /** See `briefingSecondaryOptions` - true until the stick is touched. */
        showStickHint = false
    ) {
        ctx.save();
        noGlow(ctx);

        // Dim the backdrop. A vertical gradient keeps the wireframe visible
        // in the middle of the screen while guaranteeing contrast at the top
        // and bottom, where all the copy lives.
        const veil = ctx.createLinearGradient(0, 0, 0, h);
        veil.addColorStop(0, 'rgba(7,13,17,0.94)');
        veil.addColorStop(0.5, 'rgba(7,13,17,0.66)');
        veil.addColorStop(1, 'rgba(7,13,17,0.94)');
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const areas = briefingHitAreas(w, h, SCENARIOS.length, daily !== null);
        const compact = areas.compact;
        /**
         * A phone-height briefing cannot hold the three phase cards, the loss
         * condition and a keyboard legend as well as the things you can
         * actually press. It keeps the mission list and the button; the cards
         * are a tutorial for a screen that has room for one.
         */
        const phone = touchMode || h < 430;

        // --- Masthead ---
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = THEME.ink;
        ctx.font = font(compact ? 30 : 40, 700);
        ctx.fillText('CARRIER VECTOR: 1988', cx, compact ? 48 : 68);

        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        let sub = 'Run the flight deck. Fly the sortie. Bring the jet home.';
        const cleared = clearedCount(records);
        if (cleared > 0) sub += `   ·   ${cleared} / ${SCENARIOS.length} MISSIONS CLEARED`;
        if (bestScore > 0) sub += `   ·   PERSONAL BEST ${bestScore} PTS`;
        ctx.fillText(fitText(ctx, sub, w - 60), cx, compact ? 66 : 90);

        // Build stamp, top-right and quiet: a pilot's screenshot or report
        // should always say which build it came from.
        ctx.save();
        ctx.font = font(10, 600);
        ctx.fillStyle = THEME.muted;
        ctx.textAlign = 'right';
        ctx.fillText(`v${__APP_VERSION__}`, w - 16, 20);
        ctx.restore();

        // --- Daily sortie ---
        if (daily && areas.daily) this.dailyPanel(ctx, cx, areas.daily.y, w, daily, timeSec);

        // --- Scenario selector ---
        const selectorY = areas.selectorY;
        const recommended = recommendScenario(records);
        this.scenarioSelector(ctx, areas.pills, scenario, records, recommended.id);

        // --- Selected scenario headline ---
        const headY = selectorY + (compact ? 66 : 76);
        ctx.textAlign = 'center';
        ctx.font = font(compact ? 19 : 23, 700);
        ctx.fillStyle = THEME.caution;
        ctx.fillText(scenario.name, cx, headY);

        // The chosen map when this scenario allows one, its own otherwise.
        const map = mapById(mapChoice?.id ?? scenario.setup.map ?? DEFAULT_MAP);
        ctx.font = font(12);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(
            fitText(
                ctx,
                phone
                    ? `${scenario.duration}   ·   ${map.name}`
                    : `${scenario.tagline}   ·   ${scenario.duration}   ·   ${map.name}: ${map.blurb}`,
                w - 40
            ),
            cx,
            headY + 19
        );

        // Per-mission record. A single global best told a player nothing about
        // whether they had ever beaten THIS mission, which is the only
        // question the selector is really being asked.
        const record = recordFor(records, scenario.id);
        ctx.font = font(11, 600);
        if (record.attempts === 0) {
            ctx.fillStyle = THEME.key;
            ctx.fillText('NOT YET FLOWN', cx, headY + 36);
        } else {
            const parts = [`BEST ${record.best} PTS`];
            parts.push(record.completions > 0
                ? `CLEARED ${record.completions}×`
                : `${record.attempts} ATTEMPT${record.attempts === 1 ? '' : 'S'}, NOT YET CLEARED`);
            ctx.fillStyle = record.completions > 0 ? THEME.phosphor : THEME.caution;
            ctx.fillText(parts.join('   ·   '), cx, headY + 36);
        }

        // --- Three phase cards, supplied by the scenario ---
        const gutter = 16;
        if (!phone) {
        const cardsY = headY + (compact ? 48 : 56);
        const cardW = Math.min(320, (w - 88 - gutter * 2) / 3);
        const cardH = compact ? 144 : 168;
        const totalW = cardW * 3 + gutter * 2;
        scenario.cards.forEach((card, i) => {
            this.phaseCard(ctx, {
                x: cx - totalW / 2 + i * (cardW + gutter),
                y: cardsY,
                w: cardW,
                h: cardH
            }, card);
        });

        // --- Loss condition: one line, not a paragraph ---
        const lossY = cardsY + cardH + (compact ? 22 : 34);
        ctx.textAlign = 'center';
        ctx.font = font(12, 600);
        ctx.fillStyle = THEME.alert;
        ctx.fillText(fitText(ctx, scenario.lossCondition, w - 80), cx, lossY);
        }

        // --- Primary call to action ---
        const ctaY = h - (compact ? 70 : 88);
        const pulse = 0.72 + 0.28 * Math.sin(timeSec * 3.2);
        ctx.save();
        ctx.globalAlpha = pulse;
        const ctaText = phone ? 'FLY' : 'FLY THIS MISSION';
        ctx.font = font(17, 700);
        const ctaW = ctx.measureText(ctaText).width + 128;
        const ctaX = cx - ctaW / 2;
        roundRect(ctx, ctaX, ctaY - 24, ctaW, 48, 6);
        ctx.fillStyle = 'rgba(95,216,255,0.12)';
        ctx.fill();
        ctx.strokeStyle = THEME.key;
        ctx.lineWidth = 1.6;
        glow(ctx, THEME.key, 12);
        ctx.stroke();
        noGlow(ctx);
        ctx.restore();

        if (phone) {
            // No keyboard: the button is the instruction.
            ctx.font = font(17, 700);
            ctx.fillStyle = THEME.ink;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ctaText, cx, ctaY);
        } else {
            const capW = keycap(ctx, ctaX + 22, ctaY, 'ENTER', { size: 15 });
            ctx.font = font(17, 700);
            ctx.fillStyle = THEME.ink;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(ctaText, ctaX + 22 + capW + 16, ctaY);
        }

        // --- Secondary options ---
        if (phone) {
            ctx.restore();
            return;
        }
        ctx.textBaseline = 'middle';
        const secs = briefingSecondaryOptions({
            pacingLabel,
            threatLabel,
            mapChangeable: mapChoice?.changeable === true,
            showPaletteHint,
            showStickHint
        });

        /**
         * WRAPPED, not clipped.
         *
         * This was one centred line, and every setting added to the game added
         * an item to it: at 800px the row ran off both edges at once and the
         * first and last options - change mission, and the screen style - were
         * the two that got cut. Packing it into as many lines as it needs
         * keeps every option discoverable on every screen, which is the only
         * reason the row exists.
         */
        const itemWidth = ([k, label]: [string, string]) => {
            ctx.font = font(11, 600);
            const capW = ctx.measureText(k).width + 14 + 5;
            ctx.font = font(11);
            return capW + ctx.measureText(label).width + SEC_GAP;
        };

        const maxRowW = w - 48;
        const rows: { items: [string, string][]; width: number }[] = [];
        for (const item of secs) {
            const iw = itemWidth(item);
            const last = rows[rows.length - 1];
            if (last && last.width + iw <= maxRowW) {
                last.items.push(item);
                last.width += iw;
            } else {
                rows.push({ items: [item], width: iw });
            }
        }

        /**
         * Stack upward from the bottom edge. A wrapped block sits lower than a
         * single row would: stacking upward from the usual line put the first
         * of two rows straight through the FLY THIS MISSION button, which is
         * the one thing on this screen that must never be obscured.
         */
        const baseY = rows.length > 1 ? h - 20 : h - 30;
        rows.forEach((rowItems, i) => {
            const y = baseY - (rows.length - 1 - i) * SEC_LINE_H;
            // The trailing gap is not part of the visible width.
            let sx = cx - (rowItems.width - SEC_GAP) / 2;
            for (const [k, label] of rowItems.items) {
                sx += keycap(ctx, sx, y, k, { size: 11 }) + 5;
                ctx.font = font(11);
                ctx.fillStyle = THEME.muted;
                ctx.textAlign = 'left';
                ctx.fillText(label, sx, y);
                sx += ctx.measureText(label).width + SEC_GAP;
            }
        });

        ctx.restore();
    }

    /**
     * One line above the mission list: the same run for everybody, today only.
     * It is the only thing in this game that can leave the tab, so it gets the
     * first thing the eye lands on after the title.
     */
    private dailyPanel(
        ctx: CanvasRenderingContext2D,
        cx: number,
        y: number,
        viewportW: number,
        daily: DailyPanel,
        timeSec: number
    ) {
        const flown = daily.result !== null;
        const accent = flown ? THEME.phosphor : THEME.caution;
        const headline = `DAILY SORTIE #${daily.number}`;
        const detail = flown
            ? `TODAY: WAVE ${daily.result!.wave} · ${daily.result!.score.toLocaleString('en-US')} PTS · ${daily.result!.rank}`
            : 'Same seed for every pilot in the world. One run, one score to share.';

        ctx.save();
        noGlow(ctx);
        ctx.font = font(12, 700);
        const headW = ctx.measureText(headline).width;
        ctx.font = font(11);
        // Measured as drawn, separator included - measuring the bare detail
        // left the line truncated with an ellipsis inside its own plate.
        const detailW = ctx.measureText(`   ·   ${detail}`).width;
        const w = Math.min(viewportW - 72, headW + detailW + 62);
        const x = cx - w / 2;

        plate(ctx, { x, y, w, h: 30 }, { fill: 'rgba(9,19,25,0.8)', border: accent, radius: 5 });

        // A quiet pulse when it has not been flown today: this is the thing a
        // returning player is here for, and it should catch the eye once.
        ctx.globalAlpha = flown ? 1 : 0.8 + 0.2 * Math.sin(timeSec * 2.6);
        const capW = keycap(ctx, x + 10, y + 15, 'D', { size: 11 });

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = font(12, 700);
        ctx.fillStyle = accent;
        ctx.fillText(headline, x + 10 + capW + 10, y + 15);

        ctx.font = font(11);
        ctx.fillStyle = THEME.muted;
        const detailX = x + 10 + capW + 10 + ctx.measureText(headline).width;
        ctx.font = font(11);
        ctx.fillText(
            fitText(ctx, `   ·   ${detail}`, w - (detailX - x) - 14),
            detailX,
            y + 15
        );
        ctx.restore();
    }

    /**
     * Equal-width pills, one per scenario, with the number key that selects
     * it and a difficulty read-out. Equal widths (with the name fitted into
     * whatever that comes to) is what keeps five entries on one row from
     * 800px up, instead of overflowing the moment a name gets long.
     */
    private scenarioSelector(
        ctx: CanvasRenderingContext2D,
        pills: Rect[],
        selected: ScenarioDef,
        records: MissionRecords,
        recommendedId: string
    ) {
        const pillW = pills[0].w;
        const pillH = pills[0].h;

        ctx.save();
        noGlow(ctx);
        ctx.textBaseline = 'middle';

        SCENARIOS.forEach((s, i) => {
            const x = pills[i].x;
            const y = pills[i].y;
            const isSelected = s.id === selected.id;
            const isRecommended = s.id === recommendedId && !isCleared(records, s.id);
            const accent = isSelected ? THEME.key
                : isRecommended ? THEME.phosphor
                    : THEME.edgeSoft;

            roundRect(ctx, x, y, pillW, pillH, 5);
            ctx.fillStyle = isSelected ? 'rgba(95,216,255,0.14)' : 'rgba(9,19,25,0.7)';
            ctx.fill();
            ctx.strokeStyle = accent;
            ctx.lineWidth = isSelected ? 1.8 : 1;
            ctx.stroke();

            ctx.font = font(10, 700);
            ctx.fillStyle = isSelected ? THEME.key : THEME.muted;
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}`, x + 9, y + 15);

            // A tick for a mission already beaten - the one thing a returning
            // player wants to see at a glance is what is left.
            if (isCleared(records, s.id)) {
                ctx.strokeStyle = THEME.phosphor;
                ctx.lineWidth = 1.8;
                const tx = x + pillW - 16;
                const ty = y + 15;
                ctx.beginPath();
                ctx.moveTo(tx - 5, ty);
                ctx.lineTo(tx - 2, ty + 4);
                ctx.lineTo(tx + 5, ty - 5);
                ctx.stroke();
            }

            ctx.font = font(11, isSelected ? 700 : 400);
            ctx.fillStyle = isSelected ? THEME.ink : THEME.muted;
            ctx.textAlign = 'center';
            ctx.fillText(fitText(ctx, s.name, pillW - 46), x + pillW / 2, y + 15);

            // Difficulty: filled pips out of five.
            const pipR = 2.6;
            const pipGap = 8;
            const pipsW = pipGap * 4;
            let px = x + pillW / 2 - pipsW / 2;
            for (let d = 1; d <= 5; d++) {
                ctx.beginPath();
                ctx.arc(px, y + 31, pipR, 0, Math.PI * 2);
                if (d <= s.difficulty) {
                    ctx.fillStyle = s.difficulty >= 4 ? THEME.alert
                        : s.difficulty >= 3 ? THEME.caution
                            : THEME.phosphor;
                    ctx.fill();
                } else {
                    ctx.strokeStyle = THEME.edgeSoft;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                px += pipGap;
            }

            // A single suggested next mission, so the menu reads as a path
            // rather than five equally plausible doors.
            if (isRecommended) {
                ctx.font = font(8, 700);
                ctx.fillStyle = THEME.phosphor;
                ctx.textAlign = 'center';
                ctx.fillText(
                    recordFor(records, s.id).attempts > 0 ? 'FLY THIS NEXT' : 'START HERE',
                    x + pillW / 2,
                    y + pillH + 10
                );
            }
        });
        ctx.restore();
    }

    private phaseCard(ctx: CanvasRenderingContext2D, r: Rect, card: ScenarioCard) {
        plate(ctx, r, { fill: 'rgba(9,19,25,0.86)', border: THEME.edgeSoft, radius: 6 });

        ctx.save();
        noGlow(ctx);

        // Step number badge
        ctx.beginPath();
        ctx.arc(r.x + 26, r.y + 26, 13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(87,227,155,0.16)';
        ctx.fill();
        ctx.strokeStyle = THEME.phosphor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.font = font(13, 700);
        ctx.fillStyle = THEME.phosphor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.n, r.x + 26, r.y + 27);

        ctx.textAlign = 'left';
        ctx.font = font(14, 700);
        ctx.fillStyle = THEME.ink;
        ctx.fillText(card.title, r.x + 48, r.y + 27);

        // Body copy, wrapped to the card width
        ctx.font = font(11.5);
        ctx.fillStyle = THEME.muted;
        ctx.textBaseline = 'alphabetic';
        const lines = wrapText(ctx, card.body, r.w - 32);
        lines.slice(0, 5).forEach((line, i) => {
            ctx.fillText(line, r.x + 16, r.y + 58 + i * 16);
        });

        // Keys for this phase
        let kx = r.x + 16;
        const ky = r.y + r.h - 20;
        ctx.textBaseline = 'middle';
        for (const [key, label] of card.keys) {
            kx += keycap(ctx, kx, ky, key, { size: 10 }) + 5;
            ctx.font = font(10);
            ctx.fillStyle = THEME.muted;
            ctx.textAlign = 'left';
            ctx.fillText(label, kx, ky);
            kx += ctx.measureText(label).width + 12;
        }

        ctx.restore();
    }

    /** Full control reference, grouped, pausing the sim while it's open. */
    public drawHelp(ctx: CanvasRenderingContext2D, w: number, h: number, context: ControlContext) {
        ctx.save();
        noGlow(ctx);
        ctx.fillStyle = 'rgba(7,13,17,0.97)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = THEME.ink;
        ctx.font = font(24, 700);
        ctx.fillText('CONTROLS', cx, 60);

        ctx.font = font(12);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(
            context === 'DECK' ? 'FLIGHT DECK OPERATIONS' : 'COCKPIT / FLIGHT OPERATIONS',
            cx,
            82
        );

        const bindings = bindingsFor(context);
        const groups = [...new Set(bindings.map(b => b.group))];

        const ROW_H = 24;
        const GROUP_HEAD = 30;
        const GROUP_GAP = 18;
        const startY = 126;
        const available = h - startY - 80;

        // Measure first, then decide on one centred column or two. The old
        // version always laid out as if there were two columns and only
        // wrapped on overflow, so a short list sat lopsided on the left.
        const groupHeight = (g: string) =>
            GROUP_HEAD + bindings.filter(b => b.group === g).length * ROW_H + GROUP_GAP;
        const totalH = groups.reduce((sum, g) => sum + groupHeight(g), 0);
        const twoCols = totalH > available;

        const colW = Math.min(440, twoCols ? (w - 140) / 2 : w - 160);
        const colX = (col: number) => twoCols
            ? cx - colW - 20 + col * (colW + 40)
            : cx - colW / 2;

        let col = 0;
        let y = startY;

        ctx.textBaseline = 'middle';
        for (const group of groups) {
            if (twoCols && col === 0 && y + groupHeight(group) > startY + available) {
                col = 1;
                y = startY;
            }
            const x = colX(col);

            ctx.font = font(11, 700);
            ctx.fillStyle = THEME.caution;
            ctx.textAlign = 'left';
            ctx.fillText(group, x, y);

            ctx.strokeStyle = THEME.edgeSoft;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + 12);
            ctx.lineTo(x + colW, y + 12);
            ctx.stroke();
            y += GROUP_HEAD;

            for (const b of bindings.filter(bb => bb.group === group)) {
                keycap(ctx, x, y, b.display, { size: 11 });
                ctx.font = font(12);
                ctx.fillStyle = THEME.muted;
                ctx.textAlign = 'left';
                // Clipped to the column. Unbounded, the longest label ("Rudder
                // left (fine aim only - you do not need it to turn)") ran past
                // colW and printed through the SYSTEM column's keycaps.
                ctx.fillText(fitText(ctx, b.label, colW - 124 - 8), x + 124, y);
                y += ROW_H;
            }
            y += GROUP_GAP;
        }

        const capW = keycap(ctx, cx - 60, h - 40, 'ESC', { size: 12 });
        ctx.font = font(12, 600);
        ctx.fillStyle = THEME.muted;
        ctx.textAlign = 'left';
        ctx.fillText('resume', cx - 60 + capW + 10, h - 40);
        ctx.restore();
    }

    /** End-of-mission debrief with final score and rank. */
    public drawDebrief(
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        score: ScoreKeeper,
        wave: number,
        best = 0,
        isNewBest = false,
        result: DebriefResult = { outcome: 'FAILED', scenarioName: 'CARRIER DEFENSE', reason: null }
    ) {
        ctx.save();
        noGlow(ctx);
        ctx.fillStyle = 'rgba(7,13,17,0.96)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';

        const won = result.outcome === 'SUCCESS';
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
        if (b.structureKills > 0) {
            rows.splice(4, 0, ['HARDENED TARGETS HIT', `${b.structureKills}`]);
        }
        if (b.missionsCompleted > 0) {
            rows.splice(1, 0, ['MISSION OBJECTIVE', 'COMPLETE']);
        }

        // Lay the whole card out from a measured height and centre it. The
        // fixed y = 104 / 162 / ... offsets left a 300px void under the rank
        // on a 900px-tall window, with the prompt stranded at the bottom.
        const boxW = Math.min(460, w - 80);

        /**
         * On a short window the full nine-row breakdown plus a share card is
         * taller than the viewport. Rather than clipping it - the deck screen
         * and the cockpit both shed content instead of clipping, and this
         * should match - drop the rows that read zero, which are exactly the
         * ones carrying no information.
         */
        const causeText = formatLossCause(result.cause ?? null);
        const tipText = postMortemTip(result.cause ?? null);
        // 20px per line plus 6px of breathing room, only when there is a
        // cause to show - a win, or a loss with no recorded cause, costs
        // nothing extra in the layout.
        const causeBlockH = causeText ? 20 + (tipText ? 20 : 0) + 6 : 0;

        const fullHeight = (n: number) => 112 + causeBlockH + (n * 22 + 36) + 118
            + (result.shareCard ? result.shareCard.split('\n').length * 17 + 46 + 56 : 0);
        let compact = false;
        if (fullHeight(rows.length) > h - 40) {
            const essential = new Set(['WAVES SURVIVED', 'MISSION OBJECTIVE']);
            const trimmed = rows.filter(([label, value]) =>
                essential.has(label) || !/^0%?$/.test(value));
            rows.length = 0;
            rows.push(...trimmed);
            compact = fullHeight(rows.length) > h - 40;
        }

        const boxH = rows.length * 22 + 36;
        // The share card is part of the block, not an afterthought pasted
        // under it: leaving it out of the height left the ENTER prompt drawn
        // straight through the card on a 700px-tall window.
        const cardH = result.shareCard ? result.shareCard.split('\n').length * 17 + 46 : 0;
        const blockH = 112 + causeBlockH + boxH + 118 + (cardH ? cardH + 56 : 0);
        const top = Math.max(20, (h - blockH) / 2 - 20);

        const headlineColor = won ? THEME.phosphor : THEME.alert;
        ctx.fillStyle = headlineColor;
        ctx.font = font(Math.min(38, Math.max(26, w / 38)), 700);
        glow(ctx, headlineColor, 12);
        ctx.fillText(won ? result.title ?? 'MISSION COMPLETE' : 'MISSION FAILED', cx, top + 40);
        noGlow(ctx);

        ctx.fillStyle = THEME.muted;
        ctx.font = font(13);
        ctx.fillText(
            fitText(ctx, result.reason ?? 'CV-68 NIMITZ IS COMBAT INEFFECTIVE', w - 80),
            cx,
            top + 66
        );
        ctx.font = font(11, 600);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(result.scenarioName, cx, top + 84);

        // What got you, and what to do differently. Only shown on a loss
        // with a recorded cause - a win has nothing to explain, and a loss
        // with no cause on record says nothing rather than guessing.
        if (causeText) {
            ctx.font = font(12, 700);
            ctx.fillStyle = THEME.alert;
            ctx.fillText(fitText(ctx, causeText, w - 80), cx, top + 100);
            if (tipText) {
                ctx.font = font(11);
                ctx.fillStyle = THEME.muted;
                ctx.fillText(fitText(ctx, tipText, w - 80), cx, top + 120);
            }
        }

        const boxX = cx - boxW / 2;
        const boxY = top + 112 + causeBlockH;
        plate(ctx, { x: boxX, y: boxY, w: boxW, h: boxH }, { border: THEME.edgeSoft, radius: 5 });

        ctx.font = font(12);
        ctx.textBaseline = 'middle';
        rows.forEach(([label, value], i) => {
            const y = boxY + 26 + i * 22;
            ctx.fillStyle = THEME.muted;
            ctx.textAlign = 'left';
            ctx.fillText(label, boxX + 18, y);
            ctx.fillStyle = THEME.ink;
            ctx.textAlign = 'right';
            ctx.fillText(value, boxX + boxW - 18, y);
        });

        const scoreY = boxY + boxH + 44;
        ctx.textAlign = 'center';

        /**
         * On a window too short for both, the share card IS the summary - it
         * already carries the score and the rank - so the big readout stands
         * down rather than pushing the card off the bottom of the screen.
         */
        const showScoreBlock = !(compact && result.shareCard);
        if (showScoreBlock) {
            ctx.fillStyle = THEME.caution;
            ctx.font = font(30, 700);
            ctx.fillText(`${score.totalScore} PTS`, cx, scoreY);
            ctx.font = font(17, 700);
            ctx.fillStyle = THEME.ink;
            ctx.fillText(`FINAL RANK: ${score.rank}`, cx, scoreY + 30);
        }

        ctx.font = font(12, 600);
        if (!showScoreBlock) {
            // Nothing: the card says it.
        } else if (isNewBest) {
            ctx.fillStyle = THEME.phosphor;
            glow(ctx, THEME.phosphor, 8);
            ctx.fillText('NEW PERSONAL BEST', cx, scoreY + 54);
            noGlow(ctx);
        } else if (best > 0) {
            ctx.fillStyle = THEME.muted;
            ctx.fillText(`PERSONAL BEST  ${best} PTS`, cx, scoreY + 54);
        }

        // ...and how this run compares on THIS mission, which for anything
        // other than the endless defence is the number that means something.
        if (showScoreBlock && result.missionBest !== undefined && result.missionBest > 0) {
            ctx.font = font(11, 600);
            ctx.fillStyle = result.isMissionBest ? THEME.phosphor : THEME.muted;
            ctx.fillText(
                result.isMissionBest
                    ? `BEST RUN YET ON ${result.scenarioName}`
                    : `BEST ON THIS MISSION  ${result.missionBest} PTS`,
                cx,
                scoreY + 74
            );
        }

        // Below the personal-best and mission-best lines, which both live at
        // scoreY + 54 / + 74 and were being covered by the card's top edge.
        const cardY = showScoreBlock ? scoreY + 96 : boxY + boxH + 24;
        if (result.shareCard) {
            this.shareCard(ctx, cx, cardY, w, result.shareCard, result.copied === true);
        } else if (result.nextUp) {
            ctx.font = font(11, 600);
            ctx.fillStyle = THEME.key;
            ctx.fillText(fitText(ctx, `NEXT UP: ${result.nextUp}`, w - 80), cx, scoreY + 94);
        }

        // Below the card, or below the score block when there is no card. Not
        // clamped into the card: a prompt drawn over the thing it refers to is
        // worse than a prompt slightly off the bottom.
        const promptY = result.shareCard
            ? cardY + cardH + 26
            : Math.min(h - 32, scoreY + 112);
        const capW = keycap(ctx, cx - 90, promptY, 'ENTER', { size: 13 });
        ctx.font = font(13, 600);
        ctx.fillStyle = THEME.muted;
        ctx.textAlign = 'left';
        ctx.fillText('back to mission select', cx - 90 + capW + 12, promptY);
        ctx.restore();
    }

    /**
     * The daily result, as the text that gets pasted somewhere. Drawn as the
     * card itself rather than as a prettier summary, so what the player sees
     * is exactly what lands in the clipboard.
     */
    private shareCard(
        ctx: CanvasRenderingContext2D,
        cx: number,
        y: number,
        viewportW: number,
        card: string,
        copied: boolean
    ) {
        const lines = card.split('\n');
        ctx.save();
        noGlow(ctx);
        ctx.font = font(11);
        const w = Math.min(viewportW - 60, Math.max(...lines.map(l => ctx.measureText(l).width)) + 48);
        const h = lines.length * 17 + 46;
        const x = cx - w / 2;
        plate(ctx, { x, y, w, h }, { fill: 'rgba(9,19,25,0.9)', border: THEME.phosphor, radius: 5 });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((line, i) => {
            ctx.font = font(i === 0 ? 11 : i === 1 ? 13 : 11, i <= 1 ? 700 : 400);
            ctx.fillStyle = i === 1 ? THEME.ink : i === 0 ? THEME.phosphor : THEME.muted;
            ctx.fillText(fitText(ctx, line, w - 24), cx, y + 18 + i * 17);
        });

        const capW = keycap(ctx, cx - 58, y + h - 15, 'C', { size: 11 });
        ctx.font = font(11, 600);
        ctx.fillStyle = copied ? THEME.phosphor : THEME.muted;
        ctx.textAlign = 'left';
        ctx.fillText(copied ? 'copied to clipboard' : 'copy result', cx - 58 + capW + 10, y + h - 15);
        ctx.restore();
    }
}

export interface DebriefResult {
    outcome: 'SUCCESS' | 'FAILED';
    scenarioName: string;
    /** Why it ended, in one line. */
    reason: string | null;
    /** Scenario-supplied headline for a win. */
    title?: string;
    /** Best score ever recorded on this scenario, including this run. */
    missionBest?: number;
    /** Whether this run set that scenario best. */
    isMissionBest?: boolean;
    /** The mission the debrief suggests flying next, if any. */
    nextUp?: string;
    /** The daily result as shareable text, when this was a daily run. */
    shareCard?: string | null;
    /** Whether the card has just been copied, for the confirmation line. */
    copied?: boolean;
    /** What killed the aeroplane, when the mission ended in a loss. */
    cause?: LossCause | null;
}

/** What the briefing needs to draw the daily sortie line. */
export interface DailyPanel {
    number: number;
    result: DailyResult | null;
}

/** Greedy word wrap against a measured pixel width. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines;
}

export { CONTROL_SCHEMA };
