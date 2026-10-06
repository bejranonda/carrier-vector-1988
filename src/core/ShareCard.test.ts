import { describe, expect, it } from 'vitest';
import { shareContent, shareNudge } from './ShareCard';
import type { ShareRun } from './ShareCard';

const run = (over: Partial<ShareRun> = {}): ShareRun => ({
    score: 12345,
    waves: 7,
    kills: 21,
    bestChain: 4,
    stars: 2,
    easy: false,
    isNewBest: false,
    name: null,
    versus: null,
    url: 'https://example.org/game/?c=1.12345.7',
    ...over
});

describe('shareContent (v2.3.0)', () => {
    it('a run worth boasting about is a challenge, in plain words, with the link on its own last line', () => {
        const s = shareContent(run({ isNewBest: true }));
        expect(s.text).toBe('I scored 12,345 points in Carrier Vector: 1988 and shot down 21 planes. My best yet! '
            + 'Can you beat me? It\'s a free game in your browser - same waves, a few minutes, no download:');
        expect(s.text).not.toContain('http');
        expect(s.url).toBe('https://example.org/game/?c=1.12345.7');
        expect(s.clipboard).toBe(`${s.text}\n${s.url}`);
        expect(s.clipboard.split('\n').pop()).toBe(s.url);
        expect(s.subject).toBe('Can you beat my 12,345 in Carrier Vector: 1988?');
        expect(s.action).toBe('CHALLENGE A FRIEND');
        // No rows of symbols, no shouting: what makes a message read as spam.
        expect(s.clipboard).not.toMatch(/[●◆▲★☆]/);
        expect(s.text).not.toMatch(/[A-Z]{6,}/);
        expect(s.picture.headline).toBe('CAN YOU BEAT ME?');
        expect(s.picture.title).toBe('SCRAMBLE');
        expect(s.picture.stats).toBe('7 WAVES · 21 PLANES DOWN · CHAIN x4');
        expect(s.picture.versus).toBeNull();
        expect(s.picture.host).not.toMatch(/^https?:/);
    });

    it('a run with nothing to boast about is an invitation instead', () => {
        const s = shareContent(run());
        expect(s.text.startsWith('Try Carrier Vector: 1988 - a free retro jet game in your browser, no download.')).toBe(true);
        expect(s.text).toContain('EASY mode flies the plane for you');
        expect(s.text).toContain('I scored 12,345 points - can you beat me?');
        expect(s.subject).toContain('Try Carrier Vector: 1988');
        expect(s.action).toBe('INVITE A FRIEND');
        // A run that scored nothing asks no one to beat it.
        expect(shareContent(run({ score: 0 })).text).not.toContain('can you beat me');
        // A fresh star is worth a challenge.
        expect(shareContent(run({ freshStars: 1 })).text.startsWith('I scored')).toBe(true);
    });

    it('gets the plurals right in both cases', () => {
        const one = shareContent(run({ kills: 1, waves: 1, bestChain: 1, isNewBest: true }));
        expect(one.text).toContain('shot down 1 plane.');
        expect(one.picture.stats).toBe('1 WAVE · 1 PLANE DOWN');
        expect(shareContent(run({ kills: 0, waves: 0, bestChain: 0 })).picture.stats).toBe('0 WAVES · 0 PLANES DOWN');
    });

    it('marks EASY and a personal best, in the words and on the picture', () => {
        const s = shareContent(run({ easy: true, isNewBest: true, name: 'Tom' }));
        expect(s.text).toContain('12,345 points on EASY in');
        expect(s.text).toContain('My best yet!');
        expect(s.picture.tags).toEqual(['EASY MODE', 'NEW PERSONAL BEST']);
        expect(s.picture.pilot).toBe('TOM');
    });

    it('caps the chain at x5 and the stars at three', () => {
        const s = shareContent(run({ bestChain: 9, stars: 7 }));
        expect(s.picture.stats).toContain('CHAIN x5');
        expect(s.picture.stars).toBe(3);
    });

    it('names the daily and which try it was', () => {
        const first = shareContent(run({ daily: 279, attempt: 1 }));
        expect(first.text.startsWith('Daily Scramble #279 (first try): I scored 12,345 points')).toBe(true);
        expect(first.text).toContain('Everyone gets the same waves today');
        expect(first.picture.title).toBe('DAILY SCRAMBLE #279 · FIRST TRY');
        const third = shareContent(run({ daily: 279, attempt: 3 }));
        expect(third.text).toContain('(try 3)');
        expect(third.picture.title).toBe('DAILY SCRAMBLE #279 · TRY 3');
    });

    it('a run that beat a challenge says so - the message most worth sending back', () => {
        const s = shareContent(run({ name: 'Tom', versus: { name: 'Anna', score: 12000 } }));
        expect(s.text.startsWith('I beat Anna! 12,345 points to 12,000 in Carrier Vector: 1988. Your turn')).toBe(true);
        expect(s.subject).toBe('I beat Anna in Carrier Vector: 1988!');
        expect(s.action).toBe('REPLY TO ANNA');
        expect(s.picture.headline).toBe('I BEAT ANNA!');
        expect(s.picture.versus).toBe('ANNA 12,000 · TOM 12,345');
        const anon = shareContent(run({ versus: { name: null, score: 12000 } }));
        expect(anon.text.startsWith('I beat the challenge')).toBe(true);
        expect(anon.picture.headline).toBe('CHALLENGE BEATEN!');
        expect(anon.picture.versus).toBe('CHALLENGE 12,000 · ME 12,345');
    });

    it('a tie and a loss stay friendly, and still ask the next friend to try', () => {
        const tie = shareContent(run({ versus: { name: 'Anna', score: 12345 } }));
        expect(tie.text).toContain('I tied Anna at 12,345 points');
        expect(tie.picture.headline).toBe('TIED WITH ANNA!');
        const lost = shareContent(run({ isNewBest: true, versus: { name: 'Anna', score: 15000 } }));
        expect(lost.text.startsWith('Anna is still ahead - 15,000 points to my 12,345')).toBe(true);
        expect(lost.text).toContain('Can you beat my score?');
        expect(lost.picture.headline).toBe('CAN YOU BEAT ME?');
        // "New personal best" next to a lost challenge reads as a boast about losing.
        expect(lost.picture.tags).not.toContain('NEW PERSONAL BEST');
    });
});

describe('shareNudge (v2.3.0)', () => {
    it('gives the strongest reason first, and a plain one otherwise', () => {
        expect(shareNudge({ isNewBest: true, score: 900, versus: { name: 'Anna', score: 800 }, freshStars: 1 }))
            .toEqual({ text: 'YOU BEAT ANNA - SEND IT BACK', strong: true });
        expect(shareNudge({ isNewBest: true, score: 900, versus: null, freshStars: 0 }).text).toBe('NEW PERSONAL BEST - SHOW YOUR FRIENDS');
        expect(shareNudge({ isNewBest: false, score: 900, versus: null, freshStars: 2 }).text).toBe('NEW STARS - SHOW YOUR FRIENDS');
        const plain = shareNudge({ isNewBest: false, score: 900, versus: { name: 'Anna', score: 1000 }, freshStars: 0 });
        expect(plain.strong).toBe(false);
        expect(plain.text).toContain('SAME WAVES');
    });
});
