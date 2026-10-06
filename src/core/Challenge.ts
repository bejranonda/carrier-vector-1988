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
 * Format: `?c=<seed>.<score>.<waves>`, all non-negative integers. Anything
 * else is ignored rather than trusted.
 */

export interface Challenge {
    seed: number;
    score: number;
    waves: number;
}

const MAX_SEED = 2 ** 31 - 1;

export function parseChallenge(search: string): Challenge | null {
    let raw: string | null = null;
    try {
        raw = new URLSearchParams(search).get('c');
    } catch {
        return null;
    }
    if (!raw) return null;
    const m = /^(\d{1,10})\.(\d{1,8})\.(\d{1,3})$/.exec(raw.trim());
    if (!m) return null;
    const [seed, score, waves] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (seed > MAX_SEED) return null;
    return { seed, score, waves };
}

export function challengeUrl(base: string, c: Challenge): string {
    const seed = Math.max(0, Math.min(MAX_SEED, Math.floor(c.seed)));
    const score = Math.max(0, Math.min(99_999_999, Math.floor(c.score)));
    const waves = Math.max(0, Math.min(999, Math.floor(c.waves)));
    return `${base}/?c=${seed}.${score}.${waves}`;
}

/** The briefing's line for an incoming challenge. */
export function challengeLine(c: Challenge): string {
    return `CHALLENGE · BEAT ${c.score.toLocaleString('en-US')} PTS (${c.waves} WAVE${c.waves === 1 ? '' : 'S'}) ON THE SAME WAVES`;
}

/** The debrief's verdict on a challenge run. */
export function challengeVerdict(c: Challenge, score: number): string {
    if (score > c.score) return `CHALLENGE BEATEN by ${(score - c.score).toLocaleString('en-US')} pts.`;
    if (score === c.score) return 'CHALLENGE TIED - to the point.';
    return `CHALLENGE: ${(c.score - score).toLocaleString('en-US')} pts short. FLY AGAIN - same waves.`;
}
