/**
 * CARRIER VECTOR: 1988 - Career (XP, levels, unlocks)
 *
 * WHY THIS EXISTS
 * Nothing carried from one run to the next except per-mission best scores. A
 * run that went badly was simply lost - no progress, nothing banked - which
 * is the moment a player closes the tab. Every run now pays career XP (its
 * score, plus a bounty for each new medal star), the XP fills a bar on the
 * debrief, and the bar levels the pilot up through a ladder of titles.
 *
 * The ladder is deliberately NOT the naval rank shown in flight: that one is
 * a per-run score band (ENSIGN... ADMIRAL) and always has been. The career
 * ladder is flight-lead roles (WINGMAN, FLIGHT LEAD, ACE...), so the two can
 * never be read as the same number.
 *
 * Unlocks are priced in medal stars, not XP, so they reward breadth and
 * skill rather than hours. They are cosmetic phosphor palettes - the
 * accessibility palette is never locked.
 */

import type { PaletteId } from '../renderer/Theme';

export const CAREER_TITLES = [
    'NUGGET',
    'WINGMAN',
    'SECTION LEAD',
    'FLIGHT LEAD',
    'DIVISION LEAD',
    'ACE',
    'DOUBLE ACE',
    'SQUADRON CO',
    'AIR WING CDR',
    'LEGEND'
] as const;

export const CAREER_TUNING = {
    /** XP for level n+1 is this times the triangular number of n. */
    levelStep: 1500,
    /** Paid for every run flown to an end, win or lose. */
    perRun: 100,
    /** Paid for every medal star earned for the first time. */
    perNewStar: 400
} as const;

/** Cumulative XP needed to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
    const n = Math.max(1, Math.floor(level)) - 1;
    return (CAREER_TUNING.levelStep * n * (n + 1)) / 2;
}

export interface CareerLevel {
    level: number;
    title: string;
    /** XP earned inside this level. */
    into: number;
    /** XP this level spans. */
    span: number;
}

/** No real career gets near this; a stored value beyond it is corrupt. */
export const MAX_CAREER_XP = 1e12;

export function careerLevel(xp: number): CareerLevel {
    const safe = Math.min(MAX_CAREER_XP, Math.max(0, Number.isFinite(xp) ? xp : 0));
    // Closed form, then nudged for rounding. Stepping up one level at a time
    // froze the briefing on a corrupt save (v2.2.0 review: XP 1e300 never
    // returned) - this is drawn every frame.
    let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * safe) / CAREER_TUNING.levelStep)) / 2));
    while (level > 1 && xpForLevel(level) > safe) level--;
    while (xpForLevel(level + 1) <= safe) level++;
    const base = xpForLevel(level);
    const title = level <= CAREER_TITLES.length
        ? CAREER_TITLES[level - 1]
        : `LEGEND ${'★'.repeat(Math.min(5, level - CAREER_TITLES.length))}`;
    return { level, title, into: safe - base, span: xpForLevel(level + 1) - base };
}

export interface Career {
    xp: number;
    runs: number;
}

export interface XpAward {
    career: Career;
    gained: number;
    before: CareerLevel;
    after: CareerLevel;
    promoted: boolean;
}

export function awardRun(career: Career, score: number, newStars: number): XpAward {
    const gained = Math.round(
        Math.max(0, Number.isFinite(score) ? score : 0)
        + CAREER_TUNING.perRun
        + Math.max(0, newStars) * CAREER_TUNING.perNewStar
    );
    const next: Career = { xp: career.xp + gained, runs: career.runs + 1 };
    const before = careerLevel(career.xp);
    const after = careerLevel(next.xp);
    return { career: next, gained, before, after, promoted: after.level > before.level };
}

export interface Unlock {
    palette: PaletteId;
    label: string;
    stars: number;
}

/** Cosmetic palettes, by the total medal stars they need. */
export const UNLOCKS: readonly Unlock[] = [
    { palette: 'AMBER', label: 'AMBER VECTOR', stars: 3 },
    { palette: 'ARCTIC', label: 'ARCTIC WHITE', stars: 8 },
    { palette: 'SYNTHWAVE', label: 'SYNTHWAVE', stars: 14 }
];

/** Palettes that are never locked: the default and the accessibility one. */
export const ALWAYS_AVAILABLE: readonly PaletteId[] = ['CLASSIC', 'DEUTERAN'];

export function isPaletteUnlocked(id: PaletteId, stars: number): boolean {
    if (ALWAYS_AVAILABLE.includes(id)) return true;
    const u = UNLOCKS.find(x => x.palette === id);
    return u ? stars >= u.stars : false;
}

/** Unlocks crossed by going from `before` to `after` total stars. */
export function newlyUnlocked(before: number, after: number): Unlock[] {
    return UNLOCKS.filter(u => before < u.stars && after >= u.stars);
}

/** The next unlock still ahead, for the "N more stars" teaser. */
export function nextUnlock(stars: number): Unlock | null {
    return UNLOCKS.find(u => stars < u.stars) ?? null;
}

const STORAGE_KEY = 'carrier-vector-1988.career';

export function loadCareer(): Career {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return { xp: 0, runs: 0 };
        const v = JSON.parse(raw) as Record<string, unknown>;
        const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0
            ? Math.min(MAX_CAREER_XP, Math.floor(x)) : 0);
        return { xp: num(v?.xp), runs: num(v?.runs) };
    } catch {
        return { xp: 0, runs: 0 };
    }
}

export function saveCareer(career: Career) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(career));
    } catch {
        // Best effort.
    }
}
