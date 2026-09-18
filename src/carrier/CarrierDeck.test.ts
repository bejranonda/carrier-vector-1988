import { describe, it, expect, beforeEach } from 'vitest';
import { DeckManager, mulberry32, generateWave } from './DeckManager';

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
