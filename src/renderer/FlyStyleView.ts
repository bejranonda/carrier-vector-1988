/**
 * CARRIER VECTOR: 1988 - "How would you like to fly?" (v2.1.0)
 *
 * Shown once, to a pilot who has never flown, the first time they press FLY.
 * Two big plain-language choices - EASY (the plane flies itself, you fire)
 * and STANDARD (you steer) - plus the text size, because the player who
 * needs EASY is often the player who needs bigger text, and the very first
 * screen is the only place guaranteed to be seen.
 *
 * Big type, big targets, every option reachable by key, mouse or finger.
 * Layout is pure (`flyStyleLayout`) and shared with the click hit-test.
 */

import type { FlyStyle } from '../core/EasyMode';
import { THEME, fitText, font, halo, keycap, noGlow, plate } from './Theme';
import type { Rect } from './Theme';

export interface FlyStyleLayout {
    easy: Rect;
    standard: Rect;
    textSize: Rect;
    stacked: boolean;
    /** A short screen (landscape phone): tighter type inside the cards. */
    tight: boolean;
    titleY: number;
}

export function flyStyleLayout(w: number, h: number): FlyStyleLayout {
    const stacked = w < 760;
    const tight = stacked || h < 520;
    const gap = 20;
    const cardW = stacked ? Math.min(520, w - 40) : Math.min(460, (w - 60 - gap) / 2);
    const cardH = stacked ? Math.min(118, (h - 210) / 2) : Math.min(230, h - 260);
    const blockH = stacked ? cardH * 2 + gap : cardH;
    const titleY = Math.max(36, (h - blockH - 150) / 2 + 20);
    const top = titleY + 64;
    const easy: Rect = stacked
        ? { x: (w - cardW) / 2, y: top, w: cardW, h: cardH }
        : { x: w / 2 - gap / 2 - cardW, y: top, w: cardW, h: cardH };
    const standard: Rect = stacked
        ? { x: (w - cardW) / 2, y: top + cardH + gap, w: cardW, h: cardH }
        : { x: w / 2 + gap / 2, y: top, w: cardW, h: cardH };
    const below = (stacked ? standard.y + standard.h : top + cardH) + 18;
    const textSize: Rect = { x: w / 2 - 150, y: below, w: 300, h: 40 };
    return { easy, standard, textSize, stacked, tight, titleY };
}

export function flyStyleHitTest(x: number, y: number, l: FlyStyleLayout): FlyStyle | 'TEXT_SIZE' | null {
    const inside = (r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inside(l.easy)) return 'EASY';
    if (inside(l.standard)) return 'STANDARD';
    if (inside(l.textSize)) return 'TEXT_SIZE';
    return null;
}

export function drawFlyStyleChooser(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    selected: FlyStyle,
    textSizeLabel: string,
    touch: boolean
) {
    const l = flyStyleLayout(w, h);
    ctx.save();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(5,10,13,0.94)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(30, 700);
    ctx.fillStyle = THEME.ink;
    ctx.fillText('WELCOME, PILOT', w / 2, l.titleY);
    ctx.font = font(17, 600);
    ctx.fillStyle = THEME.muted;
    ctx.fillText('How would you like to fly?', w / 2, l.titleY + 32);

    const fire = touch ? 'You tap FIRE to shoot.' : 'You press SPACE or click to fire.';
    const card = (r: Rect, style: FlyStyle, key: string, title: string, lines: string[], tag?: string) => {
        const on = selected === style;
        plate(ctx, r, {
            fill: on ? 'rgba(87,227,155,0.12)' : 'rgba(9,19,25,0.9)',
            border: on ? THEME.phosphor : THEME.edgeSoft,
            radius: 8
        });
        if (on) halo(ctx, r, THEME.phosphor, 10, 8);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const pad = 20;
        const capW = touch ? 0 : keycap(ctx, r.x + pad, r.y + 30, key, { size: 15 });
        ctx.font = font(24, 700);
        ctx.fillStyle = on ? THEME.phosphor : THEME.ink;
        ctx.fillText(title, r.x + pad + (capW ? capW + 14 : 0), r.y + 31);
        const lineH = l.tight ? 20 : 26;
        const firstY = r.y + (l.tight ? 58 : 64);
        ctx.font = font(l.tight ? 14 : 16);
        ctx.fillStyle = THEME.ink;
        lines.forEach((line, i) => {
            const y = firstY + i * lineH;
            if (y < r.y + r.h - 10) ctx.fillText(fitText(ctx, line, r.w - pad * 2), r.x + pad, y);
        });
        // The tag only where there is a clear line for it under the copy.
        const tagY = r.y + r.h - 18;
        if (tag && tagY > firstY + (lines.length - 1) * lineH + 20) {
            ctx.font = font(12, 700);
            ctx.fillStyle = THEME.caution;
            ctx.fillText(fitText(ctx, tag, r.w - pad * 2), r.x + pad, tagY);
        }
        ctx.textBaseline = 'alphabetic';
    };

    card(l.easy, 'EASY', '1', 'EASY', [
        'The plane flies and aims itself.',
        fire,
        'Slower and more forgiving.'
    ], 'RECOMMENDED IF YOU ARE NEW TO GAMES');
    card(l.standard, 'STANDARD', '2', 'STANDARD', [
        touch ? 'You steer with your left thumb.' : 'You steer with the arrow keys.',
        'More control, more challenge.',
        'For players who know flying games.'
    ]);

    // Text size - the setting most likely to decide whether this is playable.
    plate(ctx, l.textSize, { fill: 'rgba(9,19,25,0.9)', border: THEME.key, radius: 6 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const capW = touch ? 0 : keycap(ctx, l.textSize.x + 14, l.textSize.y + 20, 'T', { size: 13 });
    ctx.font = font(15, 700);
    ctx.fillStyle = THEME.ink;
    ctx.fillText(fitText(ctx, `TEXT SIZE: ${textSizeLabel}`, l.textSize.w - 40), l.textSize.x + 14 + (capW ? capW + 12 : 0), l.textSize.y + 21);

    ctx.textAlign = 'center';
    ctx.font = font(13);
    ctx.fillStyle = THEME.muted;
    const hint = touch
        ? 'Tap a choice to fly. You can change both any time from the menu.'
        : 'ENTER flies the highlighted choice. You can change both any time - press ESC in flight.';
    ctx.fillText(fitText(ctx, hint, w - 40), w / 2, Math.min(h - 16, l.textSize.y + l.textSize.h + 26));
    ctx.restore();
}
