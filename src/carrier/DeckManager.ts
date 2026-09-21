/**
 * CARRIER VECTOR: 1988 - Macro Layer: Flight Deck & Logistics Engine
 * Implements:
 * - Resource stocks: JP-5 Fuel, 20mm Vulcan ammo, AIM-9, Mk.82 bombs, spare airframes
 * - Aircraft state machine: HANGAR_MAINTENANCE -> ARMING_REFUELING -> CATAPULT_READY -> AIRBORNE -> RECOVERY_TRAP -> DAMAGED_REPAIR
 * - Deck crew stamina and task queues (fatigue delays turnarounds)
 * - Dynamic Threat Director with inbound strike packages on a macro timeline
 * - Scramble alerts and carrier consequence accounting (damage, lost airframes)
 */

import type { AircraftLoadout } from '../flight/AircraftPhysics';
import type { DeckTiming } from '../core/Pacing';

export type AircraftDeckState =
    | 'HANGAR_MAINTENANCE'
    | 'ARMING_REFUELING'
    | 'CATAPULT_READY'
    | 'CATAPULT_LAUNCHING'
    | 'AIRBORNE'
    | 'RECOVERY_TRAP'
    | 'DAMAGED_REPAIR';

export interface DeckCrew {
    name: string;
    role: 'FUEL' | 'ORDNANCE' | 'MECHANIC' | 'CATAPULT';
    stamina: number; // 0 to 100
    staminaRegenRate: number;
    efficiency: number;
}

export interface InboundStrikePackage {
    id: string;
    description: string;
    aircraftType: 'MiG-23' | 'Tu-22';
    count: number;
    bearingDeg: number;
    etaSeconds: number;
    isIntercepted: boolean;
    hasAttacked: boolean;
}

export interface CarrierInventory {
    fuelLiters: number;
    vulcanRounds: number;
    sidewinders: number;
    ironBombs: number;
    spareAirframes: number;
    carrierHealth: number; // 0 to 100%
}

export type MissionState = 'ACTIVE' | 'FAILED';

/**
 * Pushing the deck crew past their ordinary pace.
 *
 * WHY THIS EXISTS
 * The deck's one real decision was made once, in the four seconds it takes
 * to set fuel and ordnance, and everything after that was watching a
 * progress bar with nothing left to choose. This is the second axis: a
 * choice with a cost, available on every turnaround rather than a special
 * mode, paid for in the same currency (crew stamina) the rest of the deck
 * already spends. Getting back in the fight three seconds sooner against a
 * turnaround that runs slower afterward is a real trade, not a free button.
 *
 * Gated on stamina HEADROOM rather than a per-task "already used" flag.
 * `aircraftState` enters a task-bearing state from half a dozen places
 * (a clean trap, a battle-damaged trap, a lost airframe with or without a
 * spare, the arcade fast-respawn path) and a flag would need resetting at
 * every one of them - miss one and rushing either never works or never stops
 * working. A crew whose stamina is already at the floor cannot be pushed
 * further no matter how it got there, which is the same rule stated once
 * instead of six times.
 */
export const RUSH_TUNING = {
    /** Progress, in percentage points, gained by one rush. */
    progressBoost: 20,
    /** Stamina burned from each crew member driving the rushed task. */
    staminaCost: 30,
    /**
     * Stamina a crew must be above to be pushed. Below this they are already
     * running on fumes from ordinary work, and pushing further would not be
     * a choice with a cost, it would be a crew injury waiting to be logged.
     */
    minStaminaToRush: 20
} as const;

export type RushRefusal = 'NO_ACTIVE_TASK' | 'CREW_EXHAUSTED';

export interface RushOutcome {
    applied: boolean;
    refusal?: RushRefusal;
    progressGained?: number;
    staminaCost?: number;
}

/**
 * How a scenario wants the threat director to behave.
 *
 * The director used to be hardcoded: a fixed three-package opening act, then
 * endless escalating waves, always. Selectable scenarios need to vary that -
 * a strike mission wants the sky quiet so the canyon run is the challenge, a
 * last-stand wants an immediate surge, and carrier qualification wants no
 * enemies at all. Everything here is optional and defaults to the original
 * behaviour.
 */
