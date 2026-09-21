import { describe, it, expect } from 'vitest';
import {
    DEFAULT_SCENARIO,
    MissionDirector,
    SCENARIOS,
    clearedCount,
    recommendScenario,
    scenarioAt,
    scenarioById
} from './Scenarios';
import type { MissionRecords } from './MissionRecords';
import type { MissionSnapshot, ScenarioDef } from './Scenarios';
import { MAPS } from '../tactics/TerrainProfiles';
import { CONTROL_SCHEMA } from './Controls';
import { TacticalTerrain, SensorTacticsManager } from '../tactics/RadarLOS';

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
        flightAssistMode: 'ASSIST',
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
    it('defaults to the carrier defence scenario', () => {
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

    it('names a real map, and spreads the missions across them', () => {
        const used = new Set<string>();
        for (const s of SCENARIOS) {
            const id = s.setup.map ?? 'FJORD';
            expect(MAPS.some(m => m.id === id), `${s.id} -> ${id}`).toBe(true);
            used.add(id);
        }
        // Three maps exist; if a change parks every mission on one of them the
        // work of building the others has been quietly undone.
        expect(used.size).toBeGreaterThanOrEqual(3);
    });

    // The flight checkout's last step is "descend until the RWR goes silent".
    // On a map with no cover that step can never be satisfied, and a new
    // player is stuck on it forever.
    it('puts the flight checkout on a map that can actually mask', () => {
        const intro = SCENARIOS.find(s => s.setup.showTrainingChecklist)!;
        const terrain = new TacticalTerrain(intro.setup.map ?? 'FJORD');
        const sensors = new SensorTacticsManager(terrain);
        expect(sensors.samSites.length).toBeGreaterThan(0);

        let canMask = false;
        for (let z = 1000; z <= 10000 && !canMask; z += 250) {
            const ground = terrain.getElevation(0, z);
            const low = { x: 0, y: ground + 40, z };
            canMask = sensors.samSites.some(site => !sensors.checkLOS(site.position, low));
        }
        expect(canMask, 'the intro map offers no terrain masking').toBe(true);
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

/**
 * Mission prose names keys as plain strings, which sits OUTSIDE the
 * `Controls.ts` single-source-of-truth guarantee. That guarantee was built to
 * stop the README drifting from the code, and it worked - but it stopped at
 * the README, and mission cards kept their own hardcoded copies.
 *
 * That is how TRAINING_SORTIE came to instruct a brand-new pilot to press [A]
 * for autopilot, in four separate places. [A] is roll left. The assist key is
 * [F]. The one mission built to teach beginners told them to roll into the
 * fjord, and nothing in 809 tests noticed.
 *
 * These two suites extend the boundary to cover every key the game shows a
 * player inside a mission.
 */
describe('mission prose cannot drift from the control schema', () => {
    /** 'W / UP' -> ['W','UP']; 'SPACE' -> ['SPACE']. */
    function schemaTokens(display: string): string[] {
        return display.split('/').map(t => t.trim().toUpperCase()).filter(Boolean);
    }

    /** Every key token the schema knows about, in any context. */
    const KNOWN = new Set<string>(
        CONTROL_SCHEMA.flatMap(b => schemaTokens(b.display))
    );

    /**
     * Prose shorthands that stand for a group of real bindings rather than one
     * key. Listed explicitly so a typo cannot hide behind "probably a group".
     */
    const GROUPS: Record<string, string[]> = {
        WASD: ['W', 'A', 'S', 'D'],
        '1-4': ['1', '2', '3', '4'],
        '1-5': ['1', '2', '3', '4', '5']
    };

    function expand(promptKey: string): string[] {
        const group = GROUPS[promptKey.toUpperCase()];
        if (group) return group;
        return promptKey.split('/').map(t => t.trim().toUpperCase()).filter(Boolean);
    }

    it('names only keys the control schema actually binds', () => {
        for (const scenario of SCENARIOS) {
            const named: [string, string][] = [
                ...scenario.cards.flatMap(c => c.keys.map(k => [k[0], `card "${c.title}"`] as [string, string])),
                ...scenario.phases
                    .filter(p => p.key)
                    .map(p => [p.key as string, `phase "${p.id}"`] as [string, string])
            ];

            for (const [promptKey, where] of named) {
                for (const token of expand(promptKey)) {
                    expect(
                        KNOWN.has(token),
                        `${scenario.id} ${where} names "${token}", which no CONTROL_SCHEMA binding provides`
                    ).toBe(true);
                }
            }
        }
    });

    /**
     * The structural check above would NOT have caught the [A] bug, because
     * [A] is a perfectly real binding - it is just the wrong one. So this
     * check reads the card's own description of what the key does and asserts
     * the key matches the binding that actually does it.
     *
     * Both sides are derived from CONTROL_SCHEMA; nothing here hardcodes a key.
     */
    const CONCEPTS: { prose: RegExp; schemaLabel: RegExp }[] = [
        { prose: /autopilot|flight assist/i, schemaLabel: /cycle flight assist/i },
        { prose: /recovery assist/i, schemaLabel: /recovery assist/i },
        { prose: /^launch/i, schemaLabel: /launch from catapult/i },
        { prose: /rush/i, schemaLabel: /rush the turnaround/i },
        { prose: /padlock/i, schemaLabel: /padlock camera/i },
        { prose: /designat/i, schemaLabel: /designate next target/i }
    ];

    it('uses the key that actually performs the action the prose describes', () => {
        for (const scenario of SCENARIOS) {
            for (const card of scenario.cards) {
                for (const [promptKey, label] of card.keys) {
                    for (const { prose, schemaLabel } of CONCEPTS) {
                        if (!prose.test(label)) continue;

                        const binding = CONTROL_SCHEMA.find(b => schemaLabel.test(b.label));
                        expect(binding, `no binding matches ${schemaLabel}`).toBeDefined();

                        const valid = schemaTokens(binding!.display);
                        const used = expand(promptKey);
                        expect(
                            used.some(t => valid.includes(t)),
                            `${scenario.id} card "${card.title}" says "${promptKey}" does "${label}", `
                            + `but that action is bound to "${binding!.display}"`
                        ).toBe(true);
                    }
                }
            }
        }
    });
});

describe('progression guidance', () => {
    // REGRESSION: this asserted `showTrainingChecklist`, which is the
    // six-step key checkout and belongs to CARRIER_DEFENSE - the endless wave
    // mode, with a live SAM belt. So the assertion passed while every
    // first-time pilot was being routed into combat, and the guided
    // TRAINING_SORTIE built for exactly this purpose was unreachable.
    // Assert the mission, not the flag.
    it('sends a brand-new player to the guided sortie, not into combat', () => {
        const first = recommendScenario({});
        expect(first.id).toBe('TRAINING_SORTIE');
        expect(first.setup.isFirstFlight).toBe(true);
        expect(first.setup.noSamSites).toBe(true);
        expect(first.setup.combatShielded).toBe(true);
    });

    it('marks exactly one scenario as the first flight', () => {
        expect(SCENARIOS.filter(s => s.setup.isFirstFlight)).toHaveLength(1);
    });

    it('falls back to the gentlest uncleared mission once anything has been flown', () => {
        const records: MissionRecords = {
            CARRIER_DEFENSE: { best: 300, completions: 0, attempts: 1 }
        };
        const next = recommendScenario(records);
        expect(next.id).toBe('CARRIER_QUALS');
        expect(next.difficulty).toBe(Math.min(...SCENARIOS.map(s => s.difficulty)));
    });

    it('does not recommend a mission already cleared', () => {
        const records: MissionRecords = { CARRIER_QUALS: { best: 900, completions: 1, attempts: 1 } };
        expect(recommendScenario(records).id).not.toBe('CARRIER_QUALS');
    });

    it('prefers a mission already in progress among equally hard ones', () => {
        const records: MissionRecords = {
            CARRIER_QUALS: { best: 900, completions: 1, attempts: 1 },
            // Both five-pip missions; one has been attempted three times.
            LAST_STAND: { best: 400, completions: 0, attempts: 3 }
        };
        const withHarderOnly: MissionRecords = {
            ...records,
            CARRIER_DEFENSE: { best: 10, completions: 1, attempts: 1 },
            CANYON_STRIKE: { best: 10, completions: 1, attempts: 1 },
            IRON_HAND: { best: 10, completions: 1, attempts: 1 },
            TRAINING_SORTIE: { best: 10, completions: 1, attempts: 1 }
        };
        expect(recommendScenario(withHarderOnly).id).toBe('LAST_STAND');
    });

    it('points at the hardest mission once everything is cleared', () => {
        const records: MissionRecords = {};
        for (const s of SCENARIOS) records[s.id] = { best: 100, completions: 1, attempts: 1 };
        const hardest = Math.max(...SCENARIOS.map(s => s.difficulty));
        expect(recommendScenario(records).difficulty).toBe(hardest);
    });

    it('counts cleared missions and ignores attempts that never won', () => {
        expect(clearedCount({})).toBe(0);
        expect(clearedCount({
            CANYON_STRIKE: { best: 50, completions: 0, attempts: 9 },
            IRON_HAND: { best: 50, completions: 2, attempts: 4 }
        })).toBe(1);
    });

    it('always recommends a real scenario, for any record set', () => {
        const sets: MissionRecords[] = [
            {},
            { NOT_A_MISSION: { best: 5, completions: 5, attempts: 5 } },
            { CARRIER_QUALS: { best: 0, completions: 0, attempts: 0 } }
        ];
        for (const records of sets) {
            expect(SCENARIOS).toContain(recommendScenario(records));
        }
    });
});
