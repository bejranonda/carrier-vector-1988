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
    rwrMax: 132,
    rwrMin: 92
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
}

export interface HudLayoutInput {
    width: number;
    height: number;
    showApproach: boolean;
    hasChecklist: boolean;
}

export function solveHudLayout(input: HudLayoutInput): HudLayout {
    const m = HUD_METRICS;
    const width = Math.max(320, input.width);
    const height = Math.max(240, input.height);
    const cx = width / 2;
    const cy = height / 2;

    const showChecklist = input.hasChecklist && width >= m.checklistMinWidth;
    // A short window gets a one-line systems strip instead of the tall panel,
    // which keeps the bottom-left corner out of the centre instrument band.
    const compactSystems = height < m.compactSystemsHeight;
    const rwrSize = Math.max(m.rwrMin, Math.min(m.rwrMax, Math.floor(height * 0.22)));

    // The left rail is shared by the checklist (top) and the systems panel
    // (bottom); when the systems readout is compact only the checklist claims it.
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

    return {
        cx,
        cy,
        showChecklist,
        showApproach: input.showApproach,
        approachX,
        speedX,
        altX,
        symHalf,
        symScale: symHalf / m.symHalfMax,
        compactSystems,
        rwrSize
    };
}
