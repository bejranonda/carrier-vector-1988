import { describe, it, expect } from 'vitest';
import {
    ASSIST_LEVELS,
    DEFAULT_ASSIST_LEVEL,
    loadAssistLevel,
    saveAssistLevel,
    ASSIST_TUNING,
    angleDelta,
    assistSpec,
    attitudeHold,
    autopilotDemand,
    nextAssistLevel,
    resolveControls,
    stallLimiter,
    terrainFloor,
    type FlightState,
    type PilotInput
} from './FlightAssist';

function state(over: Partial<FlightState> = {}): FlightState {
    return {
        pitch: 0,
        roll: 0,
        yaw: 0,
        alpha: 0.05,
        airSpeed: 220,
        throttle: 0.6,
        altitudeAgl: 1200,
        verticalSpeed: 0,
        isStalled: false,
        onApproach: false,
        ...over
    };
}

function input(over: Partial<PilotInput> = {}): PilotInput {
    return { pitch: 0, roll: 0, throttle: 0, ...over };
}

describe('assist levels', () => {
    it('cycles MANUAL -> ASSIST -> AUTO -> MANUAL', () => {
        expect(nextAssistLevel('MANUAL')).toBe('ASSIST');
        expect(nextAssistLevel('ASSIST')).toBe('AUTO');
        expect(nextAssistLevel('AUTO')).toBe('MANUAL');
    });

    it('has a spec for every level', () => {
        for (const level of ASSIST_LEVELS) {
            const spec = assistSpec(level);
            expect(spec.id).toBe(level);
            expect(spec.label.length).toBeGreaterThan(0);
            expect(spec.blurb.length).toBeGreaterThan(0);
        }
    });
});

describe('angleDelta', () => {
    it('is zero for the same angle', () => {
        expect(angleDelta(1.2, 1.2)).toBeCloseTo(0, 10);
    });

    it('takes the short way round the wrap', () => {
        // 0.1 rad -> 6.2 rad is -0.18 the short way, not +6.1
        const d = angleDelta(0.1, 6.2);
        expect(d).toBeLessThan(0);
        expect(d).toBeCloseTo(-0.1832, 3);
    });

    it('never exceeds half a turn either way', () => {
        for (let a = 0; a < Math.PI * 2; a += 0.3) {
            for (let b = 0; b < Math.PI * 2; b += 0.3) {
                expect(Math.abs(angleDelta(a, b))).toBeLessThanOrEqual(Math.PI + 1e-9);
            }
        }
    });
});

describe('stall limiter', () => {
    it('leaves a pull alone with plenty of alpha margin', () => {
        expect(stallLimiter(state({ alpha: 0 }), 1)).toBeCloseTo(1, 6);
    });

    it('does not tax ordinary manoeuvring below the gate', () => {
        const alpha = ASSIST_TUNING.alphaLimit * ASSIST_TUNING.alphaGate * 0.9;
        expect(stallLimiter(state({ alpha }), 1)).toBe(1);
    });

    it('fades the pull out as alpha approaches the limit', () => {
        const mild = stallLimiter(state({ alpha: ASSIST_TUNING.alphaLimit * 0.75 }), 1);
        const severe = stallLimiter(state({ alpha: ASSIST_TUNING.alphaLimit * 0.9 }), 1);
        expect(mild).toBeLessThan(1);
        expect(severe).toBeLessThan(mild);
        expect(severe).toBeGreaterThanOrEqual(0);
    });

    it('blocks the pull entirely at the limit', () => {
        expect(stallLimiter(state({ alpha: ASSIST_TUNING.alphaLimit }), 1)).toBeCloseTo(0, 6);
    });

    it('never blocks an unload, so the pilot can always reduce alpha', () => {
        expect(stallLimiter(state({ alpha: 0.5 }), -1)).toBe(-1);
        expect(stallLimiter(state({ isStalled: true, alpha: 0.5 }), -1)).toBe(-1);
        // The mirror image: at negative alpha, pulling is the unload.
        expect(stallLimiter(state({ alpha: -0.5 }), 1)).toBe(1);
        expect(stallLimiter(state({ isStalled: true, alpha: -0.5 }), 1)).toBe(1);
    });

    it('pushes the nose down on its own once the wing has let go', () => {
        expect(stallLimiter(state({ isStalled: true, alpha: 0.4 }), 1)).toBeLessThanOrEqual(-0.6);
    });

    /**
     * `isStalled` is |alpha| > critical, so the wing lets go at negative alpha
     * too - nose low, unloaded into a descent, which is exactly where an
     * autopilot descending in a hard turn ends up. Answering that with a push
     * drives alpha further negative and flies the aeroplane into the sea. It
     * did, repeatably, until this was symmetric.
     */
    it('pulls instead of pushing when the wing let go at negative alpha', () => {
        expect(stallLimiter(state({ isStalled: true, alpha: -0.4 }), -1))
            .toBeGreaterThanOrEqual(0.6);
    });

    it('fades a push out as alpha approaches the negative limit', () => {
        const mild = stallLimiter(state({ alpha: -ASSIST_TUNING.alphaLimit * 0.75 }), -1);
        const severe = stallLimiter(state({ alpha: -ASSIST_TUNING.alphaLimit * 0.9 }), -1);
        expect(mild).toBeGreaterThan(-1);
        expect(severe).toBeGreaterThan(mild);
        expect(severe).toBeLessThanOrEqual(0);
    });

    it('does not tax ordinary nose-down manoeuvring above the negative gate', () => {
        const alpha = -ASSIST_TUNING.alphaLimit * ASSIST_TUNING.alphaGate * 0.9;
        expect(stallLimiter(state({ alpha }), -1)).toBe(-1);
    });

    it('leaves a centred stick alone whatever alpha is doing', () => {
        expect(stallLimiter(state({ alpha: 0.9 }), 0)).toBe(0);
        expect(stallLimiter(state({ alpha: -0.9 }), 0)).toBe(0);
    });
});

