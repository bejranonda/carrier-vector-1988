import { describe, it, expect } from 'vitest';
import { Milestones, MILESTONES } from './Milestones';
import type { MilestoneStore } from './Milestones';

function memoryStore(): MilestoneStore & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
        data,
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = v; }
    };
}

describe('Milestones', () => {
    it('pays out a first time exactly once', () => {
        const m = new Milestones(memoryStore());
        expect(m.claim('FIRST_BLOOD')).toEqual(MILESTONES.FIRST_BLOOD);
        expect(m.claim('FIRST_BLOOD')).toBeNull();
        expect(m.has('FIRST_BLOOD')).toBe(true);
    });

    it('keeps milestones independent of each other', () => {
        const m = new Milestones(memoryStore());
        m.claim('FIRST_BLOOD');
        expect(m.claim('FIRST_TRAP')).not.toBeNull();
    });

    it('remembers across sessions', () => {
        const store = memoryStore();
        new Milestones(store).claim('CHAFF_SAVE');
        const later = new Milestones(store);
        expect(later.has('CHAFF_SAVE')).toBe(true);
        expect(later.claim('CHAFF_SAVE')).toBeNull();
    });

    it('survives corrupt storage and unknown ids', () => {
        const store = memoryStore();
        store.data['carrier-vector-1988.milestones'] = '{not json';
        expect(() => new Milestones(store)).not.toThrow();
        store.data['carrier-vector-1988.milestones'] = JSON.stringify(['NOPE', 'FIRST_TRAP']);
        const m = new Milestones(store);
        expect(m.has('FIRST_TRAP')).toBe(true);
    });

    it('works with no storage at all', () => {
        const m = new Milestones(null);
        expect(m.claim('FIRST_LOOP')).not.toBeNull();
        expect(m.claim('FIRST_LOOP')).toBeNull();
    });

    it('survives a store that throws on write', () => {
        const m = new Milestones({ getItem: () => null, setItem: () => { throw new Error('full'); } });
        expect(() => m.claim('FIRST_BLOOD')).not.toThrow();
    });
});
