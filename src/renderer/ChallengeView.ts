/**
 * CARRIER VECTOR: 1988 - "Anna challenges you" (v2.3.0)
 *
 * What a friend sees first when they open a shared link. It used to be the
 * full mission select - seven mission tabs, a daily banner, three
 * explanation cards and a dozen key hints - with the challenge as one small
 * yellow line under the title: a first-time visitor, very likely on a phone
 * and very likely not a gamer, had to find the point of the link themselves.
 *
 * Now the link's promise is the whole screen: who sent it, the score to
 * beat, one sentence on what the game is, and one big button. Everything
 * else is one tap away (SEE ALL MISSIONS) and never in the way.
 *
 * Layout is pure (`challengeWelcomeLayout`) and shared with the hit-test.
 */

import { challengerLabel } from '../core/Challenge';
import type { Challenge } from '../core/Challenge';
import { THEME, fitText, font, glow, halo, keycap, keycapWidth, noGlow, plate } from './Theme';
import type { Rect } from './Theme';

export interface ChallengeWelcomeLayout {
    panel: Rect;
    accept: Rect;
    missions: Rect;
    /** A short screen (landscape phone): no explanation line, smaller score. */
    compact: boolean;
    y: { kicker: number; title: number; label: number; score: number; detail: number; about: number; reassure: number };
}

export function challengeWelcomeLayout(w: number, h: number): ChallengeWelcomeLayout {
    const compact = h < 470;
    const width = Math.min(600, w - 24);
    const x = (w - width) / 2;
    const rows = compact
        ? { kicker: 22, title: 40, label: 22, score: 50, detail: 26, about: 0, button: 64, reassure: 24, missions: 44 }
        : { kicker: 26, title: 52, label: 26, score: 66, detail: 30, about: 54, button: 72, reassure: 30, missions: 48 };
    const total = Object.values(rows).reduce((a, b) => a + b, 0) + 24;
    let y = Math.max(8, (h - total) / 2) + 12;
    const at = (k: keyof typeof rows) => {
        const here = y;
        y += rows[k];
        return here;
    };
    const ys = {
        kicker: at('kicker'),
        title: at('title'),
        label: at('label'),
        score: at('score'),
        detail: at('detail'),
        about: at('about')
    };
    const buttonY = at('button');
    const reassure = at('reassure');
    const missionsY = at('missions');
    const bw = Math.min(360, width - 32);
    const mw = Math.min(240, width - 32);
    return {
        panel: { x, y: Math.max(4, ys.kicker - 14), w: width, h: missionsY + rows.missions - ys.kicker + 18 },
        accept: { x: (w - bw) / 2, y: buttonY + 6, w: bw, h: rows.button - 14 },
        missions: { x: (w - mw) / 2, y: missionsY + 4, w: mw, h: rows.missions - 10 },
        compact,
        y: { ...ys, reassure }
    };
}

export function challengeWelcomeHitTest(x: number, y: number, l: ChallengeWelcomeLayout): 'ACCEPT' | 'MISSIONS' | null {
    const inside = (r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inside(l.accept)) return 'ACCEPT';
    if (inside(l.missions)) return 'MISSIONS';
    return null;
}

