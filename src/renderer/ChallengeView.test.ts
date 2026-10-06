import { describe, expect, it } from 'vitest';
import { challengeWelcomeHitTest, challengeWelcomeLayout, drawChallengeWelcome, monoWidth, wrapMono } from './ChallengeView';
import type { Rect } from './Theme';

const inside = (r: Rect, w: number, h: number) =>
    r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 0.5 && r.y + r.h <= h + 0.5;

// Phones both ways up, laptops, and the layouts EXTRA LARGE text makes.
const SIZES: [number, number, boolean][] = [
    [1440, 900, false], [1280, 720, false], [853, 480, false], [720, 433, false],
    [844, 390, true], [667, 375, true], [640, 360, true], [390, 844, true], [360, 640, true], [320, 568, true]
];
const LONG = { name: 'Grandma Margaret', score: 12345, waves: 7, easy: true };

describe('wrapMono', () => {
    it('wraps on words and never loses one', () => {
        const lines = wrapMono('GRANDMA MARGARET CHALLENGES YOU', 28, 326);
        expect(lines.join(' ')).toBe('GRANDMA MARGARET CHALLENGES YOU');
        for (const line of lines) expect(line.length * 28 * 0.6).toBeLessThanOrEqual(326);
        // A word longer than a line is broken rather than run off the panel.
        const broken = wrapMono('SUPERCALIFRAGILISTIC', 30, 100);
        expect(broken.join('')).toBe('SUPERCALIFRAGILISTIC');
        for (const line of broken) expect(monoWidth(line, 30)).toBeLessThanOrEqual(100);
    });

    it('balances the lines, so a sentence never leaves one word alone below it', () => {
        const lines = wrapMono('They lasted 3 waves of planes on EASY. You get the very same ones.', 15, 580);
        expect(lines).toHaveLength(2);
        expect(lines[1].split(' ').length).toBeGreaterThan(2);
        expect(Math.abs(lines[0].length - lines[1].length)).toBeLessThan(12);
    });

    it('measures Chinese, Japanese and Korean as full-width, and accents as nothing', () => {
        expect(monoWidth('ANNA', 10)).toBeCloseTo(24);
        expect(monoWidth('山田太郎', 10)).toBeCloseTo(40);
        expect(monoWidth('김민준', 10)).toBeCloseTo(30);
        expect(monoWidth('สมศักดิ์', 10)).toBeCloseTo(monoWidth('สมศกด', 10));
    });
});

