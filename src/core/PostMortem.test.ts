import { describe, it, expect } from 'vitest';
import { formatLossCause, postMortemTip } from './PostMortem';
import type { LossCause } from './PostMortem';

describe('formatLossCause', () => {
    it('names the SAM by its detail string', () => {
        expect(formatLossCause({ kind: 'SAM', detail: 'SA-6 SAM-2' })).toBe('KILLED BY SA-6 SAM-2');
    });

    it('names the aircraft for a cannon kill', () => {
        expect(formatLossCause({ kind: 'CANNON', detail: 'MiG-23 Flogger #1' }))
            .toBe('KILLED BY MiG-23 Flogger #1');
    });

    it('does not invent a name for terrain', () => {
        expect(formatLossCause({ kind: 'TERRAIN', detail: 'terrain' })).toBe('LOST TO TERRAIN IMPACT');
    });

    it('is null when there is nothing to report', () => {
        expect(formatLossCause(null)).toBeNull();
    });
});

describe('postMortemTip', () => {
    const kinds: LossCause['kind'][] = ['SAM', 'CANNON', 'TERRAIN'];

    it('gives a distinct, non-empty tip for every cause kind', () => {
        const tips = kinds.map(kind => postMortemTip({ kind, detail: 'x' }));
        for (const tip of tips) {
            expect(tip).toBeTruthy();
            expect(tip!.length).toBeGreaterThan(10);
        }
        expect(new Set(tips).size).toBe(kinds.length);
    });

    it('is null when there is no cause', () => {
        expect(postMortemTip(null)).toBeNull();
    });
});
