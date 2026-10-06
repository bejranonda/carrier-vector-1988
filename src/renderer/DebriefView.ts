/**
 * CARRIER VECTOR: 1988 - Debrief (v2.0.0)
 *
 * WHY THIS WAS REBUILT
 * The old debrief was a nine-row table of counters, a score, and one way out:
 * "ENTER - back to mission select". It answered "what happened" and nothing
 * else - not "what did I earn", not "what is next", and above all not "go
 * again", which is the one decision a player makes on this screen. Every arcade
 * hit puts RETRY under the thumb, because the second run is decided in the two
 * seconds after the first one ends.
 *
 * The screen now pays out in the order a player cares about:
 *   1. the headline and, on a loss, what got you and what to do differently
 *   2. the three medal stars, popping in one at a time, new ones flaring
 *   3. the score, counting up, against your best
 *   4. a career XP bar that fills - and a promotion, if it crossed a level
 *   5. anything unlocked, or how many stars until the next unlock
 *   6. FLY AGAIN, big, on ENTER - and MISSIONS beside it
 *
 * Sections are measured and the optional ones shed on a short window (a
 * landscape phone is 360 px tall), so nothing is ever clipped or overlapped.
 * Layout is pure (`debriefLayout`) and shared with the click hit-test.
 */

import type { CareerLevel } from '../core/Career';
import { formatLossCause, postMortemTip } from '../core/PostMortem';
import type { LossCause } from '../core/PostMortem';
import { THEME, fitText, font, glow, halo, keycap, keycapWidth, noGlow, plate } from './Theme';
import type { Rect } from './Theme';

export interface DebriefData {
    outcome: 'SUCCESS' | 'FAILED';
    /** Big line: the victory title, or MISSION FAILED / SHOT DOWN. */
    headline: string;
    /** The headline is a win over a friend's challenge: drawn in gold (v2.3.0). */
    celebrate?: boolean;
    /** Why it ended, in one line. */
    reason: string | null;
    scenarioName: string;
    /** Shown beside the mission name, e.g. "FLOWN ON EASY" (v2.2.0). */
    styleNote?: string;
    cause?: LossCause | null;
    score: number;
    isNewBest: boolean;
    missionBest: number;
    isMissionBest: boolean;
    /** Up to six [label, value] pairs, most interesting first. */
    stats: [string, string][];
    stars: {
        labels: readonly [string, string, string] | readonly string[];
        /** Stars held on this mission after this run (bitmask). */
        recordMask: number;
        /** Indices earned for the first time on this run. */
        fresh: number[];
    };
    xp: { gained: number; before: CareerLevel; after: CareerLevel; promoted: boolean } | null;
    /** Labels of cosmetic unlocks earned by this run. */
    unlocks: string[];
    /** Teaser for the next unlock, when nothing was unlocked. */
    nextUnlock: { label: string; starsNeeded: number } | null;
    /**
     * SHARE (v2.3.0): the line above the button - why this run is worth
     * sending - and how the last share went. Null when there is nothing to
     * share (deck missions).
     */
    share?: { text: string; strong: boolean; status: 'IDLE' | 'SHARED' | 'COPIED'; label?: string } | null;
    nextUp?: string;
    touch?: boolean;
}

export interface DebriefLayout {
    top: number;
    width: number;
    x: number;
    /** Which optional sections fit. `share` is the line above the buttons. */
    show: { cause: boolean; stars: boolean; stats: boolean; xp: boolean; unlock: boolean; share: boolean };
    /** The SHARE button - present whenever there is a run to share. */
    share: Rect | null;
    y: { headline: number; cause: number; stars: number; score: number; stats: number; xp: number; unlock: number; share: number; buttons: number };
    again: Rect;
    missions: Rect;
}

const TALL = {
    headline: 92,
    cause: 40,
    stars: 92,
    score: 70,
    stats: 66,
    xp: 58,
    unlock: 28,
    share: 26,
    buttons: 60
};
/** A landscape phone is ~360-390 px tall: tighter rows keep the XP bar on it. */
const SHORT: typeof TALL = { ...TALL, headline: 82, stars: 80, score: 62, xp: 52, buttons: 58 };
const rowsFor = (h: number) => (h < 520 ? SHORT : TALL);

