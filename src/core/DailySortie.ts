/**
 * CARRIER VECTOR: 1988 - The Daily Sortie
 *
 * WHY THIS EXISTS
 * Nothing ever left the tab. A player could fly a superb sortie, reach
 * COMMANDER, hold the boat through nine waves - and then have no way to say so
 * except by describing it. A browser game with no artifact to share is a game
 * nobody hears about, however good it is.
 *
 * So: one run a day that everybody gets the same version of. The wave director
 * is already a seeded `mulberry32`, so an identical campaign for every player
 * costs exactly one number - the date - and the result is a text card that
 * pastes anywhere.
 *
 * Deliberate design choices, both arguable:
 *
 *  - Unlimited attempts. Locking the day to one try punishes precisely the
 *    person who has just discovered the game and wants another go. The card
 *    states which attempt it was, so sharing stays honest without being
 *    punitive.
 *  - The card is plain text with a handful of symbols, not an image. Text
 *    survives being pasted into a chat window, a forum, a commit message and a
 *    phone keyboard; a canvas PNG survives none of those without a download.
 *
 * Pure date maths and formatting, plus best-effort storage. No canvas, no
 * subsystem imports - so the seed's stability and the card's shape are
 * testable.
 */

export interface DailyResult {
    /** ISO date key, YYYY-MM-DD. */
    date: string;
    /** Best score across today's attempts. */
    score: number;
    rank: string;
    wave: number;
    fighterKills: number;
    bomberKills: number;
    samKills: number;
    traps: number;
    perfectTraps: number;
    hullRemaining: number;
    attempts: number;
    /** Whether the best run completed the mission objective. */
    completed: boolean;
}

export type DailyResults = Record<string, DailyResult>;

/** The day the daily sortie started counting. Sortie #1. */
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

/** YYYY-MM-DD in UTC, so the day rolls over at the same instant everywhere. */
export function dailyKey(date: Date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

/**
 * The PRNG seed for a given day: YYYYMMDD as an integer. Stable, obvious from
 * the date alone, and different enough day to day that consecutive campaigns
 * do not resemble each other.
 */
export function dailySeed(date: Date = new Date()): number {
    return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

/** Human-facing sortie number, counting from the epoch. */
export function dailyNumber(date: Date = new Date()): number {
    const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.max(1, Math.floor((midnight - EPOCH) / DAY_MS) + 1);
}

/**
 * Fold a finished run into today's record. Keeps the best score, counts every
 * attempt, and carries the breakdown from whichever attempt scored highest -
 * a card must describe one coherent run, not a mix of your best bits.
 */
export function mergeDailyResult(
    results: DailyResults,
    result: Omit<DailyResult, 'attempts'>
): { results: DailyResults; today: DailyResult; isBest: boolean } {
    const previous = results[result.date];
    const attempts = (previous?.attempts ?? 0) + 1;
    const isBest = !previous || result.score > previous.score;
    const today: DailyResult = isBest
        ? { ...result, attempts }
        : { ...previous, attempts };

    return { results: { ...results, [result.date]: today }, today, isBest };
}

const repeat = (glyph: string, n: number, cap = 8) => glyph.repeat(Math.max(0, Math.min(cap, n)));

/**
 * The shareable card. Kept to four short lines: anything longer gets truncated
 * by the places people paste it.
 */
export function formatShareCard(result: DailyResult, url = 'carrier-vector-1988'): string {
    const kills = result.fighterKills + result.bomberKills;
    // Geometric Shapes rather than emoji: an aircraft glyph is missing from
    // most monospace faces, including the game's own, where it rendered as a
    // stray arrow. These three exist everywhere and still read as a score
    // grid when the card is pasted somewhere else.
    const marks = [
        repeat('●', kills),
        repeat('◆', result.samKills),
        repeat('▲', result.traps)
    ].filter(Boolean).join(' ');

    const detail = [
        `${kills} splashed`,
        result.samKills > 0 ? `${result.samKills} SAM` : '',
        result.traps > 0
            ? `${result.traps} trap${result.traps === 1 ? '' : 's'}${result.perfectTraps > 0 ? ` (${result.perfectTraps} perfect)` : ''}`
            : 'no trap',
        `hull ${Math.round(result.hullRemaining)}%`
    ].filter(Boolean).join(' · ');

    return [
        `CARRIER VECTOR: 1988 — DAILY SORTIE #${dailyNumber(new Date(`${result.date}T00:00:00Z`))}`,
        `WAVE ${result.wave} · ${result.score.toLocaleString('en-US')} PTS · ${result.rank}`,
        `${marks ? marks + '  ' : ''}${detail}`,
        `attempt ${result.attempts} · ${url}`
    ].join('\n');
}

const STORAGE_KEY = 'carrier-vector-1988.daily';

function sanitise(raw: unknown): DailyResults {
    if (typeof raw !== 'object' || raw === null) return {};
    const out: DailyResults = {};
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value !== 'object' || value === null) continue;
        const v = value as Record<string, unknown>;
        out[date] = {
            date,
            score: num(v.score),
            rank: typeof v.rank === 'string' ? v.rank : 'NUGGET',
            wave: num(v.wave),
            fighterKills: num(v.fighterKills),
            bomberKills: num(v.bomberKills),
            samKills: num(v.samKills),
            traps: num(v.traps),
            perfectTraps: num(v.perfectTraps),
            hullRemaining: num(v.hullRemaining),
            attempts: num(v.attempts),
            completed: v.completed === true
        };
    }
    return out;
}

export function loadDailyResults(): DailyResults {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return {};
        return sanitise(JSON.parse(raw));
    } catch {
        return {};
    }
}

export function saveDailyResults(results: DailyResults) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch {
        // The card still shows for this session.
    }
}
