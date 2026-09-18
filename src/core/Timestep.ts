/**
 * CARRIER VECTOR: 1988 - Fixed-Timestep Accumulator
 *
 * The original bridge loop advanced physics with the raw, clamped
 * requestAnimationFrame delta, so simulation results were frame-rate
 * dependent (a fast machine and a slow machine flew subtly different
 * flight models). This accumulator decouples simulation from render rate:
 * the render loop feeds in wall-clock elapsed time, and this class reports
 * how many fixed-size physics substeps to run, carrying any remainder
 * forward to the next frame.
 */

export const FIXED_DT = 1 / 120; // seconds per physics substep (120Hz)

export class FixedTimestepAccumulator {
    private accumulator = 0;
    public readonly fixedDt: number;
    public readonly maxSubsteps: number;

    constructor(fixedDt: number = FIXED_DT, maxSubsteps: number = 8) {
        this.fixedDt = fixedDt;
        this.maxSubsteps = maxSubsteps;
    }

    /**
     * Feed in the elapsed wall-clock time (seconds) since the previous
     * frame. Returns the number of fixed substeps to run this frame. Any
     * fractional remainder below one fixedDt is carried over to the next
     * call rather than dropped.
     *
     * If the elapsed time would require more than maxSubsteps this frame
     * (e.g. after a tab was backgrounded), the accumulator is clamped and
     * the excess wall-clock time is discarded — a "spiral of death" guard
     * so the simulation doesn't try to catch up by running hundreds of
     * substeps in one frame.
     */
    public consume(elapsedSeconds: number): number {
        if (elapsedSeconds < 0 || !Number.isFinite(elapsedSeconds)) return 0;

        this.accumulator += elapsedSeconds;

        const maxAccumulated = this.maxSubsteps * this.fixedDt;
        if (this.accumulator > maxAccumulated) {
            this.accumulator = maxAccumulated;
        }

        let steps = 0;
        while (this.accumulator >= this.fixedDt && steps < this.maxSubsteps) {
            this.accumulator -= this.fixedDt;
            steps++;
        }
        return steps;
    }

    public reset() {
        this.accumulator = 0;
    }
}
