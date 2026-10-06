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
    url: 'https://example.org/game/c/?c=1.12345.7',
    ...over
});

describe('shareContent (v2.3.0)', () => {
    it('a best is a challenge, in plain words, saying what the link is, with the link alone on its last line', () => {
        const s = shareContent(run({ isNewBest: true }));
        expect(s.text).toBe('My best yet: 12,345 points and 21 planes shot down in Carrier Vector: 1988, a free jet game. '
            + 'Can you beat me? It plays in your browser, no download:');
        expect(s.text).not.toContain('http');
        expect(s.clipboard).toBe(`${s.text}\n${s.url}`);
        expect(s.clipboard.split('\n').pop()).toBe(s.url);
        expect(s.subject).toBe('Can you beat my 12,345 in Carrier Vector: 1988?');
        expect(s.action).toBe('CHALLENGE A FRIEND');
        // No rows of symbols, no shouting, no pilot slang.
        expect(s.clipboard).not.toMatch(/[●◆▲★☆]/);
        expect(s.text).not.toMatch(/[A-Z]{6,}/);
        expect(s.text).not.toMatch(/wave|splash/i);
    });

    it('a run with nothing to boast about is a short invitation instead', () => {
        const s = shareContent(run());
        expect(s.text).toBe('Try Carrier Vector: 1988, a free jet game - it plays in your browser, nothing to install. '
            + 'EASY mode flies the plane; you just press FIRE. I got 12,345 - can you beat me?');
        expect(s.text.length).toBeLessThan(180);
        expect(s.action).toBe('INVITE A FRIEND');
        // A run that scored nothing asks no one to beat it.
        expect(shareContent(run({ score: 0 })).text).not.toContain('beat');
        // A fresh star is worth a challenge.
        expect(shareContent(run({ freshStars: 1 })).text.startsWith('I scored 12,345 points and shot down 21 planes')).toBe(true);
    });

    it('marks EASY wherever a score is claimed, and on the picture', () => {
        const s = shareContent(run({ easy: true, isNewBest: true, name: 'Tom' }));
        expect(s.text).toContain('in Carrier Vector: 1988 (I flew on EASY)');
        expect(s.picture.tags).toEqual(['EASY MODE', 'NEW PERSONAL BEST']);
        expect(shareContent(run({ easy: true })).text).toContain('I got 12,345 (I flew on EASY)');
        expect(shareContent(run({ easy: true, versus: { name: 'Anna', score: 9 } })).text).toContain('(I flew on EASY)');
    });

    it('shows only the numbers worth showing, plurals right', () => {
        expect(shareContent(run()).picture.stats).toBe('7 WAVES · 21 PLANES DOWN · CHAIN x4');
        expect(shareContent(run({ kills: 1, waves: 1, bestChain: 1 })).picture.stats).toBe('1 WAVE · 1 PLANE DOWN');
        expect(shareContent(run({ kills: 0, waves: 0, bestChain: 0 })).picture.stats).toBe('');
        expect(shareContent(run({ bestChain: 9 })).picture.stats).toContain('CHAIN x5');
        expect(shareContent(run({ stars: 7 })).picture.stars).toBe(3);
        expect(shareContent(run({ kills: 1, isNewBest: true })).text).toContain('1 plane shot down');
        // Never "0 planes shot down".
        expect(shareContent(run({ kills: 0, isNewBest: true })).text.startsWith('My best yet: 12,345 points in Carrier')).toBe(true);
        expect(shareContent(run({ kills: 0, freshStars: 1 })).text.startsWith('I scored 12,345 points in Carrier')).toBe(true);
    });

    it('names the daily and which try it was', () => {
        const first = shareContent(run({ daily: 279, attempt: 1 }));
        expect(first.text.startsWith('Daily Scramble #279 (first try): 12,345 points in Carrier Vector: 1988, a free jet game.')).toBe(true);
        expect(first.text).toContain('Everyone gets the same planes today');
        expect(first.picture.title).toBe('DAILY SCRAMBLE #279 · FIRST TRY');
        const third = shareContent(run({ daily: 279, attempt: 3 }));
        expect(third.text).toContain('(try 3)');
        expect(third.picture.title).toBe('DAILY SCRAMBLE #279 · TRY 3');
    });

    it('a reply to a won challenge speaks to the friend, and the picture names both', () => {
        const s = shareContent(run({ name: 'Tom', versus: { name: 'Anna', score: 12000 } }));
        expect(s.text).toBe('I beat your score, Anna! 12,345 to your 12,000 in Carrier Vector: 1988. '
            + 'Your turn to win it back - it\'s a free jet game in your browser, a few minutes:');
        expect(s.subject).toBe('I beat your score, Anna!');
        expect(s.action).toBe('REPLY TO ANNA');
        expect(s.picture.headline).toBe('TOM BEAT ANNA!');
        expect(s.picture.board).toEqual([{ name: 'TOM', score: 12345 }, { name: 'ANNA', score: 12000 }]);
        // Without the sender's name: "I".
        expect(shareContent(run({ versus: { name: 'Anna', score: 12000 } })).picture.headline).toBe('I BEAT ANNA!');
        const anon = shareContent(run({ versus: { name: null, score: 12000 } }));
        expect(anon.text.startsWith('I beat the challenge - 12,345 to 12,000')).toBe(true);
        expect(anon.picture.headline).toBe('CHALLENGE BEATEN!');
        expect(anon.picture.board?.[1]).toEqual({ name: 'CHALLENGE', score: 12000 });
    });

    it('a tie and a loss stay kind; a loss tells the winner instead of challenging them', () => {
        const tie = shareContent(run({ versus: { name: 'Anna', score: 12345 } }));
        expect(tie.text.startsWith("We're tied, Anna - 12,345 points each")).toBe(true);
        expect(tie.picture.headline).toBe('TIED WITH ANNA!');
        const lost = shareContent(run({ name: 'Tom', isNewBest: true, versus: { name: 'Anna', score: 15000 } }));
        expect(lost.text).toBe("You're still ahead, Anna - 15,000 to my 12,345 in Carrier Vector: 1988. I'll get you next time!");
        expect(lost.action).toBe('TELL ANNA');
        expect(lost.picture.headline).toBe('CAN YOU BEAT TOM?');
        expect(lost.picture.board?.[0]).toEqual({ name: 'ANNA', score: 15000 });
        // "New personal best" beside a lost challenge reads as a boast about losing.
        expect(lost.picture.tags).not.toContain('NEW PERSONAL BEST');
    });
});

describe('shareNudge (v2.3.0)', () => {
    it('lights SHARE for a win and a star, a best once a session, and otherwise just says what it does', () => {
        expect(shareNudge({ isNewBest: true, score: 900, versus: { name: 'Anna', score: 800 }, freshStars: 1 }))
            .toEqual({ text: 'YOU BEAT ANNA - LET ANNA KNOW', strong: true });
        expect(shareNudge({ isNewBest: false, score: 900, versus: null, freshStars: 2 })).toEqual({ text: 'NEW STARS - SHOW YOUR FRIENDS', strong: true });
        expect(shareNudge({ isNewBest: true, score: 900, versus: null, freshStars: 0, bestIsNews: true }).strong).toBe(true);
        expect(shareNudge({ isNewBest: true, score: 900, versus: null, freshStars: 0, bestIsNews: false }).strong).toBe(false);
        const plain = shareNudge({ isNewBest: false, score: 900, versus: { name: 'Anna', score: 1000 }, freshStars: 0 });
        expect(plain.strong).toBe(false);
        expect(plain.text).toContain('SAME PLANES');
    });
});
