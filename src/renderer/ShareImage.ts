/**
 * CARRIER VECTOR: 1988 - The picture a pilot shares (v2.3.0)
 *
 * A square card, because a square shows large in every chat and feed: the
 * run's best moment (a frame the game kept at the best kill), the score, the
 * stars, who flew it, and one question at the bottom. Drawn in the game's own
 * look - and in the pilot's unlocked palette, so a card is a little theirs.
 *
 * Pure drawing onto any 2D context, so the layout is testable headless; the
 * caller turns the canvas into a PNG (core/Share.ts).
 */

import type { SharePicture } from '../core/ShareCard';
import { starPath } from './DebriefView';
import { THEME, fitText, font, glow, noGlow, roundRect } from './Theme';
import type { Rect } from './Theme';

export const SHARE_IMAGE_SIZE = 1080;

/** A kept frame and its size in pixels. */
export interface Moment {
    image: CanvasImageSource;
    width: number;
    height: number;
}

/** Where everything goes on the 1080 square. Exported for the layout test. */
export const SHARE_IMAGE_LAYOUT = {
    title: 70,
    subtitle: 118,
    moment: { x: 60, y: 150, w: 960, h: 520 } as Rect,
    stars: 726,
    score: 860,
    stats: 918,
    line: 966,
    headline: 1030,
    host: 1066
} as const;

export function drawShareImage(ctx: CanvasRenderingContext2D, data: SharePicture, moment: Moment | null) {
    const S = SHARE_IMAGE_SIZE;
    const L = SHARE_IMAGE_LAYOUT;
    const cx = S / 2;
    ctx.save();
    noGlow(ctx);
    ctx.fillStyle = THEME.ground;
    ctx.fillRect(0, 0, S, S);
    drawGrid(ctx, S);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Title, and what was flown.
    ctx.font = font(60, 700);
    ctx.fillStyle = THEME.ink;
    glow(ctx, THEME.phosphor, 16);
    ctx.fillText('CARRIER VECTOR: 1988', cx, L.title);
    noGlow(ctx);
    const sub = [data.title, ...data.tags].join('  ·  ');
    ctx.font = font(30, 700);
    ctx.fillStyle = data.tags.length > 0 ? THEME.caution : THEME.phosphor;
    ctx.fillText(fitText(ctx, sub, S - 80), cx, L.subtitle);

    // The moment.
    const m = L.moment;
    ctx.save();
    roundRect(ctx, m.x, m.y, m.w, m.h, 14);
    ctx.clip();
    if (moment && moment.width > 0 && moment.height > 0) {
        // A little closer than the whole screen: the kill happens round the
        // gunsight, and the edges are instruments.
        const crop = coverCrop(moment.width, moment.height, m.w, m.h, MOMENT_ZOOM);
        ctx.drawImage(moment.image, crop.x, crop.y, crop.w, crop.h, m.x, m.y, m.w, m.h);
    } else {
        drawScope(ctx, m);
    }
    ctx.restore();
    roundRect(ctx, m.x, m.y, m.w, m.h, 14);
    ctx.strokeStyle = THEME.phosphor;
    ctx.lineWidth = 4;
    glow(ctx, THEME.phosphor, 18);
    ctx.stroke();
    noGlow(ctx);

    // Stars.
    for (let i = 0; i < 3; i++) {
        const sx = cx + (i - 1) * 92;
        starPath(ctx, sx, L.stars, 34);
        if (i < data.stars) {
            ctx.fillStyle = THEME.caution;
            glow(ctx, THEME.caution, 16);
            ctx.fill();
            noGlow(ctx);
        } else {
            ctx.strokeStyle = THEME.muted;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    // The score.
    ctx.font = font(112, 700);
    ctx.fillStyle = THEME.caution;
    glow(ctx, THEME.caution, 22);
    ctx.fillText(fitText(ctx, `${Math.round(data.score).toLocaleString('en-US')} PTS`, S - 80), cx, L.score);
    noGlow(ctx);

    ctx.font = font(38, 700);
    ctx.fillStyle = THEME.ink;
    ctx.fillText(fitText(ctx, data.stats, S - 80), cx, L.stats);

    // Who flew it - or, after a challenge, both names and both scores.
    const line = data.versus ?? (data.pilot ? `PILOT: ${data.pilot}` : null);
    if (line) {
        ctx.font = font(34, 700);
        ctx.fillStyle = THEME.phosphor;
        ctx.fillText(fitText(ctx, line, S - 80), cx, L.line);
    }

    // The question - the reason the picture exists.
    ctx.font = font(56, 700);
    ctx.fillStyle = THEME.ink;
    glow(ctx, THEME.phosphor, 14);
    ctx.fillText(fitText(ctx, data.headline, S - 60), cx, L.headline);
    noGlow(ctx);
    ctx.font = font(26, 600);
    ctx.fillStyle = THEME.muted;
    ctx.fillText(fitText(ctx, `FREE IN YOUR BROWSER · ${data.host}`, S - 60), cx, L.host);
    ctx.restore();
}

/** How much closer than the whole screen the moment is framed. */
export const MOMENT_ZOOM = 1.3;

/**
 * The source rectangle that fills (w, h) from an image, cropped centrally;
 * `zoom` > 1 crops closer still.
 */
export function coverCrop(srcW: number, srcH: number, w: number, h: number, zoom = 1): Rect {
    const scale = Math.max(w / srcW, h / srcH) * Math.max(1, zoom);
    const cw = w / scale;
    const ch = h / scale;
    return { x: (srcW - cw) / 2, y: (srcH - ch) / 2, w: cw, h: ch };
}

/** A faint ground grid, receding: the vector-display backdrop. */
function drawGrid(ctx: CanvasRenderingContext2D, S: number) {
    ctx.save();
    ctx.strokeStyle = THEME.edgeSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= S; x += 60) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, S);
    }
    for (let y = 0; y <= S; y += 60) {
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
    }
    ctx.stroke();
    ctx.restore();
}

/** No kill to show: a radar scope with the contacts still on it. */
function drawScope(ctx: CanvasRenderingContext2D, r: Rect) {
    ctx.fillStyle = 'rgba(9,19,25,0.95)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.strokeStyle = THEME.edge;
    ctx.lineWidth = 2;
    for (const k of [0.3, 0.6, 0.9]) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r.h / 2) * k, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (r.h / 2) * 0.9 * Math.cos(-0.6), cy + (r.h / 2) * 0.9 * Math.sin(-0.6));
    ctx.strokeStyle = THEME.phosphor;
    ctx.stroke();
    ctx.fillStyle = THEME.alert;
    for (const [dx, dy] of [[0.35, -0.2], [-0.25, 0.3], [0.1, 0.55]]) {
        ctx.beginPath();
        ctx.arc(cx + dx * r.h * 0.5, cy + dy * r.h * 0.5, 7, 0, Math.PI * 2);
        ctx.fill();
    }
}
