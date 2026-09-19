/**
 * CARRIER VECTOR: 1988 - Per-Mission Records
 *
 * There was exactly one number carried between sessions: a single global best
 * score. With five scenarios of wildly different length and scoring that
 * number is close to meaningless - a good canyon strike can never approach a
 * long endless carrier defence, so the strike missions had no scoreboard of
 * their own and no record that you had ever beaten them. The selector could
 * not tell you which missions you had cleared, and the debrief could not tell
 * you whether this run was your best attempt at THIS mission.
 *
 * So: one record per scenario, {best, completions, attempts}. That is enough
 * for a tick on the selector pill, a personal best per mission, and the one
 * piece of information a returning player actually wants, which is "what have
 * I not beaten yet".
 *
 * The merge logic is pure and tested. Storage is best-effort: it can throw in
 * private-mode Safari or with site data blocked, and the game must still boot
 * and still play - it just forgets.
 */

export interface MissionRecord {
    /** Best score on this scenario. */
    best: number;
    /** How many times it has been completed successfully. */
    completions: number;
    /** How many times it has been flown to an end, win or lose. */
    attempts: number;
}

export type MissionRecords = Record<string, MissionRecord>;

const STORAGE_KEY = 'carrier-vector-1988.missionRecords';

export const EMPTY_RECORD: MissionRecord = { best: 0, completions: 0, attempts: 0 };

/** One scenario's record, or a zeroed one - callers never handle undefined. */
export function recordFor(records: MissionRecords, id: string): MissionRecord {
    return records[id] ?? EMPTY_RECORD;
}

export function isCleared(records: MissionRecords, id: string): boolean {
    return recordFor(records, id).completions > 0;
}

/**
 * Fold a finished run into the record set. Pure: returns a new set rather than
 * mutating, and reports whether this run was a personal best on this scenario
 * so the debrief can say so.
 *
 * A failed run still counts as an attempt and can still set a best score -
 * losing on wave nine after a hundred thousand points is an achievement, and
 * pretending otherwise would make the number a lie.
 */
export function mergeMissionResult(
    records: MissionRecords,
    id: string,
    score: number,
    completed: boolean
): { records: MissionRecords; record: MissionRecord; isNewBest: boolean } {
    const previous = recordFor(records, id);
    const clean = Number.isFinite(score) ? Math.floor(score) : 0;
    const isNewBest = clean > previous.best;

    const record: MissionRecord = {
        best: isNewBest ? clean : previous.best,
        completions: previous.completions + (completed ? 1 : 0),
        attempts: previous.attempts + 1
    };

    return { records: { ...records, [id]: record }, record, isNewBest };
}

function sanitise(raw: unknown): MissionRecords {
    if (typeof raw !== 'object' || raw === null) return {};
    const out: MissionRecords = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value !== 'object' || value === null) continue;
        const v = value as Record<string, unknown>;
        const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
        out[id] = {
            best: num(v.best),
            completions: num(v.completions),
            attempts: num(v.attempts)
        };
    }
    return out;
}

export function loadMissionRecords(): MissionRecords {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return {};
        return sanitise(JSON.parse(raw));
    } catch {
        // Corrupt or unavailable: start clean rather than refusing to boot.
        return {};
    }
}

export function saveMissionRecords(records: MissionRecords) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
        // The figures still hold for this session.
    }
}