export interface ThreatProfile {
    /** Opening packages. An empty array means an undefended start. */
    openingTimeline?: InboundStrikePackage[];
    /** Generate a new, harder wave when the timeline empties. */
    endlessWaves?: boolean;
    /** Escalation starts here, so a scenario can open at wave 6 difficulty. */
    startWave?: number;
    /** PRNG seed for wave generation. */
    seed?: number;
    /** Starting stocks, merged over the defaults. */
    inventory?: Partial<CarrierInventory>;
    /** Payload the jet is armed with for the first sortie. */
    plannedLoadout?: AircraftLoadout;
    plannedFuel?: number;
    /**
     * Deck-crew task durations. Defaults to the original simulation timings,
     * so a caller that does not care about pacing gets exactly what this
     * state machine always did; `core/Pacing.ts` is what overrides them.
     */
    timing?: DeckTiming;
}

/**
 * Deterministic PRNG (mulberry32). Used for procedural strike waves so a
 * given seed always produces the same campaign — reproducible for testing,
 * still unpredictable to the player without a fixed seed choice.
 */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Generate an escalating procedural strike package wave. Deterministic given
 * the same waveNumber and rng state, so this is fully headlessly testable.
 * Wave 0 is never generated here — it is the hand-curated opening act
 * defined in generateOpeningTimeline().
 */
export function generateWave(waveNumber: number, rng: () => number): InboundStrikePackage[] {
    const packages: InboundStrikePackage[] = [];
    const numPackages = Math.min(4, 1 + Math.floor(waveNumber / 3));
    const baseEta = Math.max(80, 200 - waveNumber * 8); // tighter ETAs each wave, floor at 80s
    const bomberChance = Math.min(0.5, 0.15 + waveNumber * 0.03);
    const maxMigCount = Math.min(3, 1 + Math.floor(waveNumber / 2));

    for (let i = 0; i < numPackages; i++) {
        const isBomber = rng() < bomberChance;
        const aircraftType: 'MiG-23' | 'Tu-22' = isBomber ? 'Tu-22' : 'MiG-23';
        const count = aircraftType === 'MiG-23' ? 1 + Math.floor(rng() * maxMigCount) : 1;
        const bearingDeg = Math.floor(rng() * 360);
        const label = aircraftType === 'Tu-22' ? 'Tu-22M Backfire' : 'MiG-23 Flogger';

        packages.push({
            id: `W${waveNumber}-${i}`,
            description: `Inbound ${label}${count > 1 ? ` x${count}` : ''} - Wave ${waveNumber}`,
            aircraftType,
            count,
            bearingDeg,
            etaSeconds: baseEta + i * 45,
            isIntercepted: false,
            hasAttacked: false
        });
    }
    return packages;
}

export class DeckManager {
    public inventory: CarrierInventory = {
        fuelLiters: 180000,
        vulcanRounds: 12000,
        sidewinders: 24,
        ironBombs: 16,
        spareAirframes: 4,
        carrierHealth: 100
    };

    public aircraftState: AircraftDeckState = 'CATAPULT_READY';
    public currentTaskProgress: number = 100; // 0 to 100%
    public currentTaskDuration: number = 0;

    // Next sortie planned loadout
    public plannedLoadout: AircraftLoadout = {
        vulcanAmmo: 500,
        sidewinders: 4,
        ironBombs: 2,
        chaff: 12,
        harms: 2
    };
    public plannedFuel: number = 4800; // Liters

    // Deck Crews
    public crews: DeckCrew[] = [
        { name: 'Red Shirts', role: 'ORDNANCE', stamina: 90, staminaRegenRate: 1.5, efficiency: 1.0 },
        { name: 'Purple Shirts', role: 'FUEL', stamina: 85, staminaRegenRate: 1.5, efficiency: 1.0 },
        { name: 'Green Shirts', role: 'CATAPULT', stamina: 95, staminaRegenRate: 2.0, efficiency: 1.0 },
        { name: 'Brown Shirts', role: 'MECHANIC', stamina: 80, staminaRegenRate: 1.2, efficiency: 1.0 }
    ];