describe('terrain floor', () => {
    it('does nothing in level flight at altitude', () => {
        expect(terrainFloor(state(), -1)).toBe(-1);
    });

    it('commands a full pull below the hard floor whatever the stick says', () => {
        const s = state({ altitudeAgl: ASSIST_TUNING.hardFloorAgl - 10, verticalSpeed: -20 });
        expect(terrainFloor(s, -1)).toBe(1);
    });

    it('fights harder the lower and faster the descent', () => {
        const high = terrainFloor(state({ altitudeAgl: 150, verticalSpeed: -10 }), -1);
        const lower = terrainFloor(state({ altitudeAgl: 120, verticalSpeed: -10 }), -1);
        const faster = terrainFloor(state({ altitudeAgl: 120, verticalSpeed: -40 }), -1);
        expect(lower).toBeGreaterThan(high);
        expect(faster).toBeGreaterThan(lower);
    });

    it('reacts to closure rate well above the soft floor', () => {
        // 600 m up is nowhere near the floor, but at 70 m/s down it is under
        // nine seconds from the ground, and that is what the law measures.
        const sinking = terrainFloor(state({ altitudeAgl: 600, verticalSpeed: -70 }), 0);
        expect(sinking).toBeGreaterThan(0);
        // The same height in level flight is left completely alone.
        expect(terrainFloor(state({ altitudeAgl: 600, verticalSpeed: 0 }), 0)).toBe(0);
    });

    it('commands a full pull once impact is inside the pull-up time', () => {
        // 300 m at 60 m/s: under four seconds of air left.
        expect(terrainFloor(state({ altitudeAgl: 300, verticalSpeed: -60 }), -1)).toBe(1);
    });

    it('lets a gentle descent continue near the soft floor', () => {
        // Just under the floor, barely descending. The floor blends rather
        // than switching, so what matters is that the correction here is
        // small enough that the pilot still owns the descent.
        const s = state({ altitudeAgl: 179, verticalSpeed: -1 });
        expect(Math.abs(terrainFloor(s, -0.5) - -0.5)).toBeLessThan(0.02);
    });
});

