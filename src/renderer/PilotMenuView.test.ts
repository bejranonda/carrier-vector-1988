import { describe, it, expect } from 'vitest';
import { pilotMenuHitTest, pilotMenuLayout } from './PilotMenuView';

describe('pilotMenuLayout', () => {
    it('fits inside the viewport at a small size', () => {
        const layout = pilotMenuLayout(640, 360, 9);
        expect(layout.panel.x).toBeGreaterThanOrEqual(0);
        expect(layout.panel.y).toBeGreaterThanOrEqual(0);
        expect(layout.panel.x + layout.panel.w).toBeLessThanOrEqual(640);
        expect(layout.panel.y + layout.panel.h).toBeLessThanOrEqual(360 + 1);
    });

    it('lays out one rect per item, all inside the panel, none overlapping', () => {
        const layout = pilotMenuLayout(1440, 900, 6);
        expect(layout.items).toHaveLength(6);
        for (const r of layout.items) {
            expect(r.x).toBeGreaterThanOrEqual(layout.panel.x);
            expect(r.x + r.w).toBeLessThanOrEqual(layout.panel.x + layout.panel.w + 1);
        }
        for (let i = 1; i < layout.items.length; i++) {
            expect(layout.items[i].y).toBeGreaterThanOrEqual(layout.items[i - 1].y + layout.items[i - 1].h);
        }
    });
});

describe('pilotMenuHitTest', () => {
    it('finds the item a point lands on', () => {
        const layout = pilotMenuLayout(1440, 900, 5);
        const r2 = layout.items[2];
        const hit = pilotMenuHitTest(r2.x + 5, r2.y + 5, layout);
        expect(hit).toBe(2);
    });

    it('returns null outside every item', () => {
        const layout = pilotMenuLayout(1440, 900, 5);
        expect(pilotMenuHitTest(0, 0, layout)).toBeNull();
    });
});

describe('pilotMenuLayout with a long menu (v2.1.0)', () => {
    it('squeezes rows to stay inside a short screen, dropping detail lines when needed', () => {
        const l = pilotMenuLayout(960, 600, 11);
        const last = l.items[l.items.length - 1];
        expect(last.y + last.h).toBeLessThanOrEqual(l.panel.y + l.panel.h);
        expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(600);
        expect(pilotMenuLayout(1440, 900, 8).compact).toBe(false);
    });
});

describe('pilotMenuLayout on a landscape phone (v2.2.0 review)', () => {
    const phones: [number, number][] = [[844, 390], [667, 375], [640, 360], [932, 430]];

    it('keeps every row of the longest menu on screen and inside the panel', () => {
        for (const [w, h] of phones) {
            for (const n of [9, 10, 11]) {
                const l = pilotMenuLayout(w, h, n);
                const footerTop = l.panel.y + l.panel.h - 34;
                for (const r of l.items) {
                    expect(r.y + r.h, `${w}x${h}, ${n} items`).toBeLessThanOrEqual(footerTop + 1);
                    expect(r.x + r.w, `${w}x${h}`).toBeLessThanOrEqual(l.panel.x + l.panel.w);
                    expect(r.h, `${w}x${h}: thumb-sized`).toBeGreaterThanOrEqual(24);
                }
                expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(h);
            }
        }
    });

    it('never overlaps two rows, in one column or two', () => {
        for (const [w, h] of [...phones, [1440, 900] as [number, number]]) {
            const l = pilotMenuLayout(w, h, 10);
            for (let i = 0; i < l.items.length; i++) {
                for (let j = i + 1; j < l.items.length; j++) {
                    const a = l.items[i], b = l.items[j];
                    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
                    expect(overlap, `${w}x${h}: ${i} and ${j}`).toBe(false);
                }
            }
        }
    });

    it('stays one column wherever one column fits', () => {
        const l = pilotMenuLayout(1440, 900, 10);
        expect(new Set(l.items.map(r => r.x)).size).toBe(1);
    });
});