    // Threat Director
    public strikeTimeline: InboundStrikePackage[] = [];
    public scrambleAlert: boolean = false;
    public scrambleTimer: number = 0;
    public alertLog: string[] = ['CV-68 NIMITZ LOGISTICS ONLINE - NORWEGIAN SEA, 1988'];

    // Catapult launch countdown. This is the SINGLE authoritative clock for
    // the launch stroke — GameLoop reads it to drive the visual animation
    // rather than keeping a second, independently-advancing timer (the
    // original code had two clocks racing for the same 2.5s window, which
    // meant the animation-completion branch could be skipped on the exact
    // frame the state flipped to AIRBORNE).
    public catapultTimer: number = 0;
    public static readonly CATAPULT_STROKE_SEC = 2.5;

    // Recovery de-rig timer (RECOVERY_TRAP state)
    public trapDerigTimer: number = 0;
    /** The original de-rig duration, kept as the SIM-pacing default. */
    public static readonly TRAP_DERIG_SEC = 3.0;

    /**
     * How long each deck task takes. These were literals inside update() -
     * 18 s, 14 s, 30 s and TRAP_DERIG_SEC - which made the opening minute of
     * the game unmovable. The defaults here are those same numbers.
     */
    public timing: DeckTiming = {
        maintenanceSeconds: 18,
        armingSeconds: 14,
        repairSeconds: 30,
        derigSeconds: DeckManager.TRAP_DERIG_SEC
    };
    private pendingTrapOutcome: 'HANGAR' | 'REPAIR' = 'HANGAR';

    // Mission / campaign progression
    public missionState: MissionState = 'ACTIVE';
    public waveNumber: number = 0; // 0 = the scripted opening act
    private rng: () => number = mulberry32(1988);
    /** When false the director stops after the opening timeline is resolved. */
    public endlessWaves: boolean = true;

    constructor(profile: ThreatProfile = {}) {
        this.endlessWaves = profile.endlessWaves ?? true;
        this.waveNumber = profile.startWave ?? 0;
        this.rng = mulberry32(profile.seed ?? 1988);
        this.strikeTimeline = profile.openingTimeline
            ? profile.openingTimeline.map(p => ({ ...p }))
            : DeckManager.defaultOpeningTimeline();

        if (profile.timing) this.timing = { ...profile.timing };
        if (profile.inventory) Object.assign(this.inventory, profile.inventory);
        if (profile.plannedLoadout) this.plannedLoadout = { ...profile.plannedLoadout };
        if (profile.plannedFuel !== undefined) this.plannedFuel = profile.plannedFuel;
    }

    /**
     * The scripted opening act. Static so callers (the pacing layer in
     * GameLoop) can scale its ETAs before handing it back as an explicit
     * `openingTimeline`, rather than reaching inside a constructed deck.
     */
    public static defaultOpeningTimeline(): InboundStrikePackage[] {
        return [
            {
                id: 'STRIKE-1',
                description: 'Inbound MiG-23 Flogger pair',
                aircraftType: 'MiG-23',
                count: 2,
                bearingDeg: 35,
                etaSeconds: 150,
                isIntercepted: false,
                hasAttacked: false
            },
            {
                id: 'STRIKE-2',
                description: 'Inbound Tu-22M Backfire maritime bomber',
                aircraftType: 'Tu-22',
                count: 1,
                bearingDeg: 350,
                etaSeconds: 280,
                isIntercepted: false,
                hasAttacked: false
            },
            {
                id: 'STRIKE-3',
                description: 'Inbound MiG-23 sweep flight',
                aircraftType: 'MiG-23',
                count: 2,
                bearingDeg: 75,
                etaSeconds: 440,
                isIntercepted: false,
                hasAttacked: false
            }
        ];
    }

    public log(msg: string) {
        this.alertLog.unshift(`[T+${Math.floor(this.scrambleTimer)}s] ${msg}`);
        if (this.alertLog.length > 8) this.alertLog.pop();
    }

