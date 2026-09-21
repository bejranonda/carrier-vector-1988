import { describe, it, expect, beforeEach } from 'vitest';
import { DeckManager, RUSH_TUNING, mulberry32, generateWave } from './DeckManager';

describe('Carrier Deck Logistics Engine', () => {
    let deck: DeckManager;

    beforeEach(() => {
        deck = new DeckManager();
    });

    it('should initialize with standard Carrier Strike Group inventory', () => {
        expect(deck.inventory.fuelLiters).toBeGreaterThanOrEqual(100000);
        expect(deck.inventory.vulcanRounds).toBe(12000);
        expect(deck.inventory.sidewinders).toBe(24);
        expect(deck.inventory.ironBombs).toBe(16);
        expect(deck.inventory.spareAirframes).toBe(4);
    });

    it('should progress through aircraft state machine from maintenance to catapult ready', () => {
        deck.aircraftState = 'HANGAR_MAINTENANCE';
        deck.currentTaskProgress = 0;

        // Advance 20 seconds
        deck.update(20);
        expect(deck.aircraftState).toBe('ARMING_REFUELING');

        // Advance another 20 seconds
        deck.update(20);
        expect(deck.aircraftState).toBe('CATAPULT_READY');
    });

    it('should deduct munitions and fuel from inventory upon launch', () => {
        deck.aircraftState = 'CATAPULT_READY';
        const startFuel = deck.inventory.fuelLiters;
        const startAmmo = deck.inventory.vulcanRounds;
        const startSidewinders = deck.inventory.sidewinders;

        const launched = deck.triggerCatapultLaunch();
        expect(launched).toBe(true);
        expect(deck.aircraftState).toBe('CATAPULT_LAUNCHING');

        expect(deck.inventory.fuelLiters).toBe(startFuel - deck.plannedFuel);
        expect(deck.inventory.vulcanRounds).toBe(startAmmo - deck.plannedLoadout.vulcanAmmo);
        expect(deck.inventory.sidewinders).toBe(startSidewinders - deck.plannedLoadout.sidewinders);
    });

    it('should activate scramble alert when threats enter outer defense perimeter', () => {
        expect(deck.scrambleAlert).toBe(false);

        // Strike 1 has ETA 150s. Advance 30s so ETA is 120s (<= 130s)
        deck.update(30);
        expect(deck.scrambleAlert).toBe(true);
    });

    it('should inflict carrier deck damage if an enemy bomber reaches the carrier without interception', () => {
        const initialHealth = deck.inventory.carrierHealth;
        // Advance time until Bomber (Strike 2, ETA 280) strikes
        deck.update(285);

        expect(deck.inventory.carrierHealth).toBeLessThan(initialHealth);
        expect(deck.inventory.spareAirframes).toBeLessThan(4);
    });

    it('should penalize airframe loss on empty-tank trap recovery, then rig through RECOVERY_TRAP to DAMAGED_REPAIR', () => {
        const initialAirframes = deck.inventory.spareAirframes;
        deck.processTrapRecovery(0, false); // Dry fuel tanks

        expect(deck.inventory.spareAirframes).toBe(initialAirframes - 1);
        // RECOVERY_TRAP was declared in the state union from the start but
        // was never actually reachable - processTrapRecovery() used to jump
        // straight to the terminal state. It must now be a real de-rig step.
        expect(deck.aircraftState).toBe('RECOVERY_TRAP');

        deck.update(DeckManager.TRAP_DERIG_SEC + 0.1);
        expect(deck.aircraftState).toBe('DAMAGED_REPAIR');
    });

    it('should rig a clean recovery through RECOVERY_TRAP to HANGAR_MAINTENANCE', () => {
        deck.processTrapRecovery(2000, false); // fuel remaining, undamaged
        expect(deck.aircraftState).toBe('RECOVERY_TRAP');

        deck.update(DeckManager.TRAP_DERIG_SEC + 0.1);
        expect(deck.aircraftState).toBe('HANGAR_MAINTENANCE');
    });

    it('should fail the mission once carrier hull integrity reaches zero', () => {
        expect(deck.missionState).toBe('ACTIVE');
        deck.inventory.carrierHealth = 5;
        // Force Strike-2 (Tu-22, 35% damage) to resolve immediately.
        deck.strikeTimeline[1].etaSeconds = 0.01;
        deck.update(0.02);

        expect(deck.inventory.carrierHealth).toBe(0);
        expect(deck.missionState).toBe('FAILED');
    });

    it('should escalate to a new procedural wave once every package in the timeline is resolved', () => {
        expect(deck.waveNumber).toBe(0);
        for (const pkg of deck.strikeTimeline) {
            deck.markStrikeIntercepted(pkg.id);
        }
        deck.update(0.1);

        expect(deck.waveNumber).toBe(1);
        expect(deck.strikeTimeline.length).toBeGreaterThan(0);
        expect(deck.strikeTimeline.every(p => !p.isIntercepted && !p.hasAttacked)).toBe(true);
    });

    it('should not spawn a new wave once the mission has failed', () => {
        deck.inventory.carrierHealth = 1;
        deck.strikeTimeline[1].etaSeconds = 0.01;
        deck.update(0.02); // triggers hull failure
        expect(deck.missionState).toBe('FAILED');

        for (const pkg of deck.strikeTimeline) {
            pkg.isIntercepted = true;
        }
        const waveBefore = deck.waveNumber;
        deck.update(0.1);
        expect(deck.waveNumber).toBe(waveBefore);
    });
});

