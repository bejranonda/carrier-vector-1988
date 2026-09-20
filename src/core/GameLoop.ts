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
import type { InboundStrikePackage, ThreatProfile } from '../carrier/DeckManager';
import { WeaponsSystem } from '../flight/Weapons';
import { soundFX } from '../audio/SoundFX';
import type { SoundPlacement } from '../audio/SoundFX';
import { FixedTimestepAccumulator, FIXED_DT } from './Timestep';
import { ScoreKeeper } from './ScoreKeeper';
import { getContextualHint, TrainingSequence } from './Tutorial';
import type { Hint } from './Tutorial';
import { updateEnemyAI, isBomber } from '../tactics/EnemyAI';
import { PostProcess } from '../renderer/PostProcess';
import type { PostQuality } from '../renderer/PostProcess';
import { DeckView } from '../renderer/DeckView';
import { BriefingScreen } from '../renderer/BriefingScreen';
import {
    THEME,
    WORLD,
    applyPalette,
    loadPalette,
    nextPalette,
    paletteSpec,
    savePalette
} from '../renderer/Theme';
import type { PaletteId } from '../renderer/Theme';
import {
    applyDisplayModeToDocument,
    displayModeSpec,
    loadDisplayMode,
    nextDisplayMode,
    saveDisplayMode,
    storedDisplayMode
} from '../renderer/DisplayMode';
import type { DisplayModeId } from '../renderer/DisplayMode';
import { deckObjective, flightObjective } from './Objectives';
import {
    DEFAULT_SCENARIO,
    MissionDirector,
    SCENARIOS,
    recommendScenario,
    scenarioAt,
    scenarioById
} from './Scenarios';
import type { MissionSnapshot, MissionStatus, ScenarioDef, ScenarioId } from './Scenarios';
import { StrikeTarget } from '../tactics/StrikeTarget';
import {
    assistSpec,
    loadAssistLevel,
    storedAssistLevel,
    nextAssistLevel,
    resolveControls,
    saveAssistLevel
} from '../flight/FlightAssist';
import type { AssistLevel, ControlDemand, FlightState, NavTarget } from '../flight/FlightAssist';
import { TargetTracker, pursuitNav } from '../tactics/TargetDesignation';
import {
    loadTerrainFollowing,
    sampleGroundTrack,
    saveTerrainFollowing,
    terrainFollowingAltitude
} from '../flight/TerrainFollowing';
import {
    APPROACH_TUNING,
    approachCaption,
    approachGuidance,
    loadApproachAssist,
    saveApproachAssist,
    storedApproachAssist
} from '../flight/ApproachGuidance';
import type { ApproachPhase } from '../flight/ApproachGuidance';
import { VisibilityTracker } from '../tactics/Visibility';
import type { DesignatableTarget, TargetSolution } from '../tactics/TargetDesignation';
import {
    DEFAULT_MAP,
    loadMapChoice,
    nextMap,
    saveMapChoice
} from '../tactics/TerrainProfiles';
import type { MapId } from '../tactics/TerrainProfiles';
import { loadBestScore, recordBestScore } from './HighScore';
import {
    deckTiming,
    loadPacing,
    nextPacing,
    pacingSpec,
    savePacing,
    scaleOpeningEta
} from './Pacing';
import type { PacingId } from './Pacing';
import {
    loadThreatLevel,
    nextThreatLevel,
    saveThreatLevel,
    startWaveFor,
    threatLevelSpec
} from './ThreatLevel';
import type { ThreatLevelId } from './ThreatLevel';
import {
    loadSchemePreference,
    needsRotation,
    nextSchemePreference,
    readPlatformSignals,
    resolveScheme,
    saveSchemePreference
} from './Platform';
import type { ControlScheme, SchemePreference } from './Platform';
import { TouchInput } from './TouchInput';
import { solveTouchLayout } from '../renderer/TouchLayout';
import type { SafeArea, TouchControlId, TouchLayout } from '../renderer/TouchLayout';
import { drawLaunchButton, drawRotatePrompt, drawTouchControls } from '../renderer/TouchControls';
import { pickTargetAt } from '../tactics/TargetDesignation';
import type { ScreenTarget } from '../tactics/TargetDesignation';
import { briefingHitAreas } from '../renderer/BriefingScreen';
import {
    SHAKE_SOURCES,
    addTrauma,
    blastTrauma,
    decayTrauma,
    shakeOffsets
} from '../renderer/CameraShake';
import { Callouts, splashLine } from './Callouts';
import { motionSettings, readMotionPreferences } from './Accessibility';
import type { MotionSettings } from './Accessibility';
import {
    dailyKey,
    dailyNumber,
    dailySeed,
    formatShareCard,
    loadDailyResults,
    mergeDailyResult,
    saveDailyResults
} from './DailySortie';
import type { DailyResult, DailyResults } from './DailySortie';
import {
    loadMissionRecords,
    mergeMissionResult,
    recordFor,
    saveMissionRecords
} from './MissionRecords';
import type { MissionRecords } from './MissionRecords';
import type { ObjectiveStep } from './Objectives';

export type GamePhase = 'BOOT' | 'BRIEFING' | 'ACTIVE' | 'DEBRIEF';

