/**
 * CARRIER VECTOR: 1988 - The Bridge Loop (Core Simulation Coordinator)
 *
 * Integrates:
 * - Macro carrier deck logistics and the procedural threat director
 * - 3D vector flight simulation on a FIXED timestep
 * - Tactical radar LOS, RWR and lethal SAM engagements
 * - Enemy aircraft behaviour and weapon combat
 * - CRT phosphor post-processing
 * - Onboarding: boot sequence, briefing, contextual coach, help overlay
 */

import { AircraftPhysics } from '../flight/AircraftPhysics';
import type { Vector3, AircraftLoadout } from '../flight/AircraftPhysics';
import { VectorRenderer, WireframeModels } from '../renderer/VectorRenderer';
import { HUD } from '../renderer/HUD';
import type { AirborneTarget } from '../renderer/HUD';
import { TacticalTerrain, SensorTacticsManager } from '../tactics/RadarLOS';
import { DeckManager } from '../carrier/DeckManager';
import type { InboundStrikePackage } from '../carrier/DeckManager';
import { WeaponsSystem } from '../flight/Weapons';
import { soundFX } from '../audio/SoundFX';
import { FixedTimestepAccumulator, FIXED_DT } from './Timestep';
import { ScoreKeeper } from './ScoreKeeper';
import { getContextualHint, TrainingSequence } from './Tutorial';
import type { Hint } from './Tutorial';
import { updateEnemyAI, isBomber } from '../tactics/EnemyAI';
import { PostProcess } from '../renderer/PostProcess';
import type { PostQuality } from '../renderer/PostProcess';
import { DeckView } from '../renderer/DeckView';
import { BriefingScreen } from '../renderer/BriefingScreen';
import { THEME, WORLD } from '../renderer/Theme';
import {
    applyDisplayModeToDocument,
    displayModeSpec,
    loadDisplayMode,
    nextDisplayMode,
    saveDisplayMode
} from '../renderer/DisplayMode';
import type { DisplayModeId } from '../renderer/DisplayMode';
import { deckObjective, flightObjective } from './Objectives';
import {
    DEFAULT_SCENARIO,
    MissionDirector,
    SCENARIOS,
    scenarioAt,
    scenarioById
} from './Scenarios';
import type { MissionSnapshot, MissionStatus, ScenarioDef, ScenarioId } from './Scenarios';
import { StrikeTarget } from '../tactics/StrikeTarget';
import {
    assistSpec,
    loadAssistLevel,
    nextAssistLevel,
    resolveControls,
    saveAssistLevel
} from '../flight/FlightAssist';
import type { AssistLevel, ControlDemand, FlightState, NavTarget } from '../flight/FlightAssist';
import { TargetTracker, pursuitNav } from '../tactics/TargetDesignation';
import type { DesignatableTarget, TargetSolution } from '../tactics/TargetDesignation';
import { DEFAULT_MAP } from '../tactics/TerrainProfiles';
import { loadBestScore, recordBestScore } from './HighScore';
import type { ObjectiveStep } from './Objectives';

export type GamePhase = 'BOOT' | 'BRIEFING' | 'ACTIVE' | 'DEBRIEF';

export class GameLoop {
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;

    // Simulation Subsystems
    public physics: AircraftPhysics;
    public renderer: VectorRenderer;
    public hud: HUD;
    public terrain: TacticalTerrain;
    public sensors: SensorTacticsManager;
    public deck: DeckManager;
    public weapons: WeaponsSystem;
    public score: ScoreKeeper;
    public training: TrainingSequence;

    // Presentation
    private post: PostProcess;
    private deckView: DeckView;
    private briefing: BriefingScreen;

    // 3D Static World Meshes
    private carrierMesh = WireframeModels.createCarrier();
    private mig23Mesh = WireframeModels.createMiG23();
    private bomberMesh = WireframeModels.createBomber();
    private samMesh = WireframeModels.createSAMLauncher();
    private penMesh = WireframeModels.createHardenedPen();

    // View & phase state
    public currentView: 'MICRO_FLIGHT' | 'MACRO_DECK' = 'MACRO_DECK';
    public selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' = 'GUN';
    public phase: GamePhase = 'BOOT';
    public helpVisible = false;

    /** Raw key state, written by the input layer in main.ts. */
    public inputState: Record<string, boolean> = {};

    // Combat Entities
    public airborneTargets: AirborneTarget[] = [];
    /** Hardened ground targets the active scenario wants destroyed. */
    public strikeTargets: StrikeTarget[] = [];

    // Scenario / mission
    public scenario: ScenarioDef = scenarioById(DEFAULT_SCENARIO);
    /** Index into SCENARIOS, driven by the briefing screen selector. */
    public scenarioIndex = SCENARIOS.findIndex(sc => sc.id === DEFAULT_SCENARIO);
    public mission!: MissionDirector;
    public missionOutcome: 'ACTIVE' | 'SUCCESS' | 'FAILED' = 'ACTIVE';
    public missionReason: string | null = null;
    public missionStatus: MissionStatus = {
        outcome: 'ACTIVE', phaseIndex: 0, phase: null,
        reason: null, secondsRemaining: null, callouts: []
    };
    /** Seconds of simulated time since the scenario started. */
    private missionSeconds = 0;
    /** SAM count the scenario began with, so "3 of 3" stays honest. */
    private samSitesAtStart = 0;
    /** Latched so the phase list can ask "have we launched yet" after landing. */
    private hasLaunched = false;

    // Catapult animation (progress derived from DeckManager's single clock)
    public isCatapultLaunching = false;
    public catapultProgress = 0;

    /**
     * Display mode: one switch for vector persistence, bloom, per-stroke glow,
     * the scanline mask and the vignette. Restored from the last session.
     */
    public displayMode: DisplayModeId = loadDisplayMode();

    /**
     * How much of the aeroplane the player wants to fly. Restored between
     * sessions, cycled with one key, and applied by pure control laws in
     * FlightAssist - see that module for why this exists at all.
     */
    public assistLevel: AssistLevel = loadAssistLevel();
    /** Which protection, if any, is currently taking authority. For the HUD. */
    public assistOverride: ControlDemand['override'] = 'NONE';

