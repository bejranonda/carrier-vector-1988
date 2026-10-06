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

/**
 * Where everything goes on the 1080 square. Exported for the layout test.
 *
 * Laid out for a chat thumbnail (250-300 px wide), where the first review
 * found the moment frame an almost black box and only the score readable:
 * the headline with names goes to the top, the scores are the biggest thing,
 * the moment is smaller and brightened, and the footer says what the game is.
 */
export const SHARE_IMAGE_LAYOUT = {
    game: 62,
    headline: 152,
    moment: { x: 90, y: 192, w: 900, h: 380 } as Rect,
    stars: 632,
    score: 770,
    board: [692, 790],
    stats: 856,
    tags: 904,
    footerTop: 940,
    footer: 996,
    host: 1048
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

    // What it is, then what happened - with names, because a picture gets
    // forwarded to people who do not know who "I" is.
    ctx.font = font(44, 700);
    ctx.fillStyle = THEME.phosphor;
    ctx.fillText('CARRIER VECTOR: 1988', cx, L.game);
    shrinkToFit(ctx, data.headline, S - 80, 76, 44);
    ctx.fillStyle = THEME.ink;
    glow(ctx, THEME.phosphor, 18);
    ctx.fillText(fitText(ctx, data.headline, S - 80), cx, L.headline);
    noGlow(ctx);

    // The moment, smaller and brighter: thin green lines on black vanish in
    // a thumbnail, so the frame is drawn twice, the second time added.
    const m = L.moment;
    ctx.save();
    roundRect(ctx, m.x, m.y, m.w, m.h, 14);
    ctx.clip();
    if (moment && moment.width > 0 && moment.height > 0) {
        const crop = coverCrop(moment.width, moment.height, m.w, m.h, MOMENT_ZOOM);
        ctx.drawImage(moment.image, crop.x, crop.y, crop.w, crop.h, m.x, m.y, m.w, m.h);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(moment.image, crop.x, crop.y, crop.w, crop.h, m.x, m.y, m.w, m.h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
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

    if (data.board && data.board.length > 0) {
        // After a challenge: a scoreboard, the higher score on top.
        data.board.slice(0, 2).forEach((row, i) => {
            const y = L.board[i];
            ctx.font = font(64, 700);
            ctx.fillStyle = i === 0 ? THEME.caution : THEME.ink;
            if (i === 0) glow(ctx, THEME.caution, 16);
            ctx.textAlign = 'right';
            const score = Math.round(row.score).toLocaleString('en-US');
            ctx.fillText(score, m.x + m.w, y);
            const scoreW = ctx.measureText(score).width;
            ctx.textAlign = 'left';
            ctx.fillText(fitText(ctx, row.name, m.w - scoreW - 40), m.x, y);
            noGlow(ctx);
        });
        ctx.textAlign = 'center';
    } else {
        for (let i = 0; i < 3; i++) {
            const sx = cx + (i - 1) * 92;
            starPath(ctx, sx, L.stars, 32);
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
        ctx.font = font(120, 700);
        ctx.fillStyle = THEME.caution;
        glow(ctx, THEME.caution, 22);
        ctx.fillText(fitText(ctx, `${Math.round(data.score).toLocaleString('en-US')} PTS`, S - 80), cx, L.score);
        noGlow(ctx);
    }

    if (data.stats) {
        ctx.font = font(36, 700);
        ctx.fillStyle = THEME.ink;
        ctx.fillText(fitText(ctx, data.stats, S - 80), cx, L.stats);
    }
    const tags = [data.title, ...data.tags].join('  ·  ');
    ctx.font = font(30, 700);
    ctx.fillStyle = data.tags.length > 0 ? THEME.caution : THEME.phosphor;
    ctx.fillText(fitText(ctx, tags, S - 80), cx, L.tags);

    // What the game is and where - big enough to read in a thumbnail.
    ctx.fillStyle = 'rgba(87,227,155,0.12)';
    ctx.fillRect(0, L.footerTop, S, S - L.footerTop);
    ctx.font = font(40, 700);
    ctx.fillStyle = THEME.ink;
    ctx.fillText(fitText(ctx, 'FREE GAME - PLAYS IN YOUR BROWSER', S - 60), cx, L.footer);
    ctx.font = font(30, 600);
    ctx.fillStyle = THEME.muted;
    ctx.fillText(fitText(ctx, data.host, S - 60), cx, L.host);
    ctx.restore();
}

/** Set the largest bold font, from `maxPx` down to `minPx`, at which `text` fits. */
function shrinkToFit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxPx: number, minPx: number) {
    for (let px = maxPx; px >= minPx; px -= 4) {
        ctx.font = font(px, 700);
        if (ctx.measureText(text).width <= maxWidth) return;
    }
    ctx.font = font(minPx, 700);
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
