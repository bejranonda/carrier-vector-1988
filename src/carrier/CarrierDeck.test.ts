import { describe, it, expect, beforeEach } from 'vitest';
import { DeckManager } from './DeckManager';

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

    it('should penalize airframe loss on empty-tank trap recovery', () => {
        const initialAirframes = deck.inventory.spareAirframes;
        deck.processTrapRecovery(0, false); // Dry fuel tanks

        expect(deck.inventory.spareAirframes).toBe(initialAirframes - 1);
        expect(deck.aircraftState).toBe('DAMAGED_REPAIR');
    });
});
