import { describe, it, expect } from 'vitest';
import {
    DEFAULT_SCENARIO,
    MissionDirector,
    SCENARIOS,
    scenarioAt,
    scenarioById
} from './Scenarios';
import type { MissionSnapshot, ScenarioDef } from './Scenarios';

/** A quiet world: nothing has happened yet, nothing is wrong. */
function snapshot(over: Partial<MissionSnapshot> = {}): MissionSnapshot {
    return {
        missionSeconds: 0,
        isAirborne: false,
        hasLaunched: false,
        isRecovered: false,
        altitudeMsl: 22,
        altitudeAgl: 0,
        airSpeed: 0,
        fuel: 4800,
        damage: 0,
        distanceToCarrier: 0,
        distanceToStrikeTarget: 10400,
        strikeTargetDestroyed: false,
        strikeTargetHits: 0,
        samSitesAlive: 3,
        samSitesTotal: 3,
        contactsAlive: 0,
        liveInboundPackages: 0,
        soonestEtaSeconds: null,
        packagesLeaked: 0,
        carrierHealth: 100,
        airframesLost: 0,
        spareAirframes: 4,
        traps: 0,
        perfectTraps: 0,
        bombsRemaining: 2,
        rwrState: 'SILENT',
        ...over
    };
}

/** Drive a director through a sequence of world states. */
function run(scenario: ScenarioDef, states: Partial<MissionSnapshot>[]) {
    const director = new MissionDirector(scenario);
    let status = director.update(snapshot(states[0]));
    for (const state of states.slice(1)) {
        status = director.update(snapshot(state));
    }
    return { director, status };
}

describe('scenario catalogue', () => {
    it('defaults to the endless carrier defence mode', () => {
        expect(DEFAULT_SCENARIO).toBe('CARRIER_DEFENSE');
        expect(SCENARIOS[0].id).toBe('CARRIER_DEFENSE');
    });

    it('offers a spread of difficulties rather than five of the same thing', () => {
        const levels = new Set(SCENARIOS.map(s => s.difficulty));
        expect(levels.size).toBeGreaterThanOrEqual(3);
        expect(Math.min(...SCENARIOS.map(s => s.difficulty))).toBe(1);
        expect(Math.max(...SCENARIOS.map(s => s.difficulty))).toBe(5);
    });

    it('gives every scenario the copy both screens need', () => {
        for (const s of SCENARIOS) {
            expect(s.name.length, s.id).toBeGreaterThan(0);
            expect(s.tagline.length, s.id).toBeGreaterThan(0);
            expect(s.lossCondition.length, s.id).toBeGreaterThan(0);
            expect(s.duration.length, s.id).toBeGreaterThan(0);
            expect(s.cards, `${s.id} cards`).toHaveLength(3);
            for (const card of s.cards) {
                expect(card.title.length, s.id).toBeGreaterThan(0);
                expect(card.body.length, s.id).toBeGreaterThan(0);
                expect(card.keys.length, s.id).toBeGreaterThan(0);
            }
            expect(s.difficulty).toBeGreaterThanOrEqual(1);
            expect(s.difficulty).toBeLessThanOrEqual(5);
        }
    });

    it('has unique ids and unique names', () => {
        expect(new Set(SCENARIOS.map(s => s.id)).size).toBe(SCENARIOS.length);
        expect(new Set(SCENARIOS.map(s => s.name)).size).toBe(SCENARIOS.length);
    });

    it('wraps the selector in both directions', () => {
        expect(scenarioAt(0).id).toBe(SCENARIOS[0].id);
        expect(scenarioAt(SCENARIOS.length).id).toBe(SCENARIOS[0].id);
        expect(scenarioAt(-1).id).toBe(SCENARIOS[SCENARIOS.length - 1].id);
        expect(scenarioAt(-SCENARIOS.length - 1).id).toBe(SCENARIOS[SCENARIOS.length - 1].id);
    });

    it('falls back to the first scenario for an unknown id', () => {
        expect(scenarioById('NOPE' as never).id).toBe(SCENARIOS[0].id);
    });

    it('only runs the flight checkout in the intro mode', () => {
        for (const s of SCENARIOS) {
            const wantsChecklist = s.setup.showTrainingChecklist === true;
            expect(wantsChecklist, s.id).toBe(s.id === 'CARRIER_DEFENSE');
        }
    });

    it('every phase produces prose for any world state', () => {
        // The detail strings are functions; a scenario must never be able to
        // throw while the HUD is asking it what to say.
        const states = [
            snapshot(),
            snapshot({ isAirborne: true, hasLaunched: true, bombsRemaining: 0 }),
            snapshot({ distanceToStrikeTarget: null, soonestEtaSeconds: null, samSitesAlive: 0 }),
            snapshot({ strikeTargetDestroyed: true, traps: 3, perfectTraps: 1, carrierHealth: 5 })
        ];
        for (const scenario of SCENARIOS) {
            for (const phase of scenario.phases) {
                for (const state of states) {
                    expect(typeof phase.detail(state), `${scenario.id}/${phase.id}`).toBe('string');
                    expect(phase.detail(state).length).toBeGreaterThan(0);
                    expect(typeof phase.isComplete(state)).toBe('boolean');
                }
            }
            for (const state of states) {
                const f = scenario.failure(state);
                expect(f === null || typeof f === 'string', scenario.id).toBe(true);
            }
        }
    });
});

