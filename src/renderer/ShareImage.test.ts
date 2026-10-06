import { describe, expect, it } from 'vitest';
import { MOMENT_ZOOM, SHARE_IMAGE_LAYOUT, SHARE_IMAGE_SIZE, coverCrop, drawShareImage } from './ShareImage';
import type { SharePicture } from '../core/ShareCard';

/** A 2D context that records every string drawn and every image blitted. */
function recordingCtx() {
    const texts: { text: string; x: number; y: number; font: string }[] = [];
    const images: unknown[][] = [];
    const noop = () => {};
    const ctx = {
        fillStyle: '', strokeStyle: '', lineWidth: 1, font: '10px mono', shadowColor: '', shadowBlur: 0,
        textAlign: 'left', textBaseline: 'alphabetic',
        save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
        arcTo: noop, rect: noop, fill: noop, stroke: noop, clip: noop, fillRect: noop, strokeRect: noop,
        // Monospace: every glyph is 0.6 em, so widths behave like the real font.
        measureText(t: string) { return { width: t.length * 0.6 * Number(/(\d+)px/.exec(this.font)?.[1] ?? 10) }; },
        fillText(t: string, x: number, y: number) { texts.push({ text: t, x, y, font: this.font }); },
        drawImage: (...args: unknown[]) => { images.push(args); }
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, images };
}

const picture = (over: Partial<SharePicture> = {}): SharePicture => ({
    title: 'SCRAMBLE',
    headline: 'CAN YOU BEAT ME?',
    score: 12345,
    stars: 2,
    stats: '7 WAVES · 21 PLANES DOWN · CHAIN x4',
    pilot: 'TOM',
    tags: ['EASY MODE', 'NEW PERSONAL BEST'],
    versus: null,
    host: 'example.org/game',
    ...over
});

describe('coverCrop', () => {
    it('fills the frame from the middle of the image, whichever way it is wider', () => {
        // A 16:10 screen into a 960 x 520 frame: the sides stay, top and bottom go.
        const a = coverCrop(1440, 900, 960, 520);
        expect(a.w).toBeCloseTo(1440);
        expect(a.h).toBeCloseTo(1440 * 520 / 960);
        expect(a.y).toBeCloseTo((900 - a.h) / 2);
        // An upright phone frame: the top and bottom stay, the sides go.
        const b = coverCrop(390, 844, 960, 520);
        expect(b.w).toBeCloseTo(390);
        expect(b.x).toBeCloseTo(0);
        // Zoomed in: a smaller, still centred, window.
        const z = coverCrop(1440, 900, 960, 520, MOMENT_ZOOM);
        expect(z.w).toBeCloseTo(a.w / MOMENT_ZOOM);
        expect(z.x + z.w / 2).toBeCloseTo(720);
        expect(z.y + z.h / 2).toBeCloseTo(450);
    });
});

describe('drawShareImage (v2.3.0)', () => {
    it('puts the score, the question, the pilot and the address on the picture, all inside it', () => {
        const { ctx, texts, images } = recordingCtx();
        drawShareImage(ctx, picture(), { image: {} as CanvasImageSource, width: 960, height: 600 });
        const all = texts.map(t => t.text);
        expect(all).toContain('CARRIER VECTOR: 1988');
        expect(all).toContain('12,345 PTS');
        expect(all).toContain('CAN YOU BEAT ME?');
        expect(all).toContain('PILOT: TOM');
        expect(all.some(t => t.includes('example.org/game'))).toBe(true);
        expect(all.some(t => t.startsWith('SCRAMBLE') && t.includes('EASY MODE'))).toBe(true);
        expect(images).toHaveLength(1);
        for (const t of texts) {
            const size = Number(/(\d+)px/.exec(t.font)?.[1]);
            const width = t.text.length * 0.6 * size;
            expect(width, t.text).toBeLessThanOrEqual(SHARE_IMAGE_SIZE - 40);
            expect(t.y, t.text).toBeLessThanOrEqual(SHARE_IMAGE_SIZE);
        }
    });

    it('after a challenge it shows both pilots instead of one', () => {
        const { ctx, texts } = recordingCtx();
        drawShareImage(ctx, picture({ headline: 'I BEAT ANNA!', versus: 'ANNA 12,000 · TOM 12,345' }), null);
        const all = texts.map(t => t.text);
        expect(all).toContain('ANNA 12,000 · TOM 12,345');
        expect(all).not.toContain('PILOT: TOM');
        expect(all).toContain('I BEAT ANNA!');
    });

    it('with no moment it draws a scope rather than a hole, and no name means no pilot line', () => {
        const { ctx, texts, images } = recordingCtx();
        drawShareImage(ctx, picture({ pilot: null, tags: [] }), null);
        expect(images).toHaveLength(0);
        expect(texts.some(t => t.text.startsWith('PILOT'))).toBe(false);
    });

    it('keeps its rows in order down the square', () => {
        const L = SHARE_IMAGE_LAYOUT;
        const rows = [L.title, L.subtitle, L.moment.y, L.moment.y + L.moment.h, L.stars, L.score, L.stats, L.line, L.headline, L.host];
        for (let i = 1; i < rows.length; i++) expect(rows[i]).toBeGreaterThan(rows[i - 1]);
        expect(L.host).toBeLessThan(SHARE_IMAGE_SIZE);
    });
});