describe('mulberry32 deterministic PRNG', () => {
    it('produces the same sequence for the same seed', () => {
        const a = mulberry32(1988);
        const b = mulberry32(1988);
        const seqA = [a(), a(), a(), a()];
        const seqB = [b(), b(), b(), b()];
        expect(seqA).toEqual(seqB);
    });

    it('produces different sequences for different seeds', () => {
        const a = mulberry32(1);
        const b = mulberry32(2);
        expect(a()).not.toBe(b());
    });

    it('always returns values in [0, 1)', () => {
        const rng = mulberry32(42);
        for (let i = 0; i < 200; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});

describe('generateWave procedural escalation', () => {
    it('is deterministic given the same rng state', () => {
        const waveA = generateWave(3, mulberry32(7));
        const waveB = generateWave(3, mulberry32(7));
        expect(waveA).toEqual(waveB);
    });

    it('escalates package count as waveNumber grows', () => {
        const early = generateWave(0, mulberry32(1)).length;
        const late = generateWave(9, mulberry32(1)).length;
        expect(late).toBeGreaterThanOrEqual(early);
    });

    it('tightens ETAs as waveNumber grows (never below the 80s floor)', () => {
        const early = generateWave(1, mulberry32(1));
        const late = generateWave(20, mulberry32(1));
        expect(late[0].etaSeconds).toBeLessThanOrEqual(early[0].etaSeconds);
        expect(late[0].etaSeconds).toBeGreaterThanOrEqual(80);
    });

    it('always produces packages with valid aircraft types and non-negative counts', () => {
        const wave = generateWave(12, mulberry32(99));
        for (const pkg of wave) {
            expect(['MiG-23', 'Tu-22']).toContain(pkg.aircraftType);
            expect(pkg.count).toBeGreaterThanOrEqual(1);
            expect(pkg.isIntercepted).toBe(false);
            expect(pkg.hasAttacked).toBe(false);
        }
    });
});

describe('DeckManager operational tempo', () => {
    /** Run the state machine for `seconds` of simulated time at 60 Hz. */
    function run(deck: DeckManager, seconds: number) {
        const dt = 1 / 60;
        for (let i = 0; i < Math.round(seconds / dt); i++) deck.update(dt);
    }

    it('uses the original simulation timings when no pacing is injected', () => {
        const deck = new DeckManager();
        expect(deck.timing).toEqual({
            maintenanceSeconds: 18,
            armingSeconds: 14,
            repairSeconds: 30,
            derigSeconds: DeckManager.TRAP_DERIG_SEC
        });
    });

    it('honours injected deck timings', () => {
        const deck = new DeckManager({
            timing: { maintenanceSeconds: 4, armingSeconds: 5, repairSeconds: 8, derigSeconds: 1.5 }
        });
        deck.aircraftState = 'HANGAR_MAINTENANCE';
        deck.currentTaskProgress = 0;

        // Crew speed scales with stamina, so this is "well under the 18s the
        // simulation timing would have taken", not an exact stopwatch.
        run(deck, 8);
        expect(deck.aircraftState).not.toBe('HANGAR_MAINTENANCE');
    });

    it('still takes the long way round under the simulation timings', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'HANGAR_MAINTENANCE';
        deck.currentTaskProgress = 0;
        run(deck, 8);
        expect(deck.aircraftState).toBe('HANGAR_MAINTENANCE');
    });

    it('scrambles a spare airframe to the catapult in seconds, not in a hangar cycle', () => {
        const deck = new DeckManager({
            timing: { maintenanceSeconds: 4, armingSeconds: 5, repairSeconds: 8, derigSeconds: 1.5 }
        });
        deck.aircraftState = 'HANGAR_MAINTENANCE';
        deck.currentTaskProgress = 0;

        deck.scrambleSpareAirframe(3);
        expect(deck.aircraftState).toBe('ARMING_REFUELING');

        run(deck, 5);
        expect(deck.aircraftState).toBe('CATAPULT_READY');
    });

    it('does not put a jet on the catapult instantly', () => {
        // The scramble removes the waiting, not the work: there is still a
        // beat on the deck, and the tactical situation moves during it.
        const deck = new DeckManager();
        deck.scrambleSpareAirframe(3);
        deck.update(1 / 60);
        expect(deck.aircraftState).toBe('ARMING_REFUELING');
    });

    it('clears the catapult and de-rig clocks when scrambling', () => {
        const deck = new DeckManager();
        deck.catapultTimer = 1.2;
        deck.trapDerigTimer = 0.8;
        deck.scrambleSpareAirframe(3);
        expect(deck.catapultTimer).toBe(0);
        expect(deck.trapDerigTimer).toBe(0);
    });
});

describe('rushing a turnaround', () => {
    it('does nothing with no task running', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'CATAPULT_READY';
        const before = deck.currentTaskProgress;
        const outcome = deck.rushTurnaround();
        expect(outcome).toEqual({ applied: false, refusal: 'NO_ACTIVE_TASK' });
        expect(deck.currentTaskProgress).toBe(before);
    });

    it('is unavailable in the air or on the catapult, where there is no crew to push', () => {
        const deck = new DeckManager();
        for (const state of ['AIRBORNE', 'CATAPULT_READY', 'CATAPULT_LAUNCHING', 'RECOVERY_TRAP'] as const) {
            deck.aircraftState = state;
            expect(deck.canRush(), state).toBe(false);
            expect(deck.rushTurnaround().refusal).toBe('NO_ACTIVE_TASK');
        }
    });

    it('advances the task and burns the crew stamina working it', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'ARMING_REFUELING';
        deck.currentTaskProgress = 10;
        const fuelCrew = deck.crews.find(c => c.role === 'FUEL')!;
        const ordCrew = deck.crews.find(c => c.role === 'ORDNANCE')!;
        const mechCrew = deck.crews.find(c => c.role === 'MECHANIC')!;
        const fuelBefore = fuelCrew.stamina;
        const ordBefore = ordCrew.stamina;
        const mechBefore = mechCrew.stamina;

        const outcome = deck.rushTurnaround();

        expect(outcome.applied).toBe(true);
        expect(deck.currentTaskProgress).toBe(10 + RUSH_TUNING.progressBoost);
        expect(fuelCrew.stamina).toBe(fuelBefore - RUSH_TUNING.staminaCost);
        expect(ordCrew.stamina).toBe(ordBefore - RUSH_TUNING.staminaCost);
        // Only the crews actually driving THIS task pay for it.
        expect(mechCrew.stamina).toBe(mechBefore);
    });

    it('pushes only the mechanic during maintenance and repair', () => {
        for (const state of ['HANGAR_MAINTENANCE', 'DAMAGED_REPAIR'] as const) {
            const deck = new DeckManager();
            deck.aircraftState = state;
            const mechCrew = deck.crews.find(c => c.role === 'MECHANIC')!;
            const fuelCrew = deck.crews.find(c => c.role === 'FUEL')!;
            const before = mechCrew.stamina;

            deck.rushTurnaround();

            expect(mechCrew.stamina, state).toBe(before - RUSH_TUNING.staminaCost);
            expect(fuelCrew.stamina, state).toBe(fuelCrew.stamina);
        }
    });

    it('never advances progress past 100', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'ARMING_REFUELING';
        deck.currentTaskProgress = 95;
        deck.rushTurnaround();
        expect(deck.currentTaskProgress).toBe(100);
    });

    /**
     * The whole point: a crew that is already spent cannot be pushed further.
     * Without this a rush is a free button rather than a choice with a cost.
     */
    it('refuses to push a crew already at or below the floor', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'ARMING_REFUELING';
        deck.crews.find(c => c.role === 'FUEL')!.stamina = RUSH_TUNING.minStaminaToRush;
        const before = deck.currentTaskProgress;

        const outcome = deck.rushTurnaround();

        expect(outcome).toEqual({ applied: false, refusal: 'CREW_EXHAUSTED' });
        expect(deck.currentTaskProgress).toBe(before);
        expect(deck.canRush()).toBe(false);
    });

    /**
     * No per-task lockout flag: the gate is stamina headroom alone, so a
     * crew that has recovered enough can be pushed again without any special
     * bookkeeping about which task it was pushed for.
     */
    it('allows a second rush once the crew has recovered enough headroom', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'ARMING_REFUELING';
        deck.currentTaskProgress = 0;

        deck.rushTurnaround();
        // Regenerate past the floor.
        for (const crew of deck.crews) crew.stamina = 100;

        const outcome = deck.rushTurnaround();
        expect(outcome.applied).toBe(true);
        expect(deck.currentTaskProgress).toBe(RUSH_TUNING.progressBoost * 2);
    });

    it('logs the rush for the alert panel', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'ARMING_REFUELING';
        deck.rushTurnaround();
        expect(deck.alertLog[0]).toContain('RUSHED');
    });

    it('never leaves stamina negative even from repeated pushes', () => {
        const deck = new DeckManager();
        deck.aircraftState = 'ARMING_REFUELING';
        for (let i = 0; i < 5; i++) {
            for (const crew of deck.crews) crew.stamina = Math.max(crew.stamina, RUSH_TUNING.minStaminaToRush + 1);
            deck.rushTurnaround();
        }
        for (const crew of deck.crews) expect(crew.stamina).toBeGreaterThanOrEqual(0);
    });
});

