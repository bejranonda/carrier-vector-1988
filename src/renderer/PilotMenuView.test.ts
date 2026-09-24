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