describe('challengeWelcomeLayout (v2.3.0)', () => {
    it('keeps the panel and both buttons on screen at every size, buttons inside the panel', () => {
        for (const [w, h, touch] of SIZES) {
            const l = challengeWelcomeLayout(w, h, LONG, touch);
            const tag = `${w}x${h}`;
            expect(inside(l.panel, w, h), tag).toBe(true);
            for (const r of [l.accept, l.missions]) {
                expect(inside(r, w, h), tag).toBe(true);
                expect(r.x, tag).toBeGreaterThanOrEqual(l.panel.x);
                expect(r.x + r.w, tag).toBeLessThanOrEqual(l.panel.x + l.panel.w);
                expect(r.y + r.h, tag).toBeLessThanOrEqual(l.panel.y + l.panel.h);
            }
            expect(l.missions.y, tag).toBeGreaterThan(l.accept.y + l.accept.h);
            // A thumb-sized PLAY everywhere.
            expect(l.accept.h, tag).toBeGreaterThanOrEqual(44);
            expect(l.accept.w, tag).toBeGreaterThanOrEqual(200);
        }
    });

    it('wraps every line to the panel instead of cutting it - the first build cut "CHALLENGES YOU" upright', () => {
        for (const [w, h, touch] of SIZES) {
            const l = challengeWelcomeLayout(w, h, LONG, touch);
            const inner = l.panel.w - 40;
            const tag = `${w}x${h}`;
            expect(l.blocks.title.lines.join(' '), tag).toBe('GRANDMA MARGARET CHALLENGES YOU');
            for (const b of Object.values(l.blocks)) {
                if (!b) continue;
                for (const line of b.lines) {
                    expect(monoWidth(line, b.px), `${tag}: ${line}`).toBeLessThanOrEqual(inner + 0.5);
                }
            }
            // The game's name is always on the card; the panel never covers it up.
            expect(l.blocks.kicker.lines.join(' '), tag).toContain('A FREE JET GAME');
        }
    });

    it('fits a long name in any script - set smaller, never cut (v2.3.0 review)', () => {
        const names = ['山田太郎山田太郎山田太郎山田太郎', 'MAXIMILIANOVSKIJ', '김민준김민준김민준김민준김민'];
        for (const name of names) {
            for (const [w, h, touch] of SIZES) {
                const l = challengeWelcomeLayout(w, h, { ...LONG, name }, touch);
                const inner = l.panel.w - 40;
                expect(l.blocks.title.lines.join(''), `${name} ${w}x${h}`).toContain(name.toUpperCase().slice(0, 4));
                for (const line of l.blocks.title.lines) {
                    expect(monoWidth(line, l.blocks.title.px), `${name} ${w}x${h}`).toBeLessThanOrEqual(inner + 0.5);
                }
                expect(inside(l.panel, w, h), `${name} ${w}x${h}`).toBe(true);
            }
        }
    });

    it('keeps one plain sentence about the game on a landscape phone', () => {
        const l = challengeWelcomeLayout(844, 390, LONG, true);
        expect(l.blocks.about?.lines.join(' ')).toBe('Shoot down the bombers before they reach your carrier.');
        expect(challengeWelcomeLayout(1440, 900, LONG).compact).toBe(false);
    });

    it('asks an upright phone to turn sideways, and only an upright phone', () => {
        expect(challengeWelcomeLayout(390, 844, LONG, true).blocks.rotate?.lines.join(' ')).toBe('Turn your phone sideways to play.');
        expect(challengeWelcomeLayout(844, 390, LONG, true).blocks.rotate).toBeNull();
        expect(challengeWelcomeLayout(1440, 900, LONG, false).blocks.rotate).toBeNull();
    });

    it('hit-tests PLAY and SEE ALL MISSIONS, and nothing else', () => {
        const l = challengeWelcomeLayout(1440, 900, LONG);
        expect(challengeWelcomeHitTest(l.accept.x + 4, l.accept.y + 4, l)).toBe('ACCEPT');
        expect(challengeWelcomeHitTest(l.missions.x + 4, l.missions.y + 4, l)).toBe('MISSIONS');
        expect(challengeWelcomeHitTest(5, 5, l)).toBeNull();
    });
});

describe('drawChallengeWelcome (v2.3.0)', () => {
    it('names the challenger and the score, with or without a name', () => {
        const drawn: string[] = [];
        const noop = () => {};
        const ctx = {
            fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', shadowColor: '', shadowBlur: 0, textAlign: 'left', textBaseline: 'alphabetic',
            save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arcTo: noop, fill: noop, stroke: noop, fillRect: noop,
            measureText: (t: string) => ({ width: t.length * 8 }),
            fillText: (t: string) => { drawn.push(t); }
        } as unknown as CanvasRenderingContext2D;
        drawChallengeWelcome(ctx, 1440, 900, { seed: 1, score: 12345, waves: 7, easy: true, name: 'Anna' }, false, 0);
        expect(drawn).toContain('ANNA CHALLENGES YOU');
        expect(drawn).toContain('12,345 PTS');
        expect(drawn.join(' ')).toContain('of planes on EASY');
        expect(drawn).toContain("PLAY - IT'S FREE");
        drawn.length = 0;
        drawChallengeWelcome(ctx, 844, 390, { seed: 1, score: 50, waves: 1 }, true, 0);
        expect(drawn).toContain('A FRIEND CHALLENGES YOU');
        expect(drawn.join(' ')).toContain('They lasted 1 wave of planes.');
        expect(drawn).toContain('SEE ALL MISSIONS');
    });
});
