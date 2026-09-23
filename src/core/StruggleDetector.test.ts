import { describe, it, expect } from 'vitest';
import { PitchStruggleDetector } from './StruggleDetector';

const DT = 1 / 120;

function feed(d: PitchStruggleDetector, pattern: [number, number][]): boolean {
    let fired = false;
    for (const [input, seconds] of pattern) {
        for (let t = 0; t < seconds; t += DT) fired = d.update(input, DT) || fired;
    }
    return fired;
}

describe('PitchStruggleDetector', () => {
    it('fires on repeated short stabs in alternating directions', () => {
        const d = new PitchStruggleDetector();
        const stab: [number, number][] = [[1, 0.25], [0, 0.1], [-1, 0.25], [0, 0.1]];
        expect(feed(d, [...stab, ...stab, ...stab])).toBe(true);
    });

    it('fires only once', () => {
        const d = new PitchStruggleDetector();
        const stab: [number, number][] = [[1, 0.25], [-1, 0.25]];
        const pattern = Array.from({ length: 6 }, () => stab).flat();
        expect(feed(d, pattern)).toBe(true);
        expect(feed(d, pattern)).toBe(false);
        expect(d.hasOffered).toBe(true);
    });

    it('does not fire on a pilot holding long, deliberate pulls', () => {
        const d = new PitchStruggleDetector();
        const pattern: [number, number][] = [[1, 2], [0, 1], [-1, 1.5], [0, 1], [1, 2], [-1, 2]];
        expect(feed(d, pattern)).toBe(false);
    });

    it('does not fire on occasional corrections spread over time', () => {
        const d = new PitchStruggleDetector();
        const pattern: [number, number][] = [];
        for (let i = 0; i < 6; i++) pattern.push([1, 0.3], [-1, 0.3], [0, 10]);
        expect(feed(d, pattern)).toBe(false);
    });
});
