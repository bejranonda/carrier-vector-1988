/**
 * CARRIER VECTOR: 1988 - Cockpit Instrument Placement Solver
 *
 * The HUD blocks used to be placed at fixed offsets from screen centre
 * (`cx - 300`, `cx + 300`, `x = 24`...). That is fine at 1440px and broken
 * below about 1100px: at 900x700 the airspeed block was drawn straight
 * underneath the training checklist, and the pitch ladder ran through both.
 *
 * Placement is now solved left-to-right from the actual viewport, and the
 * pitch ladder gets whatever half-width is left in the middle. Pure geometry,
 * no canvas - so "no two instruments ever overlap" is directly testable, the
 * same way `DeckLayout` makes it testable for the deck screen.
 */

import type { Rect } from './DeckLayout';

export const HUD_METRICS = {
    /** Margin from the viewport edge. */
    edge: 20,
    checklistW: 196,
    /** Systems block, bottom-left, sharing the rail with the checklist. */
    systemsW: 236,
    approachW: 150,
    speedW: 96,
    altW: 110,
    /** Clearance between a side instrument and the centre symbology. */
    gap: 18,
    /** Half-width of the pitch ladder's widest element at full scale. */
    symHalfMax: 205,
    /** Smallest usable ladder half-width before it stops being readable. */
    symHalfMin: 86,
    /**
     * Below this viewport width the checklist panel would fight the airspeed
     * block for the left rail, so it is dropped and the coach ticker carries
     * the current training prompt on its own.
     */
    checklistMinWidth: 1150,
    /**
     * Below this viewport height the full 150px systems panel would eat a
     * third of the screen and climb into the centre instrument band, so it is
     * drawn as a single strip along the bottom instead.
     */
    compactSystemsHeight: 560,
    /** Full-size RWR scope side; shrunk on short viewports. */
    rwrMax: 156,
    rwrMin: 104,
    /**
     * Height claimed by the objective strip in touch mode. The instruments
     * are centred in what is left between this and the thumb band.
     */
    touchTopBand: 86,
    /**
     * Below this height the compass tape is dropped in touch mode. On a
     * 320 px phone the objective strip, the tape, the side blocks and the
     * thumb band do not all fit, and the tape is the one a player flying on
     * autopilot can most afford to lose - the designation bracket and the
     * objective line both carry bearing information.
     */
    touchCompassMinHeight: 420,
    /**
     * Below this height the RWR scope is dropped in touch mode. The right
     * column belongs to the weapon pills and the fire button, and there is
     * no corner left for a 90 px scope on a 320 px phone. The threat is still
     * announced three other ways: the MISSILE LAUNCH banner, the spatialised
     * launch audio, and the threat drone that rises with the RWR state.
     */
    touchRwrMinHeight: 460,
    /**
     * The ARCADE bottom pill bar: weapon pills, an optional countermeasure
     * pill, the assist/rewind/padlock pills, and the status telemetry pill.
     * `HUD.ts` and `PointerInteractivity.ts` used to each hardcode this row
     * independently (`barY = height - 52`, weapon `w = 78`, `+8` spacing...)
     * which is exactly the kind of drift that puts a click on the wrong
     * button. `solveArcadeBar` below is now the single source of truth.
     */
    arcadeBar: {
        /** Distance of the bar's top edge from the bottom of the viewport. */
        y: 52,
        pillH: 34,
        startX: 24,
        /** Standard horizontal gap between two adjacent pills. */
        gap: 8,
        weaponW: 78,
        countermeasureW: 96,
        assistW: 110,
        rewindW: 84,
        padlockW: 80,
        /** Total gap (not additional to `gap`) before the assist pill. */
        preAssistGap: 16,
        /** Total gap (not additional to `gap`) before the status pill. */
        preStatusGap: 16,
        /** Added to the measured text width to get the status pill's width. */
        statusPadding: 24,
        /** The status pill self-suppresses within this margin of the edge. */
        edgeMargin: 24
    }
} as const;

export interface HudLayout {
    cx: number;
    cy: number;
    showChecklist: boolean;
    showApproach: boolean;
    /** Left edge of the approach panel (only meaningful when showApproach). */
    approachX: number;
    speedX: number;
    altX: number;
    /** Half-width available to the centre symbology. */
    symHalf: number;
    /** Pitch-ladder geometry scale derived from symHalf. */
    symScale: number;
    /** Draw the systems readout as a bottom strip rather than a panel. */
    compactSystems: boolean;
    /** Side length of the RWR scope. */
    rwrSize: number;
    /** Edges claimed by the thumb controls, for the instrument draws. */
    reserve: HudReserve;
    /** True when the thumb controls are on screen. */
    touchMode: boolean;
    /** Whether there is room for the heading tape. */
    showCompass: boolean;
    /** Whether there is room for the RWR scope. */
    showRwr: boolean;
}

