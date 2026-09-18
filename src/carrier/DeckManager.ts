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
        ironBombs: 2
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

    // Catapult launch countdown
    public catapultTimer: number = 0;

    constructor() {
        this.generateThreatTimeline();
    }

    private generateThreatTimeline() {
        this.strikeTimeline = [
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

            this.currentTaskProgress += (100 / 18) * speedMultiplier * dt; // 18 seconds base
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
            this.currentTaskProgress += (100 / 14) * combinedSpeed * dt; // 14 seconds base

            if (this.currentTaskProgress >= 100) {
                this.currentTaskProgress = 100;
                this.aircraftState = 'CATAPULT_READY';
                this.log('ARMING & REFUELING FINISHED. READY ON CATAPULT NO. 1.');
            }
        } else if (this.aircraftState === 'DAMAGED_REPAIR') {
            const mechCrew = this.crews.find(c => c.role === 'MECHANIC')!;
            const speed = (0.3 + 0.7 * (mechCrew.stamina / 100));
            mechCrew.stamina = Math.max(5, mechCrew.stamina - 6.0 * dt);

            this.currentTaskProgress += (100 / 30) * speed * dt; // 30s base
            if (this.currentTaskProgress >= 100) {
                this.currentTaskProgress = 0;
                this.aircraftState = 'ARMING_REFUELING';
                this.log('BATTLE DAMAGE REPAIRED. TRANSFERRED TO ARMING CREW.');
            }
        } else if (this.aircraftState === 'CATAPULT_LAUNCHING') {
            this.catapultTimer += dt;
            if (this.catapultTimer >= 2.5) {
                this.aircraftState = 'AIRBORNE';
                this.catapultTimer = 0;
                this.log('SHOT OFF CATAPULT! AIRBORNE ON COMBAT SORTIE.');
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
     * Recovery trap (landing back on carrier deck)
     */
    public processTrapRecovery(fuelRemaining: number, isDamaged: boolean) {
        if (fuelRemaining <= 0) {
            // Out of fuel crash landing
            this.inventory.spareAirframes = Math.max(0, this.inventory.spareAirframes - 1);
            this.inventory.carrierHealth = Math.max(0, this.inventory.carrierHealth - 10);
            this.aircraftState = 'DAMAGED_REPAIR';
            this.currentTaskProgress = 0;
            this.log('CRASH LANDING: DRY FUEL TANKS! FLIGHT DECK FOAM SPREAD.');
        } else if (isDamaged) {
            this.aircraftState = 'DAMAGED_REPAIR';
            this.currentTaskProgress = 0;
            this.log('3-WIRE TRAP CAUGHT. FLIGHT INTEGRITY COMPROMISED. REPAIRS QUEUED.');
        } else {
            this.aircraftState = 'HANGAR_MAINTENANCE';
            this.currentTaskProgress = 0;
            this.log('PERFECT 3-WIRE TRAP RECOVERY. TAXIING TO HANGAR ELEVATOR.');
        }
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