describe('carrier approach', () => {
    /**
     * The floor is set at 180 m AGL and the deck is 20 m above the water. If
     * the protections applied on final, the default assist level would make a
     * trap impossible - which is a far worse bug than the crash it prevents.
     */
    it('stands the terrain floor down on an approach', () => {
        const s = state({ altitudeAgl: 45, verticalSpeed: -6, onApproach: true });
        expect(terrainFloor(s, -0.3)).toBe(-0.3);
        expect(resolveControls('ASSIST', s, input({ pitch: -0.3 }), null).pitch).toBeCloseTo(-0.3, 6);
    });

    it('still floors the jet at the same height when it is not an approach', () => {
        const s = state({ altitudeAgl: 45, verticalSpeed: -6, onApproach: false });
        expect(terrainFloor(s, -0.3)).toBe(1);
    });

    it('hands the aeroplane back when the autopilot is on and you turn final', () => {
        const nav = { bearing: 2.5, altitudeAgl: 900, airSpeed: 240 };
        const s = state({ yaw: 0, roll: 0.4, altitudeAgl: 200, onApproach: true });
        const d = resolveControls('AUTO', s, input(), nav);
        expect(d.override).toBe('LEVEL');
        // Levelling the wings, not flying off to the nav target.
        expect(d.roll).toBeLessThan(0);
    });

    /**
     * ...except for the recovery assist, which is the one nav target in the
     * game whose entire purpose is to fly the approach. It stops at short
     * final on its own, so the refusal here would only prevent it starting.
     */
    it('lets the recovery assist fly the approach when it asks to', () => {
        const nav = { bearing: 0, altitudeAgl: 200, airSpeed: 70, overridesApproach: true };
        const s = state({ yaw: 2.5, roll: 0, altitudeAgl: 200, onApproach: true });
        const d = resolveControls('AUTO', s, input(), nav);
        expect(d.override).toBe('AUTOPILOT');
    });

    it('still refuses an ordinary nav target on an approach', () => {
        const nav = { bearing: 0, altitudeAgl: 200, airSpeed: 70, overridesApproach: false };
        const s = state({ yaw: 2.5, roll: 0, altitudeAgl: 200, onApproach: true });
        expect(resolveControls('AUTO', s, input(), nav).override).not.toBe('AUTOPILOT');
    });
});

describe('assist level persistence', () => {
    const withStorage = (store: Map<string, string> | null, run: () => void) => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: store === null ? undefined : {
                getItem: (k: string) => store.get(k) ?? null,
                setItem: (k: string, v: string) => { store.set(k, v); }
            }
        });
        try {
            run();
        } finally {
            if (original) Object.defineProperty(globalThis, 'localStorage', original);
            else delete (globalThis as Record<string, unknown>).localStorage;
        }
    };

    it('defaults to ASSIST so a first sortie is flyable', () => {
        expect(DEFAULT_ASSIST_LEVEL).toBe('ASSIST');
        withStorage(new Map(), () => expect(loadAssistLevel()).toBe('ASSIST'));
    });

    it('round-trips a stored level', () => {
        const store = new Map<string, string>();
        withStorage(store, () => {
            saveAssistLevel('AUTO');
            expect(loadAssistLevel()).toBe('AUTO');
        });
    });

    it('ignores a corrupt stored value', () => {
        const store = new Map([['carrier-vector-1988.assistLevel', 'HYPERDRIVE']]);
        withStorage(store, () => expect(loadAssistLevel()).toBe(DEFAULT_ASSIST_LEVEL));
    });

    it('survives storage being unavailable in both directions', () => {
        withStorage(null, () => {
            expect(loadAssistLevel()).toBe(DEFAULT_ASSIST_LEVEL);
            expect(() => saveAssistLevel('MANUAL')).not.toThrow();
        });
    });
});

describe('attitude hold', () => {
    it('rolls back toward level when the stick is centred', () => {
        expect(attitudeHold(state({ roll: 0.6 }), input()).roll).toBeLessThan(0);
        expect(attitudeHold(state({ roll: -0.6 }), input()).roll).toBeGreaterThan(0);
    });

    it('does not fight a pilot roll input', () => {
        expect(attitudeHold(state({ roll: 0.6 }), input({ roll: 1 })).roll).toBe(1);
    });

    it('brings a nose-high attitude back down when the stick is centred', () => {
        expect(attitudeHold(state({ pitch: 0.4 }), input()).pitch).toBeLessThan(0);
    });

    it('passes a pilot pitch demand through untouched', () => {
        expect(attitudeHold(state({ pitch: 0.4 }), input({ pitch: 1 })).pitch).toBe(1);
    });

    it('stays inside the control envelope for an extreme attitude', () => {
        const held = attitudeHold(state({ pitch: 1.4, roll: -3.0 }), input());
        expect(Math.abs(held.pitch)).toBeLessThanOrEqual(1);
        expect(Math.abs(held.roll)).toBeLessThanOrEqual(1);
    });
});