describe('MissionDirector', () => {
    it('leaves the endless mode without scripted phases', () => {
        const { status } = run(scenarioById('CARRIER_DEFENSE'), [{}]);
        expect(status.phase).toBeNull();
        // A scenario with no phases must never auto-win by running out of them.
        expect(status.outcome).toBe('ACTIVE');
    });

    it('still fails the endless mode when the hull is gone', () => {
        const { status } = run(scenarioById('CARRIER_DEFENSE'), [{}, { carrierHealth: 0 }]);
        expect(status.outcome).toBe('FAILED');
        expect(status.reason).toMatch(/CV-68/);
    });

    it('walks the canyon strike from launch to recovery', () => {
        const scenario = scenarioById('CANYON_STRIKE');
        const director = new MissionDirector(scenario);

        expect(director.update(snapshot()).phase?.id).toBe('LAUNCH');

        expect(director.update(snapshot({
            hasLaunched: true, isAirborne: true, distanceToStrikeTarget: 9000
        })).phase?.id).toBe('INGRESS');

        expect(director.update(snapshot({
            hasLaunched: true, isAirborne: true, distanceToStrikeTarget: 1800
        })).phase?.id).toBe('STRIKE');

        expect(director.update(snapshot({
            hasLaunched: true, isAirborne: true, distanceToStrikeTarget: 900,
            strikeTargetDestroyed: true
        })).phase?.id).toBe('EGRESS');

        expect(director.update(snapshot({
            hasLaunched: true, isAirborne: true, distanceToStrikeTarget: 9000,
            strikeTargetDestroyed: true
        })).phase?.id).toBe('RECOVER');

        const done = director.update(snapshot({
            hasLaunched: true, isAirborne: false, isRecovered: true,
            distanceToStrikeTarget: 10400, strikeTargetDestroyed: true, traps: 1
        }));
        expect(done.outcome).toBe('SUCCESS');
        expect(done.phase).toBeNull();
    });

    it('advances through several phases satisfied on the same tick', () => {
        // A single fast pass can complete ingress and strike together; the
        // director must not stall one phase per tick.
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        director.update(snapshot());
        const status = director.update(snapshot({
            hasLaunched: true, isAirborne: true,
            distanceToStrikeTarget: 400, strikeTargetDestroyed: true
        }));
        expect(status.phase?.id).toBe('EGRESS');
    });

    it('never un-completes a phase when the world moves back', () => {
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        director.update(snapshot());
        director.update(snapshot({ hasLaunched: true, isAirborne: true, distanceToStrikeTarget: 1000 }));
        // Fly back out again without dropping: still the STRIKE phase, not INGRESS.
        const status = director.update(snapshot({
            hasLaunched: true, isAirborne: true, distanceToStrikeTarget: 9000
        }));
        expect(status.phase?.id).toBe('STRIKE');
    });

    // A single crash used to end the raid outright; the window is what should
    // punish the player, so losing a jet has to be survivable.
    it('does not fail the strike for a lost airframe while jets remain', () => {
        const { status } = run(scenarioById('CANYON_STRIKE'), [
            {},
            {
                hasLaunched: true, isAirborne: false, airframesLost: 1,
                spareAirframes: 3, missionSeconds: 90
            }
        ]);
        expect(status.outcome).toBe('ACTIVE');
    });

    it('fails the strike once the boat runs out of jets', () => {
        const { status } = run(scenarioById('CANYON_STRIKE'), [
            {},
            {
                hasLaunched: true, isAirborne: false, airframesLost: 4,
                spareAirframes: 0, missionSeconds: 120
            }
        ]);
        expect(status.outcome).toBe('FAILED');
        expect(status.reason).toMatch(/airframes/i);
    });

    it('fails the strike when the window closes with the pen intact', () => {
        const { status } = run(scenarioById('CANYON_STRIKE'), [
            {},
            { hasLaunched: true, isAirborne: true, missionSeconds: 241 }
        ]);
        expect(status.outcome).toBe('FAILED');
        expect(status.reason).toMatch(/blast doors/i);
    });

    it('does not fail the strike on the clock once the pen is down', () => {
        const { status } = run(scenarioById('CANYON_STRIKE'), [
            {},
            {
                hasLaunched: true, isAirborne: true, missionSeconds: 600,
                strikeTargetDestroyed: true, distanceToStrikeTarget: 9000
            }
        ]);
        expect(status.outcome).toBe('ACTIVE');
    });

    it('hides the clock once the window no longer applies', () => {
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        const running = director.update(snapshot({ missionSeconds: 30 }));
        expect(running.secondsRemaining).toBeCloseTo(210, 5);

        const struck = director.update(snapshot({
            missionSeconds: 60, hasLaunched: true, isAirborne: true,
            strikeTargetDestroyed: true, distanceToStrikeTarget: 500
        }));
        expect(struck.secondsRemaining).toBeNull();
    });

    it('reports untimed scenarios as having no clock', () => {
        const { status } = run(scenarioById('IRON_HAND'), [{}]);
        expect(status.secondsRemaining).toBeNull();
    });

    it('completes iron hand only when every launcher is down', () => {
        const director = new MissionDirector(scenarioById('IRON_HAND'));
        director.update(snapshot());
        expect(director.update(snapshot({
            hasLaunched: true, isAirborne: true, samSitesAlive: 1
        })).phase?.id).toBe('SEAD');
        expect(director.update(snapshot({
            hasLaunched: true, isAirborne: true, samSitesAlive: 0
        })).phase?.id).toBe('RECOVER');
    });

    it('completes carrier quals only with three traps AND a 3-wire', () => {
        const scenario = scenarioById('CARRIER_QUALS');
        expect(run(scenario, [{ traps: 3, perfectTraps: 0 }]).status.outcome).toBe('ACTIVE');
        expect(run(scenario, [{ traps: 2, perfectTraps: 2 }]).status.outcome).toBe('ACTIVE');
        expect(run(scenario, [{ traps: 3, perfectTraps: 1 }]).status.outcome).toBe('SUCCESS');
    });

    it('cannot be shot down in carrier quals', () => {
        const scenario = scenarioById('CARRIER_QUALS');
        expect(scenario.setup.noSamSites).toBe(true);
        expect(scenario.setup.threat.openingTimeline).toEqual([]);
        expect(scenario.setup.threat.endlessWaves).toBe(false);
    });

    it('emits each phase callout exactly once, on entry', () => {
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        // The launch phase carries no callout, so the first tick is silent.
        expect(director.update(snapshot()).callouts).toEqual([]);

        const entered = director.update(snapshot({ hasLaunched: true, isAirborne: true }));
        expect(entered.callouts).toEqual(['FEET DRY. RUNNING THE FJORD.']);

        // Same state again: nothing new to say.
        expect(director.update(snapshot({ hasLaunched: true, isAirborne: true })).callouts).toEqual([]);
    });

    it('emits a callout for a scenario whose first phase has one', () => {
        const director = new MissionDirector(scenarioById('CARRIER_QUALS'));
        expect(director.update(snapshot()).callouts.length).toBeGreaterThan(0);
        expect(director.update(snapshot()).callouts).toEqual([]);
    });

    it('renders the current phase as an objective the screens can draw', () => {
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        const s = snapshot();
        director.update(s);
        const objective = director.objective(s);

        expect(objective).not.toBeNull();
        expect(objective!.title.length).toBeGreaterThan(0);
        expect(objective!.detail.length).toBeGreaterThan(0);
        expect(objective!.key).toBe('ENTER');
        expect(objective!.countdownSeconds).toBeCloseTo(240, 5);
    });

    // REGRESSION: a pilot who lost a jet mid-raid was told "RUN THE FJORD -
    // 8.1 km to the pen" while sitting in the hangar. An air phase must hand
    // the line back to the deck director when the jet is on deck.
    it('yields the objective to the deck while an air phase is current', () => {
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        const onDeck = snapshot({ hasLaunched: true, isAirborne: false });

        // The launch phase IS a deck phase, so it speaks on the deck.
        expect(director.objective(snapshot())).not.toBeNull();

        director.update(snapshot({ hasLaunched: true, isAirborne: true }));
        expect(director.update(onDeck).phase?.id).toBe('INGRESS');
        expect(director.objective(onDeck)).toBeNull();

        // Airborne again, and the phase speaks for itself.
        expect(director.objective(snapshot({ hasLaunched: true, isAirborne: true }))).not.toBeNull();
    });

    it('keeps the mission clock running even while the deck is talking', () => {
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        const onDeck = snapshot({ hasLaunched: true, isAirborne: false, missionSeconds: 45 });
        director.update(snapshot({ hasLaunched: true, isAirborne: true }));
        director.update(onDeck);

        expect(director.objective(onDeck)).toBeNull();
        expect(director.clock(onDeck)).toBeCloseTo(195, 5);
    });

    it('stops the clock once the mission is decided', () => {
        const director = new MissionDirector(scenarioById('CANYON_STRIKE'));
        const lost = snapshot({ carrierHealth: 0, missionSeconds: 30 });
        director.update(lost);
        expect(director.clock(lost)).toBeNull();
    });

    it('stops offering an objective once the mission is over', () => {
        const scenario = scenarioById('CARRIER_QUALS');
        const director = new MissionDirector(scenario);
        const won = snapshot({ traps: 3, perfectTraps: 1 });
        director.update(won);
        expect(director.objective(won)).toBeNull();
    });

    // A mission you have already completed cannot fail: landing the last
    // sortie on the last airframe is a win, not a loss.
    it('lets victory win a tie with a failure condition', () => {
        const director = new MissionDirector(scenarioById('IRON_HAND'));
        director.update(snapshot());
        director.update(snapshot({ hasLaunched: true, isAirborne: true, samSitesAlive: 0 }));

        const status = director.update(snapshot({
            hasLaunched: true, isAirborne: false, isRecovered: true,
            samSitesAlive: 0, traps: 1, spareAirframes: 0
        }));
        expect(status.outcome).toBe('SUCCESS');
    });

    it('fails a scenario that runs the boat out of airframes', () => {
        const { status } = run(scenarioById('LAST_STAND'), [
            {},
            { hasLaunched: true, isAirborne: false, spareAirframes: 0, liveInboundPackages: 3 }
        ]);
        expect(status.outcome).toBe('FAILED');
        expect(status.reason).toMatch(/airframes/i);
    });

    it('keeps the outcome once it is decided', () => {
        const director = new MissionDirector(scenarioById('CARRIER_DEFENSE'));
        director.update(snapshot({ carrierHealth: 0 }));
        // The hull cannot un-sink.
        const later = director.update(snapshot({ carrierHealth: 100 }));
        expect(later.outcome).toBe('FAILED');
    });
});
