import { describe, it, expect } from 'vitest';
import { FixedTimestepAccumulator, FIXED_DT } from './Timestep';

describe('FixedTimestepAccumulator', () => {
    it('produces exactly one substep for one fixedDt of elapsed time', () => {
        const acc = new FixedTimestepAccumulator();
        expect(acc.consume(FIXED_DT)).toBe(1);
    });

    it('carries over a sub-fixedDt remainder across calls instead of dropping it', () => {
        const acc = new FixedTimestepAccumulator();
        const half = FIXED_DT / 2;
        expect(acc.consume(half)).toBe(0);
        expect(acc.consume(half)).toBe(1); // remainder + half = one full step
    });

    it('produces multiple substeps for a large elapsed time', () => {
        const acc = new FixedTimestepAccumulator();
        expect(acc.consume(FIXED_DT * 3.5)).toBe(3);
    });

    it('clamps substeps at maxSubsteps to avoid the spiral of death', () => {
        const acc = new FixedTimestepAccumulator(FIXED_DT, 5);
        expect(acc.consume(FIXED_DT * 100)).toBe(5);
    });

    it('discards clamped excess instead of queuing it for future frames', () => {
        const acc = new FixedTimestepAccumulator(FIXED_DT, 5);
        acc.consume(FIXED_DT * 100); // clamps, excess discarded
        expect(acc.consume(0)).toBe(0); // no leftover steps immediately after
    });

    it('ignores negative or non-finite elapsed time defensively', () => {
        const acc = new FixedTimestepAccumulator();
        expect(acc.consume(-1)).toBe(0);
        expect(acc.consume(NaN)).toBe(0);
        expect(acc.consume(Infinity)).toBe(0);
    });

    it('reset() clears any carried-over remainder', () => {
        const acc = new FixedTimestepAccumulator();
        acc.consume(FIXED_DT * 0.9);
        acc.reset();
        expect(acc.consume(FIXED_DT * 0.9)).toBe(0);
    });
});
