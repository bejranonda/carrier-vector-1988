import { describe, expect, it } from 'vitest';
import { challengeLine, challengeUrl, challengeVerdict, parseChallenge } from './Challenge';

describe('challenge links', () => {
    it('round-trips a run through its URL', () => {
        const c = { seed: 123456, score: 12400, waves: 7 };
        const url = challengeUrl('example.org/game', c);
        expect(url).toBe('example.org/game/?c=123456.12400.7');
        expect(parseChallenge(url.slice(url.indexOf('?')))).toEqual(c);
    });

    it('ignores anything that is not exactly three integers', () => {
        for (const bad of ['', '?', '?c=', '?c=1.2', '?c=a.b.c', '?c=1.2.3.4', '?c=-1.2.3', '?c=99999999999.1.1', '?x=1.2.3']) {
            expect(parseChallenge(bad), bad).toBeNull();
        }
    });

    it('clamps junk when building a link', () => {
        expect(challengeUrl('u', { seed: -5, score: 1e12, waves: 5000 })).toBe('u/?c=0.99999999.999');
    });

    it('says what to beat, and whether you did', () => {
        const c = { seed: 1, score: 12400, waves: 7 };
        expect(challengeLine(c)).toContain('BEAT 12,400 PTS (7 WAVES)');
        expect(challengeVerdict(c, 13000)).toContain('BEATEN by 600');
        expect(challengeVerdict(c, 12400)).toContain('TIED');
        expect(challengeVerdict(c, 10000)).toContain('2,400 pts short');
    });
});