    /**
     * The pilot's chosen target. Everything downstream follows it: the HUD
     * bracket, the weapon recommendation, which contact the Sidewinder guides
     * on, and where the autopilot flies.
     */
    public tracker = new TargetTracker();

    /** Personal best across sessions, shown on the briefing and the debrief. */
    public bestScore = loadBestScore();
    private isNewBest = false;

    /**
     * Rolling average frame time, used to back the bloom pass off on hardware
     * that cannot afford it. `PostProcess.nextQuality()` has always existed and
     * been unit-tested, but nothing drove it - quality was manual only.
     */
    private avgFrameMs = 16.7;
    private qualityCheckTimer = 0;
    /** The best bloom quality the chosen display mode allows. */
    private qualityCeiling: PostQuality = 'LOW';

    /**
     * Logical (CSS pixel) viewport. The canvas backing store is this times
     * the device pixel ratio, with the 2D context pre-scaled - so every
     * layout number in the game stays in CSS pixels while text and vectors
     * render at native resolution. The old build pinned the backing store to
     * CSS pixels and set `image-rendering: pixelated`, which is why HUD
     * glyphs looked soft and ragged on any HiDPI screen.
     */
    public viewWidth = 1;
    public viewHeight = 1;
    /** Device pixel ratio the backing store is currently sized for. */
    public dpr = 1;

    private lastTimestamp = 0;
    private audioStarted = false;
    private timestep = new FixedTimestepAccumulator();
    private elapsedSeconds = 0;
    private bootTimer = 0;
    private lastSpawnedWave = 0;
    /** Latest coach line. Public so the wiring can be asserted headlessly. */
    public currentHint: Hint | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D canvas context');
        this.ctx = ctx;

        // The 3D world renders into an offscreen buffer so it can carry
        // phosphor persistence without smearing the HUD (which is drawn
        // directly to the visible canvas after compositing).
        this.viewWidth = canvas.width || 1;
        this.viewHeight = canvas.height || 1;
        this.post = new PostProcess(this.viewWidth, this.viewHeight);
        this.renderer = new VectorRenderer(this.post.worldTarget);

        this.hud = new HUD(this.viewWidth, this.viewHeight);
        this.terrain = new TacticalTerrain();
        this.sensors = new SensorTacticsManager(this.terrain);
        this.deck = new DeckManager();
        this.weapons = new WeaponsSystem();
        this.physics = new AircraftPhysics();
        this.score = new ScoreKeeper();
        this.training = new TrainingSequence();
        this.deckView = new DeckView();
        this.briefing = new BriefingScreen();

