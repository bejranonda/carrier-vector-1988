/**
 * CARRIER VECTOR: 1988 - Pilot Menu rendering and hit-testing
 *
 * The layout is one pure solver (`pilotMenuLayout`) so the mouse can never
 * click 10px away from what the eye sees drawn - the same discipline as
 * `HudLayout` and `DeckLayout`. `PilotMenu.ts` decides WHAT the menu offers;
 * this decides WHERE it is and HOW it looks.
 */

import type { Rect } from './DeckLayout';
import type { PilotMenuItem } from '../core/PilotMenu';
import { THEME, fitText, font, keycap, noGlow, plate, roundRect } from './Theme';

export const PILOT_MENU_METRICS = {
    panelMaxW: 560,
    sideMargin: 40,
    titleH: 46,
    objectiveH: 56,
    itemH: 40,
    itemGap: 4,
    footerH: 34,
    pad: 16
} as const;

export interface PilotMenuLayout {
    panel: Rect;
    objective: Rect;
    items: Rect[];
}

/** The one layout both the renderer and the click handler read. */
export function pilotMenuLayout(width: number, height: number, itemCount: number): PilotMenuLayout {
    const m = PILOT_MENU_METRICS;
    const panelW = Math.min(m.panelMaxW, width - m.sideMargin * 2);
    const itemsH = itemCount * m.itemH + Math.max(0, itemCount - 1) * m.itemGap;
    const panelH = Math.min(
        height - 40,
        m.titleH + m.objectiveH + itemsH + m.footerH + m.pad * 2
    );
    const panel: Rect = {
        x: (width - panelW) / 2,
        y: Math.max(20, (height - panelH) / 2),
        w: panelW,
        h: panelH
    };

    const objective: Rect = {
        x: panel.x + m.pad,
        y: panel.y + m.titleH,
        w: panel.w - m.pad * 2,
        h: m.objectiveH
    };

    const items: Rect[] = [];
    let y = objective.y + objective.h + 6;
    for (let i = 0; i < itemCount; i++) {
        items.push({ x: panel.x + m.pad, y, w: panel.w - m.pad * 2, h: m.itemH });
        y += m.itemH + m.itemGap;
    }

    return { panel, objective, items };
}

/** Which item, if any, a point in CSS pixels lands on. */
export function pilotMenuHitTest(x: number, y: number, layout: PilotMenuLayout): number | null {
    for (let i = 0; i < layout.items.length; i++) {
        const r = layout.items[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return null;
}

export interface PilotMenuObjective {
    title: string;
    plain: string;
}

export function drawPilotMenu(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    items: readonly PilotMenuItem[],
    selected: number,
    objective: PilotMenuObjective
) {
    const layout = pilotMenuLayout(width, height, items.length);

    ctx.save();
    noGlow(ctx);

    // Dim the world so the panel is unmistakably a pause, not another HUD box.
    ctx.fillStyle = 'rgba(4,8,10,0.72)';
    ctx.fillRect(0, 0, width, height);

    plate(ctx, layout.panel, { fill: 'rgba(8,15,19,0.96)', border: THEME.edgeSoft, radius: 8 });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(20, 700);
    ctx.fillStyle = THEME.ink;
    ctx.fillText('PAUSED', layout.panel.x + layout.panel.w / 2, layout.panel.y + 30);

    // "Your job now" - restates the objective in the player's own words,
    // because a menu opened out of confusion should answer the confusion
    // before it offers anything else.
    plate(ctx, layout.objective, { fill: 'rgba(95,216,255,0.08)', border: THEME.phosphor, radius: 4 });
    ctx.textAlign = 'left';
    ctx.font = font(10, 700);
    ctx.fillStyle = THEME.muted;
    ctx.fillText('YOUR JOB NOW', layout.objective.x + 12, layout.objective.y + 16);
    ctx.font = font(14, 700);
    ctx.fillStyle = THEME.caution;
    ctx.fillText(fitText(ctx, objective.title, layout.objective.w - 24), layout.objective.x + 12, layout.objective.y + 33);
    ctx.font = font(11);
    ctx.fillStyle = THEME.ink;
    ctx.fillText(fitText(ctx, objective.plain, layout.objective.w - 24), layout.objective.x + 12, layout.objective.y + 48);

    ctx.textBaseline = 'middle';
    items.forEach((item, i) => {
        const r = layout.items[i];
        const isSelected = i === selected;
        if (isSelected) {
            roundRect(ctx, r.x, r.y, r.w, r.h, 4);
            ctx.fillStyle = 'rgba(95,216,255,0.10)';
            ctx.fill();
            ctx.strokeStyle = THEME.phosphor;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        // The label column starts far enough right to clear the widest
        // keycap this list ever draws ("ESC", on RESUME) - a fixed 48px
        // cleared only the single-digit ones and let ESC's wider box print
        // through the first two letters of the label beside it.
        keycap(ctx, r.x + 18, r.y + r.h / 2, item.key, { size: 11 });
        const textX = r.x + 68;
        ctx.textAlign = 'left';
        ctx.font = font(13, 600);
        ctx.fillStyle = isSelected ? THEME.phosphor : THEME.ink;
        ctx.fillText(fitText(ctx, item.label, r.w - textX + r.x - 20), textX, r.y + r.h / 2 - 6);
        ctx.font = font(10);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(fitText(ctx, item.detail, r.w - textX + r.x - 20), textX, r.y + r.h / 2 + 10);
    });

    const footerY = layout.panel.y + layout.panel.h - PILOT_MENU_METRICS.footerH / 2;
    ctx.textAlign = 'center';
    ctx.font = font(10);
    ctx.fillStyle = THEME.muted;
    ctx.fillText('↑↓ or W/S select   ·   ENTER/SPACE choose   ·   ESC resume', layout.panel.x + layout.panel.w / 2, footerY);

    ctx.restore();
}
