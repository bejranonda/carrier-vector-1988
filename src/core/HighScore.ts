/**
 * CARRIER VECTOR: 1988 - Personal Best
 *
 * The debrief showed a score and a rank, then threw them away. With nothing
 * carried between runs there was no reason to fly a second sortie better than
 * the first, which is the whole point of a wave-survival game.
 *
 * Deliberately tiny: one number in localStorage, read at the briefing and
 * written at the debrief. Storage can throw (Safari private mode, blocked
 * third-party storage) and the game must still boot, so every access is
 * best-effort and the pure comparison is separated out for testing.
 */

const STORAGE_KEY = 'carrier-vector-1988.bestScore';

export function loadBestScore(): number {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (raw === null || raw === undefined) return 0;
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch {
        return 0;
    }
}

/**
 * Store `score` if it beats `previous`. Returns the new best and whether this
 * run set it, so the debrief can call out a new record. Pure apart from the
 * write, which is best-effort.
 */
export function recordBestScore(score: number, previous = loadBestScore()): {
    best: number;
    isNewBest: boolean;
} {
    const isNewBest = Number.isFinite(score) && score > previous;
    const best = isNewBest ? Math.floor(score) : previous;
    if (isNewBest) {
        try {
            globalThis.localStorage?.setItem(STORAGE_KEY, String(best));
        } catch {
            // Nothing to do: the figure still shows for this session.
        }
    }
    return { best, isNewBest };
}