describe('autopilot', () => {
    it('coordinates the rudder with the bank, because bank alone cannot turn this jet', () => {
        const right = autopilotDemand(state({ yaw: 0 }), { bearing: 0.6, altitudeAgl: 800, airSpeed: 220 });
        const left = autopilotDemand(state({ yaw: 0.6 }), { bearing: 0, altitudeAgl: 800, airSpeed: 220 });
        expect(right.yaw).toBeGreaterThan(0);
        expect(left.yaw).toBeLessThan(0);
        // Same direction as the bank: a turn, not a skid against it.
        expect(Math.sign(right.yaw)).toBe(Math.sign(right.roll));
    });

    it('centres the rudder once the bearing is captured', () => {
        const d = autopilotDemand(state({ yaw: 1.2 }), { bearing: 1.2, altitudeAgl: 800, airSpeed: 220 });
        expect(d.yaw).toBeCloseTo(0, 6);
    });

    it('banks the short way toward the target bearing', () => {
        const right = autopilotDemand(state({ yaw: 0 }), { bearing: 0.6, altitudeAgl: 800, airSpeed: 220 });
        const left = autopilotDemand(state({ yaw: 0.6 }), { bearing: 0, altitudeAgl: 800, airSpeed: 220 });
        expect(right.roll).toBeGreaterThan(0);
        expect(left.roll).toBeLessThan(0);
    });

    it('turns the short way across the 0/2pi wrap', () => {
        const d = autopilotDemand(state({ yaw: 0.1 }), { bearing: 6.1, altitudeAgl: 800, airSpeed: 220 });
        expect(d.roll).toBeLessThan(0);
    });

    it('respects a bank limit', () => {
        const s = state({ yaw: 0, roll: 0 });
        const gentle = autopilotDemand(s, { bearing: 3.0, altitudeAgl: 800, airSpeed: 220, maxBank: 0.2 });
        // Rolling toward a 0.2 rad bank from level cannot demand more than
        // 0.2 * 2.2 of stick.
        expect(gentle.roll).toBeLessThanOrEqual(0.2 * 2.2 + 1e-9);
    });

    it('climbs when low and descends when high', () => {
        const low = autopilotDemand(state({ altitudeAgl: 200 }), { bearing: 0, altitudeAgl: 900, airSpeed: 220 });
        const high = autopilotDemand(state({ altitudeAgl: 1600 }), { bearing: 0, altitudeAgl: 900, airSpeed: 220 });
        expect(low.pitch).toBeGreaterThan(0);
        expect(high.pitch).toBeLessThan(0);
    });

    it('advances the throttle when slow and retards it when fast', () => {
        const slow = autopilotDemand(state({ airSpeed: 150 }), { bearing: 0, altitudeAgl: 900, airSpeed: 240 });
        const fast = autopilotDemand(state({ airSpeed: 330 }), { bearing: 0, altitudeAgl: 900, airSpeed: 240 });
        expect(slow.throttle).toBeGreaterThan(0);
        expect(fast.throttle).toBeLessThan(0);
    });

    it('keeps every demand inside the control envelope', () => {
        for (const yaw of [0, 1.5, 3, 4.5, 6]) {
            for (const alt of [0, 300, 3000]) {
                for (const roll of [-1.2, 0, 1.2]) {
                    const d = autopilotDemand(
                        state({ yaw, altitudeAgl: alt, roll, airSpeed: 90 }),
                        { bearing: 2.2, altitudeAgl: 600, airSpeed: 240 }
                    );
                    expect(Math.abs(d.pitch)).toBeLessThanOrEqual(1);
                    expect(Math.abs(d.roll)).toBeLessThanOrEqual(1);
                    expect(Math.abs(d.yaw)).toBeLessThanOrEqual(1);
                    expect(Math.abs(d.throttle)).toBeLessThanOrEqual(1);
                }
            }
        }
    });

    /**
     * The point of the autopilot is that it converges. Integrate the same
     * kinematics the flight model uses for heading and altitude, coarsely, and
     * assert it actually arrives instead of oscillating forever.
     */
    it('converges on a bearing and an altitude when flown', () => {
        let s = state({ yaw: 3.0, roll: 0, pitch: 0, altitudeAgl: 300, airSpeed: 220 });
        const target = { bearing: 0.4, altitudeAgl: 1000, airSpeed: 220 };
        const dt = 1 / 30;

        for (let i = 0; i < 4000; i++) {
            const d = autopilotDemand(s, target);
            const roll = Math.max(-1.4, Math.min(1.4, s.roll + d.roll * 2.4 * dt));
            const pitch = Math.max(-1.4, Math.min(1.4, s.pitch + d.pitch * 1.35 * dt));
            // The same control rates AircraftPhysics uses, including the fact
            // that heading comes from the rudder rather than from the bank.
            const yaw = (s.yaw + d.yaw * 0.65 * dt + Math.PI * 2) % (Math.PI * 2);
            const vs = Math.sin(pitch) * s.airSpeed;
            s = { ...s, roll, pitch, yaw, verticalSpeed: vs, altitudeAgl: s.altitudeAgl + vs * dt };
        }

        expect(Math.abs(angleDelta(s.yaw, target.bearing))).toBeLessThan(0.1);
        expect(Math.abs(s.altitudeAgl - target.altitudeAgl)).toBeLessThan(120);
        // And it settles rather than thrashing: wings roughly level on arrival.
        expect(Math.abs(s.roll)).toBeLessThan(0.3);
    });
});

