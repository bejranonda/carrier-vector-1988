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

    it('carries EASY as a ".e" suffix, and old links without it still open', () => {
        const c = { seed: 99, score: 6300, waves: 5, easy: true };
        const url = challengeUrl('example.org/game', c);
        expect(url).toBe('example.org/game/?c=99.6300.5.e');
        expect(parseChallenge(url.slice(url.indexOf('?')))).toEqual(c);
        expect(parseChallenge('?c=99.6300.5')).toEqual({ seed: 99, score: 6300, waves: 5 });
        for (const bad of ['?c=99.6300.5.x', '?c=99.6300.5.e.e', '?c=99.6300.5e']) {
            expect(parseChallenge(bad), bad).toBeNull();
        }
    });

    it('tells both pilots when the runs were flown on different styles', () => {
        const easyRun = { seed: 1, score: 5000, waves: 5, easy: true };
        const standardRun = { seed: 1, score: 5000, waves: 5 };
        expect(challengeLine(easyRun)).toContain('FLOWN ON EASY');
        expect(challengeLine(standardRun)).not.toContain('EASY');
        expect(challengeVerdict(easyRun, 6000, false)).toBe('CHALLENGE BEATEN by 1,000 pts (they flew EASY).');
        expect(challengeVerdict(standardRun, 6000, true)).toBe('CHALLENGE BEATEN by 1,000 pts (you flew EASY).');
        expect(challengeVerdict(easyRun, 6000, true)).toBe('CHALLENGE BEATEN by 1,000 pts.');
        expect(challengeVerdict(standardRun, 4000)).toContain('1,000 pts short. FLY AGAIN');
    });
});
