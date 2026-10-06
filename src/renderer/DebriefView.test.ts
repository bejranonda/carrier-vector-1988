import { describe, expect, it } from 'vitest';
import { debriefLayout } from './DebriefView';
import type { DebriefData } from './DebriefView';
import type { Rect } from './Theme';

const data = (share: DebriefData['share']): Pick<DebriefData, 'outcome' | 'cause' | 'share' | 'unlocks' | 'nextUnlock' | 'xp'> => ({
    outcome: 'FAILED',
    cause: null,
    share,
    unlocks: [],
    nextUnlock: { label: 'AMBER VECTOR', starsNeeded: 2 },
    xp: null
});
const SHARE = { text: 'NEW PERSONAL BEST - SHOW YOUR FRIENDS', strong: true, status: 'IDLE' as const };
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('debriefLayout with SHARE (v2.3.0)', () => {
    it('puts FLY AGAIN, SHARE and MISSIONS on screen without overlapping, at every size', () => {
        for (const [w, h] of [[1440, 900], [1280, 720], [853, 480], [720, 433], [844, 390], [667, 375], [390, 844], [360, 640]]) {
            const l = debriefLayout(w, h, data(SHARE));
            const tag = `${w}x${h}`;
            expect(l.share, tag).not.toBeNull();
            const buttons = [l.again, l.share!, l.missions];
            for (const r of buttons) {
                expect(r.x, tag).toBeGreaterThanOrEqual(0);
                expect(r.x + r.w, tag).toBeLessThanOrEqual(w);
                expect(r.y + r.h, tag).toBeLessThanOrEqual(h);
                expect(r.h, tag).toBeGreaterThanOrEqual(44);
            }
            expect(overlap(l.again, l.share!), tag).toBe(false);
            expect(overlap(l.share!, l.missions), tag).toBe(false);
            expect(overlap(l.again, l.missions), tag).toBe(false);
        }
    });

    it('gives FLY AGAIN its own row on an upright phone', () => {
        const l = debriefLayout(390, 844, data(SHARE));
        expect(l.share!.y).toBeGreaterThan(l.again.y + l.again.h);
        expect(l.again.w).toBeGreaterThan(l.share!.w);
        // ...and one row on a landscape phone, FLY AGAIN the widest.
        const p = debriefLayout(844, 390, data(SHARE));
        expect(p.share!.y).toBe(p.again.y);
        expect(p.again.w).toBeGreaterThan(p.share!.w);
    });

    it('has no SHARE button when there is nothing to share', () => {
        const l = debriefLayout(1440, 900, data(null));
        expect(l.share).toBeNull();
        expect(l.show.share).toBe(false);
    });
});
