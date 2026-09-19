import { describe, it, expect } from 'vitest';
import { TouchInput } from './TouchInput';
import { solveTouchLayout } from '../renderer/TouchLayout';

const layout = solveTouchLayout(844, 390);

describe('TouchInput', () => {
    it('starts with nothing held and nothing demanded', () => {
        const t = new TouchInput();
        const d = t.demand(layout);
        expect(t.activeCount).toBe(0);
        expect(d).toMatchObject({ pitch: 0, roll: 0, throttle: null, firing: false });
    });

    it('reports a press once, then forgets it', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.fire.cx, y: layout.fire.cy }, layout);
        expect(t.consumeTaps().map(x => x.control)).toEqual(['FIRE']);
        expect(t.consumeTaps()).toEqual([]);
    });

    it('holds fire while the thumb is down and releases on lift', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.fire.cx, y: layout.fire.cy }, layout);
        expect(t.demand(layout).firing).toBe(true);
        t.up(1);
        expect(t.demand(layout).firing).toBe(false);
    });

    /**
     * The stick's origin is wherever the thumb landed, not a fixed circle it
     * has to find first. This is the single biggest difference between a
     * virtual stick that works and one that does not.
     */
    it('centres the stick on first contact, wherever in the zone that is', () => {
        const t = new TouchInput();
        const corner = { id: 1, x: layout.stickZone.x + 8, y: layout.stickZone.y + 8 };
        t.down(corner, layout);
        expect(t.demand(layout)).toMatchObject({ pitch: 0, roll: 0 });

        t.move({ id: 1, x: corner.x + layout.stick.r, y: corner.y });
        expect(t.demand(layout).roll).toBeCloseTo(1, 6);
    });

    it('pitches up when the thumb is pulled back', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.stick.cx, y: layout.stick.cy }, layout);
        t.move({ id: 1, x: layout.stick.cx, y: layout.stick.cy - layout.stick.r });
        expect(t.demand(layout).pitch).toBeCloseTo(1, 6);
    });

    it('sets an absolute throttle from the track, afterburner included', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.throttle.x + 4, y: layout.throttle.y }, layout);
        expect(t.demand(layout).throttle).toBeCloseTo(1.5, 6);

        t.move({ id: 1, x: layout.throttle.x + 4, y: layout.throttle.y + layout.throttle.h });
        expect(t.demand(layout).throttle).toBeCloseTo(0, 6);
    });

    it('leaves the throttle alone when no thumb is on it', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.stick.cx, y: layout.stick.cy }, layout);
        expect(t.demand(layout).throttle).toBeNull();
    });

    it('flies and fires at the same time, on two thumbs', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.stick.cx, y: layout.stick.cy }, layout);
        t.down({ id: 2, x: layout.fire.cx, y: layout.fire.cy }, layout);
        t.move({ id: 1, x: layout.stick.cx + layout.stick.r, y: layout.stick.cy });

        const d = t.demand(layout);
        expect(d.firing).toBe(true);
        expect(d.roll).toBeCloseTo(1, 6);
    });

    /**
     * A thumb that slides off its button keeps that button. Re-binding
     * mid-gesture is how a virtual stick silently becomes a throttle in the
     * middle of a turn.
     */
    it('keeps a pointer bound to what it first touched', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.fire.cx, y: layout.fire.cy }, layout);
        t.move({ id: 1, x: layout.stick.cx, y: layout.stick.cy });

        const d = t.demand(layout);
        expect(d.firing).toBe(true);
        expect(d.pitch).toBe(0);
        expect(d.roll).toBe(0);
    });

    it('ignores movement from a pointer it never saw go down', () => {
        const t = new TouchInput();
        expect(() => t.move({ id: 99, x: 10, y: 10 })).not.toThrow();
        expect(t.activeCount).toBe(0);
    });

    it('reports a tap on open screen as WORLD, with its position', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: 400, y: 120 }, layout);
        const [tap] = t.consumeTaps();
        expect(tap.control).toBe('WORLD');
        expect(tap).toMatchObject({ x: 400, y: 120 });
    });

    it('offers only launch and menu on the deck screen', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.launch.x + 10, y: layout.launch.y + 10 }, layout, 'DECK');
        t.down({ id: 2, x: layout.fire.cx, y: layout.fire.cy }, layout, 'DECK');
        expect(t.consumeTaps().map(x => x.control)).toEqual(['LAUNCH', 'WORLD']);
    });

    it('drops every finger when the window loses focus', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.stick.cx, y: layout.stick.cy }, layout);
        t.down({ id: 2, x: layout.fire.cx, y: layout.fire.cy }, layout);
        t.clear();

        expect(t.activeCount).toBe(0);
        expect(t.demand(layout).firing).toBe(false);
        expect(t.consumeTaps()).toEqual([]);
    });

    it('surfaces the stick position so the renderer can draw where it is', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.stick.cx, y: layout.stick.cy }, layout);
        t.move({ id: 1, x: layout.stick.cx + 12, y: layout.stick.cy - 8 });

        const d = t.demand(layout);
        expect(d.stickOrigin).toEqual({ x: layout.stick.cx, y: layout.stick.cy });
        expect(d.stickPosition).toEqual({ x: layout.stick.cx + 12, y: layout.stick.cy - 8 });
    });

    it('has no stick position once the thumb lifts', () => {
        const t = new TouchInput();
        t.down({ id: 1, x: layout.stick.cx, y: layout.stick.cy }, layout);
        t.up(1);
        expect(t.demand(layout).stickOrigin).toBeNull();
    });
});