        this.applyDisplayMode();
        this.applyScenario(this.scenario);
    }

    // -----------------------------------------------------------------
    // Scenario lifecycle
    // -----------------------------------------------------------------

    /** Step the briefing screen's scenario selector, wrapping at both ends. */
    public selectScenario(delta: number) {
        this.scenario = scenarioAt(this.scenarioIndex + delta);
        // Normalise rather than letting the index drift off into the negatives
        // over a long browse; scenarioAt() wraps the value, not the field.
        this.scenarioIndex = SCENARIOS.findIndex(sc => sc.id === this.scenario.id);
    }

    public selectScenarioById(id: ScenarioId) {
        this.selectScenarioByIndex(SCENARIOS.findIndex(sc => sc.id === id));
    }

    /** Direct pick from the number shown on a selector pill. */
    public selectScenarioByIndex(index: number) {
        if (index < 0 || index >= SCENARIOS.length) return;
        this.scenarioIndex = index;
        this.scenario = SCENARIOS[index];
    }

    /**
     * Rebuild the world for a scenario. Every subsystem that carries run
     * state is replaced rather than reset in place, so a scenario can never
     * inherit a stale SAM lock, a half-finished deck task or a live bomb.
     */
    private applyScenario(scenario: ScenarioDef) {
        const setup = scenario.setup;

        // The map is part of the scenario, so the terrain is rebuilt with it.
        // Everything that samples terrain - sensors, the bomb predictor, the
        // renderer - is handed the new instance rather than caching heights.
        const mapId = setup.map ?? DEFAULT_MAP;
        if (this.terrain.profile.id !== mapId) {
            this.terrain = new TacticalTerrain(mapId);
        }

        this.deck = new DeckManager(setup.threat);
        this.sensors = new SensorTacticsManager(this.terrain);
        if (setup.noSamSites) this.sensors.samSites.length = 0;
        this.weapons = new WeaponsSystem();
        this.physics = new AircraftPhysics();
        this.score = new ScoreKeeper();
        this.training = new TrainingSequence();
        // The flight checkout is the intro mode's teaching tool; on a scripted
        // mission it is six lines of noise over the top of real orders.
        if (!setup.showTrainingChecklist) this.training.skip();

        if (setup.loadout) {
            this.deck.plannedLoadout = { ...setup.loadout };
        }

        this.strikeTargets = setup.strikeTarget
            ? [new StrikeTarget(
                setup.strikeTarget,
                this.terrain.getElevation(setup.strikeTarget.x, setup.strikeTarget.z)
            )]
            : [];

        this.samSitesAtStart = this.sensors.samSites.length;
        this.mission = new MissionDirector(scenario);
        this.missionSeconds = 0;
        this.hasLaunched = false;
        this.isNewBest = false;
        this.missionStatus = {
            outcome: 'ACTIVE', phaseIndex: 0, phase: null,
            reason: null, secondsRemaining: null, callouts: []
        };

        this.lastSpawnedWave = this.deck.waveNumber;
        this.airborneTargets = this.buildTargetsFromTimeline(this.deck.strikeTimeline);

        this.deck.log(`SCENARIO: ${scenario.name.toUpperCase()} - ${scenario.tagline}`);

        if (setup.startAirborne) {
            this.hotStartAirborne();
            this.hasLaunched = true;
        } else {
            this.currentView = 'MACRO_DECK';
        }
    }

    /** Snapshot of everything the mission director is allowed to look at. */
    private missionSnapshot(): MissionSnapshot {
        const target = this.strikeTargets[0] ?? null;
        const live = this.deck.strikeTimeline.filter(p => !p.isIntercepted && !p.hasAttacked);
        const groundElevation = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
        const isAirborne = this.deck.aircraftState === 'AIRBORNE';

        return {
            missionSeconds: this.missionSeconds,
            isAirborne,
            hasLaunched: this.hasLaunched,
            isRecovered: this.hasLaunched && !isAirborne && this.score.breakdown.traps > 0,

            altitudeMsl: this.physics.position.y,
            altitudeAgl: Math.max(0, this.physics.position.y - groundElevation),
            airSpeed: this.physics.airSpeed,
            fuel: this.physics.fuel,
            damage: this.physics.damage,

            distanceToCarrier: Math.hypot(this.physics.position.x, this.physics.position.z),
            distanceToStrikeTarget: target ? target.horizontalDistanceTo(this.physics.position) : null,
            strikeTargetDestroyed: target ? target.destroyed : false,
            strikeTargetHits: target ? target.hits : 0,

            samSitesAlive: this.sensors.samSites.length,
            samSitesTotal: this.samSitesAtStart,
            contactsAlive: this.airborneTargets.filter(t => t.isAlive).length,
            liveInboundPackages: live.length,
            soonestEtaSeconds: live.length ? Math.min(...live.map(p => p.etaSeconds)) : null,
            packagesLeaked: this.deck.strikeTimeline.filter(p => p.hasAttacked).length,

            carrierHealth: this.deck.inventory.carrierHealth,
            airframesLost: this.score.breakdown.airframesLost,
            spareAirframes: this.deck.inventory.spareAirframes,
            traps: this.score.breakdown.traps,
            perfectTraps: this.score.breakdown.perfectTraps,
            bombsRemaining: this.physics.loadout.ironBombs,
            rwrState: this.sensors.masterRwrState
        };
    }

    /** A bomb went into (or through) a hardened structure. */
    private onStrikeTargetHit(target: StrikeTarget, destroyed: boolean) {
        if (destroyed) {
            this.score.recordKill('STRUCTURE');
            this.deck.log(`DIRECT HIT: ${target.name} DESTROYED.`);
            soundFX.playExplosion();
        } else {
            this.deck.log(`HIT ON ${target.name} - ${target.hits}/${target.hitsRequired} REQUIRED.`);
        }
    }

    /** Push the current display mode into the renderer, post chain and CSS. */
    private applyDisplayMode() {
        const spec = displayModeSpec(this.displayMode);
        this.post.bloomStrength = spec.bloom;
        this.qualityCeiling = spec.bloom === 0 ? 'OFF' : spec.bloom > 0.45 ? 'HIGH' : 'LOW';
        this.post.quality = this.qualityCeiling;
        this.renderer.glowBlur = spec.vectorGlow;
        applyDisplayModeToDocument(spec);
    }

    /**
     * Back the bloom pass off when frames get expensive, without ever
     * exceeding what the player's chosen display mode asked for.
     */
    private updateAdaptiveQuality(frameDt: number) {
        const ms = Math.min(100, Math.max(1, frameDt * 1000));
        this.avgFrameMs += (ms - this.avgFrameMs) * 0.05;

        this.qualityCheckTimer += frameDt;
        if (this.qualityCheckTimer < 0.5) return;
        this.qualityCheckTimer = 0;

        const proposed = PostProcess.nextQuality(this.post.quality, this.avgFrameMs);
        const rank: Record<PostQuality, number> = { OFF: 0, LOW: 1, HIGH: 2 };
        this.post.quality = rank[proposed] > rank[this.qualityCeiling]
            ? this.qualityCeiling
            : proposed;
    }

    public get displayModeLabel(): string {
        return displayModeSpec(this.displayMode).label;
    }

    // -----------------------------------------------------------------
    // Sortie lifecycle
    // -----------------------------------------------------------------

    /**
     * Build airborne contacts from the current strike timeline. Replaces the
     * old hardcoded three-aircraft literal, which also meant STRIKE-3 never
     * had any aircraft and so could never be intercepted.
     */
    private buildTargetsFromTimeline(timeline: InboundStrikePackage[]): AirborneTarget[] {
        const targets: AirborneTarget[] = [];
        for (const pkg of timeline) {
            if (pkg.isIntercepted || pkg.hasAttacked) continue;

            const bearingRad = pkg.bearingDeg * (Math.PI / 180);
            const spawnZ = 6500 + Math.min(6000, pkg.etaSeconds * 12);
            // Keep contacts inside the canyon corridor so they don't spawn
            // buried inside a mountain; bearing still drives lateral offset.
            const lateralX = Math.sin(bearingRad) * 900;
            const alt = pkg.aircraftType === 'Tu-22' ? 1100 + Math.random() * 200 : 600 + Math.random() * 200;
            const speed = pkg.aircraftType === 'Tu-22' ? 200 + Math.random() * 20 : 170 + Math.random() * 30;

            for (let i = 0; i < pkg.count; i++) {
                targets.push({
                    id: `${pkg.id}-${i}`,
                    name: pkg.aircraftType === 'Tu-22' ? 'Tu-22M BACKFIRE' : `MiG-23 FLOGGER #${i + 1}`,
                    position: {
                        x: lateralX + (i - (pkg.count - 1) / 2) * 350,
                        y: alt,
                        z: spawnZ + i * 250
                    },
                    velocity: { x: (Math.random() - 0.5) * 20, y: 0, z: -speed },
                    isAlive: true
                });
            }
        }
        return targets;
    }

    private spawnEnemyThreats() {
        this.airborneTargets = this.buildTargetsFromTimeline(this.deck.strikeTimeline);
        this.lastSpawnedWave = this.deck.waveNumber;
    }

    /**
     * Configure the aircraft for a sortie with the player's PLANNED fuel and
     * loadout. Critically this does NOT force aircraftState - the deck state
     * machine owns that, so the catapult sequence can actually run.
     */
    public beginSortie(fuel: number, loadout: AircraftLoadout) {
        this.physics.repair();
        this.physics.fuel = fuel;
        this.physics.loadout = { ...loadout };
        this.selectedWeapon = 'GUN';
    }

    /** Seed the end-of-catapult-stroke flight state. */
    private seedCatapultExit() {
        this.physics.position = { x: 5, y: 22.5, z: 140 };
        this.physics.velocity = { x: 0, y: 0, z: 160 };
        this.physics.pitch = 0.14;
        this.physics.roll = 0;
        this.physics.yaw = 0;
        this.physics.throttle = 1.5;
    }

    /** Quick-start for returning players: skip the deck and start airborne. */
    public hotStartAirborne() {
        this.physics.repair();
        this.physics.position = { x: 0, y: 750, z: 1200 };
        this.physics.velocity = { x: 0, y: 0, z: 230 };
        this.physics.pitch = 0;
        this.physics.yaw = 0;
        this.physics.roll = 0;
        this.physics.throttle = 0.7;
        this.physics.fuel = 4500;
        this.deck.aircraftState = 'AIRBORNE';
        this.currentView = 'MICRO_FLIGHT';
        this.training.skip();
    }

    /**
     * Request a catapult launch. Applies the player's planned payload, which
     * previously was discarded because the old code called a reset routine
     * that hardcoded fuel to 4500 and force-set state to AIRBORNE.
     */
    public requestCatapultLaunch(): boolean {
        if (this.deck.aircraftState !== 'CATAPULT_READY') return false;
        if (!this.deck.triggerCatapultLaunch()) return false;

        this.beginSortie(this.deck.plannedFuel, this.deck.plannedLoadout);
        this.isCatapultLaunching = true;
        this.catapultProgress = 0;
        this.currentView = 'MICRO_FLIGHT';
        soundFX.playCatapultLaunch();
        return true;
    }

    /** Issue a fresh airframe after a loss. */
    private replaceAirframe(reason: string) {
        this.score.recordAirframeLost();
        this.deck.inventory.spareAirframes = Math.max(0, this.deck.inventory.spareAirframes - 1);
        this.deck.log(reason);
        this.physics.repair();
        this.physics.velocity = { x: 0, y: 0, z: 0 };
        this.physics.throttle = 0;
        this.deck.aircraftState = 'HANGAR_MAINTENANCE';
        this.deck.currentTaskProgress = 0;
        this.currentView = 'MACRO_DECK';
    }

    // -----------------------------------------------------------------
    // Frame lifecycle
    // -----------------------------------------------------------------

    public resize(width: number, height: number) {
        const dpr = typeof window !== 'undefined' && window.devicePixelRatio
            ? Math.min(2, Math.max(1, window.devicePixelRatio))
            : 1;
        this.dpr = dpr;
        this.viewWidth = Math.max(1, Math.round(width));
        this.viewHeight = Math.max(1, Math.round(height));

        this.canvas.width = Math.round(this.viewWidth * dpr);
        this.canvas.height = Math.round(this.viewHeight * dpr);
        if (this.canvas.style) {
            this.canvas.style.width = `${this.viewWidth}px`;
            this.canvas.style.height = `${this.viewHeight}px`;
        }
        // Everything downstream draws in CSS pixels.
        this.ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);

        this.post.resize(this.viewWidth, this.viewHeight, dpr);
        this.renderer.resize(this.viewWidth, this.viewHeight);
        this.hud.resize(this.viewWidth, this.viewHeight);
    }

    public start() {
        requestAnimationFrame(this.step.bind(this));
    }

    public ensureAudio() {
        if (!this.audioStarted) {
            soundFX.init();
            this.audioStarted = true;
        }
    }

    public get paused(): boolean {
        return this.phase !== 'ACTIVE' || this.helpVisible;
    }

    private step(timestamp: number) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const elapsed = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;
        this.elapsedSeconds += Math.min(0.1, Math.max(0, elapsed));

        if (this.phase === 'BOOT') {
            this.bootTimer += elapsed;
            if (this.bootTimer >= BriefingScreen.WARMUP_DURATION) {
                this.phase = 'BRIEFING';
            }
        }

        if (this.paused) {
            // Don't bank up simulation time while a menu is open, or the sim
            // would lurch forward the instant it resumes.
            this.timestep.reset();
        } else {
            const steps = this.timestep.consume(elapsed);
            for (let i = 0; i < steps; i++) {
                this.fixedUpdate(FIXED_DT);
            }
        }

        this.updateAdaptiveQuality(elapsed);
        this.draw(elapsed);
        requestAnimationFrame(this.step.bind(this));
    }

    /**
     * Apply continuous flight-control input. Runs inside the fixed update so
     * control authority is exactly time-consistent. Previously this lived in
     * a separate setInterval(16ms) with a hardcoded dt=0.016, which drifted
     * from real elapsed time and decoupled controls from the render loop.
     *
     * The keyboard no longer talks to the flight model directly: it produces a
     * pilot demand, the assist laws in FlightAssist resolve it against the
     * aircraft state, and only the result reaches the aerodynamics. At MANUAL
     * that resolution is the identity function, so the raw flight model is
     * exactly as it was.
     */
    private applyFlightInput(dt: number) {
        if (this.currentView !== 'MICRO_FLIGHT') return;
        if (this.deck.aircraftState !== 'AIRBORNE') return;
        const k = this.inputState;

        const pilot = {
            pitch: (k['w'] || k['arrowup'] ? 1 : 0) + (k['s'] || k['arrowdown'] ? -1 : 0),
            roll: (k['d'] || k['arrowright'] ? 1 : 0) + (k['a'] || k['arrowleft'] ? -1 : 0),
            throttle: (k['shift'] ? 1 : 0) + (k['control'] ? -1 : 0)
        };

        const demand = resolveControls(this.assistLevel, this.assistFlightState(), pilot, this.navTarget());
        this.assistOverride = demand.override;

        if (demand.pitch !== 0) this.physics.applyPitchInput(demand.pitch, dt);
        if (demand.roll !== 0) this.physics.applyRollInput(demand.roll, dt);
        // Autopilot rudder first, then the pilot's own - the rudder is how
        // heading actually changes in this flight model, so the autopilot has
        // to have it, and a pilot boot on the pedals still adds to it.
        if (demand.yaw !== 0) this.physics.applyYawInput(demand.yaw, dt);
        if (k['q']) this.physics.applyYawInput(-1.0, dt);
        if (k['e']) this.physics.applyYawInput(1.0, dt);

        if (demand.throttle !== 0) {
            this.physics.throttle = Math.min(1.5, Math.max(0,
                this.physics.throttle + demand.throttle * 0.5 * dt));
        }

        // Training credit tracks what the PILOT did, not what the autopilot
        // did for them - otherwise the checklist completes itself on AUTO and
        // teaches nobody anything.
        if (pilot.pitch !== 0) this.training.progress.pitchInputSeconds += dt;
        if (pilot.roll !== 0) this.training.progress.rollInputSeconds += dt;
        if (pilot.throttle !== 0) this.training.progress.throttleChanged = true;

        // Held-trigger cannon fire
        if (k[' '] && this.selectedWeapon === 'GUN') {
            this.weapons.fireGun(this.physics);
            this.training.progress.gunFired = true;
        }
    }

    /** Everything the assist laws are allowed to know about the aircraft. */
    private assistFlightState(): FlightState {
        const ground = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
        return {
            pitch: this.physics.pitch,
            roll: this.physics.roll,
            yaw: this.physics.yaw,
            alpha: this.physics.alpha,
            airSpeed: this.physics.airSpeed,
            throttle: this.physics.throttle,
            altitudeAgl: Math.max(0, this.physics.position.y - ground),
            verticalSpeed: this.physics.velocity.y,
            isStalled: this.physics.isStalled,
            onApproach: HUD.isOnApproach(this.physics)
        };
    }

    /**
     * Where the autopilot is flying. A designated target is prosecuted; with
     * nothing designated it holds the present heading at a safe height rather
     * than inventing an objective, so switching to AUTO is always a way to
     * stabilise the jet and take stock.
     */
    private navTarget(): NavTarget | null {
        const designated = this.tracker.designated();
        if (designated) {
            const p = designated.target.position;
            return pursuitNav(designated, this.terrain.getElevation(p.x, p.z));
        }

        return {
            bearing: this.physics.yaw,
            altitudeAgl: 900,
            airSpeed: 240,
            maxBank: 0.6
        };
    }

    /**
     * Refresh the designation list. Candidates are live airborne contacts,
     * surviving SAM sites and intact strike targets - exactly the things a
     * weapon can be employed against, so the cycle key never stops on wreckage.
     */
    private refreshDesignation() {
        const candidates: DesignatableTarget[] = [];

        for (const t of this.airborneTargets) {
            if (!t.isAlive) continue;
            candidates.push({ id: t.id, kind: 'AIR', name: t.name, position: t.position });
        }
        for (const sam of this.sensors.samSites) {
            candidates.push({ id: sam.id, kind: 'SAM', name: sam.name, position: sam.position });
        }
        for (const st of this.strikeTargets) {
            if (st.destroyed) continue;
            candidates.push({ id: st.id, kind: 'STRUCTURE', name: st.name, position: st.position });
        }

        this.tracker.refresh(
            { position: this.physics.position, forward: this.physics.forwardVector },
            candidates
        );
    }

    // -----------------------------------------------------------------
    // Player commands: assist level, designation, weapon release
    // -----------------------------------------------------------------

    /** Cycle MANUAL -> ASSIST -> AUTOPILOT, and say so in the log. */
    public cycleAssistLevel() {
        this.assistLevel = nextAssistLevel(this.assistLevel);
        saveAssistLevel(this.assistLevel);
        this.assistOverride = 'NONE';
        const spec = assistSpec(this.assistLevel);
        this.deck.log(`FLIGHT CONTROL: ${spec.label} - ${spec.blurb}.`);
    }

    /** Step the designation through the priority-ordered scope. */
    public cycleDesignation(direction: number = 1): TargetSolution | null {
        if (this.deck.aircraftState !== 'AIRBORNE') return null;
        this.refreshDesignation();
        const chosen = this.tracker.cycle(direction);
        if (chosen) {
            const range = (chosen.range / 1000).toFixed(1);
            this.deck.log(`DESIGNATED ${chosen.target.name} - ${range} KM - ${chosen.recommendedWeapon}.`);
        } else {
            this.deck.log('NO TARGETS ON THE SCOPE.');
        }
        return chosen;
    }

    public releaseDesignation() {
        if (!this.tracker.designatedId) return;
        this.tracker.clear();
        this.deck.log('DESIGNATION RELEASED.');
    }

    /**
     * Single-shot weapon release. Lives here rather than in the input layer so
     * the designated target can be handed to the seeker: the missile now goes
     * after the contact the player chose instead of whichever one happened to
     * be nearest the nose.
     */
    public fireSelectedWeapon() {
        if (this.currentView !== 'MICRO_FLIGHT') return;
        if (this.selectedWeapon === 'AIM9') {
            const designated = this.tracker.designated();
            this.weapons.fireSidewinder(
                this.physics,
                this.airborneTargets,
                designated?.target.kind === 'AIR' ? designated.target.id : null
            );
        } else if (this.selectedWeapon === 'BOMB') {
            this.weapons.dropBomb(this.physics);
        }
    }

    private fixedUpdate(dt: number) {
        this.applyFlightInput(dt);

        // Catapult: derive the animation from DeckManager's single clock, and
        // detect the completion EDGE. The old code kept a second independent
        // timer and checked completion AFTER deck.update() had already
        // flipped the state to AIRBORNE, so the branch never ran.
        const wasLaunching = this.deck.aircraftState === 'CATAPULT_LAUNCHING';
        if (wasLaunching) {
            this.isCatapultLaunching = true;
            this.catapultProgress = Math.min(1, this.deck.catapultTimer / DeckManager.CATAPULT_STROKE_SEC);

            const trackStartZ = -30;
            const trackEndZ = 140;
            this.physics.position = {
                x: 5,
                y: 22.5,
                z: trackStartZ + (trackEndZ - trackStartZ) * (this.catapultProgress ** 1.8)
            };
            this.physics.velocity = { x: 0, y: 0, z: 40 + this.catapultProgress * 120 };
            this.physics.pitch = 0.05;
            this.physics.roll = 0;
            this.physics.yaw = 0;
            this.physics.throttle = 1.5;
        }

        this.deck.update(dt);

        if (wasLaunching && this.deck.aircraftState === 'AIRBORNE') {
            this.isCatapultLaunching = false;
            this.catapultProgress = 0;
            this.seedCatapultExit();
            this.currentView = 'MICRO_FLIGHT';
        }

        // Spawn contacts when the threat director escalates to a new wave.
        if (this.deck.waveNumber !== this.lastSpawnedWave) {
            this.score.recordWaveSurvived();
            this.spawnEnemyThreats();
        }

        if (this.deck.aircraftState === 'AIRBORNE') {
            this.hasLaunched = true;
            this.updateSortie(dt);
        } else {
            soundFX.updateEngine(0, false);
            soundFX.setRWRState('SILENT');
        }

        this.updateMission(dt);
        if (this.phase === 'DEBRIEF') return;

        this.training.update();
        this.currentHint = this.buildHint();
    }

    private updateSortie(dt: number) {
        this.physics.update(dt);
        // Recomputed every tick: the HUD bracket, the weapon recommendation
        // and the autopilot all read this frame's geometry, and a lock on a
        // contact that died this tick has to drop itself immediately.
        this.refreshDesignation();
        soundFX.updateEngine(this.physics.throttle, true);

        // Sensors, RWR and SAM engagements
        this.sensors.update(dt, this.physics);
        soundFX.setRWRState(this.sensors.masterRwrState);

        if (this.sensors.masterRwrState === 'SILENT' && this.physics.position.y < 400) {
            this.training.progress.hasBeenMasked = true;
        }

        // SAM missile impacts now actually hurt - previously missiles flew
        // straight through the player with no collision check at all.
        for (const impact of this.sensors.missileImpacts) {
            this.physics.applyDamage(impact.damage);
            this.weapons.spawnExplosion(impact.position, 18, '#ff6600');
            this.deck.log(`SAM IMPACT FROM ${impact.samId}! AIRFRAME DAMAGE ${Math.round(impact.damage)}%.`);
        }

        // Enemy aircraft behaviour (also integrates their positions)
        updateEnemyAI(dt, this.airborneTargets, this.physics, (enemy) => {
            // Simplified hit-scan cannon burst: the alignment/range gate in
            // EnemyAI has already established a valid guns solution.
            const dmg = 4 + Math.random() * 6;
            this.physics.applyDamage(dmg);
            this.deck.log(`TAKING CANNON FIRE FROM ${enemy.name}!`);
            soundFX.playGunShot();
        });

        // Player weapons
        this.weapons.update(dt, {
            terrain: this.terrain,
            targets: this.airborneTargets,
            samSites: this.sensors.samSites,
            strikeTargets: this.strikeTargets,
            onTargetDestroyed: (destroyedTarget) => this.onTargetDestroyed(destroyedTarget),
            onSAMDestroyed: (destroyedSAM) => {
                this.score.recordKill('SAM');
                this.deck.log(`RADAR STRIKE: ${destroyedSAM.name} NEUTRALIZED.`);
            },
            onStrikeTargetHit: (target, destroyed) => this.onStrikeTargetHit(target, destroyed)
        });

        // Aircraft destroyed by accumulated battle damage
        if (this.physics.damage >= 100) {
            this.weapons.spawnExplosion(this.physics.position, 40, '#ff3300');
            this.replaceAirframe('MAYDAY: AIRCRAFT DESTROYED BY ENEMY FIRE!');
            return;
        }

        // Controlled Flight Into Terrain
        const groundElevation = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
        if (this.physics.position.y <= groundElevation + 2) {
            this.weapons.spawnExplosion(this.physics.position, 40, '#ff3300');
            this.physics.position.y = groundElevation + 2;
            this.replaceAirframe('MAYDAY: AIRCRAFT LOST TO TERRAIN IMPACT IN CANYON!');
            return;
        }

        // Carrier recovery (arresting gear trap)
        const distToCarrier = Math.hypot(this.physics.position.x, this.physics.position.z);
        if (distToCarrier < 190 && this.physics.position.y >= 17 && this.physics.position.y <= 30) {
            if (this.physics.airSpeed < 95) {
                const grade = ScoreKeeper.gradeTrap(this.physics.position.z);
                this.score.recordTrap(grade);
                const isDamaged = this.physics.damage > 25;
                this.deck.processTrapRecovery(this.physics.fuel, isDamaged);
                this.deck.log(
                    grade === 'BOLTER'
                        ? 'BOLTER! MISSED THE WIRES.'
                        : `TRAP GRADE: ${grade}-WIRE.`
                );
                this.currentView = 'MACRO_DECK';
            }
        }
    }

    private onTargetDestroyed(destroyedTarget: AirborneTarget) {
        this.deck.log(`COMBAT REPORT: ${destroyedTarget.name} DESTROYED.`);
        this.score.recordKill(isBomber(destroyedTarget) ? 'BOMBER' : 'FIGHTER');

        // Map contact id back to its strike package ("STRIKE-1-0" -> "STRIKE-1")
        const pkgId = destroyedTarget.id.replace(/-\d+$/, '');
        const anyLeft = this.airborneTargets.some(
            t => t.isAlive && t.id.replace(/-\d+$/, '') === pkgId
        );
        if (!anyLeft) {
            this.deck.markStrikeIntercepted(pkgId);
        }
    }

    /**
     * Advance the scenario clock and the mission director, and end the run
     * when the scenario says so. The deck's own FAILED state still counts as
     * a loss for every scenario, since a sunk carrier ends any of them.
     */
    private updateMission(dt: number) {
        this.missionSeconds += dt;
        const snapshot = this.missionSnapshot();
        this.missionStatus = this.mission.update(snapshot);

        for (const callout of this.missionStatus.callouts) {
            this.deck.log(callout);
        }

        const deckFailed = this.deck.missionState === 'FAILED';
        const outcome = deckFailed ? 'FAILED' : this.missionStatus.outcome;
        if (outcome === 'ACTIVE' || this.phase === 'DEBRIEF') return;

        this.missionOutcome = outcome;
        this.missionReason = deckFailed
            ? 'CV-68 was knocked out of the fight.'
            : this.missionStatus.reason;
        if (outcome === 'SUCCESS') this.score.recordMissionComplete();

        const result = recordBestScore(this.score.totalScore, this.bestScore);
        this.bestScore = result.best;
        this.isNewBest = result.isNewBest;
        this.deck.log(outcome === 'SUCCESS' ? 'MISSION COMPLETE.' : 'MISSION FAILED.');
        this.phase = 'DEBRIEF';
    }

    /** Phosphor decay constant for the active display mode. */
    private get persistenceTau(): number {
        return displayModeSpec(this.displayMode).persistenceTau;
    }

    /**
     * The always-on "what should I be doing" line, derived from whichever
     * loop the player is currently in.
     */
    public currentObjective(): ObjectiveStep {
        // A scenario with scripted phases owns the objective line; the generic
        // deck/flight director is the fallback for the open-ended mode, and
        // for the deck states a flight phase has nothing useful to say about.
        const snapshot = this.missionSnapshot();
        const missionObjective = this.mission.objective(snapshot);
        if (missionObjective) return missionObjective;

        // The mission clock follows the player onto the deck even when the
        // deck director is doing the talking.
        const countdownSeconds = this.mission.clock(snapshot) ?? undefined;
        const live = this.deck.strikeTimeline.filter(p => !p.isIntercepted && !p.hasAttacked);
        const soonest = live.length ? Math.min(...live.map(p => p.etaSeconds)) : null;

        if (this.currentView === 'MICRO_FLIGHT' && this.deck.aircraftState === 'AIRBORNE') {
            return { ...flightObjective({
                liveInboundCount: live.length,
                soonestEtaSeconds: soonest,
                airborneContacts: this.airborneTargets.filter(t => t.isAlive).length,
                fuel: this.physics.fuel,
                damage: this.physics.damage,
                distanceToCarrier: Math.hypot(this.physics.position.x, this.physics.position.z),
                rwrState: this.sensors.masterRwrState
            }), countdownSeconds };
        }

        return { ...deckObjective({
            aircraftState: this.deck.aircraftState,
            taskProgressPct: this.deck.currentTaskProgress,
            scrambleAlert: this.deck.scrambleAlert,
            soonestEtaSeconds: soonest,
            liveInboundCount: live.length,
            spareAirframes: this.deck.inventory.spareAirframes
        }), countdownSeconds };
    }

    private buildHint(): Hint | null {
        // The deck's "press ENTER" prompt now lives in the orders panel, so
        // the ticker stays silent unless something actually needs attention.
        if (this.deck.aircraftState !== 'AIRBORNE') return null;

        const groundElevation = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
        const contextual = getContextualHint({
            isStalled: this.physics.isStalled,
            rwrState: this.sensors.masterRwrState,
            altitudeAgl: this.physics.position.y - groundElevation,
            verticalSpeed: this.physics.velocity.y,
            fuel: this.physics.fuel,
            airSpeed: this.physics.airSpeed,
            damage: this.physics.damage,
            distanceToCarrier: Math.hypot(this.physics.position.x, this.physics.position.z),
            isAirborne: true,
            bayOpen: this.physics.bayOpen
        });

        // BUG THIS FIXES: the training prompt used to be returned FIRST and
        // unconditionally, so a new pilot - exactly the player who needs them
        // most - had stall, terrain and missile-launch warnings suppressed
        // for the whole of their first sortie.
        if (contextual) return contextual;

        const trainingStep = this.training.currentStep;
        if (trainingStep) return { text: trainingStep.prompt, severity: 'INFO' };
        return null;
    }

    // -----------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------

    private draw(frameDt: number) {
        const w = this.viewWidth;
        const h = this.viewHeight;

        this.ctx.save();
        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = THEME.ground;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();

        if (this.phase === 'BOOT') {
            this.briefing.drawWarmUp(this.ctx, this.bootTimer, w, h);
            return;
        }

        if (this.phase === 'BRIEFING') {
            // Wireframe backdrop into the offscreen world layer (with a gentle
            // phosphor trail), composite it, then the crisp text overlay.
            this.renderer.decayClear(Math.min(0.1, Math.max(0.001, frameDt)), this.persistenceTau * 1.8);
            this.briefing.drawBriefingBackdrop(this.renderer, this.elapsedSeconds, h);
            this.post.composite(this.ctx);
            this.briefing.drawBriefing(this.ctx, w, h, this.elapsedSeconds, this.scenario, this.bestScore);
            if (this.helpVisible) this.briefing.drawHelp(this.ctx, w, h, 'FLIGHT');
            return;
        }

        if (this.phase === 'DEBRIEF') {
            this.briefing.drawDebrief(
                this.ctx, w, h, this.score, this.deck.waveNumber, this.bestScore, this.isNewBest,
                {
                    outcome: this.missionOutcome === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
                    scenarioName: this.scenario.name,
                    reason: this.missionReason,
                    title: this.scenario.victoryTitle
                }
            );
            return;
        }

        if (this.currentView === 'MICRO_FLIGHT') {
            this.drawCockpitSim(frameDt);
        } else {
            this.post.hardClear();
            this.deckView.draw(
                this.ctx,
                this.deck,
                this.score,
                {
                    objective: this.currentObjective(),
                    hint: this.currentHint,
                    displayModeLabel: this.displayModeLabel
                },
                w, h, this.elapsedSeconds
            );
        }

        if (this.helpVisible) {
            this.briefing.drawHelp(
                this.ctx,
                w,
                h,
                this.currentView === 'MICRO_FLIGHT' ? 'FLIGHT' : 'DECK'
            );
        }
    }

    private drawCockpitSim(frameDt: number) {
        const camPos = this.physics.position;
        const camPitch = this.physics.pitch;
        const camYaw = this.physics.yaw;
        const camRoll = this.physics.roll;

        // Phosphor decay instead of a hard clear: old strokes fade out over
        // ~60ms leaving authentic vector-CRT trails. This happens on the
        // OFFSCREEN world layer only, so HUD text stays crisp.
        this.renderer.decayClear(Math.min(0.1, Math.max(0.001, frameDt)), this.persistenceTau);

        this.drawHorizonAndSea(camPos, camPitch, camYaw, camRoll);

        this.renderer.renderMesh(this.carrierMesh, { x: 0, y: 0, z: 0 }, 0, camPos, camPitch, camYaw, camRoll, WORLD.carrier);
        this.terrain.render(this.renderer, camPos, camPitch, camYaw, camRoll);

        // Hardened structures. A destroyed pen stays on the map as wreckage -
        // the player should be able to fly back past what they hit.
        for (const target of this.strikeTargets) {
            this.renderer.renderMesh(
                this.penMesh,
                target.position,
                Math.PI,
                camPos, camPitch, camYaw, camRoll,
                target.destroyed ? WORLD.valley : undefined
            );
        }

        for (const sam of this.sensors.samSites) {
            this.renderer.renderMesh(this.samMesh, sam.position, 0, camPos, camPitch, camYaw, camRoll, WORLD.hostile);

            if (sam.missileActive && sam.missilePos && sam.missileVel) {
                const tail: Vector3 = {
                    x: sam.missilePos.x - (sam.missileVel.x / 480) * 8,
                    y: sam.missilePos.y - (sam.missileVel.y / 480) * 8,
                    z: sam.missilePos.z - (sam.missileVel.z / 480) * 8
                };
                this.renderer.drawLine(tail, sam.missilePos, camPos, camPitch, camYaw, camRoll, WORLD.missile, 2.8);
            }
        }

        for (const target of this.airborneTargets) {
            if (!target.isAlive) continue;
            const mesh = isBomber(target) ? this.bomberMesh : this.mig23Mesh;
            this.renderer.renderMesh(
                mesh,
                target.position,
                target.yaw ?? Math.atan2(target.velocity.x, target.velocity.z),
                camPos, camPitch, camYaw, camRoll,
                undefined,
                target.pitch ?? 0,
                target.roll ?? 0
            );
        }

        this.weapons.render(this.renderer, camPos, camPitch, camYaw, camRoll);

        // Composite world + bloom to the visible canvas, THEN draw the HUD
        // crisply on top so persistence never smears the symbology.
        this.post.composite(this.ctx);

        this.hud.draw(
            this.ctx,
            this.physics,
            this.sensors,
            this.airborneTargets,
            this.selectedWeapon,
            this.renderer,
            {
                hint: this.currentHint,
                score: this.score,
                objective: this.currentObjective(),
                checklist: this.training.checklist(),
                displayModeLabel: this.displayModeLabel,
                strikeTargets: this.strikeTargets,
                bombImpactPoint: this.selectedWeapon === 'BOMB' && this.physics.loadout.ironBombs > 0
                    ? WeaponsSystem.predictBombImpact(this.physics, this.terrain)
                    : null,
                designated: this.tracker.designated(),
                assistLabel: assistSpec(this.assistLevel).label,
                assistOverride: this.assistOverride
            }
        );
    }

    /**
     * Horizon ring and scrolling sea lattice. Without these the cockpit is a
     * black void with no motion cue over water and no orientation reference.
     * Drawn through the same projection as everything else, so the HUD pitch
     * ladder (now fov-derived) lands exactly on this horizon.
     */
    private drawHorizonAndSea(camPos: Vector3, camPitch: number, camYaw: number, camRoll: number) {
        const R = 60000;
        const segments = 36;
        let prev: Vector3 | null = null;
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            const p: Vector3 = { x: camPos.x + Math.sin(a) * R, y: 0, z: camPos.z + Math.cos(a) * R };
            if (prev) {
                this.renderer.drawLine(prev, p, camPos, camPitch, camYaw, camRoll, WORLD.horizon, 1.6);
            }
            prev = p;
        }

        // Sea lattice: snapped to a 500m grid so it scrolls past as you fly.
        const grid = 500;
        const span = 6000;
        const baseX = Math.floor(camPos.x / grid) * grid;
        const baseZ = Math.floor(camPos.z / grid) * grid;
        for (let gx = baseX - span; gx <= baseX + span; gx += grid) {
            for (let gz = baseZ - span; gz <= baseZ + span; gz += grid) {
                if (this.terrain.getElevation(gx, gz) > 5) continue;
                const a: Vector3 = { x: gx, y: 0, z: gz };
                const b: Vector3 = { x: gx + grid, y: 0, z: gz };
                const c: Vector3 = { x: gx, y: 0, z: gz + grid };
                this.renderer.drawLine(a, b, camPos, camPitch, camYaw, camRoll, WORLD.sea, 1.0);
                this.renderer.drawLine(a, c, camPos, camPitch, camYaw, camRoll, WORLD.sea, 1.0);
            }
        }
    }

    // -----------------------------------------------------------------
    // Phase transitions driven by the input layer
    // -----------------------------------------------------------------

    public confirmBriefing() {
        if (this.phase !== 'BRIEFING') return;
        // Build the world fresh from whatever the selector landed on.
        this.applyScenario(this.scenario);
        this.missionOutcome = 'ACTIVE';
        this.missionReason = null;
        this.phase = 'ACTIVE';
        this.post.hardClear();
    }

    public restartFromDebrief() {
        this.isNewBest = false;
        this.missionOutcome = 'ACTIVE';
        this.missionReason = null;
        this.phase = 'BRIEFING';
        this.currentView = 'MACRO_DECK';
        this.post.hardClear();
    }

    /**
     * Cycle CLEAN -> MODERN -> RETRO. One key now controls every screen
     * effect (vector trails, bloom, scanlines, vignette) instead of only the
     * bloom pass, so a player who finds the texture hard to read has a
     * single, discoverable way to turn it off.
     */
    public cycleDisplayMode() {
        this.displayMode = nextDisplayMode(this.displayMode);
        this.applyDisplayMode();
        this.post.hardClear();
        const spec = displayModeSpec(this.displayMode);
        saveDisplayMode(this.displayMode);
        this.deck.log(`DISPLAY: ${spec.label} - ${spec.description}`);
    }
}
