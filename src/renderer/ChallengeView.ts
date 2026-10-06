/**
 * CARRIER VECTOR: 1988 - "Anna challenges you" (v2.3.0)
 *
 * What a friend sees first when they open a shared link. It used to be the
 * full mission select - seven mission tabs, a daily banner, three
 * explanation cards and a dozen key hints - with the challenge as one small
 * yellow line under the title: a first-time visitor, very likely on a phone
 * and very likely not a gamer, had to find the point of the link themselves.
 *
 * Now the link's promise is the whole screen: what the game is, who sent the
 * link, the score to beat, one plain sentence, and one big PLAY button.
 * Everything else is one tap away (SEE ALL MISSIONS) and never in the way.
 *
 * Every line WRAPS rather than being cut: the first build cut "GRANDMA
 * MARGARET CHALLENGES YOU" to "GRANDMA MARGAR..." on an upright phone - the
 * way most people open a link from a chat. Text is measured as the game's
 * monospace (0.6 em a character, a full em for a Chinese, Japanese or Korean
 * one, nothing for an accent), so the layout stays pure and the hit-test and
 * the drawing agree; the drawing still fits each line as a safety net.
 * Lines are balanced, so a sentence never leaves one word alone below it.
 */

import { challengerLabel } from '../core/Challenge';
import type { Challenge } from '../core/Challenge';
import { THEME, fitText, font, glow, halo, keycap, keycapWidth, noGlow, plate } from './Theme';
import type { Rect } from './Theme';

/** One block of wrapped text and where its first baseline sits. */
interface Block { lines: string[]; px: number; weight: 400 | 600 | 700; y: number; lineH: number }

export interface ChallengeWelcomeLayout {
    panel: Rect;
    accept: Rect;
    missions: Rect;
    /** A short screen: smaller type, fewer words. */
    compact: boolean;
    blocks: {
        kicker: Block; title: Block; label: Block; score: Block;
        detail: Block | null; about: Block | null; reassure: Block; rotate: Block | null;
    };
    buttonPx: number;
}

type WelcomeChallenge = Pick<Challenge, 'name' | 'score' | 'waves' | 'easy'>;

/** What the screen says, before it is wrapped. */
export function challengeWelcomeText(c: WelcomeChallenge | null, touch: boolean) {
    const waves = c?.waves ?? 0;
    return {
        kicker: 'CARRIER VECTOR: 1988 · A FREE JET GAME',
        title: `${challengerLabel(c ?? {})} CHALLENGES YOU`,
        label: 'SCORE TO BEAT',
        score: `${(c?.score ?? 0).toLocaleString('en-US')} PTS`,
        detail: `They lasted ${waves} wave${waves === 1 ? '' : 's'} of planes${c?.easy ? ' on EASY' : ''}. You get the very same ones.`,
        about: 'Shoot down the bombers before they reach your carrier. It takes a few minutes.',
        aboutShort: 'Shoot down the bombers before they reach your carrier.',
        reassure: `No download, no sign-up. EASY mode flies the plane - you ${touch ? 'tap' : 'press'} FIRE.`,
        rotate: 'Turn your phone sideways to play.',
        button: "PLAY - IT'S FREE",
        missions: 'SEE ALL MISSIONS'
    };
}

/** Full-width characters: a whole em in a monospace face, not 0.6. */
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]|[\u{20000}-\u{3FFFD}]/u;
const MARK = /\p{M}/u;

/** How wide `text` sets in the game's monospace face at `px`. */
export function monoWidth(text: string, px: number): number {
    let em = 0;
    for (const ch of text) em += MARK.test(ch) ? 0 : WIDE.test(ch) ? 1 : 0.6;
    return em * px;
}

/** A word too wide for any line, in pieces that fit (a letter keeps its accents). */
function breakWord(word: string, px: number, maxWidth: number): string[] {
    const pieces: string[] = [];
    let piece = '';
    for (const ch of word) {
        if (piece && !MARK.test(ch) && monoWidth(piece + ch, px) > maxWidth) {
            pieces.push(piece);
            piece = '';
        }
        piece += ch;
    }
    if (piece) pieces.push(piece);
    return pieces;
}

function greedyWrap(words: string[], px: number, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (monoWidth(next, px) <= maxWidth || !line) line = next;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines;
}

