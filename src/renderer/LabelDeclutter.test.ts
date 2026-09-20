import { describe, it, expect } from 'vitest';
import { placeLabels, type LabelCandidate } from './LabelDeclutter';

const view = { viewportW: 1440, viewportH: 900 };

const tag = (over: Partial<LabelCandidate> = {}): LabelCandidate => ({
    id: 'T1', x: 700, y: 450, w: 110, h: 16, priority: 1000, offset: 20, ...over
});

describe('placeLabels', () => {
    it('places a lone tag to the right of its bracket', () => {
        const [placed] = placeLabels([tag()], view);
        expect(placed.side).toBe('RIGHT');
        expect(placed.x).toBe(720);
        expect(placed.y).toBe(442);
    });

    /**
     * The defect this exists for: three contacts in a loose trail printed
     * three range tags on top of each other and on top of the altitude block.
     */
    it('drops a tag that would land on one already placed', () => {
        const stack = [
            tag({ id: 'NEAR', y: 450, priority: 1000 }),
            tag({ id: 'MID', y: 458, priority: 2000 }),
            tag({ id: 'FAR', y: 464, priority: 3000 })
        ];
        const placed = placeLabels(stack, view);
        // The nearest always gets its place; the others take whatever free
        // seat is left around their own bracket, and are dropped when there
        // is none. What must never happen is two tags on one spot.
        expect(placed[0].id).toBe('NEAR');
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                const a = placed[i];
                const b = placed[j];
                const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
                expect(hit).toBe(false);
            }
        }
    });

    it('keeps the nearest contact when they compete', () => {
        const placed = placeLabels([
            tag({ id: 'FAR', priority: 8000 }),
            tag({ id: 'NEAR', priority: 400 })
        ], view);
        expect(placed[0].id).toBe('NEAR');
    });

    it('places tags that are genuinely apart', () => {
        const placed = placeLabels([
            tag({ id: 'A', x: 300, y: 200 }),
            tag({ id: 'B', x: 900, y: 600 })
        ], view);
        expect(placed).toHaveLength(2);
    });

    it('never lets two placed tags overlap, for any arrangement', () => {
        const many: LabelCandidate[] = [];
        for (let i = 0; i < 24; i++) {
            many.push(tag({
                id: `C${i}`,
                x: 200 + (i % 6) * 90,
                y: 200 + Math.floor(i / 6) * 14,
                priority: i * 100
            }));
        }
        const placed = placeLabels(many, { ...view, maxVisible: 12 });
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                const a = placed[i];
                const b = placed[j];
                const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
                expect(hit, `${a.id} overlaps ${b.id}`).toBe(false);
            }
        }
    });

    it('never covers an instrument', () => {
        const altitudeBlock = { x: 760, y: 420, w: 110, h: 68 };
        const placed = placeLabels([tag({ x: 700, y: 450 })], { ...view, avoid: [altitudeBlock] });
        // Right side is blocked by the block, so it goes left.
        expect(placed[0].side).toBe('LEFT');
        expect(placed[0].x + placed[0].w).toBeLessThanOrEqual(altitudeBlock.x);
    });

    /**
     * Left and right alone were not enough: in a head-on merge on a phone the
     * contacts cluster around the boresight with both sides blocked, and
     * every tag was dropped. Above and below are worth having.
     */
    it('goes above or below when both sides are blocked', () => {
        const wallLeft = { x: 0, y: 442, w: 690, h: 16 };
        const wallRight = { x: 715, y: 442, w: 700, h: 16 };
        const placed = placeLabels([tag({ x: 700, y: 450 })], {
            ...view, avoid: [wallLeft, wallRight]
        });
        expect(placed).toHaveLength(1);
        expect(['ABOVE', 'BELOW']).toContain(placed[0].side);
    });

    it('still prefers beside the bracket when there is room', () => {
        expect(placeLabels([tag()], view)[0].side).toBe('RIGHT');
    });

    it('drops a tag with nowhere at all to go', () => {
        const wall = { x: 0, y: 0, w: 1440, h: 900 };
        expect(placeLabels([tag()], { ...view, avoid: [wall] })).toHaveLength(0);
    });

    it('flips to the left rather than running off the right edge', () => {
        const placed = placeLabels([tag({ x: 1400 })], view);
        expect(placed[0].side).toBe('LEFT');
        expect(placed[0].x + placed[0].w).toBeLessThanOrEqual(1440);
    });

    it('drops a tag that fits on neither side of a narrow screen', () => {
        const placed = placeLabels([tag({ x: 200, w: 300 })], { viewportW: 320, viewportH: 200 });
        expect(placed).toHaveLength(0);
    });

    it('honours the cap even when everything would fit', () => {
        const spread: LabelCandidate[] = [];
        for (let i = 0; i < 10; i++) spread.push(tag({ id: `S${i}`, x: 100, y: 60 + i * 60, priority: i }));
        expect(placeLabels(spread, { ...view, maxVisible: 3 })).toHaveLength(3);
    });

    it('ignores a contact whose projection is not a number', () => {
        const placed = placeLabels([
            tag({ id: 'BROKEN', x: Number.NaN, priority: 1 }),
            tag({ id: 'OK', priority: 2 })
        ], view);
        expect(placed.map(p => p.id)).toEqual(['OK']);
    });

    it('is stable for identically placed contacts', () => {
        const twins = [tag({ id: 'b', priority: 500 }), tag({ id: 'a', priority: 500 })];
        expect(placeLabels(twins, view)[0].id).toBe('a');
        expect(placeLabels([...twins].reverse(), view)[0].id).toBe('a');
    });

    it('returns nothing for an empty scope', () => {
        expect(placeLabels([], view)).toEqual([]);
    });
});