describe('resolveControls', () => {
    const nav = { bearing: 1.0, altitudeAgl: 900, airSpeed: 240 };

    it('MANUAL is a pure pass-through, whatever the aircraft is doing', () => {
        const s = state({ alpha: 0.9, isStalled: true, altitudeAgl: 10, verticalSpeed: -60 });
        const d = resolveControls('MANUAL', s, input({ pitch: 1, roll: -1, throttle: 1 }), nav);
        expect(d).toEqual({ pitch: 1, roll: -1, yaw: 0, throttle: 1, override: 'NONE' });
    });

    it('ASSIST levels the wings when the stick is centred', () => {
        const d = resolveControls('ASSIST', state({ roll: 0.8 }), input(), null);
        expect(d.roll).toBeLessThan(0);
        expect(d.override).toBe('LEVEL');
    });

    it('ASSIST reports no override when the pilot is flying both axes', () => {
        const d = resolveControls('ASSIST', state(), input({ pitch: 0.5, roll: 0.5 }), null);
        expect(d.override).toBe('NONE');
        expect(d.pitch).toBeCloseTo(0.5, 6);
        expect(d.roll).toBeCloseTo(0.5, 6);
    });

    it('ASSIST protects a slow cruising aircraft with anti-stall throttle', () => {
        const slowState = state({ airSpeed: 120, throttle: 0.2, onApproach: false });
        const d = resolveControls('ASSIST', slowState, input(), null);
        expect(d.throttle).toBeGreaterThan(0.5);

        // Does not override intentional retard during landing approach
        const approachState = state({ airSpeed: 120, throttle: 0.2, onApproach: true });
        const dApp = resolveControls('ASSIST', approachState, input({ throttle: -1 }), null);
        expect(dApp.throttle).toBe(-1);
    });

    /**
     * Regression, v1.10.0: the catapult leaves the throttle in full burner and
     * the floor above only pushed up, so a hands-off pilot flew a whole sortie
     * at 150%.
     */
    it('ASSIST comes out of afterburner once flying with the throttle released', () => {
        const d = resolveControls('ASSIST', state({ airSpeed: 230, throttle: 1.5 }), input(), null);
        expect(d.throttle).toBeLessThan(0);
    });

    it('ASSIST leaves the burner alone while the pilot holds it', () => {
        const d = resolveControls('ASSIST', state({ airSpeed: 230, throttle: 1.5 }), input({ throttle: 1 }), null);
        expect(d.throttle).toBe(1);
    });

    it('ASSIST keeps the burner during the slow climb-out off the catapult', () => {
        const d = resolveControls('ASSIST', state({ airSpeed: 165, throttle: 1.5 }), input(), null);
        expect(d.throttle).toBe(0);
    });

    it('ASSIST never touches a throttle the pilot set below military power', () => {
        const d = resolveControls('ASSIST', state({ airSpeed: 260, throttle: 0.8 }), input(), null);
        expect(d.throttle).toBe(0);
    });

    it('MANUAL keeps a latched afterburner', () => {
        const d = resolveControls('MANUAL', state({ airSpeed: 260, throttle: 1.5 }), input(), null);
        expect(d.throttle).toBe(0);
    });

    it('does not cry TERRAIN during a normal climb-out off the catapult', () => {
        // Low, but climbing: the floor may still help, silently.
        const d = resolveControls('ASSIST', state({ altitudeAgl: 120, verticalSpeed: 25 }), input(), null);
        expect(d.override).not.toBe('TERRAIN');
    });

    it('still cries TERRAIN when sinking toward the ground', () => {
        const d = resolveControls('ASSIST', state({ altitudeAgl: 120, verticalSpeed: -30 }), input({ pitch: -1 }), null);
        expect(d.override).toBe('TERRAIN');
    });

    it('annunciates STALL when the limiter trims the pilot back', () => {
        const d = resolveControls('ASSIST', state({ alpha: 0.24 }), input({ pitch: 1, roll: 1 }), null);
        expect(d.pitch).toBeLessThan(1);
        expect(d.override).toBe('STALL');
    });

    it('lets the terrain floor outrank the stall limiter', () => {
        // Deep in the dirt AND at the alpha limit: the floor must still win,
        // because a stall at height is survivable and a ridge is not.
        const s = state({ alpha: 0.26, altitudeAgl: 40, verticalSpeed: -50 });
        const d = resolveControls('ASSIST', s, input({ pitch: -1 }), null);
        expect(d.pitch).toBe(1);
        expect(d.override).toBe('TERRAIN');
    });

    it('AUTO flies the nav target with no pilot input at all', () => {
        const d = resolveControls('AUTO', state({ yaw: 0 }), input(), nav);
        expect(d.override).toBe('AUTOPILOT');
        expect(d.roll).toBeGreaterThan(0);
    });

    it('AUTO still gives a stick nudge straight through, per axis', () => {
        const d = resolveControls('AUTO', state({ yaw: 0 }), input({ roll: -1 }), nav);
        expect(d.roll).toBe(-1);
        // ...and the autopilot takes its foot off the rudder while they do.
        expect(d.yaw).toBe(0);
        // The untouched pitch axis is still the autopilot's.
        expect(d.override).toBe('AUTOPILOT');
    });

    it('AUTO with no nav target degrades to ASSIST rather than going limp', () => {
        const d = resolveControls('AUTO', state({ roll: 0.8 }), input(), null);
        expect(d.roll).toBeLessThan(0);
        expect(d.override).toBe('LEVEL');
    });

    it('AUTO cannot fly itself into the ground or into a stall', () => {
        // Sinking hard near the ground, the autopilot's own flight-path damping
        // already pulls full up; whichever law is responsible, the jet pulls.
        const low = resolveControls('AUTO', state({ altitudeAgl: 30, verticalSpeed: -40 }), input(), nav);
        expect(low.pitch).toBe(1);

        // The floor's real job: an autopilot COMMANDED into the ground (a nav
        // target below the terrain) is overruled, and says so.
        const diving = resolveControls(
            'AUTO', state({ altitudeAgl: 30, verticalSpeed: -40 }), input(), { ...nav, altitudeAgl: 0 }
        );
        expect(diving.override).toBe('TERRAIN');
        expect(diving.pitch).toBeGreaterThan(0.9);

        const stalled = resolveControls('AUTO', state({ isStalled: true }), input(), nav);
        expect(stalled.override).toBe('STALL');
        expect(stalled.pitch).toBeLessThanOrEqual(-0.6);
    });

    it('never emits a demand outside -1..1 for any level or state', () => {
        const levels = ASSIST_LEVELS;
        for (const level of levels) {
            for (const alt of [0, 60, 175, 4000]) {
                for (const vs of [-90, 0, 40]) {
                    for (const stalled of [false, true]) {
                        const d = resolveControls(
                            level,
                            state({ altitudeAgl: alt, verticalSpeed: vs, isStalled: stalled, alpha: 0.3, yaw: 5 }),
                            input({ pitch: 1, roll: -1, throttle: 1 }),
                            nav
                        );
                        expect(Math.abs(d.pitch)).toBeLessThanOrEqual(1);
                        expect(Math.abs(d.roll)).toBeLessThanOrEqual(1);
                        expect(Math.abs(d.yaw)).toBeLessThanOrEqual(1);
                        expect(Math.abs(d.throttle)).toBeLessThanOrEqual(1);
                    }
                }
            }
        }
    });
});
