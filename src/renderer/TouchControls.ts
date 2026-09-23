/**
 * CARRIER VECTOR: 1988 - Thumb Control Chrome
 *
 * Drawing for the layout `TouchLayout.ts` solves. Deliberately quiet: the
 * controls are drawn as outlines at low opacity and brighten under a thumb,
 * because on a 390 px-tall screen the instruments and the world are already
 * competing for every pixel and a set of solid buttons would win that
 * competition at the game's expense.
 *
 * Everything reads from the same theme tokens as the rest of the cockpit, so
 * a control cannot end up a colour that means something else. Cyan is the
 * player's own agency, which is exactly what a control is.
 */

import { THEME, font, glow, noGlow, plate, roundRect } from './Theme';
import type { TouchLayout } from './TouchLayout';
import type { TouchDemand } from '../core/TouchInput';

export interface TouchChromeContext {
    demand: TouchDemand;
    /** Currently armed weapon, to light the right pill. */
    selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' | 'HARM';
    /** Rounds / missiles / bombs / HARMs remaining, drawn on the pills. */
    ammo: [number, number, number, number];
    /** Chaff cartridges left, drawn on the chaff button. */
    chaff: number;
    /** A missile is in the air at you - light the chaff button. */
    missileInbound: boolean;
    /** Present throttle 0..1.5, for the track's fill. */
    throttle: number;
    /** Whether anything is designated, to light the target button. */
    hasDesignation: boolean;
    /** Highlight the fire control while a shot is actually available. */
    fireArmed: boolean;
    /** Whether the recovery assist is engaged, to light its button. */
    recoveryOn: boolean;
}

const IDLE_ALPHA = 0.38;
const ACTIVE_ALPHA = 0.95;

function ring(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string,
    active: boolean,
    label?: string,
    labelSize = 11
) {
    ctx.save();
    noGlow(ctx);
    ctx.globalAlpha = active ? ACTIVE_ALPHA : IDLE_ALPHA;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(95,216,255,0.22)' : 'rgba(9,19,25,0.55)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 2.6 : 1.8;
    if (active) glow(ctx, color, 10);
    ctx.stroke();
    noGlow(ctx);

    if (label) {
        ctx.font = font(labelSize, 700);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy + 0.5);
    }
    ctx.restore();
}