/**
 * A shielded (training) scenario's contacts are target drones.
 *
 * REGRESSION, v1.9.0: `combatShielded` ghosted every round the training MiG
 * fired at the player, but `updateDeckOperations` ran the package-reaches-the-
 * carrier damage path without consulting it. Measured on the live v1.8.0
 * build: a first-time pilot who pressed ENTER once and then read the deck
 * screen watched CV-68 go from 100% to 85% hull at T+20s - on the sortie whose
 * own tagline reads "Zero combat hostiles" and whose stated loss condition is
 * "Running out of fuel or ditching in the fjord".
 */
describe('combat-shielded scenarios', () => {
    /** Run the deck long enough for every opening package to reach ETA 0. */
    const runUntilPackagesLand = (d: DeckManager) => {
        for (let i = 0; i < 400; i++) d.update(1);
    };

    it('lets a drone complete its pass without damaging the carrier', () => {
        const shielded = new DeckManager();
        shielded.combatShielded = true;
        runUntilPackagesLand(shielded);

        expect(shielded.inventory.carrierHealth).toBe(100);
        expect(shielded.missionState).not.toBe('FAILED');
    });

    it('still damages the carrier in an ordinary combat scenario', () => {
        const live = new DeckManager();
        expect(live.combatShielded).toBe(false);
        runUntilPackagesLand(live);

        expect(live.inventory.carrierHealth).toBeLessThan(100);
    });

    /**
     * A shielded drone must stay on the board.
     *
     * `GameLoop.buildTargetsFromTimeline` skips any package with `hasAttacked`
     * set, and the tutorial's SPLASH THE DRONE phase completes on
     * `contactsAlive === 0` - so retiring the drone when its ETA expired would
     * let that phase satisfy itself for a pilot who never fired a shot.
     */
    it('keeps a shielded drone in the timeline instead of retiring it', () => {
        const shielded = new DeckManager();
        shielded.combatShielded = true;
        runUntilPackagesLand(shielded);

        const live = shielded.strikeTimeline.filter(p => !p.hasAttacked && !p.isIntercepted);
        expect(live.length).toBeGreaterThan(0);
        expect(shielded.strikeTimeline.every(p => !p.hasAttacked)).toBe(true);
        for (const p of live) expect(p.etaSeconds).toBeGreaterThan(0);
    });

    it('does not lose spare airframes to a shielded pass', () => {
        const shielded = new DeckManager();
        shielded.combatShielded = true;
        const before = shielded.inventory.spareAirframes;
        runUntilPackagesLand(shielded);

        expect(shielded.inventory.spareAirframes).toBe(before);
    });
});
