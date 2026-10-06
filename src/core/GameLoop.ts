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
import { SAM_MISSILE } from '../tactics/MissileGuidance';
import { DeckManager } from '../carrier/DeckManager';
import type { InboundStrikePackage, ThreatProfile } from '../carrier/DeckManager';
import { WeaponsSystem } from '../flight/Weapons';
import { createCountermeasureState, tickCountermeasures, dispense, decoyExpiry } from '../flight/Countermeasures';
import type { CountermeasureState } from '../flight/Countermeasures';
import { VectorDebrisSystem } from '../renderer/VectorDebris';
import { CockpitVoiceSystem } from '../audio/CockpitVoiceSystem';
import { PadlockCamera } from '../renderer/PadlockCamera';
import { TimeRewindBuffer } from './TimeRewind';
import { soundFX } from '../audio/SoundFX';
import type { SoundPlacement } from '../audio/SoundFX';
import { FixedTimestepAccumulator, FIXED_DT } from './Timestep';
import { ScoreKeeper, SCORE_VALUES } from './ScoreKeeper';
import { ComboTracker, multiplierFor } from './Combo';
import { SCRAMBLE, SCRAMBLE_LOADOUT, fighterAccuracy, keepClearOfBoat, rearmAfterWave, scrambleWave, spawnReference, waveClearBonus } from './Scramble';
import { KillFxSystem, drawKillFx } from '../renderer/KillFx';
import { SpeedStreaks } from '../renderer/SpeedStreaks';
import { scrambleIntensity } from '../audio/MusicPattern';
import { challengeLine, challengeUrl, challengeVerdict, challengerLabel } from './Challenge';
import { shareContent, shareNudge } from './ShareCard';
import type { ShareContent, ShareRun } from './ShareCard';
import { loadPilotName, savePilotName } from './PilotName';
import { SHARE_IMAGE_SIZE, drawShareImage } from '../renderer/ShareImage';
import type { Moment } from '../renderer/ShareImage';
import { challengeWelcomeHitTest, challengeWelcomeLayout, drawChallengeWelcome } from '../renderer/ChallengeView';
import { EASY_TUNING, easyHint, easyTrigger, loadFlyStyle, saveFlyStyle, shouldAskFlyStyle } from './EasyMode';
import type { FlyStyle } from './EasyMode';
import type { Challenge } from './Challenge';
import { MEDALS, earnedMask, loadMedals, mergeMedals, saveMedals, starCount, totalStars } from './Medals';
import type { MedalRecords, RunSummary } from './Medals';
import { awardRun, careerLevel, isPaletteUnlocked, loadCareer, newlyUnlocked, nextUnlock, saveCareer } from './Career';
import type { Career, XpAward } from './Career';
import { debriefLayout, drawDebriefView } from '../renderer/DebriefView';
import type { DebriefData } from '../renderer/DebriefView';
import { drawFlyStyleChooser, flyStyleHitTest, flyStyleLayout } from '../renderer/FlyStyleView';
import { arbitrateHint, getContextualHint, TrainingSequence } from './Tutorial';
import { HUD_DENSITY_LABEL, resolveHudDensity, saveHudDensity } from './HudDensity';
import { pilotMenuItems, plainInstruction, wrapMenuIndex, type PilotMenuItem } from './PilotMenu';
import { PitchStruggleDetector } from './StruggleDetector';
import type { HudDensity } from './HudDensity';
import type { LossCause } from './PostMortem';
import { formatLossCause } from './PostMortem';
import { Milestones } from './Milestones';
import type { Hint } from './Tutorial';
import { updateEnemyAI, isBomber } from '../tactics/EnemyAI';
import { PostProcess } from '../renderer/PostProcess';
import type { PostQuality } from '../renderer/PostProcess';
import { DeckView, DESKTOP_MENU_BUTTON_RESERVE } from '../renderer/DeckView';
import { drawPilotMenu, pilotMenuHitTest, pilotMenuLayout } from '../renderer/PilotMenuView';
import { BriefingScreen } from '../renderer/BriefingScreen';
import {
    THEME,
    WORLD,
    applyPalette,
    loadPalette,
    nextAvailablePalette,
    loadTextSize,
    nextTextSize,
    saveTextSize,
    textSizeSpec,
    textScaling,
    paletteSpec,
    savePalette,
    storedPalette
} from '../renderer/Theme';
import type { PaletteId, TextSizeId } from '../renderer/Theme';
import {
    applyDisplayModeToDocument,
    displayModeSpec,
    loadDisplayMode,
} from '../renderer/DisplayMode';
import type { DisplayModeId } from '../renderer/DisplayMode';
import { deckObjective, flightObjective } from './Objectives';
import {
    DEFAULT_SCENARIO,
    MissionDirector,
    SCENARIOS,
    recommendScenario,
    scenarioAt,
    scenarioById,
    shortCallout
} from './Scenarios';
import type { MissionSnapshot, MissionStatus, ScenarioDef, ScenarioId } from './Scenarios';
import { loadPitchInversion, storedPitchInversion, savePitchInversion, touchWording } from './Controls';