    /**
     * Deterministic tick-based simulation of deck queues, crew stamina, and threats
     */
    public update(dt: number) {
        this.scrambleTimer += dt;

        // 1. Crew stamina regeneration
        for (const crew of this.crews) {
            crew.stamina = Math.min(100, crew.stamina + crew.staminaRegenRate * dt);
        }

        // 2. Aircraft State Machine Progress
        if (this.aircraftState === 'HANGAR_MAINTENANCE') {
            const mechCrew = this.crews.find(c => c.role === 'MECHANIC')!;
            const speedMultiplier = (0.4 + 0.6 * (mechCrew.stamina / 100)) * mechCrew.efficiency;
            mechCrew.stamina = Math.max(10, mechCrew.stamina - 4.0 * dt);

            this.currentTaskProgress += (100 / this.timing.maintenanceSeconds) * speedMultiplier * dt;
            if (this.currentTaskProgress >= 100) {
                this.currentTaskProgress = 0;
                this.aircraftState = 'ARMING_REFUELING';
                this.log('MAINTENANCE COMPLETE. AIRCRAFT MOVED TO FLIGHT DECK.');
            }
        } else if (this.aircraftState === 'ARMING_REFUELING') {
            const fuelCrew = this.crews.find(c => c.role === 'FUEL')!;
            const ordCrew = this.crews.find(c => c.role === 'ORDNANCE')!;

            const fuelSpeed = (0.5 + 0.5 * (fuelCrew.stamina / 100));
            const ordSpeed = (0.5 + 0.5 * (ordCrew.stamina / 100));
            fuelCrew.stamina = Math.max(10, fuelCrew.stamina - 3.5 * dt);
            ordCrew.stamina = Math.max(10, ordCrew.stamina - 3.5 * dt);

            const combinedSpeed = Math.min(fuelSpeed, ordSpeed);
            this.currentTaskProgress += (100 / this.timing.armingSeconds) * combinedSpeed * dt;

            if (this.currentTaskProgress >= 100) {
                this.currentTaskProgress = 100;
                this.aircraftState = 'CATAPULT_READY';
                this.log('ARMING & REFUELING FINISHED. READY ON CATAPULT NO. 1.');
            }
        } else if (this.aircraftState === 'DAMAGED_REPAIR') {
            const mechCrew = this.crews.find(c => c.role === 'MECHANIC')!;
            const speed = (0.3 + 0.7 * (mechCrew.stamina / 100));
            mechCrew.stamina = Math.max(5, mechCrew.stamina - 6.0 * dt);

            this.currentTaskProgress += (100 / this.timing.repairSeconds) * speed * dt;
            if (this.currentTaskProgress >= 100) {
                this.currentTaskProgress = 0;
                this.aircraftState = 'ARMING_REFUELING';
                this.log('BATTLE DAMAGE REPAIRED. TRANSFERRED TO ARMING CREW.');
            }
        } else if (this.aircraftState === 'CATAPULT_LAUNCHING') {
            this.catapultTimer += dt;
            if (this.catapultTimer >= DeckManager.CATAPULT_STROKE_SEC) {
                this.aircraftState = 'AIRBORNE';
                this.catapultTimer = 0;
                this.log('SHOT OFF CATAPULT! AIRBORNE ON COMBAT SORTIE.');
            }
        } else if (this.aircraftState === 'RECOVERY_TRAP') {
            // De-rig on the angled deck before the jet is struck below. This
            // state existed in the type union from the start but was never
            // actually assigned — processTrapRecovery() used to jump
            // straight to HANGAR_MAINTENANCE/DAMAGED_REPAIR.
            this.trapDerigTimer += dt;
            this.currentTaskProgress = Math.min(100, (this.trapDerigTimer / this.timing.derigSeconds) * 100);
            if (this.trapDerigTimer >= this.timing.derigSeconds) {
                this.trapDerigTimer = 0;
                this.currentTaskProgress = 0;
                if (this.pendingTrapOutcome === 'REPAIR') {
                    this.aircraftState = 'DAMAGED_REPAIR';
                    this.log('AIRCRAFT STRUCK BELOW FOR BATTLE DAMAGE REPAIR.');
                } else {
                    this.aircraftState = 'HANGAR_MAINTENANCE';
                    this.log('AIRCRAFT STRUCK BELOW TO THE HANGAR DECK.');
                }
            }
        }

        // 3. Dynamic Threat Director Timeline
        let hasActiveThreatInPerimeter = false;

        for (const pkg of this.strikeTimeline) {
            if (pkg.isIntercepted || pkg.hasAttacked) continue;

            pkg.etaSeconds -= dt;

            // Scramble alert trigger at 130 seconds ETA (outer defense perimeter)
            if (pkg.etaSeconds <= 130 && pkg.etaSeconds > 0) {
                hasActiveThreatInPerimeter = true;
            }

            // Consequence accounting: Bomber arrives and strikes carrier!
            if (pkg.etaSeconds <= 0) {
                pkg.hasAttacked = true;
                if (pkg.aircraftType === 'Tu-22') {
                    const dmg = 35;
                    this.inventory.carrierHealth = Math.max(0, this.inventory.carrierHealth - dmg);
                    this.inventory.spareAirframes = Math.max(0, this.inventory.spareAirframes - 1);
                    this.log(`CRITICAL: Tu-22 AS-4 MISSILE HIT FLIGHT DECK! -${dmg}% HULL.`);
                } else {
                    const dmg = 15;
                    this.inventory.carrierHealth = Math.max(0, this.inventory.carrierHealth - dmg);
                    this.log(`WARNING: MiG-23 STRAFING RUN ON FLIGHT DECK! -${dmg}% HULL.`);
                }
            }
        }

        this.scrambleAlert = hasActiveThreatInPerimeter;

        // 4. Mission failure: the carrier itself can be knocked out of the fight.
        if (this.inventory.carrierHealth <= 0 && this.missionState === 'ACTIVE') {
            this.missionState = 'FAILED';
            this.log('CV-68 NIMITZ IS COMBAT INEFFECTIVE. MISSION FAILED.');
        }

        // 5. Procedural wave escalation. Once every package in the current
        // timeline is resolved (splashed or through), generate the next,
        // harder wave rather than leaving the player with nothing to do
        // after ~7 minutes.
        const allResolved = this.strikeTimeline.length > 0 &&
            this.strikeTimeline.every(p => p.isIntercepted || p.hasAttacked);
        if (allResolved && this.endlessWaves && this.missionState === 'ACTIVE') {
            this.waveNumber++;
            this.strikeTimeline = generateWave(this.waveNumber, this.rng);
            this.log(`NEW CONTACTS DETECTED. WAVE ${this.waveNumber} INBOUND.`);
        }
    }

