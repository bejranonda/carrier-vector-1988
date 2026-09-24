import { describe, it, expect } from 'vitest';
import {
    arbitrateHint,
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

    it('coaches the approach when descending onto the boat too fast', () => {
        const hint = getContextualHint({
            ...nominal(),
            distanceToCarrier: 1500,
            airSpeed: 140,
            altitudeAgl: 180,
            verticalSpeed: -4,
            closingOnCarrier: true
        });
        expect(hint?.text).toContain('TOO FAST');
    });

    /**
     * Regression: the trap-speed rule used to be
     * `distanceToCarrier < 2500 && airSpeed > 95`, which is true by
     * construction for the first seconds of EVERY catapult shot. A brand-new
     * pilot was told to decelerate below 90 m/s at 200 m off the bow while the
     * objective strip above it said CLIMB - and would have stalled if obeyed.
     */
    it('never nags about trap speed during the climb-out off the catapult', () => {
        const justLaunched: CoachSnapshot = {
            ...nominal(),
            distanceToCarrier: 400,
            airSpeed: 180,
            altitudeAgl: 200,
            verticalSpeed: 28,
            closingOnCarrier: false
        };
        expect(getContextualHint(justLaunched)?.text ?? '').not.toContain('TOO FAST');
    });

    it('does not nag about trap speed while flying away from the boat', () => {
        const departing: CoachSnapshot = {
            ...nominal(),
            distanceToCarrier: 1500,
            airSpeed: 200,
            altitudeAgl: 300,
            verticalSpeed: 0,
            closingOnCarrier: false
        };
        expect(getContextualHint(departing)?.text ?? '').not.toContain('TOO FAST');
    });

    it('switches to meatball guidance once on-speed near the boat', () => {
        const hint = getContextualHint({
            ...nominal(), distanceToCarrier: 1500, airSpeed: 85, closingOnCarrier: true
        });
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

describe('Contextual flight coach - the attack and the tail', () => {
    const base = {
        isStalled: false, rwrState: 'SILENT' as const, altitudeAgl: 900, verticalSpeed: 0,
        fuel: 4000, airSpeed: 240, damage: 0, distanceToCarrier: 9000, isAirborne: true, bayOpen: false
    };

    it('tells a pilot with a bandit ahead to lock it', () => {
        const h = getContextualHint({ ...base, bandit: { ahead: true, locked: false, inRange: false } });
        expect(h?.text).toContain('[T]');
    });

    it('tells a locked pilot to steer in, then to fire once in range', () => {
        expect(getContextualHint({ ...base, bandit: { ahead: true, locked: true, inRange: false } })?.text).toContain('LOCKED');
        expect(getContextualHint({ ...base, bandit: { ahead: true, locked: true, inRange: true } })?.text).toContain('[SPACE]');
    });

    it('warns of a fighter on the tail ahead of any attack prompt', () => {
        const h = getContextualHint({
            ...base, gunsTracking: true, bandit: { ahead: true, locked: true, inRange: true }
        });
        expect(h?.severity).toBe('CRITICAL');
        expect(h?.text).toContain('TAIL');
    });

    it('keeps a missile launch above a guns warning, and says chaff', () => {
        const h = getContextualHint({ ...base, rwrState: 'LAUNCH', gunsTracking: true });
        expect(h?.text).toContain('[X]');
    });

    it('stays quiet when the sky is empty', () => {
        expect(getContextualHint({ ...base, bandit: null })).toBeNull();
    });
});

describe('arbitrateHint - one instruction at a time', () => {
    const info = { text: 'LOCKED - TURN TOWARD THE BANDIT UNTIL IT IS IN RANGE', severity: 'INFO' as const };
    const fire = { text: 'IN RANGE - FIRE [SPACE]', severity: 'INFO' as const };
    const stall = { text: 'STALL - PUSH NOSE DOWN [S] AND ADD POWER [SHIFT]', severity: 'CRITICAL' as const };

    // The measured v1.9.0 case: CLIMB on the strip, TURN TOWARD THE BANDIT below it.
    it('silences routine coaching that competes with a non-attack order', () => {
        expect(arbitrateHint(info, null, { urgency: 'ACTION', key: 'W' })).toBeNull();
    });

    it('lets attack coaching reinforce an attack objective', () => {
        expect(arbitrateHint(fire, null, { urgency: 'ACTION', key: 'SPACE' })).toBe(fire);
    });

    it('always lets safety speak, whatever the objective says', () => {
        expect(arbitrateHint(stall, null, { urgency: 'ACTION', key: 'W' })).toBe(stall);
        expect(arbitrateHint(stall, 'TRAINING 1/6', null)).toBe(stall);
    });

    it('puts the training checkout ahead of routine coaching', () => {
        expect(arbitrateHint(info, 'TRAINING 2/6 - BANK', null)?.text).toBe('TRAINING 2/6 - BANK');
    });

    it('shows routine coaching when the objective is only informational', () => {
        expect(arbitrateHint(info, null, { urgency: 'NORMAL' })).toBe(info);
        expect(arbitrateHint(info, null, null)).toBe(info);
    });
});
