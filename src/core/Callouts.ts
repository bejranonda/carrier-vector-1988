/**
 * CARRIER VECTOR: 1988 - Kill Callouts
 *
 * Killing something produced an explosion, a score delta, and a line in a log
 * panel the player is not looking at because they are busy flying. The single
 * most satisfying thing that can happen in the game had no moment.
 *
 * A callout is that moment: one short line, centred, held for a beat, then
 * gone. SPLASH ONE. SAM DOWN. 3-WIRE. It is deliberately not the coach
 * ticker (which answers "what is about to kill me") and not the objective
 * strip (which answers "what am I here for") - this channel answers "that
 * worked", and nothing else is allowed into it.
 *
 * Pure: a queue with lifetimes, no canvas. Rendering reads `active()`.
 */

/**
 * `MODE` is the one exception to "this channel answers 'that worked'": a
 * system the player just toggled with a key has to confirm itself somewhere,
 * and a mode change that produces no acknowledgement reads as a dead key. It
 * is rendered in the neutral label colour rather than the instrument green, so
 * it cannot be mistaken for a kill.
 */
export type CalloutTone = 'KILL' | 'PRAISE' | 'LOSS' | 'MODE';

export interface Callout {
    text: string;
    /** Optional second line, smaller - the target's name, the wire number. */
    detail?: string;
    tone: CalloutTone;
    /** Seconds remaining. */
    life: number;
    /** Seconds it started with, so the renderer can fade and scale it. */
    span: number;
}

export const CALLOUT_TUNING = {
    /** How long a callout holds the middle of the screen. */
    defaultSeconds: 1.6,
    /**
     * Only ever three on screen. A furball can produce six kills in as many
     * seconds, and a stack of six banners is worse than none.
     */
    maxVisible: 3
} as const;

export class Callouts {
    private queue: Callout[] = [];

    public push(text: string, tone: CalloutTone = 'KILL', detail?: string, seconds: number = CALLOUT_TUNING.defaultSeconds) {
        this.queue.unshift({ text, detail, tone, life: seconds, span: seconds });
        if (this.queue.length > CALLOUT_TUNING.maxVisible) {
            this.queue.length = CALLOUT_TUNING.maxVisible;
        }
    }

    public update(dt: number) {
        for (const c of this.queue) c.life -= dt;
        this.queue = this.queue.filter(c => c.life > 0);
    }

    /** Newest first, so the renderer can stack them downward from the anchor. */
    public active(): readonly Callout[] {
        return this.queue;
    }

    public clear() {
        this.queue.length = 0;
    }
}

/** "MiG-23 FLOGGER #2" -> "SPLASH ONE — MiG-23". */
export function splashLine(index: number): string {
    const words = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    return `SPLASH ${words[Math.min(words.length, Math.max(1, index)) - 1]}`;
}
