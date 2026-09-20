import { describe, it, expect } from 'vitest';
import {
    VISIBILITY_TUNING,
    VisibilityTracker,
    isDesignatable,
    type VisibilityContact
} from './Visibility';

const at = (x: number, y: number, z: number) => ({ x, y, z });

const contact = (over: Partial<VisibilityContact> = {}): VisibilityContact => ({
    id: 'C1', kind: 'AIR', position: at(0, 500, 2000), ...over
});

describe('isDesignatable', () => {
    /**
     * A hardened target is on the briefing card. Not being able to designate
     * the pen while running the fjord toward it would be nonsense.
     */
    it('always allows a briefed structure, seen or not', () => {
        expect(isDesignatable('STRUCTURE', false, false)).toBe(true);
        expect(isDesignatable('STRUCTURE', true, true)).toBe(true);
    });

    it('requires live line of sight for an aircraft, which moves', () => {
        expect(isDesignatable('AIR', true, false)).toBe(true);
        expect(isDesignatable('AIR', false, true)).toBe(false);
    });

    /**
     * A launcher does not move. Forgetting it the moment you duck behind a
     * ridge would punish the correct tactic, which is to mask and come back.
     */
    it('remembers a launcher once it has been found', () => {
        expect(isDesignatable('SAM', true, false)).toBe(true);
        expect(isDesignatable('SAM', false, true)).toBe(true);
        expect(isDesignatable('SAM', false, false)).toBe(false);
    });
});

describe('VisibilityTracker', () => {
    it('starts blind', () => {
        const t = new VisibilityTracker();
        expect(t.isVisible('C1')).toBe(false);
        expect(t.hasDiscovered('C1')).toBe(false);
    });

    it('sees an aircraft in the clear and loses it behind terrain', () => {
        const t = new VisibilityTracker();
        const air = contact({ id: 'BANDIT', kind: 'AIR' });

        t.update(0, [air], () => true);
        expect(t.isVisible('BANDIT')).toBe(true);

        t.update(1, [air], () => false);
        expect(t.isVisible('BANDIT')).toBe(false);
    });

    it('learns a launcher by seeing it, and keeps it when masked', () => {
        const t = new VisibilityTracker();
        const sam = contact({ id: 'SAM-1', kind: 'SAM' });

        t.update(0, [sam], () => true);
        expect(t.hasDiscovered('SAM-1')).toBe(true);

        t.update(1, [sam], () => false);
        expect(t.isVisible('SAM-1')).toBe(true);
    });

    it('learns a launcher from being painted by it, without ever seeing it', () => {
        const t = new VisibilityTracker();
        const sam = contact({ id: 'SAM-2', kind: 'SAM' });

        t.update(0, [sam], () => false);
        expect(t.isVisible('SAM-2')).toBe(false);

        // The RWR just told you exactly where it is.
        t.markDiscovered('SAM-2');
        t.update(1, [sam], () => false);
        expect(t.isVisible('SAM-2')).toBe(true);
    });

    it('offers a briefed structure from the first tick, unseen', () => {
        const t = new VisibilityTracker();
        t.update(0, [contact({ id: 'PEN', kind: 'STRUCTURE' })], () => false);
        expect(t.isVisible('PEN')).toBe(true);
    });

    /**
     * checkLOS marches a ray at 40 m a sample; ten candidates every frame at
     * 60 Hz is about a hundred thousand terrain lookups a second, on a
     * budget that belongs to a phone.
     */
    it('re-marches line of sight a few times a second, not every frame', () => {
        const t = new VisibilityTracker();
        const contacts = [contact()];
        let calls = 0;
        const los = () => { calls++; return true; };

        // One second of frames at 60 Hz.
        for (let frame = 0; frame < 60; frame++) t.update(frame / 60, contacts, los);

        const expected = Math.ceil(1 / VISIBILITY_TUNING.refreshSeconds);
        expect(calls).toBeLessThanOrEqual(expected + 1);
        expect(calls).toBeGreaterThan(1);
    });

    it('holds its last answer between refreshes', () => {
        const t = new VisibilityTracker();
        const air = contact({ id: 'BANDIT', kind: 'AIR' });
        t.update(0, [air], () => true);

        // Well inside the refresh window: the answer does not change even
        // though line of sight now would.
        t.update(VISIBILITY_TUNING.refreshSeconds / 2, [air], () => false);
        expect(t.isVisible('BANDIT')).toBe(true);
    });

    it('drops a contact that is no longer in the list', () => {
        const t = new VisibilityTracker();
        t.update(0, [contact({ id: 'GONE' })], () => true);
        expect(t.isVisible('GONE')).toBe(true);

        t.update(1, [], () => true);
        expect(t.isVisible('GONE')).toBe(false);
    });

    it('forgets everything on reset, so a new sortie starts blind', () => {
        const t = new VisibilityTracker();
        t.update(0, [contact({ id: 'SAM-1', kind: 'SAM' })], () => true);
        expect(t.hasDiscovered('SAM-1')).toBe(true);

        t.reset();
        expect(t.hasDiscovered('SAM-1')).toBe(false);
        expect(t.isVisible('SAM-1')).toBe(false);
    });

    it('re-evaluates immediately after a reset rather than waiting out the window', () => {
        const t = new VisibilityTracker();
        t.update(10, [contact()], () => true);
        t.reset();

        let called = false;
        t.update(10, [contact()], () => { called = true; return true; });
        expect(called).toBe(true);
    });

    /**
     * The throttle may only serve an answer it actually has. A package that
     * spawns mid-window used to stay undesignatable for up to 120 ms - long
     * enough for the designate key to feel broken, and long enough that a test
     * swapping the contact list mid-run saw nothing at all.
     */
    it('resolves a contact that appears mid-window without waiting', () => {
        const t = new VisibilityTracker();
        const known = contact({ id: 'LEAD' });
        t.update(0, [known], () => true);

        const fresh = contact({ id: 'WINGMAN' });
        t.update(VISIBILITY_TUNING.refreshSeconds / 3, [known, fresh], () => true);
        expect(t.isVisible('WINGMAN')).toBe(true);
    });

    /**
     * ...and one arrival must not disable the throttle for the rest of the
     * window, or the ray marching cost comes straight back.
     */
    it('goes back to throttling once the new contact has been evaluated', () => {
        const t = new VisibilityTracker();
        const contacts = [contact({ id: 'LEAD' })];
        t.update(0, contacts, () => true);

        contacts.push(contact({ id: 'WINGMAN' }));
        let calls = 0;
        const los = () => { calls++; return true; };
        for (let frame = 1; frame < 6; frame++) {
            t.update(frame / 240, contacts, los);
        }
        // One refresh, prompted by the arrival, covering both contacts.
        expect(calls).toBe(2);
    });
});
