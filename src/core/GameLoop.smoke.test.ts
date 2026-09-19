/**
 * Integration smoke test for the bridge loop.
 *
 * Unit tests cover the pure math, but the highest-risk defects in this
 * project are wiring bugs: a renamed method, a missing argument, a null
 * subsystem reference. This test stands up a minimal fake Canvas2D
 * environment, constructs the real GameLoop with all real subsystems, and
 * drives many simulated frames through every phase and view, asserting the
 * whole thing runs without throwing and that state actually progresses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { angleDelta } from '../flight/FlightAssist';

/**
 * Minimal Canvas2D stub covering every call the renderer/HUD/deck view make.
 *
 * The drawing calls are plain no-ops rather than `vi.fn()`: a single frame
 * issues thousands of them, and a long run recorded enough call arguments to
 * abort the test worker. Nothing here asserts on draw calls - the tests assert
 * on simulation state.
 */
function makeContextStub() {
    const noop = () => {};
    return {
        canvas: { width: 1280, height: 800 },
        fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
        shadowColor: '', shadowBlur: 0, globalAlpha: 1,
        globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
        textAlign: 'left' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
        filter: 'none', imageSmoothingEnabled: true,
        fillRect: noop, clearRect: noop, strokeRect: noop,
        beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
        arc: noop, arcTo: noop, ellipse: noop, rect: noop,
        stroke: noop, fill: noop, clip: noop,
        save: noop, restore: noop, translate: noop, rotate: noop,
        scale: noop, setTransform: noop, resetTransform: noop,
        setLineDash: noop, drawImage: noop,
        fillText: noop,
        measureText: (t: string) => ({ width: t.length * 7 }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop })
    };
}

function makeCanvasStub(width = 1280, height = 800) {
    const ctx = makeContextStub();
    return {
        width, height,
        style: {} as CSSStyleDeclaration,
        getContext: () => ctx as unknown as CanvasRenderingContext2D
    } as unknown as HTMLCanvasElement;
}

