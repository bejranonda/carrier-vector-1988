import { describe, it, expect } from 'vitest';
import {
    CM_TUNING,
    canDispense,
    createCountermeasureState,
    decoyExpiry,
    dispense,
    isDecoyed,
    tickCountermeasures
} from './Countermeasures';

describe('the dispenser', () => {
    it('starts full', () => {
        expect(createCountermeasureState().remaining).toBe(CM_TUNING.capacity);
    });

    it('spends one cartridge per release', () => {
        const cm = createCountermeasureState();
        expect(dispense(cm)).toBe(true);
        expect(cm.remaining).toBe(CM_TUNING.capacity - 1);
    });

    /**
     * The recycle time is the whole reason the count matters. Without it a
     * frightened player holds the key down and is simply immune, which is the
     * failure mode an always-works countermeasure has to avoid.
     */
    it('will not fire again until it has recycled', () => {
        const cm = createCountermeasureState();
        dispense(cm);
        expect(canDispense(cm)).toBe(false);
        expect(dispense(cm)).toBe(false);
        expect(cm.remaining).toBe(CM_TUNING.capacity - 1);

        tickCountermeasures(cm, CM_TUNING.reloadSeconds);
        expect(canDispense(cm)).toBe(true);
    });

    it('runs dry and stays dry', () => {
        const cm = createCountermeasureState(2);
        for (let i = 0; i < 2; i++) {
            expect(dispense(cm)).toBe(true);
            tickCountermeasures(cm, CM_TUNING.reloadSeconds);
        }
        expect(cm.remaining).toBe(0);
        expect(dispense(cm)).toBe(false);
        expect(cm.remaining).toBe(0);
    });

    it('never goes negative, however it is constructed', () => {
        expect(createCountermeasureState(-5).remaining).toBe(0);
    });

    it('does not let the reload timer run below zero', () => {
        const cm = createCountermeasureState();
        dispense(cm);
        tickCountermeasures(cm, 999);
        expect(cm.reloadTimer).toBe(0);
    });
});

describe('the decoy window', () => {
    it('keeps a seeker busy for the tuned duration', () => {
        const until = decoyExpiry(100);
        expect(isDecoyed(until, 100)).toBe(true);
        expect(isDecoyed(until, 100 + CM_TUNING.decoySeconds - 0.01)).toBe(true);
        expect(isDecoyed(until, 100 + CM_TUNING.decoySeconds)).toBe(false);
    });

    it('treats a site that has never been decoyed as clean', () => {
        expect(isDecoyed(0, 0)).toBe(false);
        expect(isDecoyed(0, 250)).toBe(false);
    });

    /**
     * At 480 m/s a decoyed missile coasts about 1.7 km. It has to be far
     * enough to carry the round past the aeroplane, or the cartridge buys a
     * pause rather than an escape.
     */
    it('lasts long enough for a missile to overshoot', () => {
        const coastDistance = CM_TUNING.decoySeconds * 480;
        expect(coastDistance).toBeGreaterThan(1000);
    });
});
