import { describe, it, expect } from 'vitest';
import {
    getContextualHint,
    TrainingSequence,
    TRAINING_STEPS,
    type CoachSnapshot
} from './Tutorial';

/** A completely nominal airborne state: no rule should fire. */
function nominal(): CoachSnapshot {
    return {
        isStalled: false,
        rwrState: 'SILENT',
        altitudeAgl: 800,
        verticalSpeed: 0,
        fuel: 4000,
        airSpeed: 230,
        damage: 0,
        distanceToCarrier: 9000,
        isAirborne: true,
        bayOpen: false
    };
}

describe('Contextual flight coach', () => {
    it('stays silent when everything is nominal', () => {
        expect(getContextualHint(nominal())).toBeNull();
    });

    it('stays silent entirely when not airborne', () => {
        const onDeck = { ...nominal(), isStalled: true, isAirborne: false };
        expect(getContextualHint(onDeck)).toBeNull();
    });

    it('calls out a stall', () => {
        const hint = getContextualHint({ ...nominal(), isStalled: true });
        expect(hint?.text).toContain('STALL');
        expect(hint?.severity).toBe('CRITICAL');
    });

    it('warns about terrain only when actually descending toward it', () => {
        const lowButLevel = { ...nominal(), altitudeAgl: 100, verticalSpeed: 0 };
        expect(getContextualHint(lowButLevel)).toBeNull();

        const lowAndSinking = { ...nominal(), altitudeAgl: 100, verticalSpeed: -20 };
        expect(getContextualHint(lowAndSinking)?.text).toContain('PULL UP');
    });

    it('teaches the terrain-masking trick when a missile is launched', () => {
        const hint = getContextualHint({ ...nominal(), rwrState: 'LAUNCH' });
        expect(hint?.text).toContain('RIDGE');
        expect(hint?.severity).toBe('CRITICAL');
    });

    it('prioritises a stall over a lower-severity low-airspeed nag', () => {
        // Both rules match: stalled AND slow. The stall must win.
        const hint = getContextualHint({ ...nominal(), isStalled: true, airSpeed: 80 });
        expect(hint?.text).toContain('STALL');
    });

    it('prioritises an inbound missile over a bingo-fuel warning', () => {
        const hint = getContextualHint({ ...nominal(), rwrState: 'LAUNCH', fuel: 100 });
        expect(hint?.text).toContain('MISSILE INBOUND');
    });

    it('nags about bay doors only while something is actually looking', () => {
        expect(getContextualHint({ ...nominal(), bayOpen: true })).toBeNull();

        const hint = getContextualHint({ ...nominal(), bayOpen: true, rwrState: 'SEARCH' });
        expect(hint?.text).toContain('BAY DOORS OPEN');
    });

    it('coaches the approach when close to the boat and too fast', () => {
        const hint = getContextualHint({ ...nominal(), distanceToCarrier: 1500, airSpeed: 140 });
        expect(hint?.text).toContain('TOO FAST');
    });

    it('switches to meatball guidance once on-speed near the boat', () => {
        const hint = getContextualHint({ ...nominal(), distanceToCarrier: 1500, airSpeed: 85 });
        expect(hint?.text).toContain('MEATBALL');
    });
});

describe('TrainingSequence', () => {
    it('starts on the first step', () => {
        const t = new TrainingSequence();
        expect(t.currentStep?.id).toBe('PITCH');
        expect(t.isComplete).toBe(false);
    });

    it('advances only once the pilot demonstrates the control', () => {
        const t = new TrainingSequence();

        t.progress.pitchInputSeconds = 0.4; // not enough yet
        t.update();
        expect(t.currentStep?.id).toBe('PITCH');

        t.progress.pitchInputSeconds = 1.2;
        t.update();
        expect(t.currentStep?.id).toBe('ROLL');
    });

    it('skips over several already-satisfied steps in one update', () => {
        const t = new TrainingSequence();
        t.progress.pitchInputSeconds = 2;
        t.progress.rollInputSeconds = 2;
        t.progress.throttleChanged = true;
        t.update();
        expect(t.currentStep?.id).toBe('BAY');
    });

    it('completes after every step is satisfied', () => {
        const t = new TrainingSequence();
        t.progress = {
            pitchInputSeconds: 5,
            rollInputSeconds: 5,
            throttleChanged: true,
            bayToggled: true,
            gunFired: true,
            hasBeenMasked: true
        };
        t.update();
        expect(t.isComplete).toBe(true);
        expect(t.currentStep).toBeNull();
    });

    it('can be skipped outright by a returning pilot', () => {
        const t = new TrainingSequence();
        t.skip();
        expect(t.currentStep).toBeNull();
        expect(t.isComplete).toBe(true);
    });

    it('exposes a prompt for every step', () => {
        for (const step of TRAINING_STEPS) {
            expect(step.prompt.length).toBeGreaterThan(10);
        }
    });
});
