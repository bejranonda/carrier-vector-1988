/**
 * CARRIER VECTOR: 1988 - What a share says (v2.3.0)
 *
 * The v2.0 card was three lines of pilot slang - "5 WAVES HELD · 2,200 PTS ·
 * 1 splashed", "beat it: <link>" - written for the person who flew, not the
 * friend who receives it, and it was all the friend ever saw. A share is now
 * three things, each for that friend:
 *
 *   - a message in plain words that says who did what and asks one question
 *     ("Can you beat me?"), with the link kept separate so a share sheet can
 *     hand it to the chat app as a link, with its preview card;
 *   - a picture (drawn by renderer/ShareImage.ts from `SharePicture`): the
 *     run's best moment, the score, the stars and the sender's name - what
 *     people actually post, and what reads at a glance in a chat;
 *   - the challenge link itself, which opens the same waves with the score
 *     to beat and the sender's name on the first screen.
 *
 * A run that answered a challenge says how it went - "I beat Anna!" - which
 * is the message most worth sending back. A run with nothing to boast about
 * is shared as an invitation instead ("Try this - EASY flies the plane for
 * you"): people sending to one friend send what is useful to that friend,
 * and nobody posts what does not flatter them.
 *
 * Plain sentences, normal capitals, no rows of symbols - the things that make
 * a message read as spam, and that a screen reader reads out one by one - and
 * it says what the link is ("a free game in your browser"), for a friend
 * who has learned to be wary of links.
 */

import { PLAY_HOST } from './DailySortie';

export interface ShareRun {
    /** The daily's number, when this was the daily. */
    daily?: number;
    /** Which try at today's daily this was (1 = first). */
    attempt?: number;
    score: number;
    /** Waves counted (cleared or held). */
    waves: number;
    kills: number;
    bestChain: number;
    /** SCRAMBLE stars held after the run, 0-3. */
    stars: number;
    easy: boolean;
    isNewBest: boolean;
    /** Stars earned for the first time on this run. */
    freshStars?: number;
    /** The sender's name, if they gave one. */
    name: string | null;
    /** The challenge this run answered, if any. */
    versus?: { name: string | null; score: number } | null;
    /** The link that carries this run as a challenge. */
    url: string;
}

export interface SharePicture {
    /** 'SCRAMBLE' or 'DAILY SCRAMBLE #279'. */
    title: string;
    /** The big question or boast at the bottom of the picture. */
    headline: string;
    score: number;
    stars: number;
    /** '8 WAVES · 24 PLANES DOWN · CHAIN x4'. */
    stats: string;
    /** The sender, upper-cased, or null. */
    pilot: string | null;
    /** Small labels: 'EASY MODE', 'NEW PERSONAL BEST'. */
    tags: string[];
    /** 'ANNA 12,000 · TOM 12,345' when the run answered a challenge. */
    versus: string | null;
    /** The address, without the scheme, to print on the picture. */
    host: string;
}

export interface ShareContent {
    /** The chat message, without the link. */
    text: string;
    url: string;
    picture: SharePicture;
    /** The message with the link alone on its last line: what is sent. */
    clipboard: string;
    /** For an email. */
    subject: string;
    /** What the main button says: REPLY TO ANNA, CHALLENGE A FRIEND, INVITE A FRIEND. */
    action: string;
}

const GAME = 'Carrier Vector: 1988';
const pts = (n: number) => Math.round(n).toLocaleString('en-US');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string) => {
    const many = one === one.toUpperCase() ? `${one}S` : `${one}s`;
    return `${n} ${n === 1 ? one : many}`;
};