export function drawChallengeWelcome(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    c: Challenge,
    touch: boolean,
    age: number
) {
    const l = challengeWelcomeLayout(w, h);
    const cx = w / 2;
    const inner = l.panel.w - 40;
    ctx.save();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(5,10,13,0.9)';
    ctx.fillRect(0, 0, w, h);
    plate(ctx, l.panel, { fill: 'rgba(9,19,25,0.94)', border: THEME.caution, radius: 10 });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(l.compact ? 13 : 15, 700);
    ctx.fillStyle = THEME.caution;
    ctx.fillText('INCOMING CHALLENGE', cx, l.y.kicker + 16);

    ctx.font = font(l.compact ? 26 : 34, 700);
    ctx.fillStyle = THEME.ink;
    glow(ctx, THEME.phosphor, 12);
    ctx.fillText(fitText(ctx, `${challengerLabel(c)} CHALLENGES YOU`, inner), cx, l.y.title + (l.compact ? 30 : 38));
    noGlow(ctx);

    ctx.font = font(l.compact ? 12 : 14, 600);
    ctx.fillStyle = THEME.muted;
    ctx.fillText('SCORE TO BEAT', cx, l.y.label + 17);
    ctx.font = font(l.compact ? 38 : 50, 700);
    ctx.fillStyle = THEME.caution;
    glow(ctx, THEME.caution, 14);
    ctx.fillText(`${c.score.toLocaleString('en-US')} PTS`, cx, l.y.score + (l.compact ? 40 : 52));
    noGlow(ctx);

    ctx.font = font(l.compact ? 13 : 15, 600);
    ctx.fillStyle = THEME.ink;
    const detail = `${c.waves} WAVE${c.waves === 1 ? '' : 'S'} HELD${c.easy ? ' · FLOWN ON EASY' : ''} · SAME PLANES, SAME WAVES`;
    ctx.fillText(fitText(ctx, detail, inner), cx, l.y.detail + 18);

    if (!l.compact) {
        ctx.font = font(14);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(fitText(ctx, 'Shoot down the bombers before they reach your carrier.', inner), cx, l.y.about + 20);
        ctx.fillText(fitText(ctx, 'A retro jet game - a run takes a few minutes.', inner), cx, l.y.about + 40);
    }

    // The one thing to do.
    plate(ctx, l.accept, { fill: 'rgba(87,227,155,0.16)', border: THEME.phosphor, radius: 8 });
    const pulse = 0.5 + 0.5 * Math.sin(age * 4);
    halo(ctx, l.accept, THEME.phosphor, 8 + 8 * pulse, 8);
    ctx.textBaseline = 'middle';
    const label = 'ACCEPT CHALLENGE';
    ctx.font = font(l.compact ? 18 : 21, 700);
    const labelW = ctx.measureText(label).width;
    if (touch) {
        ctx.fillStyle = THEME.ink;
        ctx.fillText(fitText(ctx, label, l.accept.w - 24), cx, l.accept.y + l.accept.h / 2 + 1);
    } else {
        ctx.textAlign = 'left';
        const capW = keycapWidth(ctx, 'ENTER', 13);
        const startX = cx - (capW + 12 + labelW) / 2;
        keycap(ctx, startX, l.accept.y + l.accept.h / 2, 'ENTER', { size: 13 });
        ctx.font = font(l.compact ? 18 : 21, 700);
        ctx.fillStyle = THEME.ink;
        ctx.fillText(label, startX + capW + 12, l.accept.y + l.accept.h / 2 + 1);
        ctx.textAlign = 'center';
    }
    ctx.textBaseline = 'alphabetic';

    ctx.font = font(l.compact ? 12 : 13);
    ctx.fillStyle = THEME.muted;
    ctx.fillText(fitText(ctx, 'Free · no sign-up · EASY mode can fly the plane for you', inner), cx, l.y.reassure + 16);

    plate(ctx, l.missions, { fill: 'rgba(9,19,25,0.85)', border: THEME.edgeSoft, radius: 6 });
    ctx.textBaseline = 'middle';
    ctx.font = font(13, 700);
    ctx.fillStyle = THEME.muted;
    if (touch) {
        ctx.fillText('SEE ALL MISSIONS', cx, l.missions.y + l.missions.h / 2 + 1);
    } else {
        ctx.textAlign = 'left';
        const capW = keycapWidth(ctx, 'ESC', 11);
        const text = 'SEE ALL MISSIONS';
        const tw = ctx.measureText(text).width;
        const sx = cx - (capW + 10 + tw) / 2;
        keycap(ctx, sx, l.missions.y + l.missions.h / 2, 'ESC', { size: 11 });
        ctx.font = font(13, 700);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(text, sx + capW + 10, l.missions.y + l.missions.h / 2 + 1);
    }
    ctx.restore();
}