/** Screen edges already claimed by something else, in CSS pixels. */
export interface HudReserve {
    left: number;
    right: number;
    bottom: number;
    top: number;
}

export const NO_RESERVE: HudReserve = { left: 0, right: 0, bottom: 0, top: 0 };

export interface HudLayoutInput {
    width: number;
    height: number;
    showApproach: boolean;
    hasChecklist: boolean;
    /**
     * Space the thumb controls occupy in touch mode. The instruments have to
     * be placed inside what is left: on a 568 px phone the airspeed block, the
     * RWR scope and the systems strip were all drawn straight through the
     * stick and the fire button, because the solver had no idea they existed.
     */
    reserve?: HudReserve;
    /** Touch mode sheds the keyboard cheat strip and the systems panel. */
    touchMode?: boolean;
}

export function solveHudLayout(input: HudLayoutInput): HudLayout {
    const m = HUD_METRICS;
    const width = Math.max(320, input.width);
    const height = Math.max(240, input.height);
    const cx = width / 2;
    const cy = height / 2;

    const reserve = input.reserve ?? NO_RESERVE;
    const touchMode = input.touchMode === true;

    // A phone has no keyboard to read a checklist against, and no room for it.
    const showChecklist = !touchMode && input.hasChecklist && width >= m.checklistMinWidth;
    // A short window gets a one-line systems strip instead of the tall panel,
    // which keeps the bottom-left corner out of the centre instrument band.
    const compactSystems = height < m.compactSystemsHeight;
    const rwrSize = Math.max(
        m.rwrMin * (touchMode ? 0.7 : 1),
        Math.min(m.rwrMax, Math.floor((height - reserve.bottom - reserve.top) * 0.22))
    );

    // The left rail is shared by the checklist (top) and the systems panel
    // (bottom); when the systems readout is compact only the checklist claims it.
    /**
     * The side blocks do NOT reserve the thumb columns horizontally.
     *
     * The stick and the fire button occupy the BOTTOM of those columns, and
     * the airspeed and altitude blocks are vertically centred - so lifting the
     * instrument centre out of the thumb band clears them completely, while
     * reserving the full column width squeezed the pitch ladder down to its
     * 24 px hard floor on a 568 px phone. Only the corner instruments (the
     * RWR scope, the systems line) need the horizontal reserve, and they read
     * it from `layout.reserve` at draw time.
     */
    const railRight = m.edge + (showChecklist ? m.checklistW : 0);
    const leftLimit = railRight + 12;

    /**
     * Ladder half-width for a given airspeed-block position. Prefers the full
     * width, floors at symHalfMin for readability, but never so wide that it
     * would run into the block - hence the 2px hard bound, which wins over the
     * floor on genuinely tiny viewports.
     */
    const solveSymHalf = (speedLeft: number): number => {
        const room = cx - speedLeft - m.speedW - m.gap;
        const hardRoom = Math.max(24, cx - speedLeft - m.speedW - 2);
        return Math.min(m.symHalfMax, Math.max(Math.min(m.symHalfMin, hardRoom), room));
    };

    // Size the centre symbology first, then hang the side blocks off it, so a
    // wide display actually gets the full-size ladder instead of whatever a
    // fixed `cx - 300` offset happened to leave.
    let symHalf = Math.min(m.symHalfMax, Math.max(m.symHalfMin, cx - leftLimit - m.speedW - m.gap
        - (input.showApproach ? m.approachW + 14 : 0)));
    let speedX = cx - symHalf - m.gap - m.speedW;
    let approachX = 0;

    if (input.showApproach) {
        approachX = speedX - m.approachW - 14;
        if (approachX < leftLimit) {
            approachX = leftLimit;
            speedX = approachX + m.approachW + 14;
            symHalf = solveSymHalf(speedX);
        }
    } else if (speedX < leftLimit) {
        speedX = leftLimit;
        symHalf = solveSymHalf(speedX);
    }

    const rightLimit = width - m.edge - m.altW;
    const altX = Math.max(
        speedX + m.speedW + 2 * m.gap,
        Math.min(rightLimit, cx + symHalf + m.gap)
    );

    const showCompass = !touchMode || height >= m.touchCompassMinHeight;
    const showRwr = !touchMode || height >= m.touchRwrMinHeight;

    // Centre the instruments in the band that is actually free: below the
    // objective strip (and the tape, when it is shown) and above the thumbs.
    const topBand = touchMode
        ? m.touchTopBand + (showCompass ? 44 : 0) + reserve.top
        : reserve.top;
    const instrumentCy = touchMode
        ? (topBand + (height - reserve.bottom)) / 2
        : cy - reserve.bottom / 2 + reserve.top / 2;

    return {
        cx,
        cy: instrumentCy,
        showChecklist,
        showApproach: input.showApproach,
        approachX,
        speedX,
        altX,
        symHalf,
        symScale: symHalf / m.symHalfMax,
        compactSystems,
        rwrSize,
        reserve,
        touchMode,
        showCompass,
        showRwr
    };
}