/** The flight controls: stick, throttle, weapons, target, fire. */
export function drawTouchControls(
    ctx: CanvasRenderingContext2D,
    layout: TouchLayout,
    context: TouchChromeContext
) {
    const { demand } = context;

    // --- Throttle track, filled to the current setting ---
    ctx.save();
    noGlow(ctx);
    ctx.globalAlpha = demand.throttle !== null ? ACTIVE_ALPHA : IDLE_ALPHA;
    const t = layout.throttle;
    roundRect(ctx, t.x, t.y, t.w, t.h, t.w / 2);
    ctx.fillStyle = 'rgba(9,19,25,0.55)';
    ctx.fill();
    ctx.strokeStyle = THEME.key;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const fill = Math.min(1, Math.max(0, context.throttle / 1.5));
    const fillH = t.h * fill;
    if (fillH > 2) {
        roundRect(ctx, t.x + 3, t.y + t.h - fillH + 1, t.w - 6, Math.max(2, fillH - 2), (t.w - 6) / 2);
        // Amber past military power: the afterburner is a fuel decision, and
        // the track is the only place a touch player sees it.
        ctx.fillStyle = context.throttle > 1.0 ? THEME.caution : THEME.phosphor;
        ctx.fill();
    }
    ctx.font = font(9, 700);
    ctx.fillStyle = THEME.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('THR', t.x + t.w / 2, t.y - 6);
    ctx.restore();

    // --- Stick: a resting ring, or the live one under the thumb ---
    const origin = demand.stickOrigin ?? { x: layout.stick.cx, y: layout.stick.cy };
    const held = demand.stickOrigin !== null;
    ctx.save();
    noGlow(ctx);
    ctx.globalAlpha = held ? 0.5 : IDLE_ALPHA * 0.8;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, layout.stick.r, 0, Math.PI * 2);
    ctx.strokeStyle = THEME.key;
    ctx.setLineDash(held ? [] : [5, 5]);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (held && demand.stickPosition) {
        const dx = demand.stickPosition.x - origin.x;
        const dy = demand.stickPosition.y - origin.y;
        const len = Math.hypot(dx, dy) || 1;
        const clamped = Math.min(layout.stick.r, len);
        ring(
            ctx,
            origin.x + (dx / len) * clamped,
            origin.y + (dy / len) * clamped,
            layout.stick.r * 0.42,
            THEME.key,
            true
        );
    } else {
        ring(ctx, origin.x, origin.y, layout.stick.r * 0.42, THEME.key, false);
    }

    // --- Weapon pills ---
    const ids: ('GUN' | 'AIM9' | 'BOMB' | 'HARM')[] = ['GUN', 'AIM9', 'BOMB', 'HARM'];
    const names = ['GUN', 'AIM9', 'MK82', 'HARM'];
    layout.weapons.forEach((r, i) => {
        const selected = context.selectedWeapon === ids[i];
        const empty = context.ammo[i] <= 0;
        const color = empty ? THEME.muted : selected ? THEME.caution : THEME.key;

        ctx.save();
        noGlow(ctx);
        ctx.globalAlpha = selected ? ACTIVE_ALPHA : IDLE_ALPHA;
        plate(ctx, r, {
            fill: selected ? 'rgba(255,201,77,0.16)' : 'rgba(9,19,25,0.55)',
            border: color,
            radius: 5
        });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(11, 700);
        ctx.fillStyle = color;
        ctx.fillText(names[i], r.x + r.w / 2, r.y + r.h / 2 - 5);
        ctx.font = font(9, 600);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(`${context.ammo[i]}`, r.x + r.w / 2, r.y + r.h / 2 + 8);
        ctx.restore();
    });

    // --- Target and fire ---
    ring(ctx, layout.target.cx, layout.target.cy, layout.target.r,
        context.hasDesignation ? THEME.caution : THEME.key, context.hasDesignation, 'TGT', 10);

    ring(ctx, layout.fire.cx, layout.fire.cy, layout.fire.r,
        context.fireArmed ? THEME.alert : THEME.key, demand.firing, 'FIRE', 12);

    // Chaff: amber and lit the moment a missile is in the air at you, which
    // is the only moment it is the right button to press.
    const chaffColor = context.chaff <= 0 ? THEME.muted : context.missileInbound ? THEME.caution : THEME.key;
    ring(ctx, layout.chaff.cx, layout.chaff.cy, layout.chaff.r,
        chaffColor, context.missileInbound && context.chaff > 0, `CHF ${context.chaff}`, 9);

    // --- Recovery assist ---
    // Lit when engaged, because "am I being flown home or not" is the whole
    // question this button answers.
    const rec = layout.recover;
    const recColor = context.recoveryOn ? THEME.caution : THEME.key;
    ctx.save();
    noGlow(ctx);
    ctx.globalAlpha = context.recoveryOn ? ACTIVE_ALPHA : IDLE_ALPHA;
    plate(ctx, rec, {
        fill: context.recoveryOn ? 'rgba(255,201,77,0.16)' : 'rgba(9,19,25,0.55)',
        border: recColor,
        radius: 5
    });
    ctx.fillStyle = recColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(10, 700);
    ctx.fillText('RCVY', rec.x + rec.w / 2, rec.y + rec.h / 2);
    ctx.restore();

    // --- Menu ---
    ctx.save();
    noGlow(ctx);
    ctx.globalAlpha = IDLE_ALPHA;
    plate(ctx, layout.menu, { fill: 'rgba(9,19,25,0.55)', border: THEME.key, radius: 5 });
    ctx.strokeStyle = THEME.key;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const y = layout.menu.y + layout.menu.h / 2 - 7 + i * 7;
        ctx.moveTo(layout.menu.x + 12, y);
        ctx.lineTo(layout.menu.x + layout.menu.w - 12, y);
    }
    ctx.stroke();
    ctx.restore();
}

/** The deck screen's single button. */
export function drawLaunchButton(
    ctx: CanvasRenderingContext2D,
    layout: TouchLayout,
    enabled: boolean,
    label: string,
    pulse: number
) {
    const r = layout.launch;
    const color = enabled ? THEME.key : THEME.muted;

    ctx.save();
    noGlow(ctx);
    ctx.globalAlpha = enabled ? 0.75 + 0.25 * pulse : 0.45;
    plate(ctx, r, {
        fill: enabled ? 'rgba(95,216,255,0.16)' : 'rgba(9,19,25,0.6)',
        border: color,
        radius: 8
    });
    ctx.font = font(16, 700);
    ctx.fillStyle = enabled ? THEME.ink : THEME.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();

    // The menu button is reachable from the deck too.
    ctx.save();
    noGlow(ctx);
    ctx.globalAlpha = IDLE_ALPHA;
    plate(ctx, layout.menu, { fill: 'rgba(9,19,25,0.55)', border: THEME.key, radius: 5 });
    ctx.strokeStyle = THEME.key;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const y = layout.menu.y + layout.menu.h / 2 - 7 + i * 7;
        ctx.moveTo(layout.menu.x + 12, y);
        ctx.lineTo(layout.menu.x + layout.menu.w - 12, y);
    }
    ctx.stroke();
    ctx.restore();
}

/**
 * Portrait prompt. The cockpit cannot hold its instruments at phone-portrait
 * width, so rather than ship something unreadable the game asks for the
 * device to be turned.
 */
export function drawRotatePrompt(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number) {
    ctx.save();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(7,13,17,0.96)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const tilt = Math.sin(timeSec * 1.8) * 0.28;

    ctx.save();
    ctx.translate(cx, cy - 30);
    ctx.rotate(tilt);
    ctx.strokeStyle = THEME.key;
    ctx.lineWidth = 2.4;
    roundRect(ctx, -34, -56, 68, 112, 9);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(18, 700);
    ctx.fillStyle = THEME.ink;
    ctx.fillText('TURN YOUR DEVICE', cx, cy + 70);
    ctx.font = font(12);
    ctx.fillStyle = THEME.muted;
    ctx.fillText('The cockpit needs a landscape screen.', cx, cy + 94);
    ctx.restore();
}