    /**
     * Start catapult launch sequence, deducting loaded munitions from carrier inventory
     */
    public triggerCatapultLaunch(): boolean {
        if (this.aircraftState !== 'CATAPULT_READY') {
            this.log('LAUNCH ABORTED: AIRCRAFT NOT READY ON CATAPULT.');
            return false;
        }

        // Deduct inventory
        if (this.inventory.fuelLiters < this.plannedFuel) {
            this.log('WARNING: INSUFFICIENT JP-5 STOCKS. PARTIAL FUEL LOAD.');
            this.plannedFuel = Math.max(1000, this.inventory.fuelLiters);
        }
        this.inventory.fuelLiters -= this.plannedFuel;

        this.inventory.vulcanRounds = Math.max(0, this.inventory.vulcanRounds - this.plannedLoadout.vulcanAmmo);
        this.inventory.sidewinders = Math.max(0, this.inventory.sidewinders - this.plannedLoadout.sidewinders);
        this.inventory.ironBombs = Math.max(0, this.inventory.ironBombs - this.plannedLoadout.ironBombs);

        this.aircraftState = 'CATAPULT_LAUNCHING';
        this.catapultTimer = 0;
        this.log('CATAPULT NO. 1 PRESSURIZED. SHROUD RELEASE IN 2 SECONDS.');
        return true;
    }

