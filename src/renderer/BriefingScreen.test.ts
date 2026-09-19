import { describe, it, expect } from 'vitest';
import { briefingHitAreas } from './BriefingScreen';


describe('briefingHitAreas', () => {
    const SIZES: [number, number][] = [
        [1440, 900], [1024, 700], [844, 390], [667, 375], [1180, 820]
    ];

    it('gives one pill per scenario, in order, without overlaps', () => {
        for (const [w, h] of SIZES) {
            const { pills } = briefingHitAreas(w, h, 5, true);
            expect(pills).toHaveLength(5);
            for (let i = 1; i < pills.length; i++) {
                expect(pills[i].x, `${w}x${h}`).toBeGreaterThanOrEqual(pills[i - 1].x + pills[i - 1].w);
            }
        }
    });

    it('keeps every interactive area inside the viewport', () => {
        for (const [w, h] of SIZES) {
            const areas = briefingHitAreas(w, h, 5, true);
            const all = [...areas.pills, areas.cta, areas.daily!];
            for (const r of all) {
                expect(r.x, `${w}x${h}`).toBeGreaterThanOrEqual(0);
                expect(r.x + r.w, `${w}x${h}`).toBeLessThanOrEqual(w + 0.001);
                expect(r.y, `${w}x${h}`).toBeGreaterThanOrEqual(0);
                expect(r.y + r.h, `${w}x${h}`).toBeLessThanOrEqual(h + 0.001);
            }
        }
    });

    it('never lets the daily line and the pills collide', () => {
        for (const [w, h] of SIZES) {
            const { pills, daily } = briefingHitAreas(w, h, 5, true);
            expect(daily!.y + daily!.h).toBeLessThanOrEqual(pills[0].y);
        }
    });

    it('reclaims the daily line s space when there is no daily', () => {
        const withDaily = briefingHitAreas(1440, 900, 5, true);
        const without = briefingHitAreas(1440, 900, 5, false);
        expect(without.daily).toBeNull();
        expect(without.selectorY).toBeLessThan(withDaily.selectorY);
    });

    /**
     * A pill a thumb cannot hit is a pill that does not exist. Five across a
     * 667px phone is tight, so this is the number that has to hold.
     */
    it('keeps pills thumb-sized on the smallest phone', () => {
        const { pills } = briefingHitAreas(667, 375, 5, true);
        expect(pills[0].h).toBeGreaterThanOrEqual(44);
        expect(pills[0].w).toBeGreaterThanOrEqual(44);
    });

    it('puts the call to action at the bottom, clear of the pills', () => {
        for (const [w, h] of SIZES) {
            const { pills, cta } = briefingHitAreas(w, h, 5, true);
            expect(cta.y, `${w}x${h}`).toBeGreaterThan(pills[0].y + pills[0].h);
        }
    });
});