export function debriefLayout(w: number, h: number, data?: Pick<DebriefData, 'outcome' | 'cause' | 'share' | 'unlocks' | 'nextUnlock' | 'xp'>): DebriefLayout {
    const H = rowsFor(h);
    const width = Math.min(620, w - 32);
    const x = (w - width) / 2;
    const canShare = !!data?.share;
    // Three buttons need room; on a narrow (upright) screen FLY AGAIN gets a
    // row of its own and SHARE and MISSIONS share the next.
    const narrow = canShare && width < 500;
    const buttonsH = H.buttons + (narrow ? 52 : 0);
    const want = {
        cause: !!data && data.outcome === 'FAILED' && !!formatLossCause(data.cause ?? null),
        stars: true,
        stats: true,
        xp: !!data?.xp,
        unlock: !!data && (data.unlocks.length > 0 || data.nextUnlock !== null),
        share: canShare
    };
    const show = { ...want };
    const total = () => H.headline + H.score + buttonsH
        + (show.cause ? H.cause : 0) + (show.stars ? H.stars : 0) + (show.stats ? H.stats : 0)
        + (show.xp ? H.xp : 0) + (show.unlock ? H.unlock : 0) + (show.share ? H.share : 0);
    // Shed in order of least value on THIS screen. The line that says why a
    // run is worth sending outlives the stats grid; the SHARE button itself
    // sits in the button row and is never shed.
    for (const k of ['stats', 'unlock', 'cause', 'xp', 'share', 'stars'] as const) {
        if (total() <= h - 24) break;
        show[k] = false;
    }
    let y = Math.max(12, (h - total()) / 2);
    const top = y;
    const at = (key: keyof typeof TALL, on = true) => {
        const here = y;
        if (on) y += H[key];
        return here;
    };
    const ys = {
        headline: at('headline'),
        cause: at('cause', show.cause),
        stars: at('stars', show.stars),
        score: at('score'),
        stats: at('stats', show.stats),
        xp: at('xp', show.xp),
        unlock: at('unlock', show.unlock),
        share: at('share', show.share),
        buttons: at('buttons')
    };
    const by = ys.buttons + 8;
    if (narrow) {
        const half = (width - 12) / 2;
        return {
            top, width, x, show, y: ys,
            again: { x, y: by, w: width, h: 44 },
            share: { x, y: by + 52, w: half, h: 44 },
            missions: { x: x + half + 12, y: by + 52, w: half, h: 44 }
        };
    }
    const gap = 12;
    const sw = canShare ? Math.min(160, width * 0.27) : 0;
    const mw = Math.min(170, width * 0.27);
    const aw = Math.min(270, width - sw - mw - gap * (canShare ? 2 : 1));
    const bx = w / 2 - (aw + mw + sw + gap * (canShare ? 2 : 1)) / 2;
    return {
        top, width, x, show, y: ys,
        again: { x: bx, y: by, w: aw, h: 44 },
        share: canShare ? { x: bx + aw + gap, y: by, w: sw, h: 44 } : null,
        missions: { x: bx + aw + gap + (canShare ? sw + gap : 0), y: by, w: mw, h: 44 }
    };
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** A five-point star centred on (cx, cy). Shared with the share picture. */
export function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

/** Seconds into the debrief at which star `i` lands. */
export const starRevealAt = (i: number) => 0.45 + i * 0.35;

export function drawDebriefView(ctx: CanvasRenderingContext2D, w: number, h: number, data: DebriefData, age: number) {
    const L = debriefLayout(w, h, data);
    const cx = w / 2;
    ctx.save();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(7,13,17,0.96)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // 1. Headline
    const won = data.outcome === 'SUCCESS';
    const headColor = data.celebrate ? THEME.caution : won ? THEME.phosphor : THEME.alert;
    ctx.font = font(Math.min(40, Math.max(26, w / 34)), 700);
    ctx.fillStyle = headColor;
    glow(ctx, headColor, 14);
    ctx.fillText(fitText(ctx, data.headline, L.width), cx, L.y.headline + 40);
    noGlow(ctx);
    ctx.font = font(13);
    ctx.fillStyle = THEME.muted;
    ctx.fillText(fitText(ctx, data.reason ?? '', L.width), cx, L.y.headline + 64);
    ctx.font = font(11, 600);
    const nameLine = data.styleNote ? `${data.scenarioName} · ${data.styleNote}` : data.scenarioName;
    ctx.fillText(fitText(ctx, nameLine, L.width), cx, L.y.headline + 82);

    // What got you, and what to do differently.
    if (L.show.cause) {
        const cause = formatLossCause(data.cause ?? null);
        const tip = postMortemTip(data.cause ?? null);
        ctx.font = font(12, 700);
        ctx.fillStyle = THEME.alert;
        if (cause) ctx.fillText(fitText(ctx, cause, L.width), cx, L.y.cause + 14);
        if (tip) {
            ctx.font = font(11);
            ctx.fillStyle = THEME.muted;
            ctx.fillText(fitText(ctx, tip, L.width), cx, L.y.cause + 32);
        }
    }

    // 2. Stars
    if (L.show.stars) {
        const colW = L.width / 3;
        for (let i = 0; i < 3; i++) {
            const sx = L.x + colW * i + colW / 2;
            const sy = L.y.stars + 30;
            const held = (data.stars.recordMask & (1 << i)) !== 0;
            const isFresh = data.stars.fresh.includes(i);
            const t = (age - starRevealAt(i)) / 0.3;
            const pop = isFresh ? (t < 0 ? 0 : t < 1 ? 1 + (1 - t) * 0.8 : 1) : 1;
            const r = 20 * (isFresh && t < 0 ? 0.001 : pop);
            starPath(ctx, sx, sy, Math.max(0.001, r));
            if (held && (!isFresh || t >= 0)) {
                ctx.fillStyle = THEME.caution;
                if (isFresh) glow(ctx, THEME.caution, 18 * Math.max(0, 1.5 - Math.max(0, t)));
                ctx.fill();
                noGlow(ctx);
            } else {
                ctx.strokeStyle = THEME.edgeSoft;
                ctx.lineWidth = 1.5;
                starPath(ctx, sx, sy, 20);
                ctx.stroke();
            }
            ctx.font = font(10, 600);
            ctx.fillStyle = held ? THEME.ink : THEME.muted;
            ctx.fillText(fitText(ctx, data.stars.labels[i] ?? '', colW - 12), sx, sy + 38);
            if (isFresh && t >= 0) {
                ctx.font = font(10, 700);
                ctx.fillStyle = THEME.caution;
                ctx.fillText('NEW', sx, sy + 54);
            }
        }
    }

    // 3. Score, counting up
    const shown = Math.round(data.score * ease(age / 0.9));
    ctx.font = font(34, 700);
    ctx.fillStyle = THEME.caution;
    ctx.fillText(`${shown.toLocaleString('en-US')} PTS`, cx, L.y.score + 34);
    ctx.font = font(12, 700);
    if (data.isNewBest || data.isMissionBest) {
        ctx.fillStyle = THEME.phosphor;
        glow(ctx, THEME.phosphor, 8);
        ctx.fillText(data.isNewBest ? 'NEW PERSONAL BEST' : `BEST RUN YET ON ${data.scenarioName}`, cx, L.y.score + 58);
        noGlow(ctx);
    } else if (data.missionBest > 0) {
        ctx.fillStyle = THEME.muted;
        ctx.fillText(`BEST ON THIS MISSION  ${data.missionBest.toLocaleString('en-US')} PTS`, cx, L.y.score + 58);
    }

    // Stats grid: two rows of three.
    if (L.show.stats) {
        const cols = 3;
        const cw = L.width / cols;
        data.stats.slice(0, 6).forEach(([label, value], i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const sx = L.x + cw * col + cw / 2;
            const sy = L.y.stats + 18 + row * 30;
            ctx.font = font(15, 700);
            ctx.fillStyle = THEME.ink;
            ctx.fillText(value, sx, sy);
            ctx.font = font(9, 600);
            ctx.fillStyle = THEME.muted;
            ctx.fillText(fitText(ctx, label, cw - 8), sx, sy + 12);
        });
    }

    // 4. Career XP bar
    if (L.show.xp && data.xp) {
        const { before, after, gained, promoted } = data.xp;
        const fill = ease((age - 0.6) / 1.1);
        // Fill from where the bar was to where it is; on a promotion, the
        // bar fills to the end, then shows the new level's progress.
        const crossing = promoted && fill < 0.6;
        const level = crossing ? before : after;
        const from = crossing ? before.into / before.span : promoted ? 0 : before.into / before.span;
        const to = crossing ? 1 : after.into / after.span;
        const k = crossing ? fill / 0.6 : promoted ? (fill - 0.6) / 0.4 : fill;
        const frac = from + (to - from) * Math.max(0, Math.min(1, k));
        const bx = L.x + 20;
        const bw = L.width - 40;
        const by = L.y.xp + 26;
        ctx.textAlign = 'left';
        ctx.font = font(11, 700);
        ctx.fillStyle = THEME.ink;
        ctx.fillText(`CAREER LV ${level.level} · ${level.title}`, bx, by - 8);
        ctx.textAlign = 'right';
        ctx.fillStyle = THEME.phosphor;
        ctx.fillText(`+${Math.round(gained * Math.min(1, fill * 1.4)).toLocaleString('en-US')} XP`, bx + bw, by - 8);
        plate(ctx, { x: bx, y: by, w: bw, h: 10 }, { border: THEME.edgeSoft, radius: 5 });
        ctx.fillStyle = THEME.phosphor;
        ctx.fillRect(bx + 2, by + 2, Math.max(0, (bw - 4) * frac), 6);
        ctx.textAlign = 'center';
        if (promoted && fill >= 0.6) {
            ctx.font = font(13, 700);
            ctx.fillStyle = THEME.caution;
            glow(ctx, THEME.caution, 10);
            ctx.fillText(`PROMOTED: ${after.title}`, cx, by + 28);
            noGlow(ctx);
        }
    }

    // 5. Unlocks, or the teaser for the next one.
    if (L.show.unlock) {
        ctx.font = font(12, 700);
        if (data.unlocks.length > 0) {
            ctx.fillStyle = THEME.caution;
            // C copies the card on this screen; looks change on mission select.
            ctx.fillText(fitText(ctx, `UNLOCKED: ${data.unlocks.join(' · ')}${data.touch ? '' : ' - C ON MISSION SELECT CHANGES LOOKS'}`, L.width), cx, L.y.unlock + 18);
        } else if (data.nextUnlock) {
            ctx.fillStyle = THEME.muted;
            const n = data.nextUnlock.starsNeeded;
            ctx.fillText(fitText(ctx, `${n} MORE STAR${n === 1 ? '' : 'S'} UNLOCKS ${data.nextUnlock.label}`, L.width), cx, L.y.unlock + 18);
        }
    }

    // Why this run is worth sending - or that it was sent.
    if (L.show.share && data.share) {
        const st = data.share.status;
        ctx.font = font(12, 700);
        ctx.fillStyle = st !== 'IDLE' ? THEME.phosphor : data.share.strong ? THEME.caution : THEME.muted;
        // Never "sent": the browser only knows an app was chosen.
        const line = st === 'SHARED' ? 'THANK YOU FOR SHARING'
            : st === 'COPIED' ? 'LINK COPIED - PASTE IT INTO A CHAT'
                : data.share.text;
        ctx.fillText(fitText(ctx, line, L.width), cx, L.y.share + 17);
    }

    // 6. FLY AGAIN, and the way out.
    const button = (r: Rect, key: string, label: string, primary: boolean, bright = false) => {
        plate(ctx, r, {
            fill: primary ? 'rgba(87,227,155,0.12)' : bright ? 'rgba(255,201,77,0.08)' : 'rgba(9,19,25,0.85)',
            border: primary ? THEME.phosphor : bright ? THEME.caution : THEME.edgeSoft,
            radius: 6
        });
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const capW = data.touch ? 0 : keycap(ctx, r.x + 14, r.y + r.h / 2, key, { size: primary ? 13 : 11 });
        ctx.font = font(primary || bright ? 16 : 13, 700);
        ctx.fillStyle = primary || bright ? THEME.ink : THEME.muted;
        const tx = r.x + 14 + (capW ? capW + 10 : 0);
        ctx.fillText(fitText(ctx, label, r.x + r.w - tx - 10), tx, r.y + r.h / 2 + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'center';
    };
    button(L.again, 'ENTER', 'FLY AGAIN', true);
    if (primaryPulse(age) > 0) halo(ctx, L.again, THEME.phosphor, 6 + 6 * primaryPulse(age));
    if (L.share) {
        // Secondary to FLY AGAIN, but lit when the run is worth bragging about.
        const lit = !!data.share?.strong && data.share.status === 'IDLE';
        // "REPLY TO GRANDMA MARGARET" will not fit everywhere; "REPLY" does.
        const full = data.share?.label ?? 'SHARE';
        ctx.font = font(16, 700);
        const room = L.share.w - 28 - (data.touch ? 0 : keycapWidth(ctx, 'C', 11) + 10);
        const label = ctx.measureText(full).width <= room ? full : full.startsWith('REPLY') ? 'REPLY' : 'SHARE';
        button(L.share, 'C', label, false, true);
        if (lit) halo(ctx, L.share, THEME.caution, 8, 6);
    }
    button(L.missions, 'ESC', 'MISSIONS', false);
    if (data.nextUp && !L.share) {
        ctx.font = font(11, 600);
        ctx.fillStyle = THEME.key;
        const ny = L.again.y + L.again.h + 18;
        if (ny < h - 4) ctx.fillText(fitText(ctx, `NEXT UP: ${data.nextUp}`, L.width), cx, ny);
    }
    ctx.restore();
}

/** 0..1 breathing glow on FLY AGAIN once the payout has finished. */
function primaryPulse(age: number): number {
    if (age < 1.8) return 0;
    return 0.5 + 0.5 * Math.sin((age - 1.8) * 4);
}
