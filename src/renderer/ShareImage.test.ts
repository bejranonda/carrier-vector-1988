import { describe, expect, it } from 'vitest';
import { MOMENT_ZOOM, SHARE_IMAGE_LAYOUT, SHARE_IMAGE_SIZE, coverCrop, drawShareImage } from './ShareImage';
import type { SharePicture } from '../core/ShareCard';

/** A 2D context that records every string drawn and every image blitted. */
function recordingCtx() {
    const texts: { text: string; x: number; y: number; font: string; align: string }[] = [];
    const images: unknown[][] = [];
    const noop = () => {};
    const ctx = {
        fillStyle: '', strokeStyle: '', lineWidth: 1, font: '10px mono', shadowColor: '', shadowBlur: 0,
        textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1, globalCompositeOperation: 'source-over',
        save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
        arcTo: noop, rect: noop, fill: noop, stroke: noop, clip: noop, fillRect: noop, strokeRect: noop,
        // Monospace: every glyph is 0.6 em, so widths behave like the real font.
        measureText(t: string) { return { width: t.length * 0.6 * Number(/(\d+)px/.exec(this.font)?.[1] ?? 10) }; },
        fillText(t: string, x: number, y: number) { texts.push({ text: t, x, y, font: this.font, align: this.textAlign }); },
        drawImage: (...args: unknown[]) => { images.push(args); }
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, images };
}

const picture = (over: Partial<SharePicture> = {}): SharePicture => ({
    title: 'SCRAMBLE',
    headline: 'CAN YOU BEAT TOM?',
    score: 12345,
    stars: 2,
    stats: '7 WAVES · 21 PLANES DOWN · CHAIN x4',
    pilot: 'TOM',
    tags: ['EASY MODE', 'NEW PERSONAL BEST'],
    board: null,
    host: 'example.org/game',
    ...over
});

const px = (font: string) => Number(/(\d+)px/.exec(font)?.[1]);

describe('coverCrop', () => {
    it('fills the frame from the middle of the image, whichever way it is wider', () => {
        const a = coverCrop(1440, 900, 960, 520);
        expect(a.w).toBeCloseTo(1440);
        expect(a.h).toBeCloseTo(1440 * 520 / 960);
        expect(a.y).toBeCloseTo((900 - a.h) / 2);
        const b = coverCrop(390, 844, 960, 520);
        expect(b.w).toBeCloseTo(390);
        expect(b.x).toBeCloseTo(0);
        const z = coverCrop(1440, 900, 960, 520, MOMENT_ZOOM);
        expect(z.w).toBeCloseTo(a.w / MOMENT_ZOOM);
        expect(z.x + z.w / 2).toBeCloseTo(720);
        expect(z.y + z.h / 2).toBeCloseTo(450);
    });
});

describe('drawShareImage (v2.3.0)', () => {
    it('says what the game is, asks the question, and keeps every word inside the square', () => {
        const { ctx, texts, images } = recordingCtx();
        drawShareImage(ctx, picture(), { image: {} as CanvasImageSource, width: 960, height: 600 });
        const all = texts.map(t => t.text);
        expect(all).toContain('CARRIER VECTOR: 1988');
        expect(all).toContain('CAN YOU BEAT TOM?');
        expect(all).toContain('12,345 PTS');
        expect(all).toContain('FREE GAME - PLAYS IN YOUR BROWSER');
        expect(all).toContain('example.org/game');
        expect(all.some(t => t.startsWith('SCRAMBLE') && t.includes('EASY MODE'))).toBe(true);
        // The moment, drawn twice - the second time added, to brighten it.
        expect(images).toHaveLength(2);
        for (const t of texts) {
            const width = t.text.length * 0.6 * px(t.font);
            expect(width, t.text).toBeLessThanOrEqual(SHARE_IMAGE_SIZE - 40);
            expect(t.y, t.text).toBeLessThanOrEqual(SHARE_IMAGE_SIZE);
        }
        // Readable in a 270 px chat thumbnail: nothing that matters under 30 px here (~8 px there).
        for (const t of texts) expect(px(t.font), t.text).toBeGreaterThanOrEqual(30);
    });

    it('shrinks a long headline rather than cutting it', () => {
        const { ctx, texts } = recordingCtx();
        drawShareImage(ctx, picture({ headline: 'GRANDMA MARGARET BEAT ANNA!' }), null);
        const head = texts.find(t => t.text.startsWith('GRANDMA'))!;
        expect(head.text).toBe('GRANDMA MARGARET BEAT ANNA!');
        expect(px(head.font)).toBeLessThan(76);
    });

    it('after a challenge it shows a scoreboard, the higher score on top, instead of one score', () => {
        const { ctx, texts } = recordingCtx();
        drawShareImage(ctx, picture({
            headline: 'TOM BEAT ANNA!',
            board: [{ name: 'TOM', score: 12345 }, { name: 'ANNA', score: 12000 }]
        }), null);
        const tom = texts.find(t => t.text === 'TOM')!;
        const anna = texts.find(t => t.text === 'ANNA')!;
        expect(tom.y).toBeLessThan(anna.y);
        expect(texts.some(t => t.text === '12,345')).toBe(true);
        expect(texts.some(t => t.text === '12,000')).toBe(true);
        expect(texts.some(t => t.text === '12,345 PTS')).toBe(false);
    });

    it('with no moment it draws a scope rather than a hole, and draws no empty stats line', () => {
        const { ctx, texts, images } = recordingCtx();
        drawShareImage(ctx, picture({ stats: '', tags: [] }), null);
        expect(images).toHaveLength(0);
        expect(texts.some(t => t.text === '')).toBe(false);
    });

    it('keeps its rows in order down the square', () => {
        const L = SHARE_IMAGE_LAYOUT;
        const rows = [L.game, L.headline, L.moment.y, L.moment.y + L.moment.h, L.stars, L.score, L.stats, L.tags, L.footerTop, L.footer, L.host];
        for (let i = 1; i < rows.length; i++) expect(rows[i]).toBeGreaterThan(rows[i - 1]);
        expect(L.board[0]).toBeGreaterThan(L.moment.y + L.moment.h + 60);
        expect(L.board[1]).toBeLessThan(L.stats - 40);
        expect(L.host).toBeLessThan(SHARE_IMAGE_SIZE);
    });
});
