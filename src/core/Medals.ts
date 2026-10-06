/**
 * CARRIER VECTOR: 1988 - Mission Medals (three stars per mission)
 *
 * WHY THIS EXISTS
 * A mission had two states: not cleared, and cleared. Once a pilot had a tick
 * on a pill there was nothing left to want from it except a bigger number,
 * and a bigger number with no target attached is a weak reason to fly again.
 *
 * Three named stars per mission turn "again?" into a specific goal - "clear
 * wave 10", "no jet lost", "two 3-wires" - shown on the selector before the
 * run and paid out one by one on the debrief. Each star is earned on its own,
 * so a pilot who never finishes the canyon strike can still chase the one
 * star they can reach. Stars are also the currency the cosmetic unlocks are
 * priced in (Career.ts), which is what makes a star on an easy mission worth
 * going back for.
 *
 * Pure criteria and merging; storage is best effort, like every other record.
 */

import type { ScenarioId } from './Scenarios';

/** Everything a star is allowed to look at, gathered once at the end of a run. */
export interface RunSummary {
    completed: boolean;
    score: number;
    /** SCRAMBLE: waves cleared. CARRIER_DEFENSE: the deck wave reached. */
    waves: number;
    airframesLost: number;
    traps: number;
    perfectTraps: number;
    bestChain: number;
    /** Carrier hull left, percent. */
    hull: number;
    /** Scenario seconds the run lasted. */
    seconds: number;
}

export interface StarCriterion {
    /** Shown on the selector and the debrief: short, concrete, checkable. */
    label: string;
    test: (r: RunSummary) => boolean;
}

const complete: StarCriterion = { label: 'COMPLETE THE MISSION', test: r => r.completed };
const noLoss: StarCriterion = { label: 'COMPLETE WITHOUT LOSING A JET', test: r => r.completed && r.airframesLost === 0 };
const threeWire: StarCriterion = { label: 'COMPLETE WITH A 3-WIRE TRAP', test: r => r.completed && r.perfectTraps > 0 };

export const MEDALS: Record<ScenarioId, [StarCriterion, StarCriterion, StarCriterion]> = {
    SCRAMBLE: [
        { label: 'CLEAR WAVE 5', test: r => r.waves >= 5 },
        { label: 'SCORE 8,000 IN ONE RUN', test: r => r.score >= 8000 },
        { label: 'CLEAR WAVE 10', test: r => r.waves >= 10 }
    ],
    CARRIER_DEFENSE: [
        { label: 'REACH WAVE 3', test: r => r.waves >= 3 },
        { label: 'SCORE 5,000 IN ONE RUN', test: r => r.score >= 5000 },
        { label: 'REACH WAVE 6', test: r => r.waves >= 6 }
    ],
    CANYON_STRIKE: [complete, noLoss, threeWire],
    IRON_HAND: [complete, noLoss, threeWire],
    LAST_STAND: [
        complete,
        { label: 'COMPLETE WITH 40% HULL LEFT', test: r => r.completed && r.hull >= 40 },
        noLoss
    ],
    CARRIER_QUALS: [
        complete,
        { label: 'LOG TWO 3-WIRE TRAPS', test: r => r.perfectTraps >= 2 },
        { label: 'LOG THREE 3-WIRE TRAPS', test: r => r.perfectTraps >= 3 }
    ],
    TRAINING_SORTIE: [
        complete,
        threeWire,
        { label: 'COMPLETE IN UNDER 4 MINUTES', test: r => r.completed && r.seconds < 240 }
    ]
};

/** Stars this run earned, as a 3-bit mask (bit i = star i). */
export function earnedMask(id: ScenarioId, run: RunSummary): number {
    const criteria = MEDALS[id];
    if (!criteria) return 0;
    return criteria.reduce((mask, c, i) => (c.test(run) ? mask | (1 << i) : mask), 0);
}

export function starCount(mask: number): number {
    return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

export type MedalRecords = Partial<Record<ScenarioId, number>>;

export function totalStars(records: MedalRecords): number {
    return Object.values(records).reduce<number>((n, m) => n + starCount(m ?? 0), 0);
}

/**
 * Fold a run's stars into the record. Stars are only ever gained: a worse run
 * cannot take one away. `fresh` lists the star indices earned for the first
 * time, which is what the debrief celebrates.
 */
export function mergeMedals(
    records: MedalRecords,
    id: ScenarioId,
    mask: number
): { records: MedalRecords; fresh: number[]; mask: number } {
    const before = records[id] ?? 0;
    const after = before | (mask & 0b111);
    const fresh = [0, 1, 2].filter(i => (after & (1 << i)) && !(before & (1 << i)));
    return { records: { ...records, [id]: after }, fresh, mask: after };
}

const STORAGE_KEY = 'carrier-vector-1988.medals';

export function loadMedals(): MedalRecords {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null) return {};
        const out: MedalRecords = {};
        for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (id in MEDALS && typeof v === 'number' && Number.isFinite(v)) {
                out[id as ScenarioId] = Math.max(0, Math.floor(v)) & 0b111;
            }
        }
        return out;
    } catch {
        return {};
    }
}

export function saveMedals(records: MedalRecords) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
        // Best effort; the stars still hold for this session.
    }
}