describe('GameLoop integration smoke test', () => {
    let GameLoop: typeof import('./GameLoop').GameLoop;
    let TrainingSequence: typeof import('./Tutorial').TrainingSequence;

    beforeEach(async () => {
        // PostProcess allocates offscreen canvases via document.createElement.
        vi.stubGlobal('document', {
            createElement: (tag: string) => {
                if (tag === 'canvas') return makeCanvasStub();
                return {};
            },
            addEventListener: vi.fn(),
            documentElement: { dataset: {}, style: { setProperty: vi.fn() } }
        });
        vi.stubGlobal('window', { addEventListener: vi.fn(), innerWidth: 1280, innerHeight: 800 });
        vi.stubGlobal('requestAnimationFrame', vi.fn());

        GameLoop = (await import('./GameLoop')).GameLoop;
        TrainingSequence = (await import('./Tutorial')).TrainingSequence;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    /** Drive n frames of the private step() via its public rAF entry. */
    function runFrames(game: InstanceType<typeof GameLoop>, frames: number, msPerFrame = 16.7) {
        const step = (game as unknown as { step: (t: number) => void }).step.bind(game);
        let t = 0;
        for (let i = 0; i < frames; i++) {
            t += msPerFrame;
            step(t);
        }
    }

    it('constructs with every subsystem wired', () => {
        const game = new GameLoop(makeCanvasStub());
        expect(game.physics).toBeDefined();
        expect(game.deck).toBeDefined();
        expect(game.sensors).toBeDefined();
        expect(game.weapons).toBeDefined();
        expect(game.score).toBeDefined();
        expect(game.phase).toBe('BOOT');
    });

    it('spawns airborne contacts for every package in the opening timeline', () => {
        const game = new GameLoop(makeCanvasStub());
        const expected = game.deck.strikeTimeline.reduce((n, p) => n + p.count, 0);
        expect(game.airborneTargets.length).toBe(expected);
        // Regression: STRIKE-3 previously had no aircraft at all, so it could
        // never be intercepted.
        expect(game.airborneTargets.some(t => t.id.startsWith('STRIKE-3'))).toBe(true);
    });

    it('advances BOOT -> BRIEFING without throwing', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150); // ~2.5s, past the 1.8s warm-up
        expect(game.phase).toBe('BRIEFING');
    });

    it('enters ACTIVE on the deck when the briefing is confirmed', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        expect(game.phase).toBe('ACTIVE');
        expect(game.currentView).toBe('MACRO_DECK');
        runFrames(game, 60);
    });

    it('runs the full catapult sequence and carries the PLANNED payload into the cockpit', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();

        game.deck.aircraftState = 'CATAPULT_READY';
        game.deck.plannedFuel = 3200;               // deliberately NOT the old hardcoded 4500
        game.deck.plannedLoadout = { vulcanAmmo: 400, sidewinders: 2, ironBombs: 1 };

        expect(game.requestCatapultLaunch()).toBe(true);
        expect(game.deck.aircraftState).toBe('CATAPULT_LAUNCHING');
        // The player's planned payload must survive the launch.
        expect(game.physics.fuel).toBe(3200);
        expect(game.physics.loadout.sidewinders).toBe(2);

        // Ride the stroke out; the state machine must reach AIRBORNE and the
        // view must have switched to the cockpit.
        runFrames(game, 240);
        expect(game.deck.aircraftState).toBe('AIRBORNE');
        expect(game.currentView).toBe('MICRO_FLIGHT');
        expect(game.isCatapultLaunching).toBe(false);
    });

    it('flies a sortie for several seconds with input applied, without throwing', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();

        game.inputState['w'] = true;
        game.inputState['shift'] = true;
        game.inputState[' '] = true;

        const startZ = game.physics.position.z;
        runFrames(game, 300); // ~5 seconds

        expect(Number.isFinite(game.physics.position.x)).toBe(true);
        expect(Number.isFinite(game.physics.position.y)).toBe(true);
        expect(Number.isFinite(game.physics.airSpeed)).toBe(true);
        expect(game.physics.position.z).not.toBe(startZ);
    });

    it('renders the deck view without throwing', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.currentView = 'MACRO_DECK';
        runFrames(game, 60);
        expect(game.phase).toBe('ACTIVE');
    });

    it('renders the help overlay in both views without throwing', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.helpVisible = true;

        game.currentView = 'MACRO_DECK';
        runFrames(game, 20);
        game.currentView = 'MICRO_FLIGHT';
        runFrames(game, 20);
        expect(game.helpVisible).toBe(true);
    });

    it('pauses the simulation while the help overlay is open', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 30);

        game.helpVisible = true;
        const frozen = { ...game.physics.position };
        runFrames(game, 60);
        expect(game.physics.position.x).toBe(frozen.x);
        expect(game.physics.position.z).toBe(frozen.z);
    });

    it('takes SAM damage and eventually loses the airframe, going to DEBRIEF on hull loss', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();

        game.physics.applyDamage(99);
        expect(game.physics.damage).toBeCloseTo(99, 5);
        expect(game.physics.fuelLeakRate).toBeGreaterThan(0);

        // controlAuthority is derived state, recomputed inside physics.update(),
        // so it only reflects the damage after the next simulation tick.
        runFrames(game, 5);
        expect(game.physics.controlAuthority).toBeLessThan(1.0);

        // Push to destruction and confirm an airframe is consumed.
        const airframesBefore = game.deck.inventory.spareAirframes;
        game.physics.applyDamage(5);
        runFrames(game, 10);
        expect(game.deck.inventory.spareAirframes).toBeLessThan(airframesBefore);
    });

    it('reaches DEBRIEF when carrier hull integrity is destroyed', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();

        game.score.recordKill('BOMBER');
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 20);
        expect(game.phase).toBe('DEBRIEF');

        // The run's score is banked as the personal best, so a second sortie
        // has something to beat.
        expect(game.bestScore).toBe(game.score.totalScore);

        // And the debrief screen must render.
        runFrames(game, 10);
        game.restartFromDebrief();
        expect(game.phase).toBe('BRIEFING');
    });

    it('survives a resize mid-flight', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 30);

        game.resize(800, 600);
        runFrames(game, 30);
        game.resize(2560, 1440);
        runFrames(game, 30);
        expect(Number.isFinite(game.physics.position.y)).toBe(true);
    });

    // REGRESSION: buildHint() used to return the training prompt first and
    // unconditionally, so a first-time pilot - the one who most needs them -
    // never saw a stall, terrain or missile-launch warning.
    it('never lets the training prompt suppress a lethal warning', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();

        // hotStartAirborne() skips training; put a fresh pilot back in the seat.
        game.training = new TrainingSequence();
        expect(game.training.currentStep).not.toBeNull();

        game.physics.applyDamage(70);
        runFrames(game, 5);

        // Whatever the most lethal condition currently is, it must win the
        // single hint channel - never the "TRAINING n/6" prompt.
        expect(game.currentHint?.severity).toBe('CRITICAL');
        expect(game.currentHint?.text).not.toMatch(/TRAINING/);
    });

    it('surfaces the training prompt once nothing more urgent is happening', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        game.training = new TrainingSequence();

        // Silence the SAM belt so the only thing left to say is the checkout.
        game.sensors.samSites.length = 0;

        // Straight and level, high, fast, far from the boat and undamaged:
        // the coach has nothing to warn about, so the checkout gets the channel.
        game.physics.position = { x: 0, y: 2000, z: 9000 };
        game.physics.velocity = { x: 0, y: 0, z: 240 };
        game.physics.pitch = 0;
        game.physics.roll = 0;
        game.physics.throttle = 0.9;
        runFrames(game, 5);

        expect(game.currentHint?.text).toMatch(/TRAINING 1\/6/);
        expect(game.training.checklist()).toHaveLength(6);
        expect(game.training.checklist()[0].state).toBe('ACTIVE');
    });

    it('builds an objective for both loops', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();

        game.currentView = 'MACRO_DECK';
        const deckObj = game.currentObjective();
        expect(deckObj.title.length).toBeGreaterThan(0);

        game.hotStartAirborne();
        runFrames(game, 5);
        const flightObj = game.currentObjective();
        expect(flightObj.title.length).toBeGreaterThan(0);
    });

    // --- Scenarios -------------------------------------------------------

    it('defaults to the endless carrier defence scenario', () => {
        const game = new GameLoop(makeCanvasStub());
        expect(game.scenario.id).toBe('CARRIER_DEFENSE');
        expect(game.strikeTargets).toHaveLength(0);
        // The intro mode still teaches; a scripted mission does not.
        expect(game.training.checklist().length).toBe(6);
    });

    it('rebuilds the world when a scenario is selected', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.selectScenarioById('CANYON_STRIKE');
        game.confirmBriefing();

        expect(game.phase).toBe('ACTIVE');
        expect(game.scenario.id).toBe('CANYON_STRIKE');
        expect(game.strikeTargets).toHaveLength(1);
        expect(game.strikeTargets[0].destroyed).toBe(false);
        // The strike mission arms bombs and silences the wave director.
        expect(game.deck.plannedLoadout.ironBombs).toBeGreaterThan(0);
        expect(game.deck.strikeTimeline).toHaveLength(0);
        expect(game.training.checklist()).toHaveLength(0);
        runFrames(game, 60);
    });

    it('starts carrier quals airborne with an empty sky', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.selectScenarioById('CARRIER_QUALS');
        game.confirmBriefing();

        expect(game.deck.aircraftState).toBe('AIRBORNE');
        expect(game.currentView).toBe('MICRO_FLIGHT');
        expect(game.sensors.samSites).toHaveLength(0);
        expect(game.airborneTargets).toHaveLength(0);
        runFrames(game, 60);
        expect(game.phase).toBe('ACTIVE');
    });

    it('flies the canyon strike through every phase to a mission success', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.selectScenarioById('CANYON_STRIKE');
        game.confirmBriefing();

        // Launch.
        expect(game.requestCatapultLaunch()).toBe(true);
        runFrames(game, 240);
        expect(game.deck.aircraftState).toBe('AIRBORNE');
        expect(game.missionStatus.phase?.id).toBe('INGRESS');

        // Run the fjord: put the jet on the target and release.
        const target = game.strikeTargets[0];
        game.physics.position = { x: target.position.x, y: 120, z: target.position.z - 900 };
        game.physics.velocity = { x: 0, y: 0, z: 200 };
        runFrames(game, 10);
        expect(game.missionStatus.phase?.id).toBe('STRIKE');

        // Drop it straight in rather than modelling a real delivery, then get
        // the jet clear so it does not fly into the fjord floor while the
        // bomb is still falling (which would fail the mission instead).
        game.physics.position = { x: target.position.x, y: 60, z: target.position.z };
        game.physics.velocity = { x: 0, y: -40, z: 0 };
        game.selectedWeapon = 'BOMB';
        game.weapons.dropBomb(game.physics);
        game.physics.position = { x: target.position.x, y: 1500, z: target.position.z };
        game.physics.velocity = { x: 0, y: 0, z: 200 };
        runFrames(game, 120);
        expect(target.destroyed).toBe(true);
        expect(game.score.breakdown.structureKills).toBe(1);
        expect(game.missionStatus.phase?.id).toBe('EGRESS');

        // Egress clear of the fjord, then trap aboard.
        game.physics.position = { x: 0, y: 400, z: 1500 };
        runFrames(game, 10);
        expect(game.missionStatus.phase?.id).toBe('RECOVER');

        game.physics.position = { x: 0, y: 22, z: -100 };
        game.physics.velocity = { x: 0, y: 0, z: -40 };
        runFrames(game, 20);

        expect(game.score.breakdown.traps).toBeGreaterThan(0);
        expect(game.phase).toBe('DEBRIEF');
        expect(game.missionOutcome).toBe('SUCCESS');
        expect(game.score.breakdown.missionsCompleted).toBe(1);

        // ...and the run is written into this scenario's own record, so the
        // selector can mark it cleared and the debrief can compare like with
        // like instead of against a global score from a different mission.
        const record = game.missionRecords['CANYON_STRIKE'];
        expect(record.completions).toBe(1);
        expect(record.attempts).toBe(1);
        expect(record.best).toBe(game.score.totalScore);
        runFrames(game, 5); // draw the debrief with the record present
        game.restartFromDebrief();
        runFrames(game, 5); // and the briefing, with a cleared tick on a pill
        expect(game.phase).toBe('BRIEFING');
    });

    it('runs the canyon strike raid window down while the pen stands', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.selectScenarioById('CANYON_STRIKE');
        game.confirmBriefing();

        // The status is published by the first simulation tick, not by
        // confirmBriefing() itself.
        runFrames(game, 5);
        const atStart = game.missionStatus.secondsRemaining;
        expect(atStart).toBeCloseTo(240, 0);

        game.requestCatapultLaunch();
        runFrames(game, 600);

        expect(game.strikeTargets[0].destroyed).toBe(false);
        expect(game.missionStatus.secondsRemaining).not.toBeNull();
        expect(game.missionStatus.secondsRemaining!).toBeLessThan(atStart!);
        // (The window actually expiring is asserted in Scenarios.test.ts,
        // which can reach T+240 without simulating four minutes of frames.)
    });

    it('returns to mission select from the debrief', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.selectScenarioById('LAST_STAND');
        game.confirmBriefing();
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 20);
        expect(game.phase).toBe('DEBRIEF');
        expect(game.missionOutcome).toBe('FAILED');

        game.restartFromDebrief();
        expect(game.phase).toBe('BRIEFING');
        expect(game.missionOutcome).toBe('ACTIVE');
        // The selection is kept, so "fly it again" is one keypress.
        expect(game.scenario.id).toBe('LAST_STAND');
        runFrames(game, 30);
    });

    it('steps and wraps the scenario selector', () => {
        const game = new GameLoop(makeCanvasStub());
        const first = game.scenario.id;
        game.selectScenario(1);
        expect(game.scenario.id).not.toBe(first);
        game.selectScenario(-1);
        expect(game.scenario.id).toBe(first);
        game.selectScenario(-1);
        expect(game.scenario.id).toBe('CARRIER_QUALS');
    });

    // -----------------------------------------------------------------
    // Flight assist / autopilot / target designation
    // -----------------------------------------------------------------

    function airborne(game: InstanceType<typeof GameLoop>) {
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);
    }

    it('starts with the assists on, and cycles through every level', () => {
        const game = new GameLoop(makeCanvasStub());
        expect(game.assistLevel).toBe('ASSIST');
        airborne(game);

        game.cycleAssistLevel();
        expect(game.assistLevel).toBe('AUTO');
        runFrames(game, 60);
        game.cycleAssistLevel();
        expect(game.assistLevel).toBe('MANUAL');
        runFrames(game, 60);
        game.cycleAssistLevel();
        expect(game.assistLevel).toBe('ASSIST');
        expect(game.phase).toBe('ACTIVE');
    });

    it('levels the wings for a pilot who lets go, at ASSIST', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);
        game.assistLevel = 'ASSIST';
        game.physics.roll = 0.9;
        runFrames(game, 90);
        expect(Math.abs(game.physics.roll)).toBeLessThan(0.2);
    });

    it('holds a bank at MANUAL, bleeding it off only at the aerodynamic rate', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);
        game.assistLevel = 'MANUAL';
        game.physics.roll = 0.9;
        runFrames(game, 90);
        // AircraftPhysics has its own gentle roll damping (0.2/s), so a bank
        // decays a little on its own. What matters is that at MANUAL nothing
        // else is touching the stick: 1.5 s of that damping alone is ~0.67 rad.
        expect(game.physics.roll).toBeGreaterThan(0.6);
    });

    /**
     * The whole justification for the assist existing: the same suicidal input
     * that loses the airframe at MANUAL is survived at ASSIST. Flown well clear
     * of the carrier so the approach exemption is not in play.
     */
    function diveAtTheGround(level: 'MANUAL' | 'ASSIST') {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);
        game.assistLevel = level;
        game.physics.position = { x: 0, y: 500, z: 6000 };
        game.physics.velocity = { x: 0, y: -60, z: 180 };
        game.physics.pitch = -0.35;
        game.inputState['s'] = true;
        runFrames(game, 420);
        game.inputState['s'] = false;
        return game;
    }

    it('loses the airframe when the pilot flies it into the ground at MANUAL', () => {
        const game = diveAtTheGround('MANUAL');
        expect(game.score.breakdown.airframesLost).toBeGreaterThan(0);
    });

    it('pulls out of that same dive at ASSIST', () => {
        const game = diveAtTheGround('ASSIST');
        expect(game.score.breakdown.airframesLost).toBe(0);
        expect(game.deck.aircraftState).toBe('AIRBORNE');
        const ground = game.terrain.getElevation(game.physics.position.x, game.physics.position.z);
        expect(game.physics.position.y - ground).toBeGreaterThan(20);
    });

    it('does not credit the training checklist for the autopilot flying', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);
        game.assistLevel = 'AUTO';
        const before = game.training.progress.rollInputSeconds;
        game.physics.yaw = 2.5; // give the autopilot a turn to fly
        runFrames(game, 120);
        expect(game.training.progress.rollInputSeconds).toBe(before);
    });

    it('designates a contact, holds it across frames and reports it to the HUD', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);

        const chosen = game.cycleDesignation();
        expect(chosen).not.toBeNull();
        expect(game.tracker.designatedId).toBe(chosen!.target.id);

        runFrames(game, 60);
        expect(game.tracker.designatedId).toBe(chosen!.target.id);
        expect(game.tracker.designated()).not.toBeNull();
    });

    it('drops the designation when the designated contact dies', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);

        const chosen = game.cycleDesignation();
        expect(chosen).not.toBeNull();
        const contact = game.airborneTargets.find(t => t.id === chosen!.target.id);
        if (contact) {
            contact.isAlive = false;
        } else {
            // A SAM site or structure came out top of the scope instead.
            game.sensors.samSites = game.sensors.samSites.filter(s => s.id !== chosen!.target.id);
            for (const st of game.strikeTargets) if (st.id === chosen!.target.id) st.destroyed = true;
        }
        runFrames(game, 5);
        expect(game.tracker.designatedId).toBeNull();
    });

    it('sends the Sidewinder after the designated contact, not the nearest one', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);

        // Two contacts ahead: one close, one far. Designate the far one.
        game.airborneTargets = [
            {
                id: 'NEAR', name: 'MiG-23 FLOGGER', isAlive: true,
                position: { x: 0, y: 750, z: game.physics.position.z + 1200 },
                velocity: { x: 0, y: 0, z: -200 }
            },
            {
                id: 'FAR', name: 'Tu-22M BACKFIRE', isAlive: true,
                position: { x: 0, y: 750, z: game.physics.position.z + 4000 },
                velocity: { x: 0, y: 0, z: -200 }
            }
        ];
        game.sensors.samSites = [];
        game.strikeTargets = [];
        runFrames(game, 2);

        game.tracker.designateById('FAR');
        game.selectedWeapon = 'AIM9';
        game.physics.loadout.sidewinders = 2;
        game.fireSelectedWeapon();

        expect(game.weapons.missiles).toHaveLength(1);
        expect(game.weapons.missiles[0].targetId).toBe('FAR');
    });

    it('still auto-acquires with nothing designated', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);
        game.airborneTargets = [{
            id: 'NEAR', name: 'MiG-23 FLOGGER', isAlive: true,
            position: { x: 0, y: 750, z: game.physics.position.z + 1200 },
            velocity: { x: 0, y: 0, z: -200 }
        }];
        game.tracker.clear();
        game.selectedWeapon = 'AIM9';
        game.physics.loadout.sidewinders = 2;
        game.fireSelectedWeapon();
        expect(game.weapons.missiles[0].targetId).toBe('NEAR');
    });

    it('flies an intercept on the designated contact under autopilot', () => {
        const game = new GameLoop(makeCanvasStub());
        airborne(game);
        game.assistLevel = 'AUTO';

        // A contact well off to the right: the autopilot has to turn for it.
        game.airborneTargets = [{
            id: 'BANDIT', name: 'MiG-23 FLOGGER', isAlive: true,
            position: { x: 9000, y: 900, z: game.physics.position.z + 2000 },
            velocity: { x: 0, y: 0, z: 0 }
        }];
        game.sensors.samSites = [];
        game.strikeTargets = [];
        runFrames(game, 2);
        game.tracker.designateById('BANDIT');

        const error = () => {
            const s = game.tracker.designated();
            return s === null ? Infinity : Math.abs(angleDelta(game.physics.yaw, s.bearing));
        };
        const before = error();
        expect(before).toBeGreaterThan(1);
        runFrames(game, 600);
        expect(error()).toBeLessThan(before / 2);
        // And it is still flying: the autopilot has not stalled or dug in.
        expect(game.deck.aircraftState).toBe('AIRBORNE');
        expect(game.physics.airSpeed).toBeGreaterThan(80);
    });

    it('cycles the display mode without throwing', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();

        game.cycleDisplayMode();
        runFrames(game, 10);
        game.cycleDisplayMode();
        runFrames(game, 10);
        game.cycleDisplayMode();
        runFrames(game, 10);
        expect(game.phase).toBe('ACTIVE');
    });
});