const inside = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** How long the camera stays in the cockpit after catching a wire. */
const TRAP_CINEMATIC_SECONDS = 1.6;

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
     * Colour palette. Green-for-us / red-for-them is the one pairing a
     * red-green colour-blind player cannot read, so it is a setting.
     */
    public palette: PaletteId = loadPalette();
    /**
     * Chosen map, for the scenarios that let one be chosen. Null means the
     * scenario's own terrain.
     */
    public mapChoice: MapId | null = loadMapChoice();
    /**
     * How hard the fight is, as distinct from how much of the aeroplane you
     * fly (assist level) or how long you wait (ops tempo).
     */
    public threatLevel: ThreatLevelId = loadThreatLevel();

    /**
     * How much of the aeroplane the player wants to fly. Restored between
     * sessions, cycled with one key, and applied by pure control laws in
     * FlightAssist - see that module for why this exists at all.
     */
    /**
     * Operational tempo. ARCADE compresses the deck cycle and pulls the
     * threat timeline forward so the first shot happens inside half a minute;
     * SIM restores the original deliberate timings. See core/Pacing.ts.
     */
    public pacing: PacingId = loadPacing();

    /**
     * Touch mode. Not a parallel implementation of the game: the autopilot
     * flies, designation picks the target, and the flight model, assists and
     * weapons are the ones the keyboard drives. See core/Platform.ts.
     */
    public schemePreference: SchemePreference = loadSchemePreference();
    public controlScheme: ControlScheme = 'KEYBOARD';
    public touch = new TouchInput();
    public touchLayout: TouchLayout = solveTouchLayout(1280, 800);
    private safeArea: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
    /** Analog stick demand, which overrides the keyboard axes when present. */
    private analog: { pitch: number; roll: number } | null = null;
    /**
     * True while a thumb is on the throttle track. A hand on the throttle
     * outranks the autopilot's speed hold: the track sets power directly, and
     * without this the autopilot spent the next frame putting it back.
     */
    private touchThrottleHeld = false;

    public assistLevel: AssistLevel = loadAssistLevel();
    /** Which protection, if any, is currently taking authority. For the HUD. */
    public assistOverride: ControlDemand['override'] = 'NONE';

    /**
     * Whether the autopilot looks ahead and hugs the terrain rather than
     * holding a set altitude. On by default: an autopilot that crosses ridge
     * lines inside a SAM belt is not flying the aeroplane the way its pilot
     * would.
     */
    public terrainFollowing = loadTerrainFollowing();
    /** True while a ridge ahead - not the ground below - is setting altitude. */
    public terrainFollowClimbing = false;

    /**
     * Whether the autopilot will fly the recovery: join the pattern, roll out
     * on the final approach course and fly the glideslope to short final,
     * then hand back. Off by default on a keyboard - the trap is the game -
     * and on by default on a phone, where the alternative is not landing.
     */
    public approachAssist = loadApproachAssist();
    /** Which phase the recovery is in, or null when it is not flying. */
    public approachPhase: ApproachPhase | null = null;

    /**
     * The pilot's chosen target. Everything downstream follows it: the HUD
     * bracket, the weapon recommendation, which contact the Sidewinder guides
     * on, and where the autopilot flies.
     */
    public tracker = new TargetTracker();

    /**
     * What the pilot can actually see. Designation used to rank every contact
     * within twenty kilometres regardless of terrain, which made the scope a
     * free reconnaissance tool and let masking cut only one way.
     */
    public visibility = new VisibilityTracker();

    /**
     * Cockpit shake and the full-screen hit flash. Both are presentation only:
     * the shake is added to the CAMERA angles at draw time and never to the
     * physics, so the fixed-timestep simulation stays deterministic and every
     * timing test in the suite stays meaningful.
     */
    public trauma = 0;
    /**
     * Motion and flash limits. The shake and the impact flash are exactly the
     * effects `prefers-reduced-motion` exists for, and the canvas was ignoring
     * a preference the CSS already honoured.
     */
    public motion: MotionSettings = motionSettings(readMotionPreferences());
    private flashAlpha = 0;
    private flashColor: string = THEME.alert;

    /** "That worked" - the one channel for kills, traps and losses. */
    public callouts = new Callouts();
    /** Kills this sortie, so the callout can say SPLASH ONE, SPLASH TWO. */
    private sortieKills = 0;
    /** Seconds remaining on the cannon hit marker. */
    private hitMarker = 0;
    /** Last-seen missileActive per SAM, for launch-edge detection. */
    private samMissileActive = new Map<string, boolean>();
    /** Damage at the last master-caution, so it fires per event not per frame. */
    private lastCautionDamage = 0;

    /**
     * Wire-catch payoff. The trap used to resolve as an instant view switch
     * and a log line - the best moment in the game, over before it registered.
     */
    private trapCinematic = 0;
    private trapGrade: string | null = null;

    /** Personal best across sessions, shown on the briefing and the debrief. */
    public bestScore = loadBestScore();
    private isNewBest = false;

    /**
     * Per-scenario bests and completions. The global best cannot say whether
     * you have ever beaten the canyon strike, because a long carrier defence
     * out-scores it by an order of magnitude.
     */
    public missionRecords: MissionRecords = loadMissionRecords();
    private isMissionBest = false;

    /**
     * The daily sortie: one date-seeded run everybody gets the same version
     * of, and the only thing in this game that can leave the tab.
     */
    public dailyResults: DailyResults = loadDailyResults();
    /** True while the active run counts as today's daily. */
    public isDailyRun = false;
    /** The card for the run just finished, shown on the debrief. */
    public dailyCard: string | null = null;
    /** Set briefly after a successful copy, for the confirmation line. */
    public dailyCopied = false;
    /**
     * Which day the run in progress belongs to, fixed when it started.
     *
     * Reading the clock again at the end would file a sortie begun at 23:59
     * under the following day - against a seed it was never flown on.
     */
    private dailyRunDate: string | null = null;

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

        applyPalette(this.palette);
        this.applyDisplayMode();
        this.applyScenario(this.scenario);
    }

    // -----------------------------------------------------------------
    // Scenario lifecycle
    // -----------------------------------------------------------------

    /** Step the briefing screen's scenario selector, wrapping at both ends. */
    public selectScenario(delta: number) {
        soundFX.playUiMove();
        this.scenario = scenarioAt(this.scenarioIndex + delta);
        // Normalise rather than letting the index drift off into the negatives
        // over a long browse; scenarioAt() wraps the value, not the field.
        this.scenarioIndex = SCENARIOS.findIndex(sc => sc.id === this.scenario.id);
    }

    /**
     * Step the map for a scenario that allows one to be chosen.
     *
     * Returns the map now selected, or null when this scenario owns its
     * terrain - which is most of them, and is not a failure.
     */
    public cycleMapChoice(delta = 1): MapId | null {
        if (!this.scenario.setup.allowMapChoice) return null;
        const current = this.mapChoice ?? this.scenario.setup.map ?? DEFAULT_MAP;
        this.mapChoice = nextMap(current, delta);
        saveMapChoice(this.mapChoice);
        soundFX.playUiMove();
        return this.mapChoice;
    }

    /** The map the selected scenario would be flown on right now. */
    public selectedMap(): MapId {
        const setup = this.scenario.setup;
        return setup.allowMapChoice && this.mapChoice !== null
            ? this.mapChoice
            : setup.map ?? DEFAULT_MAP;
    }

    public selectScenarioById(id: ScenarioId) {
        this.selectScenarioByIndex(SCENARIOS.findIndex(sc => sc.id === id));
    }

    /** Direct pick from the number shown on a selector pill. */
    public selectScenarioByIndex(index: number) {
        if (index < 0 || index >= SCENARIOS.length) return;
        if (index !== this.scenarioIndex) soundFX.playUiMove();
        this.scenarioIndex = index;
        this.scenario = SCENARIOS[index];
    }

    /**
     * Rebuild the world for a scenario. Every subsystem that carries run
     * state is replaced rather than reset in place, so a scenario can never
     * inherit a stale SAM lock, a half-finished deck task or a live bomb.
     */
    private applyScenario(scenario: ScenarioDef, seedOverride?: number) {
        const setup = scenario.setup;

        // The map is part of the scenario, so the terrain is rebuilt with it.
        // Everything that samples terrain - sensors, the bomb predictor, the
        // renderer - is handed the new instance rather than caching heights.
        const mapId = setup.allowMapChoice && this.mapChoice !== null
            ? this.mapChoice
            : setup.map ?? DEFAULT_MAP;
        if (this.terrain.profile.id !== mapId) {
            this.terrain = new TacticalTerrain(mapId);
        }

        this.deck = new DeckManager(this.pacedThreat(setup.threat, seedOverride));
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

        this.callouts.clear();
        this.visibility.reset();
        this.samMissileActive.clear();
        this.lastCautionDamage = 0;
        this.sortieKills = 0;
        this.trauma = 0;
        this.flashAlpha = 0;
        this.hitMarker = 0;
        this.trapCinematic = 0;
        this.trapGrade = null;

        this.deck.log(`SCENARIO: ${scenario.name.toUpperCase()} - ${scenario.tagline}`);

        if (setup.startAirborne) {
            this.hotStartAirborne();
            this.hasLaunched = true;
        } else {
            this.currentView = 'MACRO_DECK';
        }
    }

    /**
     * Fold the active pacing into a scenario's threat profile: crew timings,
     * and the ETAs of whatever opening timeline the scenario supplies (its own,
     * or the deck's default three packages).
     */
    private pacedThreat(threat: ThreatProfile, seedOverride?: number): ThreatProfile {
        const paced: ThreatProfile = {
            ...threat,
            timing: deckTiming(this.pacing),
            // The threat level moves the scenario along the escalation curve
            // that wave generation already implements, rather than adding a
            // second set of difficulty numbers to keep in sync with it.
            startWave: startWaveFor(threat.startWave ?? 0, this.threatLevel)
        };
        if (seedOverride !== undefined) paced.seed = seedOverride;
        const opening = threat.openingTimeline ?? DeckManager.defaultOpeningTimeline();
        paced.openingTimeline = opening.map(p => ({
            ...p,
            etaSeconds: scaleOpeningEta(p.etaSeconds, this.pacing)
        }));
        return paced;
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
        const blast = blastTrauma(this.rangeTo(target.position), 1200);
        if (destroyed) {
            this.score.recordKill('STRUCTURE');
            this.deck.log(`DIRECT HIT: ${target.name} DESTROYED.`);
            soundFX.playExplosion(this.placeAt(target.position));
            soundFX.playKillConfirm();
            this.callouts.push('TARGET DESTROYED', 'KILL', target.name);
            this.shake(Math.max(blast, 0.35));
            this.flash(THEME.caution, 0.3);
        } else {
            this.deck.log(`HIT ON ${target.name} - ${target.hits}/${target.hitsRequired} REQUIRED.`);
            this.callouts.push('DIRECT HIT', 'KILL', `${target.hits}/${target.hitsRequired} REQUIRED`);
            this.shake(Math.max(blast, 0.2));
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
            // Under ARCADE the whole fight is fought closer in: a contact
            // eight kilometres out is thirty-five seconds of holding a
            // heading, which is not a gameplay beat.
            const spawnZ = (6500 + Math.min(6000, pkg.etaSeconds * 12))
                * pacingSpec(this.pacing).spawnDistanceScale;
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
        this.callouts.push('AIRFRAME LOST', 'LOSS');
        this.shake(SHAKE_SOURCES.damageTaken);
        this.flash(THEME.alert, 0.75);
        this.sortieKills = 0;
        this.deck.inventory.spareAirframes = Math.max(0, this.deck.inventory.spareAirframes - 1);
        this.deck.log(reason);
        this.physics.repair();
        this.physics.velocity = { x: 0, y: 0, z: 0 };
        this.physics.throttle = 0;

        // The cost of losing a jet is the airframe and the score. Under
        // ARCADE it is not also half a minute of watching a progress bar -
        // that punishes the mistake twice, and the second punishment lands on
        // the only thing the player came here to do.
        const respawn = pacingSpec(this.pacing).respawnSeconds;
        if (respawn > 0 && this.deck.inventory.spareAirframes > 0) {
            this.deck.scrambleSpareAirframe(respawn);
        } else {
            this.deck.aircraftState = 'HANGAR_MAINTENANCE';
            this.deck.currentTaskProgress = 0;
        }
        this.currentView = 'MACRO_DECK';
    }

    // -----------------------------------------------------------------
    // Frame lifecycle
    // -----------------------------------------------------------------

    /**
     * Re-resolve the control scheme and the thumb layout. Called from resize,
     * so an orientation change or a window drag is enough to pick it up.
     */
    public applyControlScheme(insets: SafeArea = this.safeArea) {
        this.safeArea = insets;
        const signals = readPlatformSignals();
        const previous = this.controlScheme;
        this.controlScheme = resolveScheme(this.schemePreference, {
            ...signals,
            width: this.viewWidth,
            height: this.viewHeight
        });
        this.touchLayout = solveTouchLayout(this.viewWidth, this.viewHeight, insets);
        // Re-read on resize: a preference can change mid-session.
        this.motion = motionSettings(readMotionPreferences());

        if (this.controlScheme === 'TOUCH' && previous !== 'TOUCH') this.applyTouchDefaults();
    }

    /**
     * What a phone should start with, unless the player has already said
     * otherwise: the jet flying itself, and the cheapest screen mode. Neither
     * overrides a stored choice - somebody who set MANUAL on a desktop and
     * then opened the game on their phone meant it.
     */
    private applyTouchDefaults() {
        if (storedAssistLevel() === null) this.assistLevel = 'AUTO';
        // On a phone the trap is the one thing the thumb controls cannot
        // really do: a virtual stick, a lens the size of a fingernail and no
        // altimeter that is not under a thumb. The recovery assist flies the
        // approach and still hands the landing back at short final, so a
        // handset player gets to finish a sortie rather than ditching.
        if (storedApproachAssist() === null) this.approachAssist = true;
        if (storedDisplayMode() === null) {
            this.displayMode = 'CLEAN';
            this.applyDisplayMode();
        }
    }

    /** Cycle AUTO -> TOUCH -> KEYBOARD, for players detection got wrong. */
    public cycleControlScheme() {
        soundFX.playUiMove();
        this.schemePreference = nextSchemePreference(this.schemePreference);
        saveSchemePreference(this.schemePreference);
        this.applyControlScheme();
        this.deck.log(`CONTROLS: ${this.schemePreference} (${this.controlScheme}).`);
    }

    /** True while the cockpit is unusable because the device is upright. */
    public get awaitingRotation(): boolean {
        return needsRotation(this.controlScheme, this.viewWidth, this.viewHeight);
    }

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
        this.applyControlScheme();
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
            // Touch is folded in once per FRAME, not per fixed step: it is an
            // input device, and sampling it several times inside one frame
            // would just repeat the same pointer positions.
            this.updateTouch();

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

        // A thumb gives an analog demand; a key gives ±1. Both arrive here as
        // the same PilotInput, so the assist laws and the flight model below
        // never learn which one the player used.
        const pilot = {
            pitch: this.analog
                ? this.analog.pitch
                : (k['w'] || k['arrowup'] ? 1 : 0) + (k['s'] || k['arrowdown'] ? -1 : 0),
            roll: this.analog
                ? this.analog.roll
                : (k['d'] || k['arrowright'] ? 1 : 0) + (k['a'] || k['arrowleft'] ? -1 : 0),
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

        // A thumb on the throttle track has already set the power for this
        // frame; the autopilot's speed hold does not get to argue with it.
        if (demand.throttle !== 0 && !this.touchThrottleHeld) {
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
            const before = this.weapons.bullets.length;
            this.weapons.fireGun(this.physics);
            if (this.weapons.bullets.length > before) this.shake(SHAKE_SOURCES.gun);
            this.training.progress.gunFired = true;
        }
    }

    /**
     * SAM launches, as an audible event at the launcher rather than a generic
     * warble in your head. Detected as the missileActive edge, because the
     * sensor manager owns the launch decision and does not announce it.
     */
    private reportSamLaunches() {
        for (const sam of this.sensors.samSites) {
            const wasActive = this.samMissileActive.get(sam.id) === true;
            if (sam.missileActive && !wasActive) {
                soundFX.playDistantLaunch(this.placeAt(sam.position));
                this.callouts.push('SAM LAUNCH', 'LOSS', sam.name);
            }
            this.samMissileActive.set(sam.id, sam.missileActive);
        }
    }

    /** Where a world sound happened, for panning and attenuation. */
    private placeAt(source: Vector3): SoundPlacement {
        return {
            listener: this.physics.position,
            listenerYaw: this.physics.yaw,
            source
        };
    }

    /** Slant range from the aircraft to a world point. */
    private rangeTo(p: Vector3): number {
        return Math.hypot(
            p.x - this.physics.position.x,
            p.y - this.physics.position.y,
            p.z - this.physics.position.z
        );
    }

    /**
     * Fold the current touch state into the game: the stick becomes an analog
     * demand, the throttle track sets power directly, and every press that
     * has happened since the last frame is dispatched.
     */
    private updateTouch() {
        if (this.controlScheme !== 'TOUCH') {
            this.analog = null;
            return;
        }

        const airborne = this.deck.aircraftState === 'AIRBORNE' && this.currentView === 'MICRO_FLIGHT';
        const demand = this.touch.demand(this.touchLayout);

        this.analog = airborne && demand.stickOrigin
            ? { pitch: demand.pitch, roll: demand.roll }
            : null;

        this.touchThrottleHeld = airborne && demand.throttle !== null;
        if (airborne && demand.throttle !== null) {
            this.physics.throttle = Math.min(1.5, Math.max(0, demand.throttle));
            this.training.progress.throttleChanged = true;
        }

        // The cannon is a held trigger; everything else is edge-triggered, so
        // the same button can fire a burst or release a single bomb.
        this.inputState[' '] = demand.firing && this.selectedWeapon === 'GUN';

        for (const tap of this.touch.consumeTaps()) {
            this.handleTouchTap(tap.control, tap.x, tap.y);
        }
    }

    private handleTouchTap(control: TouchControlId, x: number, y: number) {
        switch (control) {
            case 'FIRE':
                if (this.selectedWeapon !== 'GUN') this.fireSelectedWeapon();
                return;
            case 'TARGET':
                this.cycleDesignation(1);
                return;
            case 'WEAPON_GUN':
                this.selectedWeapon = 'GUN';
                soundFX.playUiMove();
                return;
            case 'WEAPON_MISSILE':
                this.selectedWeapon = 'AIM9';
                soundFX.playUiMove();
                return;
            case 'WEAPON_BOMB':
                this.selectedWeapon = 'BOMB';
                soundFX.playUiMove();
                return;
            case 'MENU':
                this.helpVisible = !this.helpVisible;
                soundFX.playUiMove();
                return;
            case 'RECOVER':
                this.toggleApproachAssist();
                soundFX.playUiMove();
                return;
            case 'LAUNCH':
                this.requestCatapultLaunch();
                return;
            case 'WORLD':
                this.designateAtPoint(x, y);
                return;
            default:
                // STICK and THROTTLE are continuous, handled in updateTouch().
        }
    }

    /**
     * Designate whatever the player pointed at.
     *
     * Pointing at a thing is the natural way to choose it on a touchscreen;
     * cycling a list with a button is a keyboard idiom wearing a thumb's
     * clothing. The cycle button still exists for anything off the glass.
     */
    public designateAtPoint(x: number, y: number): boolean {
        if (this.deck.aircraftState !== 'AIRBORNE') return false;
        this.refreshDesignation();

        const screen: ScreenTarget[] = [];
        for (const solution of this.tracker.solutions) {
            const camPt = this.renderer.transformToCamera(
                solution.target.position,
                this.physics.position, this.physics.pitch, this.physics.yaw, this.physics.roll
            );
            if (camPt.z < 2) continue;
            const proj = this.renderer.projectCameraPoint(camPt);
            screen.push({ id: solution.target.id, x: proj.x, y: proj.y });
        }

        const id = pickTargetAt(x, y, screen);
        if (!id) return false;

        const chosen = this.tracker.designateById(id);
        if (chosen) {
            soundFX.playLockTone();
            this.deck.log(`DESIGNATED ${chosen.target.name} - ${(chosen.range / 1000).toFixed(1)} KM.`);
        }
        return chosen !== null;
    }

    /** A tap on a menu screen, in CSS pixels. Returns true if it was used. */
    public handleMenuTap(x: number, y: number): boolean {
        if (this.phase === 'BRIEFING') {
            const areas = briefingHitAreas(this.viewWidth, this.viewHeight, SCENARIOS.length, true);
            if (areas.daily && inside(areas.daily, x, y)) {
                this.startDailySortie();
                return true;
            }
            for (let i = 0; i < areas.pills.length; i++) {
                if (inside(areas.pills[i], x, y)) {
                    this.selectScenarioByIndex(i);
                    return true;
                }
            }
            this.confirmBriefing();
            return true;
        }

        if (this.phase === 'DEBRIEF') {
            this.restartFromDebrief();
            return true;
        }
        return false;
    }

    /** Register a shake event. Presentation only - see the field comment. */
    public shake(amount: number) {
        this.trauma = addTrauma(this.trauma, amount * this.motion.shakeScale);
    }

    /** Full-screen flash, used sparingly: damage taken and kills. */
    private flash(color: string, alpha: number) {
        this.flashColor = color;
        this.flashAlpha = Math.max(this.flashAlpha, alpha * this.motion.flashScale);
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
        const recovery = this.recoveryNav();
        if (recovery) return recovery;

        const designated = this.tracker.designated();
        if (designated) {
            const p = designated.target.position;
            const nav = pursuitNav(designated, this.terrain.getElevation(p.x, p.z));
            return this.applyTerrainFollowing(nav, designated.target.kind === 'AIR');
        }

        return this.applyTerrainFollowing({
            bearing: this.physics.yaw,
            altitudeAgl: 900,
            airSpeed: 240,
            maxBank: 0.6
        }, false);
    }

    /**
     * Rewrite the autopilot's altitude to hug the terrain.
     *
     * The rule differs by what is being flown, and the difference is the
     * point of the feature rather than a special case:
     *
     *  - Going after something on the ground, or holding a heading with
     *    nothing designated, the follower REPLACES the commanded altitude.
     *    Cruising the fjord at 520 m to bomb a pen is how the autopilot used
     *    to get you locked.
     *  - Intercepting an aeroplane, it is only a FLOOR. You have to go where
     *    the bandit is, and it is not obliged to be low - but a co-altitude
     *    intercept must still not fly the jet into the ridge in between.
     *
     * `terrainFollowing` is also ignored on an approach, where the deck is
     * twenty metres above the water and a two-hundred-metre floor would
     * simply be a go-around.
     */
    private applyTerrainFollowing(nav: NavTarget, isIntercept: boolean): NavTarget {
        this.terrainFollowClimbing = false;
        if (!this.terrainFollowing || HUD.isOnApproach(this.physics)) return nav;

        const p = this.physics.position;
        const samples = sampleGroundTrack(
            p,
            this.physics.yaw,
            this.physics.airSpeed,
            (x, z) => this.terrain.getElevation(x, z)
        );
        const followed = terrainFollowingAltitude(
            samples,
            this.terrain.getElevation(p.x, p.z),
            this.physics.airSpeed
        );
        this.terrainFollowClimbing = followed.climbing;

        return {
            ...nav,
            altitudeAgl: isIntercept
                ? Math.max(nav.altitudeAgl, followed.altitudeAgl)
                : followed.altitudeAgl
        };
    }

    /**
     * The recovery assist's nav target, or null when it is not flying.
     *
     * It outranks a designation: asking to be taken home is unambiguous, and
     * a pilot who wants to go back to fighting turns it off. It stops of its
     * own accord at short final - `HANDOVER` returns null, so the ordinary
     * assists have the aeroplane again with the deck in the windscreen.
     */
    private recoveryNav(): NavTarget | null {
        this.approachPhase = null;
        if (!this.approachAssist) return null;
        if (this.assistLevel !== 'AUTO') return null;
        if (this.deck.aircraftState !== 'AIRBORNE') return null;

        const guidance = approachGuidance(this.physics.position, {
            bank: this.physics.roll,
            lateralSpeed: this.physics.velocity.x
        });
        this.approachPhase = guidance.phase;
        // The assist flies the APPROACH, not the transit and not the landing.
        // JOIN is a cue, not a hand-over: see `ApproachGuidance`.
        if (guidance.phase !== 'FINAL') return null;

        // The recovery owns the altitude; the terrain follower's 200 m floor
        // would be a permanent go-around over a deck twenty metres up.
        this.terrainFollowClimbing = false;

        // Boards out. The only drag device this airframe has is the weapons
        // bay, and without it an idle descent on the glideslope stabilises
        // far too fast for the wires - see APPROACH_TUNING.boardsOutAbove.
        this.physics.bayOpen =
            this.physics.airSpeed > APPROACH_TUNING.approachSpeed + APPROACH_TUNING.boardsOutAbove;

        const p = this.physics.position;
        const ground = this.terrain.getElevation(p.x, p.z);
        // The guidance works in altitude above the water; the autopilot flies
        // above the ground below, which over the sea is the same datum and
        // near a coast is not.
        const altitudeAgl = Math.max(0, guidance.altitudeMsl - ground);

        return {
            /**
             * The CURRENT heading, deliberately - not the guidance's course.
             *
             * The assist holds the ball and the speed; lineup is the player's,
             * and an autopilot quietly steering underneath them would fight
             * every correction they made. With no heading error the autopilot
             * levels the wings when the stick is centred and gets out of the
             * way the moment it is not, which is exactly the division of
             * labour this is meant to be.
             */
            bearing: this.physics.yaw,
            altitudeAgl,
            airSpeed: guidance.airSpeed,
            maxBank: guidance.maxBank,
            overridesApproach: true
        };
    }

    /** Cycle the threat level, and remember the choice. */
    public cycleThreatLevel(): ThreatLevelId {
        this.threatLevel = nextThreatLevel(this.threatLevel);
        saveThreatLevel(this.threatLevel);
        soundFX.playUiMove();
        return this.threatLevel;
    }

    /** Cycle the colour palette, and remember the choice. */
    public cyclePalette(): PaletteId {
        this.palette = nextPalette(this.palette);
        applyPalette(this.palette);
        savePalette(this.palette);
        this.callouts.push(`PALETTE — ${paletteSpec(this.palette).label}`, 'MODE');
        soundFX.playUiMove();
        return this.palette;
    }

    /** Toggle the recovery assist, and remember the choice. */
    public toggleApproachAssist(): boolean {
        this.approachAssist = !this.approachAssist;
        saveApproachAssist(this.approachAssist);
        if (this.approachAssist && this.assistLevel !== 'AUTO') {
            // Asking to be taken home and not being taken home is the kind of
            // dead key a player never presses twice.
            this.assistLevel = 'AUTO';
            saveAssistLevel(this.assistLevel);
        }
        this.callouts.push(
            this.approachAssist ? 'RECOVERY — TAKING YOU HOME' : 'RECOVERY — OFF',
            'MODE'
        );
        return this.approachAssist;
    }

    /** Toggle terrain following, and remember the choice. */
    public toggleTerrainFollowing(): boolean {
        this.terrainFollowing = !this.terrainFollowing;
        saveTerrainFollowing(this.terrainFollowing);
        this.callouts.push(
            this.terrainFollowing ? 'TERRAIN FOLLOW — ON' : 'TERRAIN FOLLOW — OFF',
            'MODE'
        );
        return this.terrainFollowing;
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

        // A launcher that is painting you has told you exactly where it is,
        // whether or not you can see it.
        for (const threat of this.sensors.activeThreats) {
            if (!threat.isTerrainMasked) this.visibility.markDiscovered(threat.id);
        }

        this.visibility.update(
            this.elapsedSeconds,
            candidates,
            (position) => this.sensors.checkLOS(this.physics.position, position)
        );

        this.tracker.refresh(
            { position: this.physics.position, forward: this.physics.forwardVector },
            candidates.filter(c => this.visibility.isVisible(c.id))
        );
    }

    // -----------------------------------------------------------------
    // Player commands: assist level, designation, weapon release
    // -----------------------------------------------------------------

    /**
     * Fly today's daily sortie: the endless carrier defence, seeded from the
     * date so every player in the world gets the identical campaign, at ARCADE
     * pacing so the comparison is like for like whatever they have set.
     */
    public startDailySortie(now: Date = new Date()) {
        this.selectScenarioById('CARRIER_DEFENSE');
        this.isDailyRun = true;
        this.dailyRunDate = dailyKey(now);
        this.dailyCard = null;
        this.dailyCopied = false;
        this.pacing = 'ARCADE';
        // ...and at the standard threat level, for the same reason: the daily
        // is only worth sharing if everybody flew the same fight.
        this.threatLevel = 'REGULAR';
        this.phase = 'BRIEFING';
        this.confirmBriefing(dailySeed(now));
    }

    /** Today's stored result, if it has been flown. */
    public todaysDaily(now: Date = new Date()): DailyResult | null {
        return this.dailyResults[dailyKey(now)] ?? null;
    }

    public dailyNumberToday(now: Date = new Date()): number {
        return dailyNumber(now);
    }

    /**
     * Copy the card. Called from a keydown so the browser's gesture
     * requirement is satisfied; failure is not an error worth stopping for,
     * because the card is on screen either way.
     */
    public copyDailyCard(): boolean {
        if (!this.dailyCard) return false;
        try {
            void globalThis.navigator?.clipboard?.writeText(this.dailyCard);
            this.dailyCopied = true;
            return true;
        } catch {
            return false;
        }
    }

    /** Fold a finished daily run into the stored record and build its card. */
    private recordDailyRun() {
        const b = this.score.breakdown;
        const merged = mergeDailyResult(this.dailyResults, {
            date: this.dailyRunDate ?? dailyKey(),
            score: this.score.totalScore,
            rank: this.score.rank,
            wave: this.deck.waveNumber,
            fighterKills: b.fighterKills,
            bomberKills: b.bomberKills,
            samKills: b.samKills,
            traps: b.traps,
            perfectTraps: b.perfectTraps,
            hullRemaining: this.deck.inventory.carrierHealth,
            completed: this.missionOutcome === 'SUCCESS'
        });

        this.dailyResults = merged.results;
        saveDailyResults(this.dailyResults);
        this.dailyCard = formatShareCard(merged.today);
    }

    /**
     * Cycle ARCADE <-> SIM. Takes effect on the next run rather than mid-flight,
     * because re-timing a deck cycle that is already half finished would show
     * up as a progress bar jumping backwards.
     */
    public cyclePacing() {
        soundFX.playUiMove();
        this.pacing = nextPacing(this.pacing);
        savePacing(this.pacing);
        const spec = pacingSpec(this.pacing);
        this.deck.log(`OPS TEMPO: ${spec.label} - ${spec.blurb}.`);
        if (this.phase === 'BRIEFING') return;
        this.deck.log('TAKES EFFECT ON THE NEXT SORTIE.');
    }

    /** Cycle MANUAL -> ASSIST -> AUTOPILOT, and say so in the log. */
    public cycleAssistLevel() {
        soundFX.playUiMove();
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
            soundFX.playLockTone();
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
            const before = this.weapons.missiles.length;
            this.weapons.fireSidewinder(
                this.physics,
                this.airborneTargets,
                designated?.target.kind === 'AIR' ? designated.target.id : null,
                (target) => this.visibility.isVisible(target.id)
            );
            if (this.weapons.missiles.length > before) this.shake(SHAKE_SOURCES.missileLaunch);
        } else if (this.selectedWeapon === 'BOMB') {
            const before = this.weapons.bombs.length;
            this.weapons.dropBomb(this.physics);
            if (this.weapons.bombs.length > before) this.shake(SHAKE_SOURCES.bombRelease);
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

        if (wasLaunching) {
            // A stroke that puts 11 tonnes at 160 m/s in two and a half
            // seconds should be felt, not read off a progress bar.
            this.shake(SHAKE_SOURCES.catapultStroke * 0.04);
        }

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
            soundFX.updateAmbience({
                airSpeed: 0, alpha: 0, isStalled: false, isAirborne: false, rwrState: 'SILENT'
            });
        }

        // Presentation decays on the same fixed clock as everything else, so
        // shake and callouts do not run at different speeds on different
        // monitors.
        this.trauma = decayTrauma(this.trauma, dt);
        this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.6);
        this.hitMarker = Math.max(0, this.hitMarker - dt);
        this.callouts.update(dt);
        if (this.trapCinematic > 0) {
            this.trapCinematic = Math.max(0, this.trapCinematic - dt);
            // The deck state machine already owns the aircraft; this is purely
            // how long the camera stays with it.
            if (this.trapCinematic === 0) {
                this.trapGrade = null;
                this.currentView = 'MACRO_DECK';
            }
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
        this.reportSamLaunches();
        soundFX.updateAmbience({
            airSpeed: this.physics.airSpeed,
            alpha: this.physics.alpha,
            isStalled: this.physics.isStalled,
            isAirborne: true,
            rwrState: this.sensors.masterRwrState
        });

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
            soundFX.playExplosion(this.placeAt(impact.position));
            soundFX.playMasterCaution();
            this.shake(SHAKE_SOURCES.damageTaken);
            this.flash(THEME.alert, 0.5);
            this.callouts.push('HIT', 'LOSS', `${Math.round(impact.damage)}% AIRFRAME DAMAGE`);
        }

        // Enemy aircraft behaviour (also integrates their positions)
        updateEnemyAI(dt, this.airborneTargets, this.physics, (enemy) => {
            // Simplified hit-scan cannon burst: the alignment/range gate in
            // EnemyAI has already established a valid guns solution.
            const dmg = 4 + Math.random() * 6;
            this.physics.applyDamage(dmg);
            this.deck.log(`TAKING CANNON FIRE FROM ${enemy.name}!`);
            soundFX.playIncomingFire(this.placeAt(enemy.position));
            this.shake(SHAKE_SOURCES.damageTaken * 0.5);
            this.flash(THEME.alert, 0.28);
        });

        // Player weapons
        this.weapons.update(dt, {
            terrain: this.terrain,
            targets: this.airborneTargets,
            samSites: this.sensors.samSites,
            strikeTargets: this.strikeTargets,
            onTargetDestroyed: (destroyedTarget) => this.onTargetDestroyed(destroyedTarget),
            onTargetHit: () => {
                // Every round that connects says so. Without this the gun has
                // only two states - nothing and an explosion - and the player
                // cannot tell a near miss from a hit at 1.5 km.
                this.hitMarker = 0.18;
                soundFX.playHitTick();
            },
            onSAMDestroyed: (destroyedSAM) => {
                this.score.recordKill('SAM');
                this.deck.log(`RADAR STRIKE: ${destroyedSAM.name} NEUTRALIZED.`);
                this.callouts.push('SAM DOWN', 'KILL', destroyedSAM.name);
                this.shake(SHAKE_SOURCES.killConfirmed + blastTrauma(this.rangeTo(destroyedSAM.position), 900));
                soundFX.playExplosion(this.placeAt(destroyedSAM.position));
                soundFX.playKillConfirm();
            },
            onStrikeTargetHit: (target, destroyed) => this.onStrikeTargetHit(target, destroyed)
        });

        // Master caution at each 25% of airframe damage: a panel sound for a
        // panel problem, distinct from the RWR, which means look outside.
        const damageStep = Math.floor(this.physics.damage / 25);
        if (damageStep > Math.floor(this.lastCautionDamage / 25)) soundFX.playMasterCaution();
        this.lastCautionDamage = this.physics.damage;

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

                // Hold the cockpit for a beat and let the wire do its work.
                // Cutting instantly to the deck screen threw away the payoff
                // for the hardest thing in the game.
                this.trapCinematic = TRAP_CINEMATIC_SECONDS;
                this.trapGrade = grade === 'BOLTER' ? 'BOLTER' : `${grade}-WIRE`;
                if (grade === 'BOLTER') {
                    this.callouts.push('BOLTER', 'LOSS', 'MISSED THE WIRES');
                } else {
                    this.callouts.push(`${grade}-WIRE`, 'PRAISE',
                        grade === 3 ? 'PERFECT TRAP' : 'TRAPPED ABOARD');
                    this.shake(SHAKE_SOURCES.wireCatch);
                    soundFX.playWireCatch();
                }
            }
        }
    }

    private onTargetDestroyed(destroyedTarget: AirborneTarget) {
        this.deck.log(`COMBAT REPORT: ${destroyedTarget.name} DESTROYED.`);
        this.score.recordKill(isBomber(destroyedTarget) ? 'BOMBER' : 'FIGHTER');

        this.sortieKills++;
        this.callouts.push(splashLine(this.sortieKills), 'KILL', destroyedTarget.name);
        // A kill at knife-fighting range should rattle the canopy; one at
        // five kilometres is a flash on the horizon.
        this.shake(SHAKE_SOURCES.killConfirmed + blastTrauma(this.rangeTo(destroyedTarget.position), 900));
        this.flash(THEME.phosphor, 0.12);
        soundFX.playKillConfirm();

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

        const merged = mergeMissionResult(
            this.missionRecords, this.scenario.id, this.score.totalScore, outcome === 'SUCCESS'
        );
        this.missionRecords = merged.records;
        this.isMissionBest = merged.isNewBest;
        saveMissionRecords(this.missionRecords);
        if (this.isDailyRun) this.recordDailyRun();

        this.deck.log(outcome === 'SUCCESS' ? 'MISSION COMPLETE.' : 'MISSION FAILED.');
        soundFX.playDebriefSting(outcome === 'SUCCESS');
        this.phase = 'DEBRIEF';
    }

    /**
     * The mission the debrief points at. Deliberately silent when it would
     * just repeat the mission that has only this second ended - "fly the thing
     * you are looking at" is not guidance.
     */
    private nextUpLabel(): string | null {
        const next = recommendScenario(this.missionRecords);
        if (next.id === this.scenario.id) return null;
        return `${next.name} — ${next.tagline}`;
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
            this.briefing.drawBriefing(
                this.ctx, w, h, this.elapsedSeconds, this.scenario, this.bestScore, this.missionRecords,
                `${pacingSpec(this.pacing).label} pacing`,
                `${threatLevelSpec(this.threatLevel).label} threat`,
                { number: this.dailyNumberToday(), result: this.todaysDaily() },
                this.controlScheme === 'TOUCH',
                {
                    id: this.selectedMap(),
                    changeable: this.scenario.setup.allowMapChoice === true
                }
            );
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
                    title: this.scenario.victoryTitle,
                    missionBest: recordFor(this.missionRecords, this.scenario.id).best,
                    isMissionBest: this.isMissionBest,
                    nextUp: this.nextUpLabel() ?? undefined,
                    shareCard: this.dailyCard,
                    copied: this.dailyCopied
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
                    displayModeLabel: this.displayModeLabel,
                    touchMode: this.controlScheme === 'TOUCH',
                    touchReserveBottom: this.controlScheme === 'TOUCH'
                        ? Math.max(56, this.viewHeight - this.touchLayout.launch.y + 10)
                        : undefined,
                    touchReserveTopRight: this.controlScheme === 'TOUCH'
                        ? this.viewWidth - this.touchLayout.menu.x + 10
                        : undefined
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

        if (this.controlScheme === 'TOUCH' && this.phase === 'ACTIVE' && !this.helpVisible) {
            this.drawTouchChrome();
        }

        this.drawImpactFlash(w, h);

        // Last of all: a cockpit at phone-portrait width cannot hold its
        // instruments, so the game asks for the device rather than shipping
        // something unreadable.
        if (this.awaitingRotation) {
            drawRotatePrompt(this.ctx, w, h, this.elapsedSeconds);
        }
    }

    /**
     * The edges the thumb controls claim, handed to the instrument solver so
     * it places the airspeed block, the RWR and the systems line inside what
     * is left rather than underneath a button.
     */
    private hudReserve() {
        const l = this.touchLayout;
        return {
            left: Math.max(0, l.stickZone.x + l.stickZone.w - l.safe.x),
            right: Math.max(0, l.safe.x + l.safe.w - (l.weapons[0]?.x ?? l.fire.cx - l.fire.r)),
            bottom: Math.max(0, l.safe.y + l.safe.h - Math.min(l.stickZone.y, l.target.cy - l.target.r)),
            top: 0
        };
    }

    private drawTouchChrome() {
        if (this.currentView === 'MACRO_DECK') {
            const ready = this.deck.aircraftState === 'CATAPULT_READY';
            drawLaunchButton(
                this.ctx,
                this.touchLayout,
                ready,
                ready ? 'LAUNCH' : this.deck.aircraftState.replace(/_/g, ' '),
                0.5 + 0.5 * Math.sin(this.elapsedSeconds * 3.2)
            );
            return;
        }

        const loadout = this.physics.loadout;
        drawTouchControls(this.ctx, this.touchLayout, {
            demand: this.touch.demand(this.touchLayout),
            selectedWeapon: this.selectedWeapon,
            ammo: [loadout.vulcanAmmo, loadout.sidewinders, loadout.ironBombs],
            throttle: this.physics.throttle,
            hasDesignation: this.tracker.designatedId !== null,
            fireArmed: this.deck.aircraftState === 'AIRBORNE',
            recoveryOn: this.approachAssist
        });
    }

    /**
     * A single translucent wash over the whole screen: red when something hits
     * you, green when you kill something. Drawn over the HUD deliberately -
     * this is the one cue that has to land even if the player is reading an
     * instrument.
     */
    private drawImpactFlash(w: number, h: number) {
        if (this.flashAlpha <= 0.002) return;
        this.ctx.save();
        this.ctx.globalAlpha = Math.min(0.75, this.flashAlpha);
        this.ctx.fillStyle = this.flashColor;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();
    }

    private drawCockpitSim(frameDt: number) {
        // The shake is added HERE and nowhere else: the camera sees it, the
        // flight model never does.
        const jolt = shakeOffsets(this.trauma, this.elapsedSeconds);
        const camPos = this.physics.position;
        const camPitch = this.physics.pitch + jolt.pitch;
        const camYaw = this.physics.yaw + jolt.yaw;
        const camRoll = this.physics.roll + jolt.roll;

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
                assistOverride: this.assistOverride,
                callouts: this.callouts.active(),
                hitMarker: this.hitMarker,
                trapStamp: this.trapGrade,
                touchMode: this.controlScheme === 'TOUCH',
                touchReserve: this.controlScheme === 'TOUCH' ? this.hudReserve() : undefined,
                motion: this.motion,
                visibleContacts: this.visibility,
                terrainFollowing: this.terrainFollowing && this.assistLevel === 'AUTO',
                recovery: this.approachPhase === null ? null : {
                    text: approachCaption(approachGuidance(this.physics.position)),
                    handover: this.approachPhase === 'HANDOVER'
                }
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

    public confirmBriefing(seedOverride?: number) {
        if (this.phase !== 'BRIEFING') return;
        soundFX.playUiSelect();
        // Build the world fresh from whatever the selector landed on.
        this.applyScenario(this.scenario, seedOverride);
        this.missionOutcome = 'ACTIVE';
        this.missionReason = null;
        this.phase = 'ACTIVE';
        this.post.hardClear();
    }

    public restartFromDebrief() {
        this.isNewBest = false;
        this.isMissionBest = false;
        this.isDailyRun = false;
        this.dailyCopied = false;
        this.dailyRunDate = null;
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
        soundFX.playUiMove();
        this.displayMode = nextDisplayMode(this.displayMode);
        this.applyDisplayMode();
        this.post.hardClear();
        const spec = displayModeSpec(this.displayMode);
        saveDisplayMode(this.displayMode);
        this.deck.log(`DISPLAY: ${spec.label} - ${spec.description}`);
    }
}
