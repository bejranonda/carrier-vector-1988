/**
 * CARRIER VECTOR: 1988 - Kill Chains
 *
 * WHY THIS EXISTS
 * Every kill was worth exactly its table value, whenever and however it
 * happened. Four splashes in two seconds scored the same as four kills spread
 * over four minutes, and the screen said so by stacking four identical
 * "SPLASH n" banners on top of each other. The best moment in a dogfight - a
 * pass that takes out a whole flight - had no name and no reward.
 *
 * A chain is that name and that reward: kill again inside the window and the
 * multiplier climbs, the callout escalates (DOUBLE SPLASH, TRIPLE SPLASH...),
 * and the bonus is paid on top of the kill's own value. It is the single
 * oldest "one more go" lever in arcade scoring, and it rewards exactly the
 * aggressive, decisive flying the game wants more of.
 *
 * Pure: no canvas, no audio, no clock of its own. The caller feeds it kills
 * and fixed-step time and reads back what to show.
 */

export const COMBO_TUNING = {
    /** Seconds after a kill in which the next one extends the chain. */
    windowSeconds: 4.5,
    /** The multiplier stops climbing here. */
    maxMultiplier: 5
} as const;

export interface ChainKill {
    /** Kills in the current chain, including this one. 1 = no chain. */
    chain: number;
    /** Score multiplier applied to this kill. */
    multiplier: number;
    /** Points paid on top of the kill's own table value. */
    bonus: number;
    /** The banner line: SPLASH, DOUBLE SPLASH, ... */
    label: string;
}

const NAMES = ['SPLASH', 'DOUBLE SPLASH', 'TRIPLE SPLASH', 'QUAD SPLASH'];

/** The banner for a chain of `n` kills. */
export function chainLabel(n: number): string {
    if (n <= 1) return NAMES[0];
    if (n <= NAMES.length) return NAMES[n - 1];
    return 'ACE STREAK';
}

export function multiplierFor(chain: number): number {
    return Math.max(1, Math.min(COMBO_TUNING.maxMultiplier, Math.floor(chain)));
}

export class ComboTracker {
    /** Kills in the live chain. 0 when no chain is running. */
    public chain = 0;
    /** Seconds left before the live chain lapses. */
    public timer = 0;
    /** Longest chain this run - for the debrief and the medals. */
    public best = 0;

    /**
     * Register a kill worth `baseValue` points and return what it earned.
     * The bonus is `baseValue x (multiplier - 1)`, so a lone kill is paid
     * exactly what it always was and nothing about the score table changes.
     */
    public registerKill(baseValue: number): ChainKill {
        this.chain = this.timer > 0 ? this.chain + 1 : 1;
        this.timer = COMBO_TUNING.windowSeconds;
        this.best = Math.max(this.best, this.chain);
        const multiplier = multiplierFor(this.chain);
        return {
            chain: this.chain,
            multiplier,
            bonus: Math.max(0, Math.round(baseValue * (multiplier - 1))),
            label: chainLabel(this.chain)
        };
    }

    /** Advance the window. Returns true on the tick a chain lapses. */
    public update(dt: number): boolean {
        if (this.timer <= 0) return false;
        this.timer = Math.max(0, this.timer - dt);
        if (this.timer === 0) {
            this.chain = 0;
            return true;
        }
        return false;
    }

    /** 0..1 of the window left, for the HUD meter. 0 when no chain is live. */
    public get fraction(): number {
        return this.chain > 0 ? this.timer / COMBO_TUNING.windowSeconds : 0;
    }

    /** A lost airframe breaks the chain - but never the record. */
    public breakChain() {
        this.chain = 0;
        this.timer = 0;
    }

    public reset() {
        this.breakChain();
        this.best = 0;
    }
}