export function shareContent(run: ShareRun): ShareContent {
    const v = run.versus ?? null;
    const outcome = v ? (run.score > v.score ? 'WON' : run.score === v.score ? 'TIED' : 'LOST') : null;
    const easy = run.easy ? ' on EASY' : '';
    const tries = run.daily === undefined || !run.attempt ? null : run.attempt === 1 ? 'first try' : `try ${run.attempt}`;

    let text: string;
    let subject = `Can you beat my ${pts(run.score)} in ${GAME}?`;
    let action = v ? (v.name ? `REPLY TO ${v.name.toUpperCase()}` : 'SEND IT BACK') : 'CHALLENGE A FRIEND';
    const play = 'same waves, a few minutes';
    if (v && outcome === 'WON') {
        text = v.name
            ? `I beat ${v.name}! ${pts(run.score)} points to ${pts(v.score)}${easy} in ${GAME}. Your turn - ${play}:`
            : `I beat the challenge - ${pts(run.score)} points to ${pts(v.score)}${easy} in ${GAME}. Your turn - ${play}:`;
        subject = v.name ? `I beat ${v.name} in ${GAME}!` : `Challenge beaten in ${GAME}!`;
    } else if (v && outcome === 'TIED') {
        text = `I tied ${v.name ?? 'the challenge'} at ${pts(run.score)} points${easy} in ${GAME}. Can you beat it? ${cap(play)}:`;
    } else if (v) {
        text = `${v.name ?? 'The challenge'} is still ahead - ${pts(v.score)} points to my ${pts(run.score)}${easy} in ${GAME}. Can you beat my score? ${cap(play)}:`;
    } else if (run.daily !== undefined) {
        text = `Daily Scramble #${run.daily}${tries ? ` (${tries})` : ''}: I scored ${pts(run.score)} points${easy} in ${GAME} and shot down ${plural(run.kills, 'plane')}.`
            + ` Everyone gets the same waves today - can you beat me? It's a free game in your browser:`;
    } else if (run.isNewBest || (run.freshStars ?? 0) > 0) {
        text = `I scored ${pts(run.score)} points${easy} in ${GAME} and shot down ${plural(run.kills, 'plane')}.${run.isNewBest ? ' My best yet!' : ''}`
            + ` Can you beat me? It's a free game in your browser - ${play}, no download:`;
    } else {
        // Nothing to boast about: an invitation, not a challenge.
        text = `Try ${GAME} - a free retro jet game in your browser, no download. EASY mode flies the plane for you; you just fire.`
            + (run.score > 0 ? ` I scored ${pts(run.score)} points${easy} - can you beat me?` : '') + ' Same waves as mine:';
        subject = `Try ${GAME} - can you beat my ${pts(run.score)}?`;
        action = 'INVITE A FRIEND';
    }

    const pilot = run.name ? run.name.toUpperCase() : null;
    const rival = v ? (v.name ? v.name.toUpperCase() : 'CHALLENGE') : null;
    const headline = outcome === 'WON' ? (v!.name ? `I BEAT ${rival}!` : 'CHALLENGE BEATEN!')
        : outcome === 'TIED' ? (v!.name ? `TIED WITH ${rival}!` : 'DEAD HEAT!')
            : 'CAN YOU BEAT ME?';
    const tags: string[] = [];
    if (run.easy) tags.push('EASY MODE');
    if (run.isNewBest && outcome !== 'LOST') tags.push('NEW PERSONAL BEST');
    const chain = run.bestChain >= 2 ? ` · CHAIN x${Math.min(5, run.bestChain)}` : '';

    return {
        text,
        url: run.url,
        clipboard: `${text}\n${run.url}`,
        subject,
        action,
        picture: {
            title: run.daily !== undefined ? `DAILY SCRAMBLE #${run.daily}${tries ? ` · ${tries.toUpperCase()}` : ''}` : 'SCRAMBLE',
            headline,
            score: run.score,
            stars: Math.max(0, Math.min(3, Math.round(run.stars))),
            stats: `${plural(run.waves, 'WAVE')} · ${plural(run.kills, 'PLANE')} DOWN${chain}`,
            pilot,
            tags,
            versus: v ? `${rival} ${pts(v.score)} · ${pilot ?? 'ME'} ${pts(run.score)}` : null,
            host: PLAY_HOST
        }
    };
}

/**
 * The debrief's one line above SHARE: why this run is worth sending, or -
 * when it is not especially - what the friend gets.
 */
export function shareNudge(run: Pick<ShareRun, 'isNewBest' | 'versus' | 'score'> & { freshStars: number }): { text: string; strong: boolean } {
    const v = run.versus ?? null;
    if (v && run.score > v.score) return { text: `YOU BEAT ${v.name ? v.name.toUpperCase() : 'THE CHALLENGE'} - SEND IT BACK`, strong: true };
    if (run.isNewBest) return { text: 'NEW PERSONAL BEST - SHOW YOUR FRIENDS', strong: true };
    if (run.freshStars > 0) return { text: `NEW STAR${run.freshStars === 1 ? '' : 'S'} - SHOW YOUR FRIENDS`, strong: true };
    return { text: 'SHARE: YOUR FRIEND FLIES THESE SAME WAVES', strong: false };
}
