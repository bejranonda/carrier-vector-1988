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
import type { AirborneTarget } from '../renderer/HUD';
import { briefingHitAreas } from '../renderer/BriefingScreen';
import { SCENARIOS } from './Scenarios';

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

    /**
     * Drive n frames of the private step() via its public rAF entry.
     *
     * The timestamp continues from wherever the last call left it. It used to
     * restart at zero, which handed step() a timestamp earlier than the one
     * before and cost a frame on every call - harmless for a single long run,
     * but it meant `runFrames(game, 1)` in a loop advanced the simulation not
     * at all, silently.
     */
    function runFrames(game: InstanceType<typeof GameLoop>, frames: number, msPerFrame = 16.7) {
        const inner = game as unknown as { step: (t: number) => void; lastTimestamp: number };
        const step = inner.step.bind(game);
        let t = inner.lastTimestamp || 0;
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
    // Motion and flash safety
    // -----------------------------------------------------------------

    it('shakes the camera by default', () => {
        const game = new GameLoop(makeCanvasStub());
        game.shake(1);
        expect(game.trauma).toBeGreaterThan(0);
    });

    /**
     * The shake and the full-screen flash are exactly what
     * prefers-reduced-motion exists for, and the canvas was ignoring a
     * preference the CSS already honoured for the CRT flicker.
     */
    it('does not shake at all when the player has asked for reduced motion', () => {
        const game = new GameLoop(makeCanvasStub());
        game.motion = { shakeScale: 0, flashScale: 0.25, allowBlink: false, blinkPeriodMs: 400 };

        game.shake(1);
        expect(game.trauma).toBe(0);

        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        game.inputState[' '] = true;
        runFrames(game, 60);
        game.inputState[' '] = false;
        expect(game.trauma).toBe(0);
    });

    it('still runs a full sortie with reduced motion on', () => {
        const game = new GameLoop(makeCanvasStub());
        game.motion = { shakeScale: 0, flashScale: 0.25, allowBlink: false, blinkPeriodMs: 400 };
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 240);
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 30);
        expect(game.phase).toBe('DEBRIEF');
    });

    // -----------------------------------------------------------------
    // Touch mode
    // -----------------------------------------------------------------

    /** Force the touch scheme, as a phone's signals would. */
    function touchGame() {
        const game = new GameLoop(makeCanvasStub());
        game.schemePreference = 'TOUCH';
        game.resize(844, 390);
        return game;
    }

    it('resolves the touch scheme and starts a phone on the autopilot', () => {
        const game = touchGame();
        expect(game.controlScheme).toBe('TOUCH');
        // The jet flying itself is what makes one-thumb play possible.
        expect(game.assistLevel).toBe('AUTO');
        expect(game.displayMode).toBe('CLEAN');
    });

    it('leaves a keyboard player untouched', () => {
        const game = new GameLoop(makeCanvasStub());
        game.resize(1440, 900);
        expect(game.controlScheme).toBe('KEYBOARD');
        expect(game.assistLevel).toBe('ASSIST');
    });

    it('asks a phone held upright to turn, and stops asking once it is', () => {
        const game = touchGame();
        game.resize(390, 844);
        expect(game.awaitingRotation).toBe(true);
        game.resize(844, 390);
        expect(game.awaitingRotation).toBe(false);
    });

    it('launches from the deck button', () => {
        const game = touchGame();
        runFrames(game, 150);
        game.confirmBriefing();
        runFrames(game, 5);
        expect(game.deck.aircraftState).toBe('CATAPULT_READY');

        const l = game.touchLayout.launch;
        game.touch.down({ id: 1, x: l.x + l.w / 2, y: l.y + l.h / 2 }, game.touchLayout, 'DECK');
        game.touch.up(1);
        runFrames(game, 10);

        expect(game.deck.aircraftState).not.toBe('CATAPULT_READY');
        runFrames(game, 240);
        expect(game.deck.aircraftState).toBe('AIRBORNE');
    });

    it('flies from the thumb stick', () => {
        const game = touchGame();
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        game.assistLevel = 'MANUAL';
        runFrames(game, 5);

        const stick = game.touchLayout.stick;
        game.touch.down({ id: 1, x: stick.cx, y: stick.cy }, game.touchLayout);
        game.touch.move({ id: 1, x: stick.cx + stick.r, y: stick.cy });
        runFrames(game, 60);

        expect(game.physics.roll).toBeGreaterThan(0.2);
    });

    it('sets the throttle from the track', () => {
        const game = touchGame();
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);

        const t = game.touchLayout.throttle;
        game.touch.down({ id: 1, x: t.x + t.w / 2, y: t.y }, game.touchLayout);
        runFrames(game, 5);
        expect(game.physics.throttle).toBeCloseTo(1.5, 2);

        game.touch.move({ id: 1, x: t.x + t.w / 2, y: t.y + t.h });
        runFrames(game, 5);
        expect(game.physics.throttle).toBeCloseTo(0, 2);
    });

    it('selects a weapon and releases it from the thumb buttons', () => {
        const game = touchGame();
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);
        game.physics.loadout.sidewinders = 2;

        const missilePill = game.touchLayout.weapons[1];
        game.touch.down(
            { id: 1, x: missilePill.x + missilePill.w / 2, y: missilePill.y + missilePill.h / 2 },
            game.touchLayout
        );
        game.touch.up(1);
        runFrames(game, 3);
        expect(game.selectedWeapon).toBe('AIM9');

        const fire = game.touchLayout.fire;
        game.touch.down({ id: 2, x: fire.cx, y: fire.cy }, game.touchLayout);
        game.touch.up(2);
        runFrames(game, 3);
        expect(game.weapons.missiles.length).toBe(1);
    });

    /**
     * Pointing at a thing is the natural way to choose it on a touchscreen.
     * The cycle button still exists for whatever is off the glass.
     */
    it('designates the contact under a tap on the world', () => {
        const game = touchGame();
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);
        game.sensors.samSites = [];

        const p = game.physics.position;
        game.airborneTargets = [{
            id: 'BANDIT', name: 'MiG-23 FLOGGER #1', isAlive: true,
            position: { x: p.x, y: p.y, z: p.z + 2000 },
            velocity: { x: 0, y: 0, z: 0 }
        }];
        runFrames(game, 3);

        // Dead ahead projects to the centre of the glass.
        expect(game.designateAtPoint(game.viewWidth / 2, game.viewHeight / 2)).toBe(true);
        expect(game.tracker.designatedId).toBe('BANDIT');
    });

    it('does not designate empty sky', () => {
        const game = touchGame();
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        game.airborneTargets = [];
        game.sensors.samSites = [];
        game.strikeTargets = [];
        runFrames(game, 3);

        expect(game.designateAtPoint(10, 10)).toBe(false);
        expect(game.tracker.designatedId).toBeNull();
    });

    it('picks a mission from a tap on its pill', () => {
        const game = touchGame();
        runFrames(game, 150);
        expect(game.phase).toBe('BRIEFING');

        const areas = briefingHitAreas(game.viewWidth, game.viewHeight, SCENARIOS.length, true);
        const third = areas.pills[2];
        expect(game.handleMenuTap(third.x + third.w / 2, third.y + third.h / 2)).toBe(true);
        expect(game.scenario.id).toBe(SCENARIOS[2].id);
        // Still on the briefing: choosing is not committing.
        expect(game.phase).toBe('BRIEFING');
    });

    it('flies the daily from a tap on its line', () => {
        const game = touchGame();
        runFrames(game, 150);
        const areas = briefingHitAreas(game.viewWidth, game.viewHeight, SCENARIOS.length, true);
        game.handleMenuTap(areas.daily!.x + 20, areas.daily!.y + 15);
        expect(game.isDailyRun).toBe(true);
        expect(game.phase).toBe('ACTIVE');
    });

    it('commits the mission from a tap anywhere else on the briefing', () => {
        const game = touchGame();
        runFrames(game, 150);
        expect(game.handleMenuTap(game.viewWidth / 2, game.viewHeight - 30)).toBe(true);
        expect(game.phase).toBe('ACTIVE');
    });

    it('draws every phase in touch mode without throwing', () => {
        for (const [w, h] of [[568, 320], [844, 390], [1024, 768]] as const) {
            const game = new GameLoop(makeCanvasStub());
            game.schemePreference = 'TOUCH';
            game.resize(w, h);
            runFrames(game, 150);          // boot + briefing
            game.confirmBriefing();
            runFrames(game, 30);           // deck
            game.hotStartAirborne();
            runFrames(game, 60);           // cockpit
            game.helpVisible = true;
            runFrames(game, 5);            // help overlay
            game.helpVisible = false;
            game.deck.inventory.carrierHealth = 0;
            runFrames(game, 30);           // debrief
            expect(game.phase).toBe('DEBRIEF');
        }
    });

    it('drops every finger when focus is lost', () => {
        const game = touchGame();
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);

        const stick = game.touchLayout.stick;
        game.touch.down({ id: 1, x: stick.cx, y: stick.cy }, game.touchLayout);
        game.touch.clear();
        runFrames(game, 5);
        expect(game.touch.activeCount).toBe(0);
    });

    // -----------------------------------------------------------------
    // Daily sortie
    // -----------------------------------------------------------------

    it('starts the daily on the endless defence, seeded from the date', () => {
        const day = new Date('2026-09-19T08:00:00Z');
        const a = new GameLoop(makeCanvasStub());
        runFrames(a, 150);
        a.startDailySortie(day);

        const b = new GameLoop(makeCanvasStub());
        runFrames(b, 150);
        b.startDailySortie(day);

        expect(a.scenario.id).toBe('CARRIER_DEFENSE');
        expect(a.isDailyRun).toBe(true);
        expect(a.phase).toBe('ACTIVE');
        // The whole point: two players, same day, same campaign.
        expect(a.deck.strikeTimeline).toEqual(b.deck.strikeTimeline);
    });

    it('gives a different campaign on a different day', () => {
        /** Resolve the opening act so the seeded wave director takes over. */
        const escalate = (game: InstanceType<typeof GameLoop>) => {
            for (const pkg of game.deck.strikeTimeline) pkg.isIntercepted = true;
            runFrames(game, 30);
            return game.deck.strikeTimeline.map(p => [p.aircraftType, p.count]);
        };

        const a = new GameLoop(makeCanvasStub());
        runFrames(a, 150);
        a.startDailySortie(new Date('2026-09-19T08:00:00Z'));

        const b = new GameLoop(makeCanvasStub());
        runFrames(b, 150);
        b.startDailySortie(new Date('2026-09-20T08:00:00Z'));

        const waveA = escalate(a);
        const waveB = escalate(b);
        expect(waveA.length).toBeGreaterThan(0);
        expect(waveA).not.toEqual(waveB);
    });

    it('gives two pilots on the same day the same escalation, not just the same opening', () => {
        const day = new Date('2026-09-19T08:00:00Z');
        const escalate = (game: InstanceType<typeof GameLoop>) => {
            for (const pkg of game.deck.strikeTimeline) pkg.isIntercepted = true;
            runFrames(game, 30);
            return game.deck.strikeTimeline.map(p => [p.aircraftType, p.count]);
        };

        const a = new GameLoop(makeCanvasStub());
        runFrames(a, 150);
        a.startDailySortie(day);

        const b = new GameLoop(makeCanvasStub());
        runFrames(b, 150);
        b.startDailySortie(day);

        expect(escalate(a)).toEqual(escalate(b));
    });

    it('forces arcade pacing so the comparison is like for like', () => {
        const game = new GameLoop(makeCanvasStub());
        game.pacing = 'SIM';
        runFrames(game, 150);
        game.startDailySortie();
        expect(game.pacing).toBe('ARCADE');
    });

    it('records the run and builds a shareable card when it ends', () => {
        const day = new Date('2026-09-19T08:00:00Z');
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.startDailySortie(day);

        expect(game.todaysDaily(day)).toBeNull();

        // Sink the boat to end the run.
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 30);
        expect(game.phase).toBe('DEBRIEF');

        const today = game.todaysDaily(day);
        expect(today).not.toBeNull();
        expect(today!.attempts).toBe(1);
        expect(game.dailyCard).toContain('DAILY SORTIE #');
        expect(game.dailyCard).toContain('attempt 1');
    });

    it('counts a second attempt and keeps the better run', () => {
        const day = new Date('2026-09-19T08:00:00Z');
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);

        game.startDailySortie(day);
        game.score.recordKill('BOMBER');
        game.score.recordKill('BOMBER');
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 30);
        const best = game.todaysDaily(day)!.score;

        game.restartFromDebrief();
        game.startDailySortie(day);
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 30);

        const today = game.todaysDaily(day)!;
        expect(today.attempts).toBe(2);
        expect(today.score).toBe(best);
        expect(game.dailyCard).toContain('attempt 2');
    });

    it('does not record an ordinary mission as the daily', () => {
        const day = new Date('2026-09-19T08:00:00Z');
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 30);

        expect(game.phase).toBe('DEBRIEF');
        expect(game.todaysDaily(day)).toBeNull();
        expect(game.dailyCard).toBeNull();
    });

    /**
     * A sortie begun at 23:59 belongs to the day it was flown on, not to
     * whatever the clock says when the carrier finally goes down. Reading the
     * date twice filed it against a seed it was never flown on.
     */
    it('files the run under the day it started, not the day it ended', () => {
        const day = new Date('2026-05-04T23:59:30Z');
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.startDailySortie(day);

        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 30);

        expect(game.todaysDaily(day)).not.toBeNull();
        expect(game.todaysDaily(new Date('2026-05-05T00:01:00Z'))).toBeNull();
    });

    it('does not fall over when the clipboard is unavailable', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        expect(game.copyDailyCard()).toBe(false);

        game.startDailySortie();
        game.deck.inventory.carrierHealth = 0;
        runFrames(game, 30);
        expect(() => game.copyDailyCard()).not.toThrow();
    });

    // -----------------------------------------------------------------
    // Feel: shake, callouts, hit feedback, the trap payoff
    // -----------------------------------------------------------------

    it('shakes the camera when you shoot, and settles back to still', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);

        // An empty sky: nothing but the player's own trigger can add trauma,
        // so "it settles" is a statement about the decay and not about how
        // quiet the fight happened to be.
        game.airborneTargets = [];
        game.sensors.samSites = [];
        runFrames(game, 5);

        expect(game.trauma).toBe(0);
        game.inputState[' '] = true;
        runFrames(game, 30);
        game.inputState[' '] = false;
        expect(game.trauma).toBeGreaterThan(0);

        runFrames(game, 180);
        expect(game.trauma).toBe(0);
    });

    /**
     * The shake is a camera effect. If it ever reaches the flight model,
     * every fixed-timestep guarantee in this project becomes a coin flip.
     */
    it('never lets the shake touch the flight model', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        game.assistLevel = 'MANUAL';
        runFrames(game, 5);

        const attitude = { pitch: game.physics.pitch, roll: game.physics.roll, yaw: game.physics.yaw };
        game.shake(1);
        runFrames(game, 1);
        expect(game.physics.roll).toBeCloseTo(attitude.roll, 6);
        expect(game.physics.yaw).toBeCloseTo(attitude.yaw, 6);
    });

    it('calls out a kill and clears the callout after its lifetime', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);

        // One bandit dead ahead, killed with a Sidewinder: the missile homes,
        // so this tests the kill -> callout wiring rather than the author's
        // ability to fly a gun solution in a headless test.
        const p = game.physics.position;
        const bandit: AirborneTarget = {
            id: 'BANDIT', name: 'MiG-23 FLOGGER #1', isAlive: true,
            position: { x: p.x, y: p.y, z: p.z + 2500 },
            velocity: { x: 0, y: 0, z: 0 }
        };
        game.airborneTargets = [bandit];
        game.sensors.samSites = [];
        runFrames(game, 2);

        game.tracker.designateById('BANDIT');
        game.selectedWeapon = 'AIM9';
        game.physics.loadout.sidewinders = 2;
        game.fireSelectedWeapon();

        for (let i = 0; i < 40 && bandit.isAlive; i++) runFrames(game, 15);

        expect(bandit.isAlive).toBe(false);
        expect(game.score.breakdown.fighterKills).toBe(1);
        expect(game.callouts.active().length).toBeGreaterThan(0);
        expect(game.callouts.active()[0].text).toBe('SPLASH ONE');
        expect(game.callouts.active()[0].detail).toBe('MiG-23 FLOGGER #1');

        runFrames(game, 180);
        expect(game.callouts.active()).toHaveLength(0);
    });

    it('counts the splashes up within a sortie and resets them on the next one', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);
        game.sensors.samSites = [];

        const killOne = (id: string) => {
            const p = game.physics.position;
            const bandit: AirborneTarget = {
                id, name: `MiG-23 FLOGGER ${id}`, isAlive: true,
                position: { x: p.x, y: p.y, z: p.z + 2200 },
                velocity: { x: 0, y: 0, z: 0 }
            };
            game.airborneTargets = [bandit];
            runFrames(game, 2);
            game.tracker.designateById(id);
            game.selectedWeapon = 'AIM9';
            game.physics.loadout.sidewinders = 2;
            game.fireSelectedWeapon();
            for (let i = 0; i < 40 && bandit.isAlive; i++) runFrames(game, 15);
        };

        killOne('A');
        expect(game.callouts.active()[0].text).toBe('SPLASH ONE');
        killOne('B');
        expect(game.callouts.active()[0].text).toBe('SPLASH TWO');
    });

    it('holds the cockpit for the wire, then hands over to the deck', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);

        // On the wires, slow enough to catch one.
        game.physics.position = { x: 0, y: 22, z: -100 };
        game.physics.velocity = { x: 0, y: 0, z: -40 };
        runFrames(game, 20);

        expect(game.score.breakdown.traps).toBeGreaterThan(0);
        // Still in the cockpit, with the grade on the glass.
        expect(game.currentView).toBe('MICRO_FLIGHT');

        runFrames(game, 150); // 2.5 s: the payoff plays out
        expect(game.currentView).toBe('MACRO_DECK');
    });

    it('starts each mission with clean presentation state', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);
        game.shake(1);
        game.callouts.push('SPLASH ONE');

        game.restartFromDebrief();
        game.selectScenarioById('CARRIER_QUALS');
        game.confirmBriefing();
        expect(game.trauma).toBe(0);
        expect(game.callouts.active()).toHaveLength(0);
    });

    // -----------------------------------------------------------------
    // Operational tempo
    // -----------------------------------------------------------------

    /**
     * The first sortie is launchable immediately - the deck opens ready on the
     * catapult. It is every sortie AFTER that one which used to cost a full
     * hangar-and-rearm cycle, and that is what the pacing setting addresses.
     */
    it('opens ready to launch, whatever the pacing', () => {
        for (const pacing of ['ARCADE', 'SIM'] as const) {
            const game = new GameLoop(makeCanvasStub());
            game.pacing = pacing;
            runFrames(game, 150);
            game.confirmBriefing();
            expect(game.deck.aircraftState).toBe('CATAPULT_READY');
        }
    });

    /**
     * The claim the pacing change rests on, asserted rather than
     * screenshotted: the turnaround after coming home is a beat, not a wait.
     */
    it('turns the jet around in seconds after a trap under ARCADE', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();

        game.deck.processTrapRecovery(3000, false);
        runFrames(game, 720); // 12 s at 60 Hz
        expect(game.deck.aircraftState).toBe('CATAPULT_READY');
    });

    it('still takes the deliberate path home under SIM', () => {
        const game = new GameLoop(makeCanvasStub());
        game.pacing = 'SIM';
        runFrames(game, 150);
        game.confirmBriefing();

        game.deck.processTrapRecovery(3000, false);
        runFrames(game, 720);
        // 3 s de-rig + 18 s hangar + 14 s arming: nowhere near ready.
        expect(game.deck.aircraftState).not.toBe('CATAPULT_READY');
    });

    it('pulls the opening threat timeline forward and the contacts in closer', () => {
        const arcade = new GameLoop(makeCanvasStub());
        runFrames(arcade, 150);
        arcade.confirmBriefing();

        const sim = new GameLoop(makeCanvasStub());
        sim.pacing = 'SIM';
        runFrames(sim, 150);
        sim.confirmBriefing();

        const firstEta = (g: InstanceType<typeof GameLoop>) => g.deck.strikeTimeline[0].etaSeconds;
        const nearestContact = (g: InstanceType<typeof GameLoop>) =>
            Math.min(...g.airborneTargets.map(t => t.position.z));

        expect(firstEta(arcade)).toBeLessThan(firstEta(sim));
        expect(firstEta(arcade)).toBeLessThan(60);
        expect(nearestContact(arcade)).toBeLessThan(nearestContact(sim));
        // Close enough that the transit is a beat, not a commute.
        expect(nearestContact(arcade)).toBeLessThan(5000);
    });

    it('puts a spare airframe on the catapult seconds after a loss under ARCADE', () => {
        const game = new GameLoop(makeCanvasStub());
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);

        const spares = game.deck.inventory.spareAirframes;
        // Fly it into the sea.
        game.physics.position = { x: 0, y: 5, z: 4000 };
        game.physics.velocity = { x: 0, y: -60, z: 100 };
        game.assistLevel = 'MANUAL';
        runFrames(game, 10);

        expect(game.score.breakdown.airframesLost).toBe(1);
        expect(game.deck.inventory.spareAirframes).toBe(spares - 1);
        // The cost is the jet and the score, not the waiting.
        expect(game.deck.aircraftState).toBe('ARMING_REFUELING');
        runFrames(game, 300); // 5 s
        expect(game.deck.aircraftState).toBe('CATAPULT_READY');
    });

    it('sends the pilot to the hangar the long way under SIM', () => {
        const game = new GameLoop(makeCanvasStub());
        game.pacing = 'SIM';
        runFrames(game, 150);
        game.confirmBriefing();
        game.hotStartAirborne();
        runFrames(game, 5);

        game.physics.position = { x: 0, y: 5, z: 4000 };
        game.physics.velocity = { x: 0, y: -60, z: 100 };
        game.assistLevel = 'MANUAL';
        runFrames(game, 10);

        expect(game.score.breakdown.airframesLost).toBe(1);
        expect(game.deck.aircraftState).toBe('HANGAR_MAINTENANCE');
    });

    it('cycles the ops tempo and remembers it for the next scenario build', () => {
        const game = new GameLoop(makeCanvasStub());
        game.cyclePacing();
        expect(game.pacing).toBe('SIM');
        runFrames(game, 150);
        game.confirmBriefing();
        expect(game.deck.timing.armingSeconds).toBe(14);

        game.cyclePacing();
        game.restartFromDebrief();
        game.confirmBriefing();
        expect(game.deck.timing.armingSeconds).toBe(5);
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
        // High, deliberately: designation now needs line of sight, and at 900 m
        // a contact 9 km abeam is behind the ridge line, so the intercept test
        // would be measuring terrain masking instead of the autopilot.
        game.airborneTargets = [{
            id: 'BANDIT', name: 'MiG-23 FLOGGER', isAlive: true,
            position: { x: 9000, y: 5000, z: game.physics.position.z + 2000 },
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
