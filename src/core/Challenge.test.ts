import { describe, expect, it } from 'vitest';
import { MAX_PILOT_NAME, challengeLine, challengeUrl, challengeVerdict, challengerLabel, cleanPilotName, parseChallenge } from './Challenge';

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

    it('carries the challenger\'s name after the #, and links without one still open (v2.3.0)', () => {
        const parse = (url: string) => { const u = new URL(url); return parseChallenge(u.search, u.hash); };
        const c = { seed: 7, score: 9100, waves: 6, name: 'Anna' };
        const url = challengeUrl('https://example.org/game/c', c);
        // The name is in the fragment, which never reaches a server.
        expect(url).toBe('https://example.org/game/c/?c=7.9100.6#n=Anna');
        expect(new URL(url).search).toBe('?c=7.9100.6');
        expect(parse(url)).toEqual(c);
        const easy = { ...c, easy: true };
        expect(parse(challengeUrl('https://example.org', easy))).toEqual(easy);
        // Any script: a Thai name survives the round trip, percent-encoded.
        const thai = { seed: 7, score: 9100, waves: 6, name: 'สมชาย' };
        const thaiUrl = challengeUrl('https://example.org/game', thai);
        expect(thaiUrl).not.toMatch(/[^\x21-\x7e]/);
        expect(parse(thaiUrl)).toEqual(thai);
        // A junk name drops; the challenge itself still opens. A name in the
        // query string (an early v2.3.0 link) is read too.
        expect(parseChallenge('?c=7.9100.6', '#n=%3C%2F%3E')).toEqual({ seed: 7, score: 9100, waves: 6 });
        expect(parseChallenge('?c=7.9100.6&n=Anna')).toEqual(c);
        expect(parseChallenge('?c=7.9100.6')).toEqual({ seed: 7, score: 9100, waves: 6 });
    });

    it('cleans a name so a link cannot put an address or markup on a friend\'s screen', () => {
        expect(cleanPilotName('  Grandpa   Joe ')).toBe('Grandpa Joe');
        expect(cleanPilotName('www.win-a-prize.com')).toBe('wwwwin-a-prizeco');
        expect(cleanPilotName('<script>alert(1)</script>')).toBe('scriptalert1scri');
        expect(cleanPilotName("Anne-Marie O'Neil")).toBe("Anne-Marie O'Nei");
        expect(Array.from(cleanPilotName('x'.repeat(40))!)).toHaveLength(MAX_PILOT_NAME);
        for (const bad of ['', '   ', "-'-", '...', null, undefined, 42]) {
            expect(cleanPilotName(bad), String(bad)).toBeNull();
        }
    });

    it('names the challenger in the briefing line and the verdict', () => {
        const c = { seed: 1, score: 12400, waves: 7, name: 'Anna' };
        expect(challengerLabel(c)).toBe('ANNA');
        expect(challengerLabel({})).toBe('A FRIEND');
        expect(challengeLine(c)).toContain('CHALLENGE FROM ANNA · BEAT 12,400 PTS');
        expect(challengeVerdict(c, 13000)).toBe('YOU BEAT ANNA by 600 pts!');
        expect(challengeVerdict(c, 12400)).toBe('TIED WITH ANNA - to the point.');
        expect(challengeVerdict(c, 10000)).toBe('2,400 pts short of ANNA. FLY AGAIN - same waves.');
        expect(challengeVerdict({ ...c, easy: true }, 13000)).toBe('YOU BEAT ANNA by 600 pts (they flew EASY)!');
    });
});
