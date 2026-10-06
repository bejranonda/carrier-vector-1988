/**
 * CARRIER VECTOR: 1988 - SCRAMBLE (arcade score attack)
 *
 * WHY THIS EXISTS
 * Every road into a fight went through a menu, a deck screen, a catapult
 * animation and - for a brand-new pilot - a four-minute guided flight whose
 * first two orders were "climb to 2,500 ft" and "engage the autopilot". The
 * v2.0.0 review measured the first kill there at 13.9 s for a scripted pilot
 * obeying every order instantly - after four distinct instructions, before any
 * human reading time. Arcade hits put the player in the action within seconds
 * and teach by escalating, not by lecturing.
 *
 * SCRAMBLE is that road: airborne over the fjord on the first frame, a bomber
 * already locked dead ahead, SPACE to fire. Each wave is a lesson in disguise:
 *
 *   1  one bomber dead ahead, auto-locked        -> "press SPACE"
 *   2  two bombers either side                   -> "turn toward them"
 *   3  two fighters that shoot back              -> "keep turning"
 *   4  a bomber with an escort                   -> "pick the bomber"
 *   5  bandits from behind                       -> "check six"
 *   6+ escalating mixed waves from every bearing
 *
 * Clearing a wave rearms and patches the jet and pays a bonus that is bigger
 * the faster the wave went down. Three jets; bombers that reach the boat hurt
 * it. The run ends when the jets or the carrier are gone, and the score - with
 * its kill chains - is the thing you came back to beat.
 *
 * Pure: wave composition, bonuses and rearm amounts only. GameLoop turns the
 * specs into contacts and owns the clock.
 */

import type { AircraftLoadout } from '../flight/AircraftPhysics';

export const SCRAMBLE = {
    /** Jets per run. */
    lives: 3,
    /** Waves cleared that count the run as "completed" (first medal star). */
    clearWave: 5,
    /** Seconds before wave 1, and between waves. */
    firstWaveDelay: 1.0,
    breatherSeconds: 3.2,
    /** Wave-clear bonus: this per wave number... */
    waveBonusPerWave: 150,
    /** ...plus this per second under par... */
    speedBonusPerSecond: 15,
    /** ...where par is this many seconds. */
    parSeconds: 30,
    /** Carrier hull lost to a bomber that reaches the boat, percent. */
    bomberHullDamage: 15,
    /** Horizontal distance from the boat at which a bomber is "on top", m. */
    bomberStrikeRadius: 650,
    /** Airframe damage patched on each wave clear, percent points. */
    repairPerWave: 35,
    /** The magazine never exceeds these. */
    maxSidewinders: 6,
    maxChaff: 16,
    vulcanAmmo: 600,
    /** Hard cap on contacts in one wave, for readability and frame time. */
    maxContacts: 9,
    /**
     * A wave still alive after this long bugs out. A run must never stall on
     * one contact the pilot cannot find or catch.
     */
    waveTimeoutSeconds: 75
} as const;

/** What the jet launches with. Missiles first - a beginner's first shot should land. */
export const SCRAMBLE_LOADOUT: AircraftLoadout = {
    vulcanAmmo: SCRAMBLE.vulcanAmmo,
    sidewinders: 4,
    ironBombs: 0,
    chaff: 12,
    harms: 0
};

export type ScrambleType = 'FIGHTER' | 'BOMBER';

export interface ScrambleSpawn {
    type: ScrambleType;
    /** Bearing relative to the player's nose, degrees, clockwise. */
    bearingDeg: number;
    /** Distance from the player, metres. */
    rangeM: number;
    /** Altitude relative to the player, metres. */
    altOffsetM: number;
    /** A passive contact never opens fire - the first two waves are a gallery. */
    passive: boolean;
}

export interface ScrambleWave {
    wave: number;
    spawns: ScrambleSpawn[];
    /** One line, shown on the wave banner: what is new about this wave. */
    brief: string;
}

const f = (bearingDeg: number, rangeM: number, altOffsetM = 0, passive = false): ScrambleSpawn =>
    ({ type: 'FIGHTER', bearingDeg, rangeM, altOffsetM, passive });
const b = (bearingDeg: number, rangeM: number, altOffsetM = 150, passive = false): ScrambleSpawn =>
    ({ type: 'BOMBER', bearingDeg, rangeM, altOffsetM, passive });

/** The scripted opening: each wave introduces exactly one idea. */
/**
 * Plain words (v2.1.0): no "bandit", no "check six", no "escort". Each brief
 * says what is coming and the one thing to do about it. `easy` is the same
 * line for a pilot whose plane is flying itself - it never asks them to steer.
 */