    /**
     * Recovery trap (landing back on carrier deck). Always routes through
     * the RECOVERY_TRAP de-rig state first — the aircraft doesn't teleport
     * straight to the hangar or repair bay the instant the hook catches.
     */
    /**
     * Put a spare airframe on the catapult without running the full
     * hangar-and-rearm cycle, ready in roughly `readyInSeconds`.
     *
     * Losing a jet cost thirty-two seconds of watching progress bars before
     * the player could fly again - which punishes the mistake twice, once in
     * the score and once in the only currency a player actually has. The cost
     * of a loss stays exactly what it was (an airframe off the boat and the
     * score penalty); what goes is the waiting.
     */
    public scrambleSpareAirframe(readyInSeconds: number) {
        this.aircraftState = 'ARMING_REFUELING';
        this.catapultTimer = 0;
        this.trapDerigTimer = 0;
        // Arming advances at (100 / armingSeconds) x crew speed per second, so
        // starting this far along leaves about readyInSeconds of work.
        const remaining = (100 / this.timing.armingSeconds) * readyInSeconds;
        this.currentTaskProgress = Math.max(0, Math.min(100, 100 - remaining));
        this.log('SPARE AIRFRAME RANGED ON CAT 1. CREW WORKING HOT.');
    }

    public processTrapRecovery(fuelRemaining: number, isDamaged: boolean) {
        this.aircraftState = 'RECOVERY_TRAP';
        this.trapDerigTimer = 0;
        this.currentTaskProgress = 0;

        if (fuelRemaining <= 0) {
            // Out of fuel crash landing
            this.inventory.spareAirframes = Math.max(0, this.inventory.spareAirframes - 1);
            this.inventory.carrierHealth = Math.max(0, this.inventory.carrierHealth - 10);
            this.pendingTrapOutcome = 'REPAIR';
            this.log('CRASH LANDING: DRY FUEL TANKS! FLIGHT DECK FOAM SPREAD.');
        } else if (isDamaged) {
            this.pendingTrapOutcome = 'REPAIR';
            this.log('TRAP CAUGHT. FLIGHT INTEGRITY COMPROMISED. TAXIING FOR REPAIRS.');
        } else {
            this.pendingTrapOutcome = 'HANGAR';
            this.log('CLEAN TRAP RECOVERY. TAXIING TO HANGAR ELEVATOR.');
        }
    }

    /** Which crews a rush would push, for the given deck state. Empty outside a task. */
    private crewsWorking(state: AircraftDeckState): DeckCrew[] {
        switch (state) {
            case 'HANGAR_MAINTENANCE':
            case 'DAMAGED_REPAIR':
                return this.crews.filter(c => c.role === 'MECHANIC');
            case 'ARMING_REFUELING':
                return this.crews.filter(c => c.role === 'FUEL' || c.role === 'ORDNANCE');
            default:
                return [];
        }
    }

    /** Read-only: would `rushTurnaround()` do anything right now? For the HUD. */
    public canRush(): boolean {
        const crews = this.crewsWorking(this.aircraftState);
        return crews.length > 0 && crews.every(c => c.stamina > RUSH_TUNING.minStaminaToRush);
    }

    /**
     * Push the crew currently working the aircraft past their ordinary pace,
     * at the cost of the stamina that pace depends on. See the type doc above
     * for why this exists and why it is gated the way it is.
     */
    public rushTurnaround(): RushOutcome {
        const crews = this.crewsWorking(this.aircraftState);
        if (crews.length === 0) return { applied: false, refusal: 'NO_ACTIVE_TASK' };

        if (crews.some(c => c.stamina <= RUSH_TUNING.minStaminaToRush)) {
            return { applied: false, refusal: 'CREW_EXHAUSTED' };
        }

        for (const crew of crews) {
            crew.stamina = Math.max(0, crew.stamina - RUSH_TUNING.staminaCost);
        }
        this.currentTaskProgress = Math.min(100, this.currentTaskProgress + RUSH_TUNING.progressBoost);
        this.log('TURNAROUND RUSHED - CREW PUSHING PAST THE SAFE PACE.');
        return {
            applied: true,
            progressGained: RUSH_TUNING.progressBoost,
            staminaCost: RUSH_TUNING.staminaCost
        };
    }

    /**
     * Intercept an enemy strike package in air
     */
    public markStrikeIntercepted(strikeId: string) {
        const pkg = this.strikeTimeline.find(s => s.id === strikeId);
        if (pkg) {
            pkg.isIntercepted = true;
            this.log(`SPLASH ENEMY STRIKE: ${pkg.description} ELIMINATED!`);
        }
    }
}
