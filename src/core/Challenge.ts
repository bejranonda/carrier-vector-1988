/**
 * CARRIER VECTOR: 1988 - Challenge links
 *
 * A pasted card that says "12,400 PTS" is a boast. A pasted card whose link
 * opens the game on *the same waves* with "beat 12,400" on the briefing is a
 * challenge - and a challenge is the strongest reason a friend has to click.
 * SCRAMBLE's waves are a pure function of (wave, seed), so a whole run fits in
 * a query string, and no server is needed: this project has no backend by
 * policy, and this does not need one.
 *
 * Format: `?c=<seed>.<score>.<waves>`, all non-negative integers, with `.e`
 * appended when the run was flown on EASY (v2.2.0) - EASY's extra jets and
 * wider missile cone make its scores easier to reach, and whoever opens the
 * link deserves to know. Anything else is ignored rather than trusted; links
 * made before v2.2.0 have no suffix and still open.
 *
 * v2.3.0 adds `#n=<name>`: the challenger's name, as they typed it. "Anna
 * challenges you" is an invitation from a person; "a challenge" is a link
 * from nobody. It rides in the fragment, after `#`, which browsers never send
 * to a server - so a name never lands in a host's logs or a link-preview
 * fetch. It is cleaned on the way in and on the way out (`cleanPilotName`),
 * and a link without one still opens.
 */

export interface Challenge {
    seed: number;
    score: number;
    waves: number;
    /** The challenger flew EASY. */
    easy?: boolean;
    /** The challenger's name, already cleaned (v2.3.0). */
    name?: string;
}

const MAX_SEED = 2 ** 31 - 1;

/** Longest pilot name kept, in characters. Fits a card line at any size. */
export const MAX_PILOT_NAME = 16;

/**
 * Letters that print as nothing - the Hangul fillers, the classic "blank
 * name" - or that pass for a dot, a slash or a colon ("paypalꓸcom"): with
 * them a link could still show a friend an address, or no one at all, as
 * "X challenges you" (v2.3.0 review).
 */
const LOOKALIKES = /[\u115F\u1160\u3164\uFFA0\uA4F8-\uA4FB\u1427\u141F\u1420\u02D0\u02D1\u0971]/gu;
/** Accents one letter may carry: enough for Thai or Tibetan, not a tower. */
const MAX_MARKS = 4;
const TOWER = new RegExp(`(\\p{M}{${MAX_MARKS}})\\p{M}+`, 'gu');

/**
 * A name fit to print on someone else's screen. Letters and combining marks
 * of any script (a Thai or a Greek name is a name), digits, spaces, hyphens
 * and apostrophes - and nothing else: no dots, slashes or colons (nor
 * letters that look like them), so a link can never put a web address in
 * front of a friend as "X challenges you", and no markup. Every kind of
 * space is a space, and runs of them are one; the result is cut to
 * MAX_PILOT_NAME characters, a letter keeping its accents. Null when
 * nothing is left.
 */
export function cleanPilotName(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const kept = raw.normalize('NFC')
        // A tab, a no-break space, the wide Japanese space: all spaces.
        .replace(/\s+/gu, ' ')
        .replace(LOOKALIKES, '')
        .replace(/[^\p{L}\p{M}\p{N} '’-]/gu, '')
        // Accents belong to a letter: none on their own, never a tower.
        .replace(/(^|[ '’-])\p{M}+/gu, '$1')
        .replace(TOWER, '$1')
        .replace(/ {2,}/g, ' ')
        .trim();
    const chars = Array.from(kept);
    let end = Math.min(chars.length, MAX_PILOT_NAME);
    while (end < chars.length && /\p{M}/u.test(chars[end])) end++;
    const cut = chars.slice(0, end).join('').trim();
    // A name needs at least one letter or digit: "-'-" is not a name.
    return /[\p{L}\p{N}]/u.test(cut) ? cut : null;
}

/** Read a challenge from a page's `location.search` and `location.hash`. */
export function parseChallenge(search: string, hash = ''): Challenge | null {
    let params: URLSearchParams;
    let fragment: URLSearchParams;
    try {
        params = new URLSearchParams(search);
        fragment = new URLSearchParams(hash.replace(/^#/, ''));
    } catch {
        return null;
    }
    const raw = params.get('c');
    if (!raw) return null;
    const m = /^(\d{1,10})\.(\d{1,8})\.(\d{1,3})(\.e)?$/.exec(raw.trim());
    if (!m) return null;
    const [seed, score, waves] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (seed > MAX_SEED) return null;
    const c: Challenge = { seed, score, waves };
    if (m[4]) c.easy = true;
    const name = cleanPilotName(fragment.get('n') ?? params.get('n'));
    if (name) c.name = name;
    return c;
}

export function challengeUrl(base: string, c: Challenge): string {
    const seed = Math.max(0, Math.min(MAX_SEED, Math.floor(c.seed)));
    const score = Math.max(0, Math.min(99_999_999, Math.floor(c.score)));
    const waves = Math.max(0, Math.min(999, Math.floor(c.waves)));
    const name = cleanPilotName(c.name);
    // An apostrophe is encoded too: a chat app's link finder can stop at
    // one, and "O'Brien" would arrive as "O".
    const tag = name ? `#n=${encodeURIComponent(name).replace(/'/g, '%27')}` : '';
    return `${base}/?c=${seed}.${score}.${waves}${c.easy ? '.e' : ''}${tag}`;
}

/** Who sent it, for a headline: the name, or "A FRIEND". */
export function challengerLabel(c: Pick<Challenge, 'name'>): string {
    return c.name ? c.name.toUpperCase() : 'A FRIEND';
}

/** The briefing's line for an incoming challenge. */
export function challengeLine(c: Challenge): string {
    const from = c.name ? ` FROM ${challengerLabel(c)}` : '';
    return `CHALLENGE${from} · BEAT ${c.score.toLocaleString('en-US')} PTS (${c.waves} WAVE${c.waves === 1 ? '' : 'S'}) ON THE SAME WAVES${c.easy ? ' · FLOWN ON EASY' : ''}`;
}

/**
 * The debrief's verdict on a challenge run. When the two runs were flown on
 * different styles the verdict says so, whichever way round.
 */
export function challengeVerdict(c: Challenge, score: number, flownEasy = false): string {
    const styles = Boolean(c.easy) === flownEasy ? ''
        : flownEasy ? ' (you flew EASY)' : ' (they flew EASY)';
    const by = (n: number) => `${n.toLocaleString('en-US')} pts`;
    // With a name the verdict is about a person; without one, the old wording.
    const who = c.name ? challengerLabel(c) : null;
    if (score > c.score) {
        return who ? `YOU BEAT ${who} by ${by(score - c.score)}${styles}!` : `CHALLENGE BEATEN by ${by(score - c.score)}${styles}.`;
    }
    if (score === c.score) return who ? `TIED WITH ${who} - to the point${styles}.` : `CHALLENGE TIED - to the point${styles}.`;
    return who ? `${by(c.score - score)} short of ${who}${styles}. FLY AGAIN - same waves.`
        : `CHALLENGE: ${by(c.score - score)} short${styles}. FLY AGAIN - same waves.`;
}