const OPENING: { spawns: ScrambleSpawn[]; brief: string; easy: string }[] = [
    { spawns: [b(0, 2300, 80, true)], brief: 'ONE BOMBER AHEAD - PRESS SPACE TO FIRE', easy: 'ONE BOMBER AHEAD - PRESS SPACE TO FIRE' },
    { spawns: [b(-32, 2700, 120, true), b(32, 2700, 120, true)], brief: 'TWO BOMBERS - TURN TOWARD THEM WITH A / D', easy: 'TWO BOMBERS - THE PLANE TURNS FOR YOU. FIRE WHEN TOLD' },
    { spawns: [f(-22, 3200), f(22, 3200)], brief: 'FIGHTERS - THEY SHOOT BACK. KEEP TURNING', easy: 'FIGHTERS - THEY SHOOT BACK. KEEP FIRING WHEN TOLD' },
    { spawns: [b(0, 3400, 200), f(-55, 2900), f(55, 2900)], brief: 'A BOMBER WITH GUARDS - SHOOT THE BOMBER FIRST', easy: 'A BOMBER WITH GUARDS - SHOOT THE BOMBER FIRST' },
    { spawns: [f(180, 2600, 50), f(160, 3000), b(-20, 3600, 200), f(20, 3300)], brief: 'ENEMIES BEHIND YOU TOO - KEEP TURNING', easy: 'ENEMIES BEHIND YOU TOO - THE PLANE WILL TURN TO FIGHT' }
];

/** A small deterministic generator so a wave is reproducible from (wave, seed). */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Contacts in an escalation wave (6+): grows by one every two waves, capped. */
export function escalationCount(wave: number): number {
    return Math.min(SCRAMBLE.maxContacts, 4 + Math.floor((wave - 5) / 2));
}

export function scrambleWave(wave: number, seed = 1988, easy = false): ScrambleWave {
    const n = Math.max(1, Math.floor(wave));
    if (n <= OPENING.length) {
        const o = OPENING[n - 1];
        return { wave: n, spawns: o.spawns.map(s => ({ ...s })), brief: easy ? o.easy : o.brief };
    }

    const rng = mulberry32(seed * 7919 + n * 104729);
    const count = escalationCount(n);
    const bombers = Math.max(1, Math.floor(count / 3));
    const spawns: ScrambleSpawn[] = [];
    // Spread the bearings round the clock with jitter, so a wave comes from
    // everywhere rather than as a wall in front of the nose.
    const offset = rng() * 360;
    for (let i = 0; i < count; i++) {
        const bearing = ((offset + (360 / count) * i + (rng() - 0.5) * 40 + 540) % 360) - 180;
        const range = 2800 + rng() * 1600;
        spawns.push(i < bombers
            ? b(bearing, range, 150 + rng() * 150)
            : f(bearing, range, (rng() - 0.5) * 300));
    }
    const ace = n % 5 === 0;
    return {
        wave: n,
        spawns,
        brief: ace
            ? `WAVE ${n} - EVERYTHING THEY HAVE`
            : `${count} ENEMY PLANES - ${bombers} BOMBER${bombers === 1 ? '' : 'S'} GOING FOR YOUR SHIP`
    };
}

/**
 * Fraction of a fighter's connecting bursts that actually land, by wave. The
 * v2.0.0 bot run lost a jet to the very first wave that shot back; the MiGs
 * learn to aim as the run goes on rather than arriving as veterans.
 */
export function fighterAccuracy(wave: number): number {
    if (wave <= 4) return 0.45;
    if (wave <= 7) return 0.7;
    return 1;
}

/** Bonus paid for clearing `wave` in `seconds`. Never negative. */
export function waveClearBonus(wave: number, seconds: number): number {
    const speed = Math.max(0, SCRAMBLE.parSeconds - Math.max(0, seconds)) * SCRAMBLE.speedBonusPerSecond;
    return Math.round(Math.max(1, wave) * SCRAMBLE.waveBonusPerWave + speed);
}

/** The jet after a wave clear: guns full, two more missiles, some chaff, patched. */
export function rearmAfterWave(loadout: AircraftLoadout, damage: number): { loadout: AircraftLoadout; damage: number } {
    return {
        loadout: {
            ...loadout,
            vulcanAmmo: SCRAMBLE.vulcanAmmo,
            sidewinders: Math.min(SCRAMBLE.maxSidewinders, loadout.sidewinders + 2),
            chaff: Math.min(SCRAMBLE.maxChaff, loadout.chaff + 4)
        },
        damage: Math.max(0, damage - SCRAMBLE.repairPerWave)
    };
}

export interface ScrambleCardInput {
    wavesCleared: number;
    score: number;
    /** Stars held on SCRAMBLE after the run, 0-3. */
    stars: number;
    kills: number;
    bestChain: number;
    url: string;
}

/**
 * The brag card for any SCRAMBLE run, daily or not - three short lines that
 * paste anywhere and end with the address of the game. A run with nothing to
 * share is the one a player closes the tab on; a run they can paste is an
 * invitation to someone else.
 */
export function formatScrambleCard(r: ScrambleCardInput): string {
    const stars = '★'.repeat(Math.max(0, Math.min(3, r.stars))) + '☆'.repeat(3 - Math.max(0, Math.min(3, r.stars)));
    const chain = r.bestChain >= 2 ? ` · chain x${Math.min(5, r.bestChain)}` : '';
    return [
        `CARRIER VECTOR: 1988 — SCRAMBLE ${stars}`,
        `${r.wavesCleared} WAVE${r.wavesCleared === 1 ? '' : 'S'} HELD · ${Math.round(r.score).toLocaleString('en-US')} PTS · ${r.kills} splashed${chain}`,
        `beat it: ${r.url}`
    ].join('\n');
}
