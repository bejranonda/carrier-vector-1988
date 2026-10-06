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
 * A run that answered a challenge says how it went, to the friend who sent
 * it - "I beat your score, Anna!" - which is the message most worth sending
 * back; a lost one tells them they are still ahead rather than challenging
 * them back. A run with nothing to boast about
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
    /** After a challenge: both pilots and their scores, the higher first. */
    board: { name: string; score: number }[] | null;
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
const plural = (n: number, one: string) => {
    const many = one === one.toUpperCase() ? `${one}S` : `${one}s`;
    return `${n} ${n === 1 ? one : many}`;
};

export function shareContent(run: ShareRun): ShareContent {
    const v = run.versus ?? null;
    const outcome = v ? (run.score > v.score ? 'WON' : run.score === v.score ? 'TIED' : 'LOST') : null;
    // Honest about EASY wherever a score is claimed.
    const easy = run.easy ? ' (I flew on EASY)' : '';
    const tries = run.daily === undefined || !run.attempt ? null : run.attempt === 1 ? 'first try' : `try ${run.attempt}`;
    const what = 'a free jet game in your browser';

    let text: string;
    let subject = `Can you beat my ${pts(run.score)} in ${GAME}?`;
    let action = 'CHALLENGE A FRIEND';
    if (v && outcome === 'WON') {
        // A reply speaks to the person it answers.
        text = v.name
            ? `I beat your score, ${v.name}! ${pts(run.score)} to your ${pts(v.score)} in ${GAME}${easy}. Your turn to win it back - it's ${what}, a few minutes:`
            : `I beat the challenge - ${pts(run.score)} to ${pts(v.score)} in ${GAME}${easy}! Your turn - it's ${what}, a few minutes:`;
        subject = v.name ? `I beat your score, ${v.name}!` : `Challenge beaten in ${GAME}!`;
        action = v.name ? `REPLY TO ${v.name.toUpperCase()}` : 'REPLY';
    } else if (v && outcome === 'TIED') {
        text = v.name
            ? `We're tied, ${v.name} - ${pts(run.score)} points each in ${GAME}${easy}! Your turn to break it - it's ${what}:`
            : `I tied the challenge at ${pts(run.score)} points in ${GAME}${easy}. Can you beat it? It's ${what}, a few minutes:`;
        action = v.name ? `REPLY TO ${v.name.toUpperCase()}` : 'REPLY';
    } else if (v) {
        // Lost: no point challenging the one who won. Tell them - kindly.
        text = v.name
            ? `You're still ahead, ${v.name} - ${pts(v.score)} to my ${pts(run.score)} in ${GAME}${easy}. I'll get you next time!`
            : `The challenge is still ahead - ${pts(v.score)} to my ${pts(run.score)} in ${GAME}${easy}. Can you beat it? It's ${what}:`;
        subject = v.name ? `You're still ahead, ${v.name}` : subject;
        action = v.name ? `TELL ${v.name.toUpperCase()}` : 'CHALLENGE A FRIEND';
    } else if (run.daily !== undefined) {
        text = `Daily Scramble #${run.daily}${tries ? ` (${tries})` : ''}: ${pts(run.score)} points in ${GAME}${easy}, a free jet game.`
            + ` Everyone gets the same planes today - can you beat me? It plays in your browser:`;
    } else if (run.isNewBest) {
        const downed = run.kills > 0 ? ` and ${plural(run.kills, 'plane')} shot down` : '';
        text = `My best yet: ${pts(run.score)} points${downed} in ${GAME}${easy}, a free jet game.`
            + ` Can you beat me? It plays in your browser, no download:`;
    } else if ((run.freshStars ?? 0) > 0) {
        const downed = run.kills > 0 ? ` and shot down ${plural(run.kills, 'plane')}` : '';
        text = `I scored ${pts(run.score)} points${downed} in ${GAME}${easy}, a free jet game.`
            + ` Can you beat me? It plays in your browser, no download:`;
    } else {
        // Nothing to boast about: an invitation, not a challenge.
        text = `Try ${GAME}, a free jet game - it plays in your browser, nothing to install. EASY mode flies the plane; you just press FIRE.`
            + (run.score > 0 ? ` I got ${pts(run.score)}${easy} - can you beat me?` : '');
        subject = `Try ${GAME} - a free jet game`;
        action = 'INVITE A FRIEND';
    }

    const pilot = run.name ? run.name.toUpperCase() : null;
    const rival = v ? (v.name ? v.name.toUpperCase() : 'CHALLENGE') : null;
    // The picture gets forwarded to family groups: a name says more than "I".
    const headline = outcome === 'WON' ? (v!.name ? `${pilot ?? 'I'} BEAT ${rival}!` : 'CHALLENGE BEATEN!')
        : outcome === 'TIED' ? (v!.name ? `TIED WITH ${rival}!` : 'DEAD HEAT!')
            : pilot ? `CAN YOU BEAT ${pilot}?` : 'CAN YOU BEAT ME?';
    const tags: string[] = [];
    if (run.easy) tags.push('EASY MODE');
    if (run.isNewBest && outcome !== 'LOST') tags.push('NEW PERSONAL BEST');
    // Only the numbers worth showing: no "0 WAVES", no chain of one.
    const stats = [
        run.waves > 0 ? plural(run.waves, 'WAVE') : null,
        run.kills > 0 ? `${plural(run.kills, 'PLANE')} DOWN` : null,
        run.bestChain >= 2 ? `CHAIN x${Math.min(5, run.bestChain)}` : null
    ].filter(Boolean).join(' · ');

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
            stats,
            pilot,
            tags,
            board: v ? [{ name: pilot ?? 'ME', score: run.score }, { name: rival!, score: v.score }]
                .sort((a, b) => b.score - a.score) : null,
            host: PLAY_HOST
        }
    };
}

/**
 * The debrief's one line above SHARE: why this run is worth sending, or -
 * when it is not especially - what the friend gets.
 */
export function shareNudge(
    run: Pick<ShareRun, 'isNewBest' | 'versus' | 'score'> & { freshStars: number; /** First best this session. */ bestIsNews?: boolean }
): { text: string; strong: boolean } {
    const v = run.versus ?? null;
    if (v && run.score > v.score) {
        return { text: v.name ? `YOU BEAT ${v.name.toUpperCase()} - LET ${v.name.toUpperCase()} KNOW` : 'CHALLENGE BEATEN - REPLY WITH YOUR SCORE', strong: true };
    }
    if (run.freshStars > 0) return { text: `NEW STAR${run.freshStars === 1 ? '' : 'S'} - SHOW YOUR FRIENDS`, strong: true };
    // Early on nearly every run is a best; lighting SHARE for each one is a
    // nag. Once a session, then it is just a line.
    if (run.isNewBest) return { text: 'NEW PERSONAL BEST - SHOW YOUR FRIENDS', strong: run.bestIsNews !== false };
    return { text: 'SHARE: YOUR FRIEND GETS THE SAME PLANES', strong: false };
}