import { hitTestDeck, hitTestHud } from '../renderer/PointerInteractivity';
import type { DeckStateSnapshot, HudStateSnapshot } from '../renderer/PointerInteractivity';
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
    approachSpeedFor,
    inApproachCorridor,
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
import { solveTouchLayout, touchKitFor } from '../renderer/TouchLayout';
import type { SafeArea, TouchControlId, TouchKit, TouchLayout } from '../renderer/TouchLayout';
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
    PLAY_URL,
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
    public debris: VectorDebrisSystem = new VectorDebrisSystem();
    public cockpitVoice: CockpitVoiceSystem = new CockpitVoiceSystem();
    public padlock: PadlockCamera = new PadlockCamera();
    public timeRewind: TimeRewindBuffer = new TimeRewindBuffer();

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
    public selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' | 'HARM' = 'GUN';
    public phase: GamePhase = 'BOOT';
    public helpVisible = false;
    /**
     * The pilot's own pause menu (v1.11.0) - see `PilotMenu.ts`.
     *
     * Answers a beginner playtest directly: "I should have menu to click and
     * select what to do." `menuSelected` is the keyboard/gamepad cursor; a
     * mouse click bypasses it entirely via `activateMenuItem`.
     */
    public menuOpen = false;
    public menuSelected = 0;

    /** Raw key state, written by the input layer in main.ts. */
    public inputState: Record<string, boolean> = {};

    /**
     * Whether Up/W pitches the nose DOWN (real aviation stick: pull back to
     * climb, push forward to dive). False = Direct (Up = climb, natural for
     * most first-time players). Saved across sessions.
     */
    public pitchInverted: boolean = loadPitchInversion();

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
    /** Text size for every label in the game - see Theme.TEXT_SIZES. */
    public textSize: TextSizeId = loadTextSize();
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
    /** Safe-area insets in layout px (CSS px / UI zoom), as the layouts use them. */
    private safeArea: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
    /** The same insets as the browser reports them, in CSS px. */
    private cssSafeArea: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
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
    private manualTargetCleared = false;
    private hasInitialTargetAcquired = false;

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
    /** Kill chains and their multiplier - see Combo.ts. */
    public combo = new ComboTracker();
    /** Shockwave rings and rising score text at the wreck - see KillFx.ts. */
    public killFx = new KillFxSystem();
    /** Vector dust streaming past the canopy - see SpeedStreaks.ts. */
    private streaks = new SpeedStreaks();
    /**
     * Real seconds of hit-stop left. While it runs the simulation advances at
     * HIT_STOP_SCALE of real time: a kill lands with a beat of weight instead
     * of sliding past at full speed. Applied in `frame()` - the real-time
     * loop - so the fixed-step simulation itself stays deterministic.
     */
    private hitStop = 0;
    public static readonly HIT_STOP_SCALE = 0.12;

    /** EASY or STANDARD - see EasyMode.ts. Set in the constructor. */
    public flyStyle: FlyStyle = 'STANDARD';
    /** The first-run "how would you like to fly?" screen is up. */
    public flyStyleChooserOpen = false;
    /** Which option the chooser's keyboard cursor is on. */
    public flyStyleChoice: FlyStyle = 'EASY';
    /** The chooser was answered this session (storage may not remember it). */
    private flyStyleAnswered = false;
    /** What the pilot asked to fly when the chooser interrupted them. */
    private pendingFlight: 'BRIEFING' | 'DAILY' | 'SKIP' = 'BRIEFING';
    /** EASY: seconds until a held trigger tries again. */
    private easyTriggerTimer = 0;
    /** EASY: seconds the cannon keeps firing after one click. */
    private easyGunBurst = 0;
    /** EASY: throttle on the "not yet" message. */
    private easyNotYetCooldown = 0;
    /**
     * The deck's wave counter when the run began. VETERAN starts it four
     * waves on, so medals count the waves this run actually reached from
     * there - "REACH WAVE 3" used to be met before a shot was fired.
     */
    private startWaveNumber = 0;
    /** The "try EASY" offer has been made this run (once per run, never on EASY). */
    public easyOffered = false;
    /**
     * EASY was on at some point in this run (v2.2.0). Switching it on half
     * way still marks the run: the cards, the challenge link and the daily
     * say EASY whenever any of the score was earned with its help.
     */
    public runFlownEasy = false;
    /** Seconds between a wave's last kill and its WAVE CLEARED payout. */
    public static readonly WAVE_CLEAR_BEAT = 1.1;

    /**
     * SCRAMBLE run state (core/Scramble.ts), or null on every other scenario.
     * `breather` counts down to the next wave; `waveSeconds` times the live
     * one for the speed bonus.
     */
    public scramble: {
        wave: number;
        breather: number;
        waveSeconds: number;
        wavesCleared: number;
        /** EASY: seconds toward the next Sidewinder trickling back. */
        trickle: number;
        brief: string;
        seed: number;
        /** Seconds since the wave's last contact went down. */
        clearTimer: number;
        /** The live wave timed out rather than being shot down. */
        bugOut: boolean;
        /**
         * Jets this run allows, fixed when it starts (v2.2.0). It used to be
         * re-read from the fly style every tick, so switching EASY off with
         * three of five jets lost ended the run on the spot. Switching EASY
         * on part way raises it - the run is marked EASY anyway.
         */
        jets: number;
        /** Bombers that reached the boat in the live wave. */
        leaked: number;
        /** Contacts the player shot down in the live wave. */
        waveKills: number;
    } | null = null;
    /** Seconds remaining on the cannon hit marker. */
    private hitMarker = 0;
    /** Last-seen missileActive per SAM, for launch-edge detection. */
    private samMissileActive = new Map<string, boolean>();
    /** Chaff dispenser: reload timer. Cartridge count itself lives on the loadout. */
    private countermeasures: CountermeasureState = createCountermeasureState();
    /** Damage at the last master-caution, so it fires per event not per frame. */
    private lastCautionDamage = 0;
    /**
     * What most recently damaged the aeroplane this sortie, for the debrief
     * post-mortem. Cleared at the start of every sortie so a stale cause from
     * a previous flight can never be shown against this one's outcome.
     */
    private lastLossCause: LossCause | null = null;

    /**
     * Wire-catch payoff. The trap used to resolve as an instant view switch
     * and a log line - the best moment in the game, over before it registered.
     */
    private trapCinematic = 0;
    private trapGrade: string | null = null;

    /** Three stars per mission, held across sessions - see Medals.ts. */
    public medals: MedalRecords = loadMedals();
    /** Career XP and runs flown - see Career.ts. */
    public career: Career = loadCareer();
    /**
     * What the run that just ended earned, for the debrief: the stars it took
     * for the first time, the XP award, and any unlock it crossed.
     */
    public lastRun: { fresh: number[]; award: XpAward; unlocks: string[]; summary: RunSummary } | null = null;
    /**
     * A run someone shared (`?c=seed.score.waves`): fly the same SCRAMBLE
     * waves and beat their score. See Challenge.ts.
     */
    public challenge: Challenge | null = null;
    /**
     * The "Anna challenges you" screen (v2.3.0): up when the page opened on a
     * challenge link, until the friend accepts it or asks for the missions.
     */
    public challengeWelcomeOpen = false;
    /** Real seconds the debrief has been up - drives its payout animation. */
    public debriefAge = 0;

    /**
     * The score this run is chasing (v2.3.0): the challenger's, or the
     * pilot's own best on this mission. Passing it mid-run is a moment - a
     * banner and a fanfare - not something to find out on the debrief.
     */
    public scoreTarget: { score: number; who: string; challenge: boolean } | null = null;
    private scoreTargetPassed = false;
    private scoreTargetCelebrated = false;

    /**
     * The run's best moment, kept for the share picture (v2.3.0): a copy of
     * the screen a beat after the best kill - the highest chain, the later
     * one on a tie - taken before the thumb controls are drawn.
     */
    private moment: Moment | null = null;
    private momentCanvas: HTMLCanvasElement | null = null;
    private momentWeight = -1;
    private momentPendingWeight = 0;
    private momentDueAt = 0;

    /** The pilot's name for shares, if they gave one (v2.3.0, PilotName.ts). */
    public pilotName: string | null = loadPilotName();
    /** What the finished run would share: built at its end, named at share time. */
    private lastShareRun: (Omit<ShareRun, 'name' | 'url'> & { seed: number; freshStars: number }) | null = null;
    /** How the last share went, for the debrief's line under SHARE. */
    public shareStatus: 'IDLE' | 'SHARED' | 'COPIED' = 'IDLE';
    /**
     * Opens the share panel (main.ts, plain DOM: a real text field for the
     * name and real buttons). Unset in tests and headless runs, where SHARE
     * falls back to copying the text card.
     */
    public onShareRequest: (() => void) | null = null;

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
     * Logical viewport, in layout pixels: CSS pixels over the text-size zoom
     * (v2.1.0), so CSS pixels at NORMAL text. The canvas backing store is the
     * CSS size times the device pixel ratio, with the 2D context pre-scaled -
     * so every layout number in the game stays in layout pixels while text and vectors
     * render at native resolution. The old build pinned the backing store to
     * CSS pixels and set `image-rendering: pixelated`, which is why HUD
     * glyphs looked soft and ragged on any HiDPI screen.
     */
    public viewWidth = 1;
    public viewHeight = 1;
    /** Device pixel ratio the backing store is currently sized for. */
    public dpr = 1;
    /** The real canvas size, CSS px. `viewWidth/Height` are these over `uiZoom`. */
    public cssWidth = 1;
    public cssHeight = 1;
    /** Layout pixels -> CSS pixels. 1 at NORMAL text, and on phones; see Theme.textScaling. */
    public uiZoom = 1;

    private lastTimestamp = 0;
    private audioStarted = false;
    private timestep = new FixedTimestepAccumulator();
    private elapsedSeconds = 0;
    private bootTimer = 0;
    private lastSpawnedWave = 0;
    /** Latest coach line. Public so the wiring can be asserted headlessly. */
    public currentHint: Hint | null = null;
    /** Watches for a pilot fighting the pitch keys - see StruggleDetector. */
    private pitchStruggle = new PitchStruggleDetector();
    /** Smoothed d(airspeed)/dt, m/s^2 - see `assistFlightState`. */
    private speedRate = 0;
    private lastAirSpeed: number | null = null;
    /** Seconds left on the "a fighter is lining me up" warning. */
    private gunsWarningTimer = 0;

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
        this.cssWidth = this.viewWidth;
        this.cssHeight = this.viewHeight;
        this.post = new PostProcess(this.viewWidth, this.viewHeight);
        this.renderer = new VectorRenderer(this.post.worldTarget);

        this.hud = new HUD(this.viewWidth, this.viewHeight);
        this.terrain = new TacticalTerrain();
        this.sensors = new SensorTacticsManager(this.terrain);
        this.deck = new DeckManager();
        this.weapons = new WeaponsSystem();
        this.physics = new AircraftPhysics();
        this.physics.turnAssist = 1;
        this.physics.liftScale = pacingSpec(this.pacing).liftScale;
        this.score = new ScoreKeeper();
        this.training = new TrainingSequence();
        this.deckView = new DeckView();
        this.briefing = new BriefingScreen();

        applyPalette(this.palette);
        this.applyDisplayMode();
        // A pilot who has never chosen and never flown starts on EASY and is
        // asked once; a returning pilot keeps the game they already knew.
        const anyAttempts = Object.values(this.missionRecords).some(r => r.attempts > 0);
        this.setFlyStyle(loadFlyStyle() ?? (anyAttempts ? 'STANDARD' : 'EASY'), false);
        this.scenario = scenarioById(DEFAULT_SCENARIO);
        this.scenarioIndex = SCENARIOS.findIndex(sc => sc.id === DEFAULT_SCENARIO);
        this.applyScenario(this.scenario);
        this.hud.hudDensity = resolveHudDensity(this.hasCompletedAMission());
    }

    /** Any mission ever completed - the FIRST_FLIGHT HUD's graduation test. */
    public hasCompletedAMission(): boolean {
        return SCENARIOS.some(sc => recordFor(this.missionRecords, sc.id).completions > 0);
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
        // A shielded scenario's contacts are drones: they fly the pattern, they
        // do not strafe the boat. The deck has to know, because it owns the
        // package-reaches-the-carrier damage path.
        this.deck.combatShielded = setup.combatShielded === true;
        this.sensors = new SensorTacticsManager(this.terrain);
        if (setup.noSamSites) this.sensors.samSites.length = 0;
        this.weapons = new WeaponsSystem();
        this.physics = new AircraftPhysics();
        this.physics.turnAssist = 1;
        this.physics.liftScale = pacingSpec(this.pacing).liftScale;
        this.score = new ScoreKeeper();
        this.training = new TrainingSequence();
        // The flight checkout is the intro mode's teaching tool; on a scripted
        // mission it is six lines of noise over the top of real orders. And a
        // pilot who has already completed a mission has nothing left to learn
        // from "hold W": v2.0.0 playtest found the 0/6 checkout pinned over
        // every endless run a veteran flew, and a TRAINING 1/6 coach line
        // replacing combat hints a minute into the fight.
        // EASY flies the plane, so a checkout of stick and throttle has
        // nothing to teach - and its prompt outranked FIRE NOW all sortie.
        if (!setup.showTrainingChecklist || this.hasCompletedAMission() || this.easyMode) this.training.skip();

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
        this.startWaveNumber = this.deck.waveNumber;
        this.airborneTargets = this.buildTargetsFromTimeline(this.deck.strikeTimeline);

        this.callouts.clear();
        this.visibility.reset();
        this.samMissileActive.clear();
        this.lastCautionDamage = 0;
        this.sortieKills = 0;
        this.easyOffered = false;
        this.runFlownEasy = this.easyMode;
        this.moment = null;
        this.momentWeight = -1;
        this.momentDueAt = 0;
        this.lastShareRun = null;
        this.shareStatus = 'IDLE';
        // SCRAMBLE chases a number: the challenger's, else the pilot's best.
        const best = recordFor(this.missionRecords, scenario.id).best;
        this.scoreTarget = !setup.scramble ? null
            : this.challenge && !this.isDailyRun
                ? { score: this.challenge.score, who: challengerLabel(this.challenge), challenge: true }
                : best > 0 ? { score: best, who: 'YOUR BEST', challenge: false } : null;
        this.scoreTargetPassed = false;
        this.scoreTargetCelebrated = false;
        // A jet lost in the last run must not die again in this one: RESTART
        // during the MAYDAY sequence, or a daily started from the menu, used
        // to begin the new run with dead controls, slow motion and a jet
        // already written off (v2.2.0 review). Airborne starts never pass
        // through beginSortie, which is where these were cleared before.
        this.dying = null;
        this.lastLossCause = null;
        this.combo.reset();
        this.killFx.clear();
        this.hitStop = 0;
        this.trauma = 0;
        this.flashAlpha = 0;
        this.hitMarker = 0;
        this.debris.clear();
        this.cockpitVoice.clear();
        this.padlock.reset();
        this.timeRewind.reset();
        this.trapCinematic = 0;
        this.trapGrade = null;

        this.deck.log(`SCENARIO: ${scenario.name.toUpperCase()} - ${scenario.tagline}`);

        this.scramble = setup.scramble
            ? {
                wave: 0,
                breather: SCRAMBLE.firstWaveDelay,
                waveSeconds: 0,
                wavesCleared: 0,
                trickle: 0,
                brief: '',
                seed: seedOverride ?? Math.floor(Math.random() * 1e9),
                clearTimer: 0,
                bugOut: false,
                jets: this.scrambleLives(),
                leaked: 0,
                waveKills: 0
            }
            : null;
        if (this.scramble) this.airborneTargets = [];

        if (setup.startAirborne) {
            this.hotStartAirborne();
            this.hasLaunched = true;
            if (this.scramble) this.armScrambleJet();
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
            rwrState: this.sensors.masterRwrState,
            flightAssistMode: this.effectiveAssist(),
            jetsAllowed: this.scramble?.jets ?? this.scrambleLives()
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
                    // A shielded scenario's contacts are target drones, and are
                    // called that everywhere - a tag reading "MIG-23" on the
                    // mission that promised zero hostiles is a contradiction the
                    // player can see.
                    name: this.scenario.setup.combatShielded
                        ? `DRONE #${i + 1}`
                        : pkg.aircraftType === 'Tu-22' ? 'Tu-22M BACKFIRE' : `MiG-23 FLOGGER #${i + 1}`,
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
        this.countermeasures = createCountermeasureState(loadout.chaff);
        this.lastLossCause = null;
        this.dying = null;
        this.manualTargetCleared = false;
        this.hasInitialTargetAcquired = false;
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
        this.manualTargetCleared = false;
        this.hasInitialTargetAcquired = false;
        this.training.skip();
    }

    /**
     * Push the deck crew past their ordinary pace, at the cost of the
     * stamina that pace depends on - see `DeckManager.rushTurnaround()`. The
     * deck's only real decision was made once, in the seconds it takes to set
     * fuel and ordnance; this gives the rest of the turnaround one too.
     */
    public rushTurnaround(): boolean {
        const outcome = this.deck.rushTurnaround();
        if (outcome.applied) {
            soundFX.playUiSelect();
        } else if (outcome.refusal === 'CREW_EXHAUSTED') {
            // A refusal the player can act on (wait) is worth a sound, unlike
            // NO_ACTIVE_TASK, which just means the key was pressed at a time
            // it never does anything - not worth commenting on.
            soundFX.playMasterCaution();
        }
        return outcome.applied;
    }

    /**
     * Request a catapult launch. Applies the player's planned payload, which
     * previously was discarded because the old code called a reset routine
     * that hardcoded fuel to 4500 and force-set state to AIRBORNE.
     */
    public requestCatapultLaunch(): boolean {
        if (this.deck.aircraftState !== 'CATAPULT_READY') return false;
        if (!this.deck.triggerCatapultLaunch()) return false;

        // What the magazine could supply, not what was planned.
        this.beginSortie(this.deck.plannedFuel, this.deck.lastLaunchLoadout ?? this.deck.loadableLoadout());
        this.isCatapultLaunching = true;
        this.catapultProgress = 0;
        this.currentView = 'MICRO_FLIGHT';
        soundFX.playCatapultLaunch();
        return true;
    }

    /** localStorage, or null where it is missing or blocked (tests, private modes). */
    private static safeStorage(): Storage | null {
        try {
            return globalThis.localStorage ?? null;
        } catch {
            return null;
        }
    }

    /**
     * A loop is: nose well past 60 degrees up, then inverted. Checked every
     * tick but only one comparison each, and re-armed once the jet is back to
     * level upright flight so a second sortie can earn it again.
     */
    private watchForLoop() {
        if (this.deck.aircraftState !== 'AIRBORNE') return;
        const fwdY = this.physics.forwardVector.y;
        if (fwdY > 0.87) this.loopProgress.climbed = true;
        if (this.loopProgress.climbed && Math.abs(this.physics.roll) > 2.2) {
            this.loopProgress.climbed = false;
            this.celebrate('FIRST_LOOP');
        } else if (fwdY < 0.2 && Math.abs(this.physics.roll) < 1.0) {
            this.loopProgress.climbed = false;
        }
    }

    /** The louder line for a player's first time doing something. */
    private celebrate(id: Parameters<Milestones['claim']>[0]) {
        const m = this.milestones.claim(id);
        if (!m) return;
        this.callouts.push(m.title, 'PRAISE', m.detail);
        this.flash(THEME.phosphor, 0.35);
    }

    /** Seconds the cockpit stays up, in slow motion, after the airframe is lost. */
    public static readonly DEATH_SEQUENCE_SECONDS = 2.6;
    /** Fraction of real time the world runs at while the pilot watches it end. */
    public static readonly DEATH_TIME_SCALE = 0.3;
    private milestones = new Milestones(GameLoop.safeStorage());
    /** Sortie-long latch so the loop milestone is checked once per sortie, not per frame. */
    private loopProgress = { climbed: false };
    private dying: { remaining: number; reason: string; cause: LossCause | null } | null = null;

    /** True while the loss sequence is playing (cockpit still up, controls dead). */
    public get isDying(): boolean { return this.dying !== null; }

    /**
     * The airframe is gone. Do NOT cut to the deck: a pilot who is flying and
     * then suddenly is not reads it as a crash of the software, not of the
     * jet. Hold the cockpit for a couple of seconds in slow motion, throw the
     * shake and the flash, and put the reason on the screen - then, and only
     * then, the deck. Killing is the same call from every source (cannon, SAM,
     * terrain), so the sequence lives here and none of them has to know.
     */
    private replaceAirframe(reason: string) {
        if (this.dying) return;
        if (this.currentView !== 'MICRO_FLIGHT') {
            this.finishAirframeLoss(reason);
            return;
        }
        this.dying = {
            remaining: GameLoop.DEATH_SEQUENCE_SECONDS,
            reason,
            cause: this.lastLossCause
        };
        const cause = formatLossCause(this.lastLossCause) ?? reason;
        this.callouts.push('MAYDAY - AIRFRAME LOST', 'LOSS', cause);
        this.shake(SHAKE_SOURCES.damageTaken * 1.6);
        this.flash(THEME.alert, 0.9);
        this.physics.throttle = 0;
        const isGroundImpact = this.lastLossCause?.kind === 'TERRAIN'
            || this.lastLossCause?.kind === 'STALL'
            || this.lastLossCause?.kind === 'FUEL'
            || this.lastLossCause?.kind === 'OCEAN';
        if (isGroundImpact) this.physics.velocity = { x: 0, y: 0, z: 0 };
    }

    /** Issue a fresh airframe after a loss. */
    private finishAirframeLoss(reason: string) {
        this.dying = null;
        this.score.recordAirframeLost();
        this.callouts.push('AIRFRAME LOST', 'LOSS');
        this.shake(SHAKE_SOURCES.damageTaken);
        this.flash(THEME.alert, 0.75);
        this.sortieKills = 0;
        this.combo.breakChain();
        this.deck.inventory.spareAirframes = Math.max(0, this.deck.inventory.spareAirframes - 1);
        this.deck.log(reason);
        this.offerEasyIfStruggling();
        if (this.scramble) {
            this.respawnScramble();
            return;
        }
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
     *
     * Takes the insets in CSS px and converts them here, at the zoom in force
     * now - main.ts used to convert them, so a text-size change (which
     * resizes without a window event) left them in the old zoom's units and
     * thumb controls a few px under a notch (v2.2.0 review).
     */
    public applyControlScheme(cssInsets: SafeArea = this.cssSafeArea) {
        this.cssSafeArea = cssInsets;
        const z = this.uiZoom || 1;
        const insets: SafeArea = {
            top: cssInsets.top / z, right: cssInsets.right / z,
            bottom: cssInsets.bottom / z, left: cssInsets.left / z
        };
        this.safeArea = insets;
        const signals = readPlatformSignals();
        const previous = this.controlScheme;
        // Device detection is in CSS px, whatever the text size: a zoomed
        // tablet layout used to read as a phone and switch to touch controls
        // (and the autopilot) when the text got bigger.
        this.controlScheme = resolveScheme(this.schemePreference, {
            ...signals,
            width: this.cssWidth,
            height: this.cssHeight
        });
        this.touchLayout = solveTouchLayout(this.viewWidth, this.viewHeight, insets, this.touchKit());
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
    }

    /** Cycle AUTO -> TOUCH -> KEYBOARD, for players detection got wrong. */
    public cycleControlScheme() {
        soundFX.playUiMove();
        this.schemePreference = nextSchemePreference(this.schemePreference);
        saveSchemePreference(this.schemePreference);
        // A full resize: phone or not decides the zoom (Theme.textScaling).
        this.resize(this.cssWidth, this.cssHeight);
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
        this.cssWidth = Math.max(1, Math.round(width));
        this.cssHeight = Math.max(1, Math.round(height));
        // Text size is a UI zoom: lay out for a smaller virtual screen, then
        // scale it up - except on a phone, which is never zoomed and grows its
        // in-flight words in place instead (see Theme.textScaling). Whether
        // this is a phone is a CSS-px question, asked before any zoom.
        const touch = resolveScheme(this.schemePreference, {
            ...readPlatformSignals(), width: this.cssWidth, height: this.cssHeight
        }) === 'TOUCH';
        const scaling = textScaling(this.textSize, this.cssWidth, this.cssHeight, touch);
        this.uiZoom = scaling.zoom;
        this.hud.textBoost = scaling.boost;
        this.viewWidth = Math.max(1, Math.round(this.cssWidth / this.uiZoom));
        this.viewHeight = Math.max(1, Math.round(this.cssHeight / this.uiZoom));

        this.canvas.width = Math.round(this.cssWidth * dpr);
        this.canvas.height = Math.round(this.cssHeight * dpr);
        if (this.canvas.style) {
            this.canvas.style.width = `${this.cssWidth}px`;
            this.canvas.style.height = `${this.cssHeight}px`;
        }
        // Everything downstream draws in layout pixels (CSS px / zoom).
        const scale = dpr * this.uiZoom;
        this.ctx.setTransform?.(scale, 0, 0, scale, 0, 0);

        this.post.resize(this.viewWidth, this.viewHeight, scale);
        this.renderer.resize(this.viewWidth, this.viewHeight);
        this.hud.resize(this.viewWidth, this.viewHeight);
        this.applyControlScheme();
    }

    public start() {
        // Open on the mission the briefing marks START HERE - the training
        // sortie for a new pilot, the easiest uncleared mission after that. It
        // used to do this for new pilots only, so a returning pilot saw START
        // HERE on one mission while the big FLY button flew another.
        this.selectScenarioById(this.challenge ? 'SCRAMBLE' : recommendScenario(this.missionRecords).id);
        requestAnimationFrame(this.step.bind(this));
    }

    public ensureAudio() {
        if (!this.audioStarted) {
            soundFX.init();
            this.audioStarted = true;
        }
    }

    public get paused(): boolean {
        return this.phase !== 'ACTIVE' || this.helpVisible || this.menuOpen;
    }

    /**
     * One animation frame, made survivable.
     *
     * The frame body used to schedule the next frame on its last line, so a
     * single exception anywhere in update or draw skipped that line and froze
     * the game on a still image with no message - the worst possible failure
     * in front of a new player. Now a bad frame is logged and the loop carries
     * on; only a failure that persists for `FATAL_FRAME_ERRORS` consecutive
     * frames (about half a second) stops the loop and reports itself through
     * `onFatalError`, which the shell turns into a visible recovery screen.
     */
    private step(timestamp: number) {
        try {
            this.frame(timestamp);
            this.consecutiveFrameErrors = 0;
        } catch (error) {
            this.consecutiveFrameErrors++;
            console.error('Frame failed:', error);
            if (this.consecutiveFrameErrors >= GameLoop.FATAL_FRAME_ERRORS) {
                this.onFatalError?.(error);
                return;
            }
        }
        requestAnimationFrame(this.step.bind(this));
    }

    /** Consecutive failing frames after which the loop gives up. */
    public static readonly FATAL_FRAME_ERRORS = 30;
    private consecutiveFrameErrors = 0;
    /** Called once if the loop stops for good; the shell shows a recovery screen. */
    public onFatalError: ((error: unknown) => void) | null = null;

    private frame(timestamp: number) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const elapsed = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;
        this.elapsedSeconds += Math.min(0.1, Math.max(0, elapsed));
        if (this.phase === 'DEBRIEF') this.debriefAge += Math.min(0.1, Math.max(0, elapsed));

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

            let simElapsed = elapsed;
            // EASY runs the world at 80%: time to read, time to react.
            if (this.easyMode && this.phase === 'ACTIVE') simElapsed *= EASY_TUNING.timeScale;
            if (this.hitStop > 0) {
                this.hitStop = Math.max(0, this.hitStop - Math.min(0.1, Math.max(0, elapsed)));
                simElapsed = elapsed * GameLoop.HIT_STOP_SCALE;
            }
            const steps = this.timestep.consume(simElapsed);
            const wasActive = this.phase === 'ACTIVE';
            for (let i = 0; i < steps; i++) {
                this.fixedUpdate(FIXED_DT);
                // The run ended on this step: its score, medals, card and
                // daily are already recorded, so the rest of this frame's
                // steps must not move the world the debrief describes.
                if (wasActive && this.phase !== 'ACTIVE') break;
            }
            // Real time, so the payoff keeps moving through the hit-stop.
            this.killFx.update(Math.min(0.1, Math.max(0, elapsed)));
        }

        this.updateAdaptiveQuality(elapsed);
        this.updateMusic();
        this.draw(elapsed);
    }

    /**
     * The tab went into the background (v2.2.0 review). The frame loop stops
     * with it, but the soundtrack's own timer did not: the music played on
     * over a frozen game. Stop it, and pause a live flight, so a pilot who
     * took a phone call comes back to the menu - not to a fight already
     * under way.
     */
    public onHidden() {
        soundFX.setMusicIntensity(0);
        if (this.phase === 'ACTIVE' && !this.menuOpen) this.toggleMenu();
    }

    /** The SCRAMBLE soundtrack follows the fight, and stops everywhere else. */
    private updateMusic() {
        const s = this.scramble;
        const playing = s !== null && this.phase === 'ACTIVE' && !this.paused;
        soundFX.setMusicIntensity(playing
            ? scrambleIntensity({
                wave: s!.wave,
                waveLive: s!.breather <= 0 && this.airborneTargets.some(t => t.isAlive),
                chain: this.combo.chain
            })
            : 0);
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
        if (this.dying) return;
        const k = this.inputState;

        // A thumb gives an analog demand; a key gives ±1. Both arrive here as
        // the same PilotInput, so the assist laws and the flight model below
        // never learn which one the player used.
        const rawPitch = this.analog
            ? this.analog.pitch
            : (k['w'] || k['arrowup'] ? 1 : 0) + (k['s'] || k['arrowdown'] ? -1 : 0);
        const pilot = {
            pitch: this.pitchInverted ? -rawPitch : rawPitch,
            roll: this.analog
                ? this.analog.roll
                : (k['d'] || k['arrowright'] ? 1 : 0) + (k['a'] || k['arrowleft'] ? -1 : 0),
            throttle: (k['shift'] ? 1 : 0) + (k['control'] ? -1 : 0)
        };

        // A pilot stabbing the pitch keys back and forth is usually fighting a
        // stick that feels backwards. Offer the flip once, in context - only
        // to someone who has never touched the setting, and only on keys (the
        // thumb stick has no "arrow-up" convention to fight).
        if (!this.analog && this.pitchStruggle.update(rawPitch, dt) && storedPitchInversion() === null) {
            this.callouts.push('STICK FEELS BACKWARDS?', 'MODE', 'PRESS [I] - UP ARROW DIVES, LIKE A FLIGHT SIM');
            this.deck.log('TIP: [I] FLIPS THE STICK - UP ARROW DIVES, AS IN MOST FLIGHT SIMS.');
        }

        // Smoothed airspeed rate, for the autothrottle's anticipation term.
        const speed = this.physics.airSpeed;
        if (this.lastAirSpeed !== null && dt > 0) {
            const raw = (speed - this.lastAirSpeed) / dt;
            this.speedRate += (raw - this.speedRate) * Math.min(1, dt * 4);
        }
        this.lastAirSpeed = speed;

        const demand = resolveControls(this.effectiveAssist(), this.assistFlightState(), pilot, this.navTarget());
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
        // EASY fires the cannon only in the bursts the smart trigger asks for.
        const gunHeld = this.easyMode ? this.easyGunBurst > 0 : k[' '] && this.selectedWeapon === 'GUN';
        if (gunHeld) {
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

    /** The thumb controls this sortie actually uses (v2.2.0). */
    private touchKit(): TouchKit {
        return touchKitFor({ easy: this.easyMode, scramble: this.scramble !== null });
    }

    /** Re-solve the thumb layout when the kit changes - EASY toggled, a new mode. */
    private refreshTouchKit() {
        const kit = this.touchKit();
        const was = this.touchLayout.kit;
        const same = was.flight === kit.flight && was.target === kit.target && was.chaff === kit.chaff
            && was.recover === kit.recover && was.bigFire === kit.bigFire
            && was.stores.every((v, i) => v === kit.stores[i]);
        if (!same) this.touchLayout = solveTouchLayout(this.viewWidth, this.viewHeight, this.safeArea, kit);
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
        this.refreshTouchKit();

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
        // the same button can fire a burst or release a single bomb. On EASY
        // a finger held anywhere on the world is the trigger too, like the
        // mouse: no button to find at all.
        this.inputState[' '] = (demand.firing && (this.easyMode || this.selectedWeapon === 'GUN'))
            || (this.easyMode && this.touch.isHeld('WORLD'));

        for (const tap of this.touch.consumeTaps()) {
            this.handleTouchTap(tap.control, tap.x, tap.y);
        }
    }

    private handleTouchTap(control: TouchControlId, x: number, y: number) {
        switch (control) {
            case 'FIRE':
                if (this.easyMode) this.easyFire();
                else if (this.selectedWeapon !== 'GUN') this.fireSelectedWeapon();
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
            case 'WEAPON_HARM':
                this.selectedWeapon = 'HARM';
                soundFX.playUiMove();
                return;
            case 'CHAFF':
                this.releaseChaff();
                return;
            case 'MENU':
                // v1.11.0: the thumb MENU button now opens the real pilot
                // menu (pause, take me home, mission select, ...) instead of
                // the raw control reference - CONTROLS is one tap inside it.
                this.toggleMenu();
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
                if (this.easyMode) this.easyFire();
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

    /** A tap on a menu screen, in layout pixels. Returns true if it was used. */
    public handleMenuTap(x: number, y: number): boolean {
        if (this.flyStyleChooserOpen) {
            const hit = flyStyleHitTest(x, y, flyStyleLayout(this.viewWidth, this.viewHeight));
            if (hit === 'TEXT_SIZE') this.cycleTextSize();
            else if (hit) this.chooseFlyStyle(hit);
            return true;
        }
        if (this.phase === 'BRIEFING' && this.challengeWelcomeOpen) {
            const hit = challengeWelcomeHitTest(x, y, challengeWelcomeLayout(this.viewWidth, this.viewHeight));
            if (hit === 'ACCEPT') this.acceptChallengeWelcome();
            else if (hit === 'MISSIONS') this.closeChallengeWelcome();
            return true;
        }
        if (this.phase === 'BRIEFING') {
            const areas = briefingHitAreas(this.viewWidth, this.viewHeight, SCENARIOS.length, true);
            if (areas.daily && inside(areas.daily, x, y)) {
                this.requestFlight('DAILY');
                return true;
            }
            for (let i = 0; i < areas.pills.length; i++) {
                if (inside(areas.pills[i], x, y)) {
                    this.selectScenarioByIndex(i);
                    return true;
                }
            }
            this.requestFlight('BRIEFING');
            return true;
        }

        if (this.phase === 'DEBRIEF') {
            if (!this.debriefAcceptsInput()) return true;
            const layout = debriefLayout(this.viewWidth, this.viewHeight, this.debriefData());
            if (inside(layout.missions, x, y)) this.returnToBriefing();
            // SHARE is its own button: a tap on the old card used to fly
            // again and throw the card away, so a phone could never send one.
            else if (layout.share && inside(layout.share, x, y)) this.requestShare();
            else this.flyAgain();
            return true;
        }
        return false;
    }

    /** Register a shake event. Presentation only - see the field comment. */
    public shake(amount: number) {
        this.trauma = addTrauma(this.trauma, amount * this.motion.shakeScale * (this.easyMode ? EASY_TUNING.shake : 1));
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
            onApproach: HUD.isOnApproach(this.physics),
            speedRate: this.speedRate
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
        // SCRAMBLE has no deck to recover to; a phone's default-on recovery
        // assist must not fly the jet away from the fight to land.
        if (!this.approachAssist || this.scramble) return null;
        if (this.effectiveAssist() !== 'AUTO') return null;
        if (this.deck.aircraftState !== 'AIRBORNE') return null;

        // Fly the approach at this airframe's on-speed speed, not a constant:
        // see `AircraftPhysics.onSpeedApproachSpeed`.
        const tuning = {
            ...APPROACH_TUNING,
            approachSpeed: approachSpeedFor(this.physics.onSpeedApproachSpeed())
        };
        const guidance = approachGuidance(this.physics.position, {
            bank: this.physics.roll,
            lateralSpeed: this.physics.velocity.x,
            heading: this.physics.yaw
        }, tuning);
        this.approachPhase = guidance.phase;

        /**
         * JOIN covers two different situations, and only one of them is this
         * method's to fly. Genuinely out of position (too far, off to one
         * side) is still a CUE and not a hand-over: the HUD points the way
         * and the player flies the transit, exactly as before.
         *
         * Already in a good position but pointed the wrong way is different,
         * and is new in v1.11.0. `guidance` has already computed a short,
         * tight reversal for it (see `ApproachGuidance`'s heading check) -
         * flying that IS this method's job, because leaving it to `navTarget`
         * `('hold whatever heading the jet has')` is precisely the bug this
         * fixes: a beginner killed the training drone, pressed L, and the
         * jet held its post-kill heading - almost directly away from the
         * carrier - for good. `inApproachCorridor` without a heading is the
         * same position-only test `approachGuidance` used internally, so this
         * can tell the two JOIN cases apart without it exposing a new phase.
         */
        if (guidance.phase === 'JOIN' && inApproachCorridor(this.physics.position, tuning)) {
            this.terrainFollowClimbing = false;
            const p = this.physics.position;
            const ground = this.terrain.getElevation(p.x, p.z);
            return this.applyTerrainFollowing({
                bearing: guidance.bearing,
                altitudeAgl: Math.max(0, guidance.altitudeMsl - ground),
                airSpeed: guidance.airSpeed,
                maxBank: guidance.maxBank
            }, true);
        }
        if (guidance.phase !== 'FINAL') return null;

        // The recovery owns the altitude; the terrain follower's 200 m floor
        // would be a permanent go-around over a deck twenty metres up.
        this.terrainFollowClimbing = false;

        // Boards out. The only drag device this airframe has is the weapons
        // bay, and without it an idle descent on the glideslope stabilises
        // far too fast for the wires - see APPROACH_TUNING.boardsOutAbove.
        this.physics.bayOpen =
            this.physics.airSpeed > tuning.approachSpeed + APPROACH_TUNING.boardsOutAbove;

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
            overridesApproach: true,
            // On the slope, fly the slope: the altitude error is then only a
            // correction, instead of the whole descent being chased from behind.
            pathAngle: guidance.altitudeMsl < APPROACH_TUNING.patternAltitude
                ? -APPROACH_TUNING.glideslopeDegrees * (Math.PI / 180)
                : 0
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
        const stars = totalStars(this.medals);
        this.palette = nextAvailablePalette(this.palette, (p) => isPaletteUnlocked(p, stars));
        applyPalette(this.palette);
        savePalette(this.palette);
        this.callouts.push(`PALETTE — ${paletteSpec(this.palette).label}`, 'MODE');
        soundFX.playUiMove();
        return this.palette;
    }

    /** NORMAL -> LARGE -> EXTRA LARGE text, remembered. */
    public cycleTextSize(): TextSizeId {
        this.textSize = nextTextSize(this.textSize);
        saveTextSize(this.textSize);
        this.resize(this.cssWidth, this.cssHeight);
        this.callouts.push(`TEXT SIZE — ${textSizeSpec(this.textSize).label}`, 'MODE');
        soundFX.playUiMove();
        return this.textSize;
    }

    /** Toggle the recovery assist, and remember the choice. */
    public toggleApproachAssist(): boolean {
        // L in SCRAMBLE used to say "TAKING YOU HOME", save the setting and
        // force the stored assist to AUTO - with no deck to fly to.
        if (this.scramble) {
            this.callouts.push('NO DECK IN SCRAMBLE', 'MODE', 'CLEAR THE WAVE TO PATCH THE JET');
            return this.approachAssist;
        }
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

    /** Toggle padlock camera tracking the designated target. */
    public togglePadlock(): boolean {
        const active = this.padlock.toggle();
        this.callouts.push(active ? 'PADLOCK — TARGET LOCK' : 'PADLOCK — BORESIGHT', 'MODE');
        soundFX.playUiMove();
        return active;
    }

    /** Trigger the 5-second arcade flight rewind buffer. */
    public triggerTimeRewind(): boolean {
        // EASY flies on the autopilot whatever the stored assist level says.
        if (this.effectiveAssist() !== 'MANUAL' && this.timeRewind.canRewind()) {
            const ok = this.timeRewind.triggerRewind(this.physics);
            if (ok) {
                soundFX.playMasterCaution();
                this.shake(SHAKE_SOURCES.missileLaunch);
                this.deck.log('TIME REWIND: 5 SECONDS RESTORED.');
                this.callouts.push('REWIND — 5s RESTORED', 'MODE', `${this.timeRewind.rewindsRemaining} REMAINING`);
                return true;
            }
        }
        return false;
    }

    /**
     * Release a chaff cartridge.
     *
     * Always breaks every SAM currently tracking or engaging the aeroplane -
     * see flight/Countermeasures.ts for why that is deliberate rather than a
     * missed nuance. Decoys every threatening site rather than only the one
     * that has actually fired, because from the cockpit there is no way to
     * tell which site is about to pull the trigger, and a player should never
     * have to guess which of several red contacts their one countermeasure
     * key affects.
     */
    public releaseChaff(): boolean {
        if (this.currentView !== 'MICRO_FLIGHT') return false;
        if (!dispense(this.countermeasures)) {
            soundFX.playRelayClick();
            return false;
        }
        this.physics.loadout.chaff = this.countermeasures.remaining;

        const until = decoyExpiry(this.sensors.missionSeconds);
        let decoyedAny = false;
        for (const sam of this.sensors.samSites) {
            const threat = this.sensors.activeThreats.find(t => t.id === sam.id);
            if (threat && (threat.state === 'LAUNCH' || threat.state === 'TRACK')) {
                sam.decoyedUntil = Math.max(sam.decoyedUntil, until);
                decoyedAny = true;
            }
        }

        soundFX.playCountermeasure(this.placeAt(this.physics.position));
        this.callouts.push(
            decoyedAny ? 'CHAFF — LOCK BROKEN' : 'CHAFF',
            decoyedAny ? 'PRAISE' : 'MODE',
            `${this.countermeasures.remaining} REMAINING`
        );
        if (decoyedAny) this.celebrate('CHAFF_SAVE');
        this.deck.log(`CHAFF RELEASED. ${this.countermeasures.remaining} REMAINING.`);
        return true;
    }

    /**
     * Toggle pitch inversion. Real-aviation stick: pulling UP arrow / W makes
     * the nose go DOWN (climb). False = Direct: Up arrow makes nose go UP.
     * Persisted across sessions so the player never has to set it again.
     */
    public togglePitchInversion(): boolean {
        this.pitchInverted = !this.pitchInverted;
        savePitchInversion(this.pitchInverted);
        soundFX.playRelayClick();
        this.callouts.push(
            this.pitchInverted ? 'STICK: REAL (UP = DIVE)' : 'STICK: DIRECT (UP = CLIMB)',
            'MODE'
        );
        return this.pitchInverted;
    }

    /**
     * Cycle HUD density FIRST FLIGHT -> ARCADE -> PRO, and remember the choice.
     * Once the player has picked one, graduation never overrides it.
     */
    public toggleHudDensity(): HudDensity {
        this.hud.toggleHudDensity();
        saveHudDensity(this.hud.hudDensity);
        soundFX.playRelayClick();
        this.callouts.push(`HUD: ${HUD_DENSITY_LABEL[this.hud.hudDensity]}`, 'MODE');
        return this.hud.hudDensity;
    }

    /**
     * The jet should be going home: the mission's recovery phase, bingo fuel,
     * or heavy damage. One test, shared by every "go home" cue so they cannot
     * disagree about when it is time.
     */
    public isHomeward(): boolean {
        // SCRAMBLE has no deck to go home to: heavy damage is patched by
        // clearing the wave, and a BOAT cue at 60% damage pointed nowhere.
        if (this.scramble) return false;
        return this.missionStatus.phase?.id === 'RECOVER'
            || this.physics.fuel < 800
            || this.physics.damage >= 60;
    }

    /**
     * Where the mission wants the jet next, when the target brackets do not
     * already say: the boat on the way home (recovery phase, bingo fuel, heavy
     * damage), or a hardened target still standing. Null otherwise.
     */
    public goHereGoal(): { bearing: number; rangeMetres: number; label: string } | null {
        if (this.deck.aircraftState !== 'AIRBORNE') return null;
        const p = this.physics.position;
        const homeward = this.isHomeward();
        // Inside the approach the landing aids and the recovery caption own the
        // job; a cue pointing at the deck from 2 km astern is noise.
        if (homeward && !HUD.isOnApproach(this.physics)) {
            return {
                bearing: Math.atan2(0 - p.x, 0 - p.z),
                rangeMetres: Math.hypot(p.x, p.z),
                label: 'BOAT'
            };
        }
        const target = this.strikeTargets.find(t => !t.destroyed);
        if (target && !homeward) {
            const dx = target.position.x - p.x;
            const dz = target.position.z - p.z;
            return { bearing: Math.atan2(dx, dz), rangeMetres: Math.hypot(dx, dz), label: 'TARGET' };
        }
        return null;
    }

    /**
     * Handle a mouse click on the active desktop view (deck or cockpit HUD).
     * Returns true if the click was consumed so main.ts can skip designation.
     */
    public handleDesktopClick(x: number, y: number): boolean {
        if (this.phase !== 'ACTIVE') return false;
        if (this.controlScheme === 'TOUCH') return false;

        if (this.currentView === 'MACRO_DECK') {
            const deckSnap: DeckStateSnapshot = {
                aircraftState: this.deck.aircraftState,
                canRush: this.deck.canRush(),
                plannedFuel: this.deck.plannedFuel,
                sidewinders: this.deck.plannedLoadout.sidewinders,
                ironBombs: this.deck.plannedLoadout.ironBombs
            };
            const action = hitTestDeck(x, y, this.viewWidth, this.viewHeight, deckSnap, this.deckView.lastPanels);
            if (!action) return false;
            soundFX.playRelayClick();
            switch (action) {
                case 'LAUNCH': this.requestCatapultLaunch(); break;
                case 'RUSH': this.rushTurnaround(); break;
                case 'FUEL_MINUS': this.deck.plannedFuel = Math.max(1000, this.deck.plannedFuel - 500); break;
                case 'FUEL_PLUS': this.deck.plannedFuel = Math.min(this.physics.maxFuel, this.deck.plannedFuel + 500); break;
                case 'AIM9_CYCLE': this.deck.plannedLoadout.sidewinders = (this.deck.plannedLoadout.sidewinders + 2) % 8; break;
                case 'BOMB_CYCLE': this.deck.plannedLoadout.ironBombs = (this.deck.plannedLoadout.ironBombs + 1) % 5; break;
                case 'SWITCH_COCKPIT':
                    this.currentView = 'MICRO_FLIGHT';
                    break;
                case 'HELP': this.helpVisible = !this.helpVisible; break;
            }
            return true;
        }

        if (this.currentView === 'MICRO_FLIGHT') {
            const hudSnap: HudStateSnapshot = {
                selectedWeapon: this.selectedWeapon,
                assistLabel: this.easyMode ? 'EASY' : assistSpec(this.assistLevel).label,
                hudDensity: this.hud.hudDensity,
                padlockActive: this.padlock.isPadlocked,
                pitchInverted: this.pitchInverted,
                rewindsRemaining: this.timeRewind.rewindsRemaining,
                hasDesignation: Boolean(this.tracker.designated())
            };
            // controlScheme is narrowed to KEYBOARD by the guard at the top of
            // this method, so the touch reserve can never apply here.
            const layout = this.hud.solveLayout(
                this.physics,
                this.training.checklist().length > 0,
                undefined,
                false
            );
            const action = hitTestHud(x, y, this.viewWidth, this.viewHeight, layout, hudSnap);
            if (!action) return false;
            soundFX.playRelayClick();
            switch (action) {
                case 'WEAPON_GUN': this.selectedWeapon = 'GUN'; break;
                case 'WEAPON_AIM9': this.selectedWeapon = 'AIM9'; break;
                case 'WEAPON_BOMB': this.selectedWeapon = 'BOMB'; break;
                case 'WEAPON_HARM': this.selectedWeapon = 'HARM'; break;
                case 'ASSIST_CYCLE': this.cycleAssistLevel(); break;
                case 'TIME_REWIND': this.triggerTimeRewind(); break;
                case 'PADLOCK': this.togglePadlock(); break;
                case 'HUD_MODE': this.toggleHudDensity(); break;
                case 'PITCH_INVERT': this.togglePitchInversion(); break;
                case 'SWITCH_DECK':
                    this.currentView = 'MACRO_DECK';
                    break;
                case 'HELP': this.helpVisible = !this.helpVisible; break;
            }
            return true;
        }

        return false;
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

        // SCRAMBLE flies with a datalinked AEW picture: every bandit is on the
        // scope whether or not a ridge is in the way, so a wave can never hide.
        this.visibility.update(
            this.elapsedSeconds,
            candidates,
            (position) => this.scramble !== null || this.sensors.checkLOS(this.physics.position, position)
        );

        this.tracker.refresh(
            { position: this.physics.position, forward: this.physics.forwardVector },
            candidates.filter(c => this.visibility.isVisible(c.id))
        );

        // Auto-acquisition for beginners:
        // 1. In AUTO mode (autopilot), continuously maintain a target lock so the autopilot can prosecute.
        // 2. In ASSIST mode, acquire the initial threat after takeoff so new pilots don't fly blind without HUD brackets.
        if (this.deck.aircraftState === 'AIRBORNE' && !this.manualTargetCleared) {
            // SCRAMBLE re-locks whenever the lock is lost: the next bandit is
            // always boxed and pointed at, so SPACE is always the answer.
            const relock = this.scramble !== null && !this.tracker.designated();
            if (this.effectiveAssist() === 'AUTO' || !this.hasInitialTargetAcquired || relock) {
                const acquired = this.tracker.autoAcquire();
                if (acquired) this.hasInitialTargetAcquired = true;
            }
        }
    }

    // -----------------------------------------------------------------
    // Player commands: assist level, designation, weapon release
    // -----------------------------------------------------------------

    /**
     * Fly today's daily: a SCRAMBLE (v2.0.0; it was the endless carrier
     * defence), seeded from the date so every player in the world gets the
     * identical waves, at ARCADE
     * pacing so the comparison is like for like whatever they have set.
     */
    public startDailySortie(now: Date = new Date()) {
        // v2.0.0: the daily is a SCRAMBLE - short, seeded wave for wave, and
        // the mode a newcomer arriving from a shared card can play at once.
        this.selectScenarioById('SCRAMBLE');
        this.isDailyRun = true;
        this.dailyRunDate = dailyKey(now);
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
     * No share panel (tests, headless): put the message and the link on the
     * clipboard. Called from a key or a tap, so the browser's gesture
     * requirement is met; "copied" is only said once it was.
     */
    private copyShareText(): boolean {
        const share = this.currentShare();
        const clip = (globalThis.navigator as Navigator | undefined)?.clipboard;
        if (!share || !clip?.writeText) return false;
        try {
            clip.writeText(share.clipboard).then(() => { this.shareStatus = 'COPIED'; }, () => { /* refused */ });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Stars, career XP and unlocks for the run that just ended (v2.0.0). A new
     * cosmetic look is equipped on the spot, so the reward is seen rather
     * than read - unless the pilot flies the colour-blind palette, which is
     * never swapped out from under them.
     */
    private recordProgression(completed: boolean) {
        const summary: RunSummary = {
            completed,
            score: this.score.totalScore,
            waves: this.scramble ? this.scramble.wavesCleared : this.deck.waveNumber - this.startWaveNumber,
            airframesLost: this.score.breakdown.airframesLost,
            traps: this.score.breakdown.traps,
            perfectTraps: this.score.breakdown.perfectTraps,
            bestChain: this.combo.best,
            hull: this.deck.inventory.carrierHealth,
            seconds: this.missionSeconds
        };
        const starsBefore = totalStars(this.medals);
        const merged = mergeMedals(this.medals, this.scenario.id, earnedMask(this.scenario.id, summary));
        this.medals = merged.records;
        saveMedals(this.medals);
        const starsAfter = totalStars(this.medals);

        const award = awardRun(this.career, this.score.totalScore, merged.fresh.length);
        this.career = award.career;
        saveCareer(this.career);

        const unlocked = newlyUnlocked(starsBefore, starsAfter);
        if (unlocked.length > 0 && this.palette !== 'DEUTERAN') {
            this.palette = unlocked[unlocked.length - 1].palette;
            applyPalette(this.palette);
            savePalette(this.palette);
        }
        this.lastRun = { fresh: merged.fresh, award, unlocks: unlocked.map(u => u.label), summary };
        // What SHARE sends (v2.3.0): the run, named at share time - the pilot
        // can still type a name in the share panel.
        if (this.scramble) {
            const b = this.score.breakdown;
            this.lastShareRun = {
                daily: this.isDailyRun ? dailyNumber(new Date(`${this.dailyRunDate ?? dailyKey()}T00:00:00Z`)) : undefined,
                attempt: this.isDailyRun ? this.dailyResults[this.dailyRunDate ?? dailyKey()]?.attempts : undefined,
                score: this.score.totalScore,
                waves: this.scramble.wavesCleared,
                kills: b.fighterKills + b.bomberKills,
                bestChain: this.combo.best,
                stars: starCount(this.medals.SCRAMBLE ?? 0),
                easy: this.runFlownEasy,
                isNewBest: this.isNewBest || this.isMissionBest,
                versus: this.challenge && !this.isDailyRun ? { name: this.challenge.name ?? null, score: this.challenge.score } : null,
                freshStars: merged.fresh.length,
                seed: this.scramble.seed
            };
        }
        this.debriefAge = 0;
        if (merged.fresh.length > 0) soundFX.playFanfare(4);
    }

    /** The share for the run just finished, under the pilot's current name. */
    public currentShare(): ShareContent | null {
        const r = this.lastShareRun;
        if (!r) return null;
        const { seed, ...run } = r;
        return shareContent({
            ...run,
            name: this.pilotName,
            // /c/ is the same game with a preview card for the friend - and no
            // og:url pointing home, which Facebook would follow (vite.config.ts).
            url: challengeUrl(`${PLAY_URL}/c`, {
                seed, score: run.score, waves: run.waves, easy: run.easy, name: this.pilotName ?? undefined
            })
        });
    }

    /** Draw the share picture for the run just finished onto `canvas` (1080 square). */
    public drawSharePicture(canvas: HTMLCanvasElement): boolean {
        const share = this.currentShare();
        if (!share) return false;
        canvas.width = SHARE_IMAGE_SIZE;
        canvas.height = SHARE_IMAGE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        drawShareImage(ctx, share.picture, this.moment);
        return true;
    }

    /** The name on shares from now on; null or junk forgets it. */
    public setPilotName(raw: string | null): string | null {
        this.pilotName = savePilotName(raw);
        return this.pilotName;
    }

    /**
     * SHARE on the debrief - C, or a tap. Opens the share panel; with no
     * panel (tests, headless) it copies the message and link instead.
     */
    public requestShare(): boolean {
        if (this.phase !== 'DEBRIEF' || !this.lastShareRun) return false;
        soundFX.playUiSelect();
        if (this.onShareRequest) {
            this.onShareRequest();
            return true;
        }
        return this.copyShareText();
    }

    /** How a share went, for the debrief's line under SHARE. */
    public noteShareResult(status: 'SHARED' | 'COPIED') {
        this.shareStatus = status;
    }

    /** Everything the debrief draws, assembled from the run that just ended. */
    public debriefData(): DebriefData {
        const won = this.missionOutcome === 'SUCCESS';
        const b = this.score.breakdown;
        const run = this.lastRun;
        const kills = b.fighterKills + b.bomberKills;
        const stats: [string, string][] = this.scramble
            ? [
                ['WAVES CLEARED', `${this.scramble.wavesCleared}`],
                ['BANDITS SPLASHED', `${kills}`],
                ['BEST CHAIN', this.combo.best >= 2 ? `x${Math.min(5, this.combo.best)} · ${this.combo.best}` : '-'],
                ['JETS LOST', `${b.airframesLost}`],
                ['HULL LEFT', `${Math.round(this.deck.inventory.carrierHealth)}%`],
                ['BONUS PTS', `${this.score.bonusPoints}`]
            ]
            : [
                ['WAVES', `${this.deck.waveNumber}`],
                ['AIR KILLS', `${kills}`],
                ['GROUND KILLS', `${b.samKills + b.structureKills}`],
                ['TRAPS (3-WIRE)', `${b.traps} (${b.perfectTraps})`],
                ['BEST CHAIN', this.combo.best >= 2 ? `x${Math.min(5, this.combo.best)}` : '-'],
                ['JETS LOST', `${b.airframesLost}`]
            ];
        const stars = totalStars(this.medals);
        const next = nextUnlock(stars);
        // A SCRAMBLE run ends one of two ways, and the headline says which:
        // it used to say SHOT DOWN when the jet was fine and the boat sank.
        const carrierLost = this.deck.inventory.carrierHealth <= 0;
        const headline = won
            ? this.scenario.victoryTitle
            : this.scramble
                ? `${carrierLost ? 'CARRIER LOST' : 'SHOT DOWN'} · WAVE ${Math.max(1, this.scramble.wave)}`
                : 'MISSION FAILED';
        // SCRAMBLE always ends in a loss of some kind; on a completed run the
        // headline is the win and the reason says how far it went first.
        let reason = this.scramble && won
            ? `${this.scramble.wavesCleared} waves held before the end. ${this.missionReason ?? ''}`.trim()
            : this.missionReason;
        // Beating a friend's score is the headline, whatever else happened:
        // it is the moment a run is worth sending back (v2.3.0).
        let celebrate = false;
        let title = headline;
        if (this.scramble && this.challenge && !this.isDailyRun) {
            reason = challengeVerdict(this.challenge, this.score.totalScore, this.runFlownEasy);
            const ahead = this.score.totalScore - this.challenge.score;
            if (ahead > 0) {
                celebrate = true;
                title = this.challenge.name ? `YOU BEAT ${challengerLabel(this.challenge)}!` : 'CHALLENGE BEATEN!';
                const end = won ? `${this.scramble.wavesCleared} waves held`
                    : `${carrierLost ? 'the carrier went down' : 'shot down'} at wave ${Math.max(1, this.scramble.wave)}`;
                reason = `By ${ahead.toLocaleString('en-US')} pts - ${end}.`;
            }
        }
        return {
            outcome: won ? 'SUCCESS' : 'FAILED',
            headline: title,
            celebrate,
            reason,
            scenarioName: this.scenario.name,
            styleNote: this.runFlownEasy ? 'FLOWN ON EASY' : undefined,
            // What got the jet - not shown when it was the carrier that went.
            cause: won || carrierLost ? null : this.lastLossCause,
            score: this.score.totalScore,
            isNewBest: this.isNewBest,
            missionBest: recordFor(this.missionRecords, this.scenario.id).best,
            isMissionBest: this.isMissionBest,
            stats,
            stars: {
                labels: MEDALS[this.scenario.id].map(c => c.label),
                recordMask: this.medals[this.scenario.id] ?? 0,
                fresh: run?.fresh ?? []
            },
            xp: run ? run.award : null,
            unlocks: run?.unlocks ?? [],
            nextUnlock: next ? { label: next.label, starsNeeded: next.stars - stars } : null,
            share: this.lastShareRun ? {
                ...shareNudge({
                    isNewBest: this.lastShareRun.isNewBest,
                    versus: this.lastShareRun.versus,
                    score: this.lastShareRun.score,
                    freshStars: this.lastShareRun.freshStars
                }),
                status: this.shareStatus,
                // After a friend's challenge the button answers them by name.
                label: this.lastShareRun.versus
                    ? (this.lastShareRun.versus.name ? `REPLY TO ${this.lastShareRun.versus.name.toUpperCase()}` : 'REPLY')
                    : 'SHARE'
            } : null,
            nextUp: this.nextUpLabel() ?? undefined,
            touch: this.controlScheme === 'TOUCH'
        };
    }

    /**
     * ENTER on the debrief: the same mission again, straight back into it.
     * The single most important button in an arcade game, and the old
     * debrief did not have it - ENTER went back to mission select.
     */
    public flyAgain() {
        if (this.phase !== 'DEBRIEF') return;
        const daily = this.isDailyRun;
        this.returnToBriefing();
        if (daily) this.startDailySortie();
        else this.confirmBriefing();
    }

    /** Debrief input is ignored for a beat, so a held trigger cannot skip the payout. */
    public static readonly DEBRIEF_INPUT_DELAY = 0.7;

    public debriefAcceptsInput(): boolean {
        return this.phase === 'DEBRIEF' && this.debriefAge >= GameLoop.DEBRIEF_INPUT_DELAY;
    }

    /** Fold a finished daily run into the stored record and build its card. */
    private recordDailyRun() {
        const b = this.score.breakdown;
        const merged = mergeDailyResult(this.dailyResults, {
            date: this.dailyRunDate ?? dailyKey(),
            score: this.score.totalScore,
            rank: this.score.rank,
            wave: this.scramble ? this.scramble.wavesCleared : this.deck.waveNumber,
            fighterKills: b.fighterKills,
            bomberKills: b.bomberKills,
            samKills: b.samKills,
            traps: b.traps,
            perfectTraps: b.perfectTraps,
            hullRemaining: this.deck.inventory.carrierHealth,
            completed: this.missionOutcome === 'SUCCESS',
            ...(this.scramble ? { mode: 'SCRAMBLE' as const, bestChain: this.combo.best } : {}),
            ...(this.runFlownEasy ? { easy: true } : {})
        });

        this.dailyResults = merged.results;
        saveDailyResults(this.dailyResults);
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
        this.manualTargetCleared = false;
        this.hasInitialTargetAcquired = true;
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
        this.manualTargetCleared = true;
        this.hasInitialTargetAcquired = true;
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
        if (this.selectedWeapon === 'AIM9' && this.physics.loadout.sidewinders <= 0) {
            // An empty rail should not be a dead key in a dogfight: fall back
            // to the cannon, say so, and let the held trigger do the rest.
            this.selectedWeapon = 'GUN';
            this.callouts.push('GUNS', 'MODE', 'OUT OF MISSILES - HOLD SPACE');
            return;
        }
        if (this.selectedWeapon === 'AIM9') {
            const designated = this.tracker.designated();
            // A heat-seeker launched at an empty sky is a missile thrown away.
            // The v2.0.0 browser run found an eager pilot mashing SPACE before
            // wave 1 had spawned, emptying the rails at nothing - then facing
            // the first bomber with the gun. No target, no launch.
            const anyTarget = designated?.target.kind === 'AIR'
                || this.airborneTargets.some(t => t.isAlive && this.visibility.isVisible(t.id));
            if (!anyTarget) {
                soundFX.playRelayClick();
                this.callouts.push('NO TARGET', 'MODE', 'NOTHING TO LOCK - WAIT FOR THE BANDITS');
                return;
            }
            const before = this.weapons.missiles.length;
            this.weapons.fireSidewinder(
                this.physics,
                this.airborneTargets,
                designated?.target.kind === 'AIR' ? designated.target.id : null,
                (target) => this.visibility.isVisible(target.id)
            );
            if (this.weapons.missiles.length > before) this.shake(SHAKE_SOURCES.missileLaunch);
        } else if (this.selectedWeapon === 'HARM') {
            const launched = this.weapons.fireHarm(this.physics, this.sensors.samSites, this.sensors.activeThreats);
            if (launched) {
                this.shake(SHAKE_SOURCES.missileLaunch);
            } else {
                // Nothing radiating in range - the pilot pulled the trigger on
                // an empty lock. Distinct from a dry weapon: the round is
                // still in the rack, only the shot did not happen.
                soundFX.playRelayClick();
                this.callouts.push('NO RADAR CONTACT', 'MODE');
            }
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
            if (this.scramble && this.deck.aircraftState === 'AIRBORNE') this.updateScramble(dt);
            this.checkScoreTarget();
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
        this.combo.update(dt);
        this.easyGunBurst = Math.max(0, this.easyGunBurst - dt);
        this.easyNotYetCooldown = Math.max(0, this.easyNotYetCooldown - dt);
        if (this.easyMode && (this.inputState[' '] || this.inputState['mousefire'])) {
            this.easyTriggerTimer -= dt;
            if (this.easyTriggerTimer <= 0) {
                this.easyFire(true);
                this.easyTriggerTimer = EASY_TUNING.triggerInterval;
            }
        } else {
            this.easyTriggerTimer = 0;
        }
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
        this.gunsWarningTimer = Math.max(0, this.gunsWarningTimer - dt);
        this.currentHint = this.buildHint();
    }

    private updateSortie(dt: number) {
        if (this.dying) {
            this.dying.remaining -= dt;
            if (this.dying.remaining <= 0) {
                const { reason, cause } = this.dying;
                this.lastLossCause = cause;
                this.finishAirframeLoss(reason);
                return;
            }
            dt *= GameLoop.DEATH_TIME_SCALE;
        }
        this.physics.update(dt);
        this.watchForLoop();
        this.debris.update(dt, (x, z) => this.terrain.getElevation(x, z));
        this.timeRewind.update(dt, this.physics);
        const groundAlt = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
        const altitudeAgl = Math.max(0, this.physics.position.y - groundAlt);
        this.cockpitVoice.update(dt, {
            rwrState: this.sensors.masterRwrState,
            altitudeAgl,
            verticalSpeed: this.physics.velocity.y,
            isStalled: this.physics.isStalled,
            alphaDeg: (this.physics.alpha * 180) / Math.PI,
            fuelFraction: this.physics.fuel / this.physics.maxFuel,
            isAirborne: this.deck.aircraftState === 'AIRBORNE'
        });
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

        // Countermeasure dispenser recycle.
        tickCountermeasures(this.countermeasures, dt);

        // Sensors, RWR and SAM engagements
        this.sensors.update(dt, this.physics);
        soundFX.setRWRState(this.sensors.masterRwrState);

        if (this.sensors.masterRwrState === 'SILENT' && this.physics.position.y < 400) {
            this.training.progress.hasBeenMasked = true;
        }

        // SAM missile impacts now actually hurt - previously missiles flew
        // straight through the player with no collision check at all.
        // In combatShielded scenarios (training) impacts are suppressed so
        // new players can explore without immediately dying to SAMs.
        for (const impact of this.sensors.missileImpacts) {
            if (this.scenario.setup.combatShielded) {
                this.deck.log(`[TRAINING] SAM from ${impact.samId} ghosted — no damage in combat-shielded sortie.`);
            } else {
                this.physics.applyDamage(impact.damage * (this.easyMode ? EASY_TUNING.damageTaken : 1));
                const sourceSam = this.sensors.samSites.find(s => s.id === impact.samId);
                this.lastLossCause = { kind: 'SAM', detail: sourceSam?.name ?? impact.samId };
                this.weapons.spawnExplosion(impact.position, 18, '#ff6600');
                this.deck.log(`SAM IMPACT FROM ${impact.samId}! AIRFRAME DAMAGE ${Math.round(impact.damage)}%.`);
                soundFX.playExplosion(this.placeAt(impact.position));
                soundFX.playMasterCaution();
                this.shake(SHAKE_SOURCES.damageTaken);
                this.flash(THEME.alert, 0.5);
                this.callouts.push('HIT', 'LOSS', `${Math.round(impact.damage)}% AIRFRAME DAMAGE`);
            }
        }

        // Enemy aircraft behaviour (also integrates their positions)
        updateEnemyAI(dt, this.airborneTargets, this.physics, (enemy, hit) => {
            // Simplified hit-scan cannon burst: the alignment/range gate in
            // EnemyAI has already established a valid guns solution, and
            // `hit` says whether this burst actually connected.
            if (this.scenario.setup.combatShielded || this.dying || enemy.passive) return; // ghost in training
            soundFX.playIncomingFire(this.placeAt(enemy.position));
            if (hit && enemy.accuracy !== undefined && Math.random() > enemy.accuracy) hit = false;
            if (hit && this.easyMode && Math.random() < EASY_TUNING.fighterAccuracy) hit = false;
            if (!hit) {
                this.deck.log(`TRACERS PAST YOU - ${enemy.name} IS FIRING`);
                this.shake(SHAKE_SOURCES.damageTaken * 0.15);
                return;
            }
            const dmg = (4 + Math.random() * 6) * (this.easyMode ? EASY_TUNING.damageTaken : 1);
            this.physics.applyDamage(dmg);
            this.lastLossCause = { kind: 'CANNON', detail: enemy.name };
            this.deck.log(`TAKING CANNON FIRE FROM ${enemy.name}!`);
            this.shake(SHAKE_SOURCES.damageTaken * 0.5);
            this.flash(THEME.alert, 0.28);
        }, (enemy) => {
            // The warning that makes cannon fire a fight instead of an ambush.
            if (this.scenario.setup.combatShielded || enemy.passive) return;
            // On EASY the plane does the turning; do not order the pilot to.
            this.callouts.push('GUNS TRACKING', 'LOSS',
                this.easyMode ? `${enemy.name} - THE PLANE IS TURNING TO FIGHT` : `${enemy.name} - BREAK TURN`);
            // Heard, not just read: the pilot is looking at the target.
            if (this.gunsWarningTimer <= 0) soundFX.playGunsTracking(this.placeAt(enemy.position));
            this.gunsWarningTimer = 4;
        });

        // Player weapons
        this.weapons.update(dt, {
            terrain: this.terrain,
            targets: this.airborneTargets,
            samSites: this.sensors.samSites,
            threats: this.sensors.activeThreats,
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
                this.payKill(destroyedSAM.position, SCORE_VALUES.SAM, 'SAM DOWN', destroyedSAM.name);
                this.shake(SHAKE_SOURCES.killConfirmed + blastTrauma(this.rangeTo(destroyedSAM.position), 900));
                this.debris.spawnFromMesh(this.samMesh.lines, destroyedSAM.position, { x: 0, y: 0, z: 0 }, '#ff6622');
                soundFX.playExplosion(this.placeAt(destroyedSAM.position));
                soundFX.playKillConfirm(undefined, this.combo.chain);
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
            this.debris.spawnFromMesh([], this.physics.position, this.physics.velocity, '#ff3300', 16);
            this.replaceAirframe('MAYDAY: AIRCRAFT DESTROYED BY ENEMY FIRE!');
            return;
        }

        // Controlled Flight Into Terrain
        const groundElevation = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
        if (this.scenario.setup.combatShielded) {
            // The training sortie cannot kill you. Shielding used to cover
            // missiles and cannon only, so a beginner who flew the nose into
            // the fjord on their very first flight still lost the airframe -
            // the one lesson the tutorial exists to make safe. The wingman
            // hauls the jet clear instead, and it costs nothing but a callout.
            const floor = groundElevation + 150;
            // Away from the boat, catch a descent early. Near it, the low
            // glideslope is the point of the lesson, so only the last few
            // metres above the water count.
            const nearBoat = Math.hypot(this.physics.position.x, this.physics.position.z) < 1500;
            const danger = nearBoat ? groundElevation + 4 : groundElevation + 40;
            if (this.physics.position.y < floor && this.physics.position.y <= danger
                && this.deck.aircraftState === 'AIRBORNE') {
                this.physics.position.y = floor;
                this.physics.pitch = Math.max(this.physics.pitch, 0.15);
                this.physics.velocity.y = Math.max(this.physics.velocity.y, 0);
                this.physics.velocity.z = Math.max(this.physics.velocity.z, 0);
                this.callouts.push('GHOST-LEAD: PULL UP!', 'MODE', 'training - no damage');
                soundFX.playMasterCaution();
            }
            // Never strand a rookie on fumes either.
            if (this.physics.fuel < 1500) this.physics.fuel = 1500;
        }
        if (this.physics.position.y <= groundElevation + 2) {
            this.weapons.spawnExplosion(this.physics.position, 40, '#ff3300');
            this.debris.spawnFromMesh([], this.physics.position, this.physics.velocity, '#ff3300', 20);
            this.physics.position.y = groundElevation + 2;
            this.lastLossCause = { kind: 'TERRAIN', detail: 'terrain' };
            this.replaceAirframe('MAYDAY: AIRCRAFT LOST TO TERRAIN IMPACT IN CANYON!');
            return;
        }

        // Carrier recovery (arresting gear trap)
        const distToCarrier = Math.hypot(this.physics.position.x, this.physics.position.z);
        // SCRAMBLE has no deck: a low pass over the boat is a flypast, not a trap.
        if (!this.scramble && distToCarrier < 190 && this.physics.position.y >= 17 && this.physics.position.y <= 30) {
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
                    this.celebrate('FIRST_TRAP');
                }
            }
        }
    }

    // -----------------------------------------------------------------
    // EASY flying (v2.1.0) - see core/EasyMode.ts
    // -----------------------------------------------------------------

    public get easyMode(): boolean {
        return this.flyStyle === 'EASY';
    }

    /** Switch EASY on or off; `remember` stores the choice. */
    public setFlyStyle(style: FlyStyle, remember = true) {
        this.flyStyle = style;
        if (style === 'EASY') {
            this.runFlownEasy = true;
            if (this.scramble) this.scramble.jets = Math.max(this.scramble.jets, this.scrambleLives());
        }
        this.callouts.holdScale = style === 'EASY' ? EASY_TUNING.calloutHold : 1;
        if (remember) saveFlyStyle(style);
    }

    public toggleFlyStyle(): FlyStyle {
        this.setFlyStyle(this.easyMode ? 'STANDARD' : 'EASY');
        this.callouts.push(this.easyMode ? 'EASY FLYING ON' : 'EASY FLYING OFF', 'MODE',
            this.easyMode ? 'THE PLANE FLIES ITSELF - YOU FIRE' : 'YOU FLY THE PLANE');
        soundFX.playUiSelect();
        return this.flyStyle;
    }

    /** Whether the first-run chooser should be shown before this flight. */
    public shouldAskFlyStyle(): boolean {
        // Answered this session counts too: with storage blocked (a private
        // window) the question otherwise came back before every flight.
        if (this.flyStyleAnswered) return false;
        const anyAttempts = Object.values(this.missionRecords).some(r => r.attempts > 0);
        return shouldAskFlyStyle(loadFlyStyle(), anyAttempts);
    }

    /**
     * Every "fly" request from the briefing comes through here, so a brand-new
     * pilot is asked how they want to fly before their very first flight -
     * whichever button they pressed - and never again.
     */
    public requestFlight(kind: 'BRIEFING' | 'DAILY' | 'SKIP' = 'BRIEFING') {
        if (this.phase !== 'BRIEFING') return;
        if (this.shouldAskFlyStyle()) {
            this.pendingFlight = kind;
            this.flyStyleChoice = 'EASY';
            this.flyStyleChooserOpen = true;
            soundFX.playUiMove();
            return;
        }
        this.launchFlight(kind);
    }

    private launchFlight(kind: 'BRIEFING' | 'DAILY' | 'SKIP') {
        if (kind === 'DAILY') {
            this.startDailySortie();
        } else {
            this.confirmBriefing();
            if (kind === 'SKIP') this.hotStartAirborne();
        }
    }

    /** The chooser's answer: remember it and fly what was asked for. */
    public chooseFlyStyle(style: FlyStyle) {
        this.flyStyleChooserOpen = false;
        this.flyStyleAnswered = true;
        this.setFlyStyle(style);
        soundFX.playUiSelect();
        this.launchFlight(this.pendingFlight);
    }

    public moveFlyStyleChoice(style: FlyStyle) {
        if (this.flyStyleChoice !== style) soundFX.playUiMove();
        this.flyStyleChoice = style;
    }

    public closeFlyStyleChooser() {
        this.flyStyleChooserOpen = false;
    }

    /**
     * The control law actually flying. EASY means the autopilot flies every
     * intercept, whatever the stored assist level says.
     */
    private effectiveAssist(): AssistLevel {
        return this.easyMode ? 'AUTO' : this.assistLevel;
    }

    /** Would a press of FIRE do something useful right now? */
    private shotIsGood(): boolean {
        if (this.easyMode) return this.easyTriggerChoice() !== 'NOT_YET';
        const d = this.tracker.designated();
        if (!d) return false;
        if (this.selectedWeapon === 'AIM9') return d.inMissileEnvelope && this.physics.loadout.sidewinders > 0;
        if (this.selectedWeapon === 'GUN') return d.inGunEnvelope && this.physics.loadout.vulcanAmmo > 0;
        return false;
    }

    /** An instruction in the words this pilot's controls use (keys, or a thumb). */
    private forThisPilot(text: string): string {
        return this.controlScheme === 'TOUCH' ? touchWording(text) : text;
    }

    /** SCRAMBLE jets per run for the current fly style: more when flying EASY. */
    private scrambleLives(): number {
        return this.easyMode ? EASY_TUNING.lives : SCRAMBLE.lives;
    }

    /** The jets the live run allows - fixed at its start, see `scramble.jets`. */
    private jetsThisRun(): number {
        return this.scramble?.jets ?? this.scrambleLives();
    }

    /**
     * The EASY smart trigger: SPACE, a click or the FIRE button. Fires the
     * missile when it will land, the cannon when the target is close and on
     * the nose, and otherwise says "not yet" in plain words. Bombs and HARMs
     * still go when the pilot has chosen them - EASY never takes a weapon away.
     */
    public easyFire(silent = false) {
        if (this.currentView !== 'MICRO_FLIGHT' || this.deck.aircraftState !== 'AIRBORNE' || this.dying) return;
        if (this.selectedWeapon === 'BOMB' || this.selectedWeapon === 'HARM') {
            if (!silent) this.fireSelectedWeapon();
            return;
        }
        const d = this.tracker.designated();
        const choice = this.easyTriggerChoice();
        if (choice === 'MISSILE') {
            this.selectedWeapon = 'AIM9';
            this.fireSelectedWeapon();
        } else if (choice === 'GUN') {
            this.selectedWeapon = 'GUN';
            this.easyGunBurst = EASY_TUNING.gunBurstSeconds;
        } else if (!silent && this.easyNotYetCooldown <= 0) {
            const inbound = !!d && this.weapons.missiles.some(m => m.targetId === d.target.id);
            // Say why in words that are true: a ground target never earns a
            // FIRE NOW from the air-to-air trigger, so "wait" would be a lie.
            const ground = !!d && d.target.kind !== 'AIR' && !d.inGunEnvelope;
            this.callouts.push('NOT YET', 'MODE',
                !d ? 'NO TARGET YET - THE PLANE WILL FIND ONE'
                    : inbound ? 'A MISSILE IS ALREADY ON ITS WAY'
                        : ground ? this.forThisPilot('THAT IS ON THE GROUND - PRESS 3 FOR BOMBS, OR 4 FOR A HARM AT A SAM')
                            : 'THE PLANE IS LINING UP - WAIT FOR "FIRE NOW"',
                1.4, 'EASY');
            soundFX.playRelayClick();
            this.easyNotYetCooldown = 1.2;
        }
    }

    /**
     * A STANDARD pilot who has lost two jets in one run is offered EASY, once,
     * in plain words - the guidelines' "hints after repeated failure", and the
     * same in-context pattern as the stick-flip offer. Never repeated, never
     * shown on EASY, and it changes nothing until the pilot says so.
     */
    private offerEasyIfStruggling() {
        if (this.easyMode || this.easyOffered || this.score.breakdown.airframesLost < 2) return;
        this.easyOffered = true;
        // A phone has no ESC key: say where its menu is.
        this.callouts.push('HAVING A HARD TIME?', 'MODE',
            this.controlScheme === 'TOUCH'
                ? 'TAP THE MENU BUTTON (TOP RIGHT) AND TURN ON EASY FLYING - THE PLANE FLIES ITSELF'
                : 'PRESS ESC AND TURN ON EASY FLYING - THE PLANE FLIES ITSELF, YOU FIRE', 4.5, 'EASY');
        this.deck.log('TIP: EASY FLYING (ESC MENU) LETS THE PLANE FLY AND AIM ITSELF - YOU ONLY FIRE.');
    }

    /** What the smart trigger would do right now. */
    private easyTriggerChoice() {
        const d = this.tracker.designated();
        return easyTrigger({
            target: d ? {
                kind: d.target.kind,
                inMissileEnvelope: d.inMissileEnvelope,
                inGunEnvelope: d.inGunEnvelope,
                range: d.range,
                aspect: d.aspect
            } : null,
            sidewinders: this.physics.loadout.sidewinders,
            missileInbound: !!d && this.weapons.missiles.some(m => m.targetId === d.target.id),
            gunRounds: this.physics.loadout.vulcanAmmo,
            heavyWeaponSelected: this.selectedWeapon === 'BOMB' || this.selectedWeapon === 'HARM'
        });
    }

    // -----------------------------------------------------------------
    // SCRAMBLE (v2.0.0) - see core/Scramble.ts
    // -----------------------------------------------------------------

    /** Missiles armed and selected: a beginner's first SPACE should be a kill. */
    private armScrambleJet() {
        this.physics.loadout = { ...SCRAMBLE_LOADOUT };
        this.countermeasures = createCountermeasureState(SCRAMBLE_LOADOUT.chaff);
        this.selectedWeapon = 'AIM9';
    }

    /**
     * The moment a run passes the score it was chasing (v2.3.0). Once a run:
     * a challenger's score earns "YOU BEAT ANNA!", the pilot's own best earns
     * NEW PERSONAL BEST - while it is happening, which is when it feels like
     * something.
     */
    private checkScoreTarget() {
        const t = this.scoreTarget;
        if (!t) return;
        // Live, both ways: a penalty can take the score back under the line,
        // and then the chip says so rather than claim a win the debrief will
        // deny. The banner and the fanfare happen once a run.
        this.scoreTargetPassed = this.score.totalScore > t.score;
        if (!this.scoreTargetPassed || this.scoreTargetCelebrated) return;
        this.scoreTargetCelebrated = true;
        const pts = t.score.toLocaleString('en-US');
        if (t.challenge) {
            this.callouts.push(t.who === 'A FRIEND' ? 'CHALLENGE BEATEN!' : `YOU BEAT ${t.who}!`, 'PRAISE',
                `PAST ${pts} PTS - KEEP GOING`, 2.8, 'RECORD');
        } else {
            this.callouts.push('NEW PERSONAL BEST!', 'PRAISE', `PAST ${pts} PTS - KEEP GOING`, 2.8, 'RECORD');
        }
        soundFX.playFanfare(6);
        this.flash(THEME.caution, 0.25);
    }

    private updateScramble(dt: number) {
        const s = this.scramble;
        if (!s || this.dying) return;
        // Fuel is not the game here.
        if (this.physics.fuel < 1500) this.physics.fuel = 1500;
        // EASY: the rails slowly refill, so a pilot never runs dry mid-wave.
        if (this.easyMode && this.physics.loadout.sidewinders < SCRAMBLE.maxSidewinders) {
            s.trickle += dt;
            if (s.trickle >= EASY_TUNING.missileTrickleSeconds) {
                s.trickle = 0;
                this.physics.loadout.sidewinders++;
            }
        }

        // A bomber that reaches the boat hits it and is gone - the cost of
        // chasing the wrong contact, in the one currency this mode keeps.
        for (const t of this.airborneTargets) {
            if (!t.isAlive || !isBomber(t)) continue;
            if (Math.hypot(t.position.x, t.position.z) > SCRAMBLE.bomberStrikeRadius) continue;
            t.isAlive = false;
            s.leaked++;
            const dmg = Math.round(SCRAMBLE.bomberHullDamage * (this.easyMode ? EASY_TUNING.carrierDamage : 1));
            this.deck.inventory.carrierHealth = Math.max(0, this.deck.inventory.carrierHealth - dmg);
            this.score.recordHullDamage(dmg);
            this.deck.log(`CRITICAL: ${t.name} REACHED CV-68! -${dmg}% HULL.`);
            this.callouts.push('CARRIER HIT', 'LOSS', `-${dmg}% HULL · A BOMBER GOT THROUGH`);
            this.weapons.spawnExplosion({ x: 0, y: 30, z: 0 }, 30, '#ff6600');
            soundFX.playExplosion(this.placeAt({ x: 0, y: 20, z: 0 }));
            soundFX.playMasterCaution();
            this.shake(SHAKE_SOURCES.damageTaken * 0.6);
        }

        if (s.breather > 0) {
            s.breather -= dt;
            if (s.breather <= 0) this.spawnScrambleWave();
            return;
        }

        if (this.airborneTargets.some(t => t.isAlive)) {
            s.waveSeconds += dt;
            s.clearTimer = 0;
            if (s.waveSeconds < SCRAMBLE.waveTimeoutSeconds) return;
            // Safety net: whatever is left turns for home. No points for it,
            // but the run moves on.
            for (const t of this.airborneTargets) t.isAlive = false;
            s.bugOut = true;
            this.callouts.push('BANDITS BUGGING OUT', 'MODE', 'THE REST OF THE WAVE TURNED FOR HOME', 2.2, 'WAVE');
            return;
        }
        // Let the last kill have its moment - banner, ring, hit-stop - before
        // the wave-clear payout lands on top of it.
        s.clearTimer += dt;
        if (s.clearTimer < GameLoop.WAVE_CLEAR_BEAT) return;
        s.clearTimer = 0;

        // Three ways a wave ends (v2.2.0). CLEARED: every contact shot down -
        // the full bonus. HELD: some shot down, but a bomber reached the boat
        // or the rest bugged out - it counts, without the speed bonus. OVER:
        // nothing shot down - it does not count. A wave let through used to
        // pay the same as one shot down, so a run that never fired earned the
        // CLEAR WAVE 5 star and a SUCCESS debrief.
        const won = !s.bugOut && s.leaked === 0;
        const held = s.waveKills > 0;
        const leaked = s.leaked;
        const bugOut = s.bugOut;
        const bonus = won ? waveClearBonus(s.wave, s.waveSeconds) : 0;
        s.bugOut = false;
        s.leaked = 0;
        s.waveKills = 0;
        if (held) {
            s.wavesCleared++;
            this.score.recordWaveSurvived();
        }
        this.score.recordBonus(bonus);
        const rearmed = rearmAfterWave(this.physics.loadout, this.physics.damage);
        this.physics.loadout = rearmed.loadout;
        this.physics.damage = rearmed.damage;
        // The rails are loaded again; so is the weapon a beginner fires best.
        if (this.selectedWeapon === 'GUN' && this.physics.loadout.sidewinders > 0) this.selectedWeapon = 'AIM9';
        this.lastCautionDamage = this.physics.damage;
        const got = leaked > 0 ? `${leaked} REACHED THE SHIP` : bugOut ? 'THE REST TURNED FOR HOME' : '';
        if (won) {
            this.callouts.push(`WAVE ${s.wave} CLEARED`, 'PRAISE',
                `+${bonus + SCORE_VALUES.WAVE_SURVIVED} PTS · REARMED & PATCHED`, 2.6, 'WAVE');
            this.deck.log(`WAVE ${s.wave} CLEARED IN ${Math.round(s.waveSeconds)} S. +${bonus} BONUS.`);
            soundFX.playFanfare(Math.min(12, s.wave));
            this.flash(THEME.phosphor, 0.2);
        } else if (held) {
            this.callouts.push(`WAVE ${s.wave} HELD`, 'MODE',
                `+${SCORE_VALUES.WAVE_SURVIVED} PTS · ${got} · REARMED`, 2.6, 'WAVE');
            this.deck.log(`WAVE ${s.wave} HELD - ${got}.`);
            soundFX.playUiSelect();
        } else {
            this.callouts.push(`WAVE ${s.wave} OVER`, 'LOSS',
                `NONE SHOT DOWN${got ? ` · ${got}` : ''} · REARMED`, 2.6, 'WAVE');
            this.deck.log(`WAVE ${s.wave} OVER - NONE SHOT DOWN.`);
        }
        s.breather = SCRAMBLE.breatherSeconds;
    }

    /** Turn the next wave's specs into contacts placed round the jet. */
    private spawnScrambleWave() {
        const s = this.scramble;
        if (!s) return;
        s.wave++;
        s.waveSeconds = 0;
        s.bugOut = false;
        s.leaked = 0;
        s.waveKills = 0;
        const spec = scrambleWave(s.wave, s.seed, this.easyMode);
        s.brief = this.controlScheme === 'TOUCH' ? touchWording(spec.brief) : spec.brief;

        const p = this.physics.position;
        const yaw = this.physics.yaw;
        this.airborneTargets = spec.spawns.map((sp, i) => {
            const a = spawnReference(sp.type, p, yaw) + sp.bearingDeg * (Math.PI / 180);
            const bomber = sp.type === 'BOMBER';
            const placed = { x: p.x + Math.sin(a) * sp.rangeM, z: p.z + Math.cos(a) * sp.rangeM };
            const { x, z } = bomber ? keepClearOfBoat(placed.x, placed.z) : placed;
            const ground = this.terrain.getElevation(x, z);
            const y = Math.max(ground + 250, p.y + sp.altOffsetM, 300);
            const speed = bomber ? 190 : 185;
            // Fighters come for the jet; bombers go for the boat.
            const tx = bomber ? -x : p.x - x;
            const tz = bomber ? -z : p.z - z;
            const h = Math.hypot(tx, tz) || 1;
            return {
                id: `W${s.wave}-${bomber ? 'TU-22' : 'MIG'}-${i}`,
                name: bomber ? 'Tu-22M BACKFIRE' : `MiG-23 FLOGGER #${i + 1}`,
                position: { x, y, z },
                velocity: { x: (tx / h) * speed, y: 0, z: (tz / h) * speed },
                isAlive: true,
                passive: sp.passive,
                accuracy: fighterAccuracy(s.wave),
                huntsPlayer: !bomber && !sp.passive
            };
        });
        // Every wave is auto-locked again: picking a target is a skill this
        // mode teaches later (T), not a gate in front of the first shot.
        this.hasInitialTargetAcquired = false;
        this.manualTargetCleared = false;
        this.callouts.push(`WAVE ${s.wave}`, 'PRAISE', s.brief, 2.6, 'WAVE');
        this.deck.log(`WAVE ${s.wave} INBOUND: ${s.brief}.`);
        soundFX.playUiSelect();
    }

    /**
     * Back in the fight after a loss: same patch of sky, a safe height,
     * nose on the nearest bandit, a fresh magazine. The deck - and its
     * progress bar - is no part of this mode.
     */
    private respawnScramble() {
        const jetsLeft = this.jetsThisRun() - this.score.breakdown.airframesLost;
        if (jetsLeft <= 0) {
            // The failure condition ends the run on the next tick.
            this.deck.aircraftState = 'HANGAR_MAINTENANCE';
            return;
        }
        const was = { ...this.physics.position };
        this.hotStartAirborne();
        const ground = this.terrain.getElevation(was.x, was.z);
        const nearest = this.airborneTargets
            .filter(t => t.isAlive)
            .sort((a, b) => Math.hypot(a.position.x - was.x, a.position.z - was.z)
                - Math.hypot(b.position.x - was.x, b.position.z - was.z))[0];
        const yaw = nearest ? Math.atan2(nearest.position.x - was.x, nearest.position.z - was.z) : 0;
        this.physics.position = { x: was.x, y: Math.max(ground + 600, 800), z: was.z };
        this.physics.yaw = yaw;
        this.physics.velocity = { x: Math.sin(yaw) * 230, y: 0, z: Math.cos(yaw) * 230 };
        this.armScrambleJet();
        this.timeRewind.clearHistory();
        this.callouts.push(`JET ${this.jetsThisRun() - jetsLeft + 1} OF ${this.jetsThisRun()}`, 'MODE',
            jetsLeft === 1 ? 'LAST JET - MAKE IT COUNT' : 'BACK IN THE FIGHT', 2.2, 'WAVE');
    }

    private scrambleObjective(): ObjectiveStep {
        const s = this.scramble!;
        const jets = Math.max(0, this.jetsThisRun() - this.score.breakdown.airframesLost);
        const hull = Math.round(this.deck.inventory.carrierHealth);
        const status = `JETS ${jets} · HULL ${hull}%`;
        const alive = this.airborneTargets.filter(t => t.isAlive).length;
        if (s.wave === 0 || s.breather > 0 || alive === 0) {
            // The beat between a wave's end and its payout says how it ended.
            const ending = s.wave > 0 && s.breather <= 0;
            const won = !s.bugOut && s.leaked === 0;
            return {
                title: s.wave === 0 ? 'BANDITS INBOUND'
                    : ending ? `WAVE ${s.wave} ${won ? 'CLEARED' : 'OVER'}` : `WAVE ${s.wave + 1} INBOUND`,
                detail: s.wave === 0 ? `Weapons hot. ${status}`
                    : ending ? `${won ? 'Shot them all down.' : 'Rearming.'} ${status}` : `Rearmed and patched. ${status}`,
                urgency: 'NORMAL',
                waiting: true
            };
        }
        return {
            // Plain words (v2.1.0): "SHOOT DOWN 2 PLANES", not "SPLASH 2 BANDITS".
            title: `SHOOT DOWN ${alive} PLANE${alive === 1 ? '' : 'S'}`,
            detail: `WAVE ${s.wave} · ${s.brief} · ${status}`,
            key: 'SPACE',
            urgency: 'ACTION'
        };
    }

    /**
     * The shared payout for anything the player shoots down (aircraft and
     * SAMs; a bombed structure has its own payoff): extend the chain, bank
     * its bonus, put one escalating banner up (a chain replaces its own
     * previous banner rather than stacking), throw the ring and the points at
     * the wreck, and hold the world for a beat.
     */
    private payKill(position: Vector3, baseValue: number, soloLine: string, name: string) {
        const kill = this.combo.registerKill(baseValue);
        this.score.recordBonus(kill.bonus);
        // The share picture's moment: the best kill so far - the longest
        // chain, a bomber over a fighter - photographed a beat later, when
        // the fireball and the banner are up.
        const weight = kill.chain * 10 + baseValue / 100;
        if (this.scramble && weight >= this.momentWeight) {
            this.momentPendingWeight = weight;
            this.momentDueAt = this.elapsedSeconds + 0.3;
        }
        const chained = kill.chain >= 2;
        this.callouts.push(
            chained ? `${kill.label}  x${kill.multiplier}` : soloLine,
            'KILL',
            chained ? `+${baseValue + kill.bonus} PTS  ·  ${name}` : name,
            undefined,
            'KILL_CHAIN'
        );
        this.killFx.spawn(
            position,
            `+${baseValue + kill.bonus}${chained ? ` x${kill.multiplier}` : ''}`,
            chained ? THEME.caution : THEME.phosphor,
            chained ? 1 + Math.min(4, kill.chain - 1) * 0.35 : 1
        );
        this.hitStop = Math.max(this.hitStop, kill.chain >= 3 ? 0.16 : 0.09);
    }

    private onTargetDestroyed(destroyedTarget: AirborneTarget) {
        this.deck.log(`COMBAT REPORT: ${destroyedTarget.name} DESTROYED.`);
        this.score.recordKill(isBomber(destroyedTarget) ? 'BOMBER' : 'FIGHTER');

        this.sortieKills++;
        if (this.scramble) this.scramble.waveKills++;
        this.celebrate('FIRST_BLOOD');
        const base = isBomber(destroyedTarget) ? SCORE_VALUES.BOMBER : SCORE_VALUES.FIGHTER;
        this.payKill(destroyedTarget.position, base, splashLine(this.sortieKills), destroyedTarget.name);
        // A kill at knife-fighting range should rattle the canopy; one at
        // five kilometres is a flash on the horizon.
        this.shake(SHAKE_SOURCES.killConfirmed + blastTrauma(this.rangeTo(destroyedTarget.position), 900));
        this.flash(THEME.phosphor, 0.22);
        const meshLines = isBomber(destroyedTarget) ? this.bomberMesh.lines : this.mig23Mesh.lines;
        this.debris.spawnFromMesh(meshLines, destroyedTarget.position, destroyedTarget.velocity, '#ff4433', 24);
        soundFX.playKillConfirm(undefined, this.combo.chain);

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
            /**
             * Every step already pays off in the tactical log, which nobody
             * mid-manoeuvre is reading. v1.11.0: the same line also gets the
             * PRAISE banner and a confirmation tone, so completing the climb,
             * arming the autopilot, or splashing the drone actually feels
             * like something happened - see "let user have fun to play too"
             * in the v1.11.0 review.
             */
            this.callouts.push(shortCallout(callout), 'PRAISE');
            soundFX.playUiSelect();
        }

        const deckFailed = this.deck.missionState === 'FAILED';
        let outcome = deckFailed ? 'FAILED' : this.missionStatus.outcome;
        if (outcome === 'ACTIVE' || this.phase === 'DEBRIEF') return;
        // SCRAMBLE always ends with the jets or the boat gone; going down
        // after the fifth wave is a completed run, not a failed one.
        if (this.scramble && outcome === 'FAILED' && this.scramble.wavesCleared >= SCRAMBLE.clearWave) {
            outcome = 'SUCCESS';
        }

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
        this.recordProgression(outcome === 'SUCCESS');

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
        if (this.scramble) return this.scrambleObjective();
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

    /**
     * The hostile aircraft the coach should be talking about, from the
     * tracker's own solutions so "ahead" and "in range" mean exactly what the
     * HUD brackets mean.
     */
    private nearestBandit(): { ahead: boolean; locked: boolean; inRange: boolean } | null {
        let best: TargetSolution | null = null;
        for (const sol of this.tracker.solutions) {
            if (sol.target.kind !== 'AIR') continue;
            if (!best || sol.range < best.range) best = sol;
        }
        if (!best) return null;
        const locked = this.tracker.designated()?.target.id === best.target.id;
        return {
            ahead: best.aspect > 0.5 && best.range < 12000,
            locked,
            inRange: best.inMissileEnvelope || best.inGunEnvelope
        };
    }

    private buildHint(): Hint | null {
        // The deck's "press ENTER" prompt now lives in the orders panel, so
        // the ticker stays silent unless something actually needs attention.
        if (this.deck.aircraftState !== 'AIRBORNE' || this.dying) return null;

        const groundElevation = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
        // SCRAMBLE has no deck to come home to: no approach, trap or
        // return-to-carrier coaching, and damage is patched by clearing a wave.
        const scramble = this.scramble !== null;
        const contextual = getContextualHint({
            isStalled: this.physics.isStalled,
            rwrState: this.sensors.masterRwrState,
            altitudeAgl: this.physics.position.y - groundElevation,
            verticalSpeed: this.physics.velocity.y,
            fuel: this.physics.fuel,
            airSpeed: this.physics.airSpeed,
            damage: this.physics.damage,
            distanceToCarrier: scramble ? Number.POSITIVE_INFINITY : Math.hypot(this.physics.position.x, this.physics.position.z),
            isAirborne: true,
            // The trap-speed warning is for a recovery, not for the cat shot
            // that necessarily happens fast and at zero range from the boat.
            closingOnCarrier: !scramble && HUD.isOnApproach(this.physics),
            bayOpen: this.physics.bayOpen,
            gunsTracking: this.gunsWarningTimer > 0,
            bandit: this.nearestBandit()
        });

        // Safety first, then the training checkout, then routine coaching - and
        // routine coaching only when it does not contradict the objective strip.
        // See `arbitrateHint` for the measured case that made this necessary.
        let hint = scramble && contextual?.text.includes('RETURN TO CARRIER')
            ? { text: 'HEAVY DAMAGE - CLEAR THE WAVE TO PATCH THE JET', severity: contextual.severity }
            : contextual;
        if (this.easyMode) hint = easyHint(hint, this.easyTriggerChoice() !== 'NOT_YET');
        const chosen = arbitrateHint(
            hint,
            // EASY switched on part way through a checkout: its stick drills
            // no longer apply (v2.2.0 review).
            this.easyMode ? null : this.training.currentStep?.prompt ?? null,
            this.currentObjective()
        );
        // A phone gets the same order in words a thumb can follow.
        return chosen && this.controlScheme === 'TOUCH' ? { ...chosen, text: touchWording(chosen.text) } : chosen;
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
                },
                storedPalette() === null,
                storedPitchInversion() === null,
                {
                    medals: this.medals,
                    careerLine: this.career.runs > 0
                        ? (() => { const c = careerLevel(this.career.xp); return `CAREER LV ${c.level} · ${c.title}`; })()
                        : null,
                    challengeLine: this.challenge && this.scenario.setup.scramble ? challengeLine(this.challenge) : null,
                    textSizeLabel: textSizeSpec(this.textSize).label,
                    flyStyleLabel: this.easyMode ? 'EASY flying' : 'STANDARD flying',
                    // SCRAMBLE's jets follow the fly style: say how many.
                    lossLine: this.scenario.setup.scramble
                        ? `Losing all ${this.scrambleLives() === 3 ? 'three' : this.scrambleLives() === 5 ? 'five' : this.scrambleLives()} jets, or the carrier.`
                        : undefined
                }
            );
            if (this.challengeWelcomeOpen && this.challenge && !this.flyStyleChooserOpen) {
                drawChallengeWelcome(this.ctx, w, h, this.challenge, this.controlScheme === 'TOUCH', this.elapsedSeconds);
            }
            if (this.helpVisible) this.briefing.drawHelp(this.ctx, w, h, 'FLIGHT');
            if (this.flyStyleChooserOpen) {
                drawFlyStyleChooser(this.ctx, w, h, this.flyStyleChoice,
                    textSizeSpec(this.textSize).label, this.controlScheme === 'TOUCH');
            }
            return;
        }

        if (this.phase === 'DEBRIEF') {
            drawDebriefView(this.ctx, w, h, this.debriefData(), this.debriefAge);
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
                    touchMode: this.controlScheme === 'TOUCH',
                    touchReserveBottom: this.controlScheme === 'TOUCH'
                        ? Math.max(56, this.viewHeight - this.touchLayout.launch.y + 10)
                        : undefined,
                    touchReserveTopRight: this.controlScheme === 'TOUCH'
                        ? this.viewWidth - this.touchLayout.menu.x + 10
                        : undefined,
                    desktopMenuReserve: DESKTOP_MENU_BUTTON_RESERVE / (this.uiZoom || 1),
                    detail: this.hud.hudDensity === 'FIRST_FLIGHT' ? 'BRIEF' : 'FULL'
                },
                w, h, this.elapsedSeconds
            );
        }

        // Before any overlay and before the thumb controls: the share picture
        // shows the fight, not the buttons.
        if (this.momentDueAt > 0 && this.elapsedSeconds >= this.momentDueAt && this.currentView === 'MICRO_FLIGHT'
            && !this.menuOpen && !this.helpVisible && !this.awaitingRotation) {
            this.captureMoment();
        }

        if (this.helpVisible) {
            this.briefing.drawHelp(
                this.ctx,
                w,
                h,
                this.currentView === 'MICRO_FLIGHT' ? 'FLIGHT' : 'DECK'
            );
        }

        if (this.menuOpen) {
            drawPilotMenu(this.ctx, w, h, this.menuItems(), this.menuSelected, this.menuObjective());
        }

        if (this.controlScheme === 'TOUCH' && this.phase === 'ACTIVE' && !this.helpVisible && !this.menuOpen) {
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

    /** Keep a downscaled copy of the frame just drawn as the run's best moment. */
    private captureMoment() {
        this.momentDueAt = 0;
        const src = this.canvas;
        if (!src.width || !src.height) return;
        try {
            this.momentCanvas ??= globalThis.document?.createElement('canvas') ?? null;
            const c = this.momentCanvas;
            const ctx = c?.getContext('2d');
            if (!c || !ctx) return;
            const scale = Math.min(1, 960 / src.width);
            c.width = Math.round(src.width * scale);
            c.height = Math.round(src.height * scale);
            ctx.drawImage(src, 0, 0, c.width, c.height);
            this.moment = { image: c, width: c.width, height: c.height };
            this.momentWeight = this.momentPendingWeight;
        } catch {
            // A missing moment only means the card shows the radar scope.
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
            // The highest thumb control on either side: the stick zone, the
            // target and chaff buttons, and the top of the weapon column.
            bottom: Math.max(0, l.safe.y + l.safe.h - Math.min(
                l.stickZone.y,
                l.target.cy - l.target.r,
                l.chaff.cy - l.chaff.r,
                ...l.weapons.map(w => w.y)
            )),
            top: 0,
            // Between the two thumb clusters the bottom of the screen is free;
            // bottom-anchored readouts live there, just above the safe edge.
            bottomCentre: Math.max(0, this.viewHeight - (l.safe.y + l.safe.h)) + 10
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
            ammo: [loadout.vulcanAmmo, loadout.sidewinders, loadout.ironBombs, loadout.harms],
            chaff: loadout.chaff,
            missileInbound: this.sensors.masterRwrState === 'LAUNCH',
            throttle: this.physics.throttle,
            hasDesignation: this.tracker.designatedId !== null,
            fireArmed: this.deck.aircraftState === 'AIRBORNE',
            fireReady: this.deck.aircraftState === 'AIRBORNE' && this.shotIsGood(),
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

        // Padlock camera tracking target look-at
        const basis = VectorRenderer.basisVectors(this.physics.pitch, this.physics.yaw, this.physics.roll);
        const des = this.tracker.designated();
        const tgtPos = des ? des.target.position : null;
        const padlockOffset = this.padlock.update(frameDt, camPos, basis, tgtPos);

        const camPitch = this.physics.pitch + jolt.pitch + padlockOffset.pitchOffset;
        const camYaw = this.physics.yaw + jolt.yaw + padlockOffset.yawOffset;
        const camRoll = this.physics.roll + jolt.roll;

        // Phosphor decay instead of a hard clear: old strokes fade out over
        // ~60ms leaving authentic vector-CRT trails. This happens on the
        // OFFSCREEN world layer only, so HUD text stays crisp.
        this.renderer.decayClear(Math.min(0.1, Math.max(0.001, frameDt)), this.persistenceTau);

        this.drawHorizonAndSea(camPos, camPitch, camYaw, camRoll);

        // Speed streaks: how many of the pool show scales with airspeed, so a
        // slow approach is calm and a 500-knot pass is a blur. Thinned for
        // prefers-reduced-motion rather than removed - they are also the only
        // close-range motion cue over open water.
        this.streaks.update(camPos, this.physics.velocity);
        const streakShare = SpeedStreaks.intensity(this.physics.airSpeed) * (this.motion.shakeScale < 1 ? 0.3 : 1);
        const shown = Math.floor(this.streaks.points.length * streakShare);
        for (let i = 0; i < shown; i++) {
            const p = this.streaks.points[i];
            this.renderer.drawLine(p, SpeedStreaks.tail(p, this.physics.velocity),
                camPos, camPitch, camYaw, camRoll, WORLD.horizon, 1);
        }

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
                // Length and speed both come from SAM_MISSILE now, rather
                // than a hardcoded 480 duplicating tactics/MissileGuidance.ts.
                // A tuning change to the missile's speed used to silently
                // desync the drawn tracer's length from its real flight
                // path - the round would fly at one speed and paint itself
                // as though it flew at another.
                const tail: Vector3 = {
                    x: sam.missilePos.x - (sam.missileVel.x / SAM_MISSILE.speed) * SAM_MISSILE.tracerLength,
                    y: sam.missilePos.y - (sam.missileVel.y / SAM_MISSILE.speed) * SAM_MISSILE.tracerLength,
                    z: sam.missilePos.z - (sam.missileVel.z / SAM_MISSILE.speed) * SAM_MISSILE.tracerLength
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
        this.renderer.renderDebris(this.debris, camPos, camPitch, camYaw, camRoll);

        // Composite world + bloom to the visible canvas, THEN draw the HUD
        // crisply on top so persistence never smears the symbology.
        this.post.composite(this.ctx);

        if (this.timeRewind.isRewindingEffect > 0) {
            this.flash('#00e5ff', this.timeRewind.isRewindingEffect * 0.8);
        }

        drawKillFx(this.ctx, this.killFx, (p) => {
            const c = this.renderer.transformToCamera(p, camPos, camPitch, camYaw, camRoll);
            if (c.z < this.renderer.nearPlane) return null;
            const sp = this.renderer.projectCameraPoint(c);
            return { x: sp.x, y: sp.y, z: c.z };
        }, this.renderer.fov);

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
                scoreTarget: this.scoreTarget ? { ...this.scoreTarget, passed: this.scoreTargetPassed } : null,
                objective: this.currentObjective(),
                checklist: this.training.checklist(),
                strikeTargets: this.strikeTargets,
                bombImpactPoint: this.selectedWeapon === 'BOMB' && this.physics.loadout.ironBombs > 0
                    ? WeaponsSystem.predictBombImpact(this.physics, this.terrain)
                    : null,
                designated: this.tracker.designated(),
                isPadlocked: this.padlock.isPadlocked,
                pitchInverted: this.pitchInverted,
                rewindsRemaining: this.timeRewind.rewindsRemaining,
                goHere: this.goHereGoal(),
                assistLabel: this.easyMode ? 'EASY' : assistSpec(this.assistLevel).label,
                // EASY: the autopilot's own limits (ALPHA LIMIT...) are its
                // business, not a message for a pilot who is not flying.
                assistOverride: this.easyMode ? 'NONE' : this.assistOverride,
                callouts: this.callouts.active(),
                combo: { chain: this.combo.chain, multiplier: multiplierFor(this.combo.chain), fraction: this.combo.fraction },
                hitMarker: this.hitMarker,
                trapStamp: this.trapGrade,
                touchMode: this.controlScheme === 'TOUCH',
                touchReserve: this.controlScheme === 'TOUCH' ? this.hudReserve() : undefined,
                motion: this.motion,
                visibleContacts: this.visibility,
                terrainFollowing: this.terrainFollowing && this.effectiveAssist() === 'AUTO',
                // The JOIN cue ("get astern of the boat") is advice for a jet on
                // its way home. Shown from the catapult onward - where it used
                // to be, on phones, which default the recovery assist on - it
                // sat on top of CLIMB TO 2,500 FT: two orders at once. FINAL and
                // HANDOVER always show, because then the assist is flying.
                recovery: this.approachPhase === null
                    || (this.approachPhase === 'JOIN' && !this.isHomeward())
                    ? null
                    : {
                        text: approachCaption(approachGuidance(this.physics.position)),
                        handover: this.approachPhase === 'HANDOVER'
                    },
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

    /** Take up a shared challenge: SCRAMBLE, on the sharer's seed. */
    public acceptChallenge(challenge: Challenge | null) {
        this.challenge = challenge;
        // A friend's link opens on the friend's challenge, not the menu.
        this.challengeWelcomeOpen = challenge !== null;
        if (challenge) this.selectScenarioById('SCRAMBLE');
    }

    /** ACCEPT on the challenge screen: fly it (asking a newcomer how first). */
    public acceptChallengeWelcome() {
        if (!this.challengeWelcomeOpen) return;
        this.challengeWelcomeOpen = false;
        // The challenger flew EASY and this pilot has never been asked: fly
        // EASY too, without the question - the same fight, one tap sooner.
        // A STANDARD challenge still asks: a newcomer may well want EASY.
        if (this.challenge?.easy && this.shouldAskFlyStyle()) {
            this.flyStyleAnswered = true;
            this.setFlyStyle('EASY');
        }
        this.requestFlight('BRIEFING');
    }

    /** SEE ALL MISSIONS: the normal menu; SCRAMBLE still carries the challenge. */
    public closeChallengeWelcome() {
        if (!this.challengeWelcomeOpen) return;
        this.challengeWelcomeOpen = false;
        soundFX.playUiMove();
    }

    public confirmBriefing(seedOverride?: number) {
        if (this.phase !== 'BRIEFING') return;
        if (seedOverride === undefined && this.challenge && this.scenario.setup.scramble && !this.isDailyRun) {
            seedOverride = this.challenge.seed;
        }
        soundFX.playUiSelect();
        // Re-resolved per mission so a first completion graduates the player
        // to the full instruments - unless they have chosen a density already.
        this.hud.hudDensity = resolveHudDensity(this.hasCompletedAMission());
        // Build the world fresh from whatever the selector landed on.
        this.applyScenario(this.scenario, seedOverride);
        this.missionOutcome = 'ACTIVE';
        this.missionReason = null;
        this.phase = 'ACTIVE';
        this.post.hardClear();
    }

    public restartFromDebrief() {
        this.returnToBriefing();
    }

    /**
     * Back to mission select from wherever the player is - the debrief, or
     * (v1.11.0) an abandoned sortie via the pilot menu's MISSION_SELECT.
     * `restartFromDebrief` is kept as its own public method, unchanged, so
     * nothing that already called it has to know this now shares a body.
     */
    public returnToBriefing() {
        this.menuOpen = false;
        this.isNewBest = false;
        this.isMissionBest = false;
        this.isDailyRun = false;
        this.dailyRunDate = null;
        this.missionOutcome = 'ACTIVE';
        this.missionReason = null;
        this.phase = 'BRIEFING';
        this.currentView = 'MACRO_DECK';
        this.post.hardClear();
    }

    /** Fly the same sortie again from the deck, straight from the pilot menu. */
    public restartMission() {
        // A restart is the same fight again - the daily stays the daily, as
        // FLY AGAIN already did (it used to become an unrecorded random run).
        const daily = this.isDailyRun;
        this.returnToBriefing();
        if (daily) this.startDailySortie();
        else this.confirmBriefing();
    }

    // -----------------------------------------------------------------
    // Pilot menu (v1.11.0) - see PilotMenu.ts and PilotMenuView.ts
    // -----------------------------------------------------------------

    /** The menu's contents right now, most useful item first. */
    public menuItems(): PilotMenuItem[] {
        return pilotMenuItems({
            airborne: this.deck.aircraftState === 'AIRBORNE',
            onDeckReady: this.deck.aircraftState === 'CATAPULT_READY',
            autopilotFlying: this.effectiveAssist() === 'AUTO',
            recoveryOn: this.approachAssist,
            hudDensityLabel: HUD_DENSITY_LABEL[this.hud.hudDensity],
            muted: soundFX.muted,
            canRecover: this.scramble === null,
            musicOn: this.scramble !== null ? soundFX.musicEnabled : undefined,
            easyOn: this.easyMode,
            textSizeLabel: textSizeSpec(this.textSize).label
        });
    }

    /** The current objective, restated in plain words, for the menu's own panel. */
    public menuObjective(): { title: string; plain: string } {
        const objective = this.currentObjective();
        const plain = plainInstruction(objective.key, objective.title);
        return { title: objective.title, plain: this.controlScheme === 'TOUCH' ? touchWording(plain) : plain };
    }

    /** ESC, the DOM menu button, and the touch MENU button all call this. */
    public toggleMenu() {
        if (this.phase !== 'ACTIVE') return;
        this.helpVisible = false;
        this.menuOpen = !this.menuOpen;
        this.menuSelected = 0;
        soundFX.playUiMove();
    }

    public closeMenu() {
        this.menuOpen = false;
    }

    /** A mouse or touch point while the menu is open. Always consumes the click. */
    public handlePilotMenuClick(x: number, y: number): boolean {
        if (!this.menuOpen) return false;
        const items = this.menuItems();
        const layout = pilotMenuLayout(this.viewWidth, this.viewHeight, items.length);
        const hit = pilotMenuHitTest(x, y, layout);
        if (hit !== null) {
            this.menuSelected = hit;
            this.activateSelectedMenuItem();
        }
        return true;
    }

    public moveMenuSelection(delta: number) {
        this.menuSelected = wrapMenuIndex(this.menuSelected + delta, this.menuItems().length);
        soundFX.playUiMove();
    }

    public activateSelectedMenuItem() {
        const item = this.menuItems()[this.menuSelected];
        if (item) this.activateMenuItem(item.id);
    }

    /** What a menu item, whether picked by keyboard or clicked, actually does. */
    public activateMenuItem(id: PilotMenuItem['id']) {
        soundFX.playUiSelect();
        switch (id) {
            case 'RESUME':
                this.menuOpen = false;
                return;
            case 'LAUNCH':
                this.menuOpen = false;
                this.requestCatapultLaunch();
                return;
            case 'FLY_FOR_ME':
                this.assistLevel = this.assistLevel === 'AUTO' ? 'ASSIST' : 'AUTO';
                saveAssistLevel(this.assistLevel);
                this.menuOpen = false;
                return;
            case 'TAKE_ME_HOME':
                if (!this.approachAssist) this.toggleApproachAssist();
                this.menuOpen = false;
                return;
            case 'CONTROLS':
                this.menuOpen = false;
                this.helpVisible = true;
                return;
            case 'INSTRUMENTS':
                this.toggleHudDensity();
                return;
            case 'SOUND':
                soundFX.toggleMute();
                return;
            case 'MUSIC':
                soundFX.toggleMusic();
                return;
            case 'EASY':
                this.toggleFlyStyle();
                return;
            case 'TEXT_SIZE':
                this.cycleTextSize();
                return;
            case 'RESTART':
                this.restartMission();
                return;
            case 'MISSION_SELECT':
                this.returnToBriefing();
                return;
        }
    }

}
