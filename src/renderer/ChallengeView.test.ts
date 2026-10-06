import { describe, expect, it } from 'vitest';
import { challengeWelcomeHitTest, challengeWelcomeLayout, drawChallengeWelcome } from './ChallengeView';
import type { Rect } from './Theme';

const inside = (r: Rect, w: number, h: number) =>
    r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 0.5 && r.y + r.h <= h + 0.5;

// Phones both ways up, laptops, and the layouts EXTRA LARGE text makes.
const SIZES: [number, number][] = [
    [1440, 900], [1280, 720], [853, 480], [720, 433], [844, 390], [667, 375], [640, 360],
    [390, 844], [360, 640]
];

describe('challengeWelcomeLayout (v2.3.0)', () => {
    it('keeps the panel and both buttons on screen at every size, buttons inside the panel', () => {
        for (const [w, h] of SIZES) {
            const l = challengeWelcomeLayout(w, h);
            const tag = `${w}x${h}`;
            expect(inside(l.panel, w, h), tag).toBe(true);
            for (const r of [l.accept, l.missions]) {
                expect(inside(r, w, h), tag).toBe(true);
                expect(r.x, tag).toBeGreaterThanOrEqual(l.panel.x);
                expect(r.x + r.w, tag).toBeLessThanOrEqual(l.panel.x + l.panel.w);
                expect(r.y + r.h, tag).toBeLessThanOrEqual(l.panel.y + l.panel.h);
            }
            expect(l.missions.y, tag).toBeGreaterThan(l.accept.y + l.accept.h);
            // A thumb-sized ACCEPT everywhere.
            expect(l.accept.h, tag).toBeGreaterThanOrEqual(44);
            expect(l.accept.w, tag).toBeGreaterThanOrEqual(200);
        }
    });

    it('drops the explanation on a short screen and keeps it on a tall one', () => {
        expect(challengeWelcomeLayout(844, 390).compact).toBe(true);
        expect(challengeWelcomeLayout(1440, 900).compact).toBe(false);
        expect(challengeWelcomeLayout(390, 844).compact).toBe(false);
    });

    it('hit-tests ACCEPT and SEE ALL MISSIONS, and nothing else', () => {
        const l = challengeWelcomeLayout(1440, 900);
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
        expect(drawn.some(t => t.includes('FLOWN ON EASY'))).toBe(true);
        expect(drawn).toContain('ACCEPT CHALLENGE');
        drawn.length = 0;
        drawChallengeWelcome(ctx, 844, 390, { seed: 1, score: 50, waves: 1 }, true, 0);
        expect(drawn).toContain('A FRIEND CHALLENGES YOU');
        expect(drawn.some(t => t.includes('1 WAVE HELD'))).toBe(true);
        expect(drawn).toContain('SEE ALL MISSIONS');
    });
});