export type ArcadeBarSlotId =
    | 'WEAPON_0' | 'WEAPON_1' | 'WEAPON_2' | 'WEAPON_3'
    | 'COUNTERMEASURE' | 'ASSIST' | 'REWIND' | 'PADLOCK' | 'STATUS';

export interface ArcadeBarSlot {
    id: ArcadeBarSlotId;
    rect: Rect;
}

export interface ArcadeBarInput {
    width: number;
    height: number;
    /** 3 today, 4 once the HARM (or similar) lands. Clamped to [0, 4]. */
    weaponCount: number;
    showCountermeasure: boolean;
    showRewind: boolean;
    showPadlock: boolean;
    /**
     * `ctx.measureText(statusText).width` for the status telemetry text.
     * The status pill's width is derived from this, and the pill self-
     * suppresses (the STATUS slot is omitted) if it would run past the
     * right edge of the viewport - matching the old inline behaviour in
     * `HUD.ts`. Omit this when the caller has no canvas context (e.g. for
     * hit-testing, where the status pill has never been clickable) - the
     * STATUS slot is then always omitted.
     */
    statusTextWidth?: number;
}

const ARCADE_BAR_WEAPON_IDS: ArcadeBarSlotId[] = ['WEAPON_0', 'WEAPON_1', 'WEAPON_2', 'WEAPON_3'];

/**
 * Solves the geometry of the ARCADE HUD's bottom pill bar: weapon pills,
 * an optional countermeasure pill, then assist / rewind / padlock, then an
 * optional status telemetry pill. Both the drawing code (`HUD.ts`) and the
 * mouse hit-testing code (`PointerInteractivity.ts`) consume this so their
 * rectangles can never drift apart.
 */
export function solveArcadeBar(input: ArcadeBarInput): ArcadeBarSlot[] {
    const m = HUD_METRICS.arcadeBar;
    const width = Math.max(320, input.width);
    const height = Math.max(240, input.height);
    const barY = height - m.y;

    const slots: ArcadeBarSlot[] = [];
    let curX = m.startX;

    const weaponCount = Math.max(0, Math.min(ARCADE_BAR_WEAPON_IDS.length, Math.floor(input.weaponCount)));
    for (let i = 0; i < weaponCount; i++) {
        slots.push({ id: ARCADE_BAR_WEAPON_IDS[i], rect: { x: curX, y: barY, w: m.weaponW, h: m.pillH } });
        curX += m.weaponW + m.gap;
    }

    if (input.showCountermeasure) {
        slots.push({ id: 'COUNTERMEASURE', rect: { x: curX, y: barY, w: m.countermeasureW, h: m.pillH } });
        curX += m.countermeasureW + m.gap;
    }

    // The assist pill gets extra breathing room from the weapon/CM block.
    curX += m.preAssistGap - m.gap;
    slots.push({ id: 'ASSIST', rect: { x: curX, y: barY, w: m.assistW, h: m.pillH } });
    curX += m.assistW + m.gap;

    if (input.showRewind) {
        slots.push({ id: 'REWIND', rect: { x: curX, y: barY, w: m.rewindW, h: m.pillH } });
        curX += m.rewindW + m.gap;
    }

    if (input.showPadlock) {
        slots.push({ id: 'PADLOCK', rect: { x: curX, y: barY, w: m.padlockW, h: m.pillH } });
        curX += m.padlockW + m.gap;
    }

    // The status pill gets extra breathing room too, then self-suppresses
    // (is simply never pushed) if it would overflow the right edge.
    curX += m.preStatusGap - m.gap;
    if (input.statusTextWidth !== undefined) {
        const statusW = input.statusTextWidth + m.statusPadding;
        if (curX + statusW < width - m.edgeMargin) {
            slots.push({ id: 'STATUS', rect: { x: curX, y: barY, w: statusW, h: m.pillH } });
        }
    }

    return slots;
}
