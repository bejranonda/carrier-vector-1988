/**
 * CARRIER VECTOR: 1988 - "Does the stick feel backwards?"
 *
 * WHY THIS EXISTS (Known Issues #40, #48)
 * Arrow-up climbs by default. A player with flight-sim habits expects it to
 * DIVE, and the stick flip on [I] only helps a player who knows it exists. The
 * briefing offers it once, before the first flight - but the moment the player
 * actually discovers the problem is in the air, fighting the jet: press, the
 * nose goes the wrong way, stab the other key, over and over.
 *
 * That pattern is detectable: several short pitch presses in alternating
 * directions inside a short window. When it happens - and the player has never
 * touched the stick setting - offer the flip once, in context, where it can be
 * taken with one key.
 *
 * Pure: fed the pilot's pitch demand every fixed step, it answers one question.
 */

export const STRUGGLE_TUNING = {
    /** A press shorter than this, reversed, counts as a stab. */
    shortPressSeconds: 0.6,
    /** Stabs needed within the window. */
    reversals: 4,
    windowSeconds: 12
} as const;

export class PitchStruggleDetector {
    private lastSign = 0;
    private pressSeconds = 0;
    private elapsed = 0;
    private stabs: number[] = [];
    private offered = false;

    /**
     * Feed the pilot's pitch demand (-1..1) for one step. Returns true exactly
     * once: the step on which the struggle pattern completes.
     */
    public update(pitchInput: number, dt: number): boolean {
        this.elapsed += dt;
        if (this.offered) return false;

        const sign = pitchInput > 0.2 ? 1 : pitchInput < -0.2 ? -1 : 0;
        if (sign !== 0 && sign === this.lastSign) {
            this.pressSeconds += dt;
            return false;
        }
        if (sign !== 0 && this.lastSign !== 0 && sign === -this.lastSign
            && this.pressSeconds < STRUGGLE_TUNING.shortPressSeconds) {
            this.stabs.push(this.elapsed);
        }
        if (sign !== 0) {
            this.lastSign = sign;
            this.pressSeconds = 0;
        } else {
            // A release keeps the direction, so press-release-press-other-way
            // still reads as a reversal - that is exactly how a key is stabbed.
            this.pressSeconds += dt;
        }

        const since = this.elapsed - STRUGGLE_TUNING.windowSeconds;
        this.stabs = this.stabs.filter(t => t >= since);
        if (this.stabs.length >= STRUGGLE_TUNING.reversals) {
            this.offered = true;
            return true;
        }
        return false;
    }

    /** Has the offer already been made this session? */
    public get hasOffered(): boolean {
        return this.offered;
    }
}
