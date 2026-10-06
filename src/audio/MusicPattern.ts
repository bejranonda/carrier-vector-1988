/**
 * CARRIER VECTOR: 1988 - SCRAMBLE soundtrack (pattern)
 *
 * The game had engine, RWR and weapons - and silence underneath. Arcade
 * fliers are carried by their music as much as by their controls; a run
 * without a beat feels like a test flight. This is a small procedural
 * synthwave loop in A minor (i-VI-III-VII, 112 bpm) that layers up with the
 * fight: a kick and bass when bandits are inbound, hats once a wave is live,
 * an arpeggio when the run is hot (a chain going, or wave 5 and beyond).
 *
 * Pure: `musicStep(step, intensity)` says what plays on a sixteenth-note step.
 * `SoundFX` owns the clock and the oscillators, so the arrangement can be
 * tested without an AudioContext.
 */

export const MUSIC_TUNING = {
    bpm: 112,
    /** Steps per bar (sixteenths). */
    stepsPerBar: 16,
    bars: 4
} as const;

export const STEP_SECONDS = 60 / MUSIC_TUNING.bpm / 4;
export const LOOP_STEPS = MUSIC_TUNING.stepsPerBar * MUSIC_TUNING.bars;

export type MusicVoice = 'KICK' | 'BASS' | 'HAT' | 'ARP';

export interface MusicNote {
    voice: MusicVoice;
    /** Hz; 0 for unpitched voices. */
    freq: number;
    /** Seconds. */
    dur: number;
    /** 0..1 relative level inside the music bus. */
    gain: number;
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Chord roots per bar (MIDI): A2, F2, C3, G2. */
const ROOTS = [45, 41, 48, 43];
/** Chord tones above the root, minor/major as the progression needs. */
const CHORDS = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12]];

/** Layer thresholds on the 0..1 intensity scale. */
export const LAYERS = { kick: 0.15, bass: 0.15, hat: 0.4, arp: 0.75 } as const;

export function musicStep(step: number, intensity: number): MusicNote[] {
    const s = ((Math.floor(step) % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
    const bar = Math.floor(s / MUSIC_TUNING.stepsPerBar);
    const inBar = s % MUSIC_TUNING.stepsPerBar;
    const root = ROOTS[bar];
    const notes: MusicNote[] = [];
    if (intensity < LAYERS.kick) return notes;

    if (inBar % 4 === 0) notes.push({ voice: 'KICK', freq: 0, dur: 0.18, gain: 0.9 });
    if (intensity >= LAYERS.bass && inBar % 2 === 0) {
        // Octave-jumping eighths: root, root, octave, root.
        const octave = inBar % 8 === 4 ? 12 : 0;
        notes.push({ voice: 'BASS', freq: midi(root + octave), dur: STEP_SECONDS * 1.8, gain: 0.7 });
    }
    if (intensity >= LAYERS.hat && inBar % 4 === 2) notes.push({ voice: 'HAT', freq: 0, dur: 0.05, gain: 0.5 });
    if (intensity >= LAYERS.arp) {
        const tone = CHORDS[bar][inBar % 4];
        notes.push({ voice: 'ARP', freq: midi(root + 24 + tone), dur: STEP_SECONDS * 0.9, gain: 0.35 });
    }
    return notes;
}

/** How hard the music should play for the state of a SCRAMBLE run. */
export function scrambleIntensity(s: { wave: number; waveLive: boolean; chain: number }): number {
    if (s.wave === 0 && !s.waveLive) return 0.2;
    if (!s.waveLive) return 0.25;
    if (s.chain >= 2 || s.wave >= 5) return 1;
    return 0.55;
}