/**
 * Word wrap for the game's monospace face at `px`: as few lines as fit,
 * then as even as they can be - "...You get the very same" over a lone
 * "ones." read as a mistake.
 */
export function wrapMono(text: string, px: number, maxWidth: number): string[] {
    const words = text.split(' ').flatMap(w => (monoWidth(w, px) > maxWidth ? breakWord(w, px, maxWidth) : [w]));
    const lines = greedyWrap(words, px, maxWidth);
    if (lines.length < 2) return lines;
    // Narrow the measure while the line count holds.
    let best = lines;
    const step = px * 0.6;
    for (let width = maxWidth - step; width > maxWidth / 2; width -= step) {
        if (words.some(w => monoWidth(w, px) > width)) break;
        const tried = greedyWrap(words, px, width);
        if (tried.length > lines.length) break;
        best = tried;
    }
    return best;
}

/** The size at which the widest word of `text` fits a line (at most 40% smaller). */
function fitWordsPx(text: string, px: number, maxWidth: number): number {
    const widest = Math.max(...text.split(' ').map(w => monoWidth(w, 1)));
    if (widest * px <= maxWidth) return px;
    return Math.max(Math.round(px * 0.6), Math.floor(maxWidth / widest));
}

export function challengeWelcomeLayout(
    w: number,
    h: number,
    c: WelcomeChallenge | null = null,
    touch = false
): ChallengeWelcomeLayout {
    const text = challengeWelcomeText(c, touch);
    const width = Math.min(620, w - 24);
    const inner = width - 40;
    const upright = touch && h > w;
    const narrow = width < 480;

    // The roomy layout first, then smaller type, then fewer words.
    const modes = [
        { compact: false, about: true, detail: true },
        { compact: true, about: true, detail: true },
        { compact: true, about: false, detail: true },
        { compact: true, about: false, detail: false }
    ];
    let result: ChallengeWelcomeLayout | null = null;
    for (const mode of modes) {
        const sizes = mode.compact
            ? { kicker: 12, title: narrow ? 24 : 26, label: 12, score: narrow ? 38 : 40, body: 13, button: 18 }
            : { kicker: 14, title: narrow ? 28 : 34, label: 14, score: narrow ? 46 : 52, body: 15, button: 21 };
        let y = mode.compact ? 14 : 18;
        const block = (s: string, size: number, weight: 400 | 600 | 700, lineH: number, gapBefore = 0): Block => {
            y += gapBefore;
            // A long one-word name sets smaller rather than being broken.
            const px = fitWordsPx(s, size, inner);
            const lines = wrapMono(s, px, inner);
            const b: Block = { lines, px, weight, y: y + px, lineH: lineH - (size - px) };
            y += lines.length * b.lineH;
            return b;
        };
        const kicker = block(text.kicker, sizes.kicker, 700, sizes.kicker + 6);
        const title = block(text.title, sizes.title, 700, sizes.title + 8, mode.compact ? 4 : 8);
        const label = block(text.label, sizes.label, 600, sizes.label + 6, mode.compact ? 4 : 8);
        const score = block(text.score, sizes.score, 700, sizes.score + 6, 2);
        const detail = mode.detail ? block(text.detail, sizes.body, 600, sizes.body + 6, mode.compact ? 4 : 8) : null;
        const about = mode.about
            ? block(mode.compact ? text.aboutShort : text.about, sizes.body, 400, sizes.body + 6, 4)
            : null;
        y += mode.compact ? 8 : 14;
        const buttonY = y;
        const buttonH = mode.compact ? 48 : 58;
        y += buttonH + 8;
        const reassure = block(text.reassure, sizes.body - 1, 400, sizes.body + 5);
        const rotate = upright ? block(text.rotate, sizes.body, 700, sizes.body + 6, 4) : null;
        y += mode.compact ? 6 : 10;
        const missionsY = y;
        const missionsH = mode.compact ? 38 : 44;
        y += missionsH + (mode.compact ? 14 : 18);
        const total = y;

        const top = Math.max(4, (h - total) / 2);
        const shift = (b: Block | null) => (b ? { ...b, y: b.y + top } : null);
        const bw = Math.min(380, inner);
        const mw = Math.min(260, inner);
        result = {
            panel: { x: (w - width) / 2, y: top, w: width, h: total },
            accept: { x: (w - bw) / 2, y: top + buttonY, w: bw, h: buttonH },
            missions: { x: (w - mw) / 2, y: top + missionsY, w: mw, h: missionsH },
            compact: mode.compact,
            blocks: {
                kicker: shift(kicker)!, title: shift(title)!, label: shift(label)!, score: shift(score)!,
                detail: shift(detail), about: shift(about), reassure: shift(reassure)!, rotate: shift(rotate)
            },
            buttonPx: sizes.button
        };
        if (total <= h - 8) break;
    }
    return result!;
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
    const l = challengeWelcomeLayout(w, h, c, touch);
    const text = challengeWelcomeText(c, touch);
    const cx = w / 2;
    const inner = l.panel.w - 32;
    ctx.save();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(5,10,13,0.92)';
    ctx.fillRect(0, 0, w, h);
    plate(ctx, l.panel, { fill: 'rgba(9,19,25,0.96)', border: THEME.caution, radius: 10 });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const draw = (b: Block | null, color: string, glowColor?: string) => {
        if (!b) return;
        ctx.font = font(b.px, b.weight);
        ctx.fillStyle = color;
        if (glowColor) glow(ctx, glowColor, b.px > 30 ? 14 : 10);
        b.lines.forEach((line, i) => ctx.fillText(fitText(ctx, line, inner), cx, b.y + i * b.lineH));
        noGlow(ctx);
    };
    draw(l.blocks.kicker, THEME.caution);
    draw(l.blocks.title, THEME.ink, THEME.phosphor);
    draw(l.blocks.label, THEME.muted);
    draw(l.blocks.score, THEME.caution, THEME.caution);
    draw(l.blocks.detail, THEME.ink);
    draw(l.blocks.about, THEME.muted);

    // The one thing to do.
    plate(ctx, l.accept, { fill: 'rgba(87,227,155,0.16)', border: THEME.phosphor, radius: 8 });
    const pulse = 0.5 + 0.5 * Math.sin(age * 4);
    halo(ctx, l.accept, THEME.phosphor, 8 + 8 * pulse, 8);
    ctx.textBaseline = 'middle';
    ctx.font = font(l.buttonPx, 700);
    const midY = l.accept.y + l.accept.h / 2 + 1;
    if (touch) {
        ctx.fillStyle = THEME.ink;
        ctx.fillText(fitText(ctx, text.button, l.accept.w - 24), cx, midY);
    } else {
        ctx.textAlign = 'left';
        const capW = keycapWidth(ctx, 'ENTER', 13);
        ctx.font = font(l.buttonPx, 700);
        const label = fitText(ctx, text.button, l.accept.w - capW - 40);
        const startX = cx - (capW + 12 + ctx.measureText(label).width) / 2;
        keycap(ctx, startX, midY, 'ENTER', { size: 13 });
        ctx.font = font(l.buttonPx, 700);
        ctx.fillStyle = THEME.ink;
        ctx.fillText(label, startX + capW + 12, midY);
        ctx.textAlign = 'center';
    }
    ctx.textBaseline = 'alphabetic';

    draw(l.blocks.reassure, THEME.muted);
    draw(l.blocks.rotate, THEME.key);

    plate(ctx, l.missions, { fill: 'rgba(9,19,25,0.85)', border: THEME.edgeSoft, radius: 6 });
    ctx.textBaseline = 'middle';
    ctx.font = font(13, 700);
    ctx.fillStyle = THEME.muted;
    const mY = l.missions.y + l.missions.h / 2 + 1;
    if (touch) {
        ctx.fillText(text.missions, cx, mY);
    } else {
        ctx.textAlign = 'left';
        const capW = keycapWidth(ctx, 'ESC', 11);
        ctx.font = font(13, 700);
        const sx = cx - (capW + 10 + ctx.measureText(text.missions).width) / 2;
        keycap(ctx, sx, mY, 'ESC', { size: 11 });
        ctx.font = font(13, 700);
        ctx.fillStyle = THEME.muted;
        ctx.fillText(text.missions, sx + capW + 10, mY);
    }
    ctx.restore();
}
