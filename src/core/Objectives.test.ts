import { describe, it, expect } from 'vitest';
import { deckObjective, flightObjective, formatEta } from './Objectives';
import type { DeckObjectiveSnapshot, FlightObjectiveSnapshot } from './Objectives';

const deckBase: DeckObjectiveSnapshot = {
    aircraftState: 'CATAPULT_READY',
    taskProgressPct: 100,
    scrambleAlert: false,
    soonestEtaSeconds: 148,
    liveInboundCount: 3,
    spareAirframes: 4
};

const flightBase: FlightObjectiveSnapshot = {
    liveInboundCount: 2,
    soonestEtaSeconds: 200,
    airborneContacts: 4,
    fuel: 4000,
    damage: 0,
    distanceToCarrier: 9000,
    rwrState: 'SILENT'
};

describe('formatEta', () => {
    it('renders mm:ss and clamps at zero', () => {
        expect(formatEta(0)).toBe('0:00');
        expect(formatEta(65)).toBe('1:05');
        expect(formatEta(148)).toBe('2:28');
        expect(formatEta(-12)).toBe('0:00');
    });

    it('renders a placeholder when there is nothing inbound', () => {
        expect(formatEta(null)).toBe('--:--');
        expect(formatEta(Number.NaN)).toBe('--:--');
    });
});

describe('deckObjective', () => {
    it('names the launch key when the aircraft is on the catapult', () => {
        const o = deckObjective(deckBase);
        expect(o.key).toBe('ENTER');
        expect(o.urgency).toBe('ACTION');
        expect(o.waiting).toBeFalsy();
        expect(o.detail).toContain('2:28');
    });

    it('escalates to URGENT during a scramble alert', () => {
        expect(deckObjective({ ...deckBase, scrambleAlert: true }).urgency).toBe('URGENT');
    });

    it('tells the player they are WAITING, not stuck, during turnaround states', () => {
        for (const state of ['ARMING_REFUELING', 'HANGAR_MAINTENANCE', 'DAMAGED_REPAIR', 'RECOVERY_TRAP'] as const) {
            const o = deckObjective({ ...deckBase, aircraftState: state });
            expect(o.waiting, state).toBe(true);
        }
    });

    it('points an airborne player at the cockpit view', () => {
        const o = deckObjective({ ...deckBase, aircraftState: 'AIRBORNE' });
        expect(o.key).toBe('TAB');
        expect(o.detail).toContain('3 inbound packages');
    });

    it('covers every deck state (no state can fall through to undefined)', () => {
        const states = [
            'HANGAR_MAINTENANCE', 'ARMING_REFUELING', 'CATAPULT_READY',
            'CATAPULT_LAUNCHING', 'AIRBORNE', 'RECOVERY_TRAP', 'DAMAGED_REPAIR'
        ] as const;
        for (const aircraftState of states) {
            const o = deckObjective({ ...deckBase, aircraftState });
            expect(o.title.length, aircraftState).toBeGreaterThan(0);
            expect(o.detail.length, aircraftState).toBeGreaterThan(0);
        }
    });

    it('singularises the inbound count', () => {
        expect(deckObjective({ ...deckBase, aircraftState: 'AIRBORNE', liveInboundCount: 1 }).detail)
            .toContain('1 inbound package.');
    });
});

describe('flightObjective', () => {
    it('asks for an intercept while contacts are airborne', () => {
        const o = flightObjective(flightBase);
        expect(o.title).toBe('SPLASH 4 CONTACTS');
        expect(o.key).toBe('SPACE');
        expect(o.detail).toContain('3:20');
    });

    it('switches to breaking the lock when a missile is in the air', () => {
        const o = flightObjective({ ...flightBase, rwrState: 'LAUNCH' });
        expect(o.urgency).toBe('URGENT');
        expect(o.detail).toMatch(/ridge line/i);
    });

    // Getting home IS the objective once you are shot up or out of gas, so it
    // has to outrank the intercept - otherwise the HUD keeps telling a pilot
    // with 10% airframe left to press on.
    it('overrides the intercept when the airframe is badly damaged', () => {
        const o = flightObjective({ ...flightBase, damage: 75 });
        expect(o.title).toBe('RETURN TO THE BOAT');
        expect(o.urgency).toBe('URGENT');
    });

    it('overrides the intercept at bingo fuel', () => {
        const o = flightObjective({ ...flightBase, fuel: 500 });
        expect(o.title).toContain('BINGO FUEL');
    });

    it('switches to the trap once the area is clear and the boat is close', () => {
        const o = flightObjective({ ...flightBase, airborneContacts: 0, distanceToCarrier: 1200 });
        expect(o.title).toBe('TRAP ABOARD');
    });

    it('sends the player home when the area is clear but the boat is far', () => {
        const o = flightObjective({ ...flightBase, airborneContacts: 0, distanceToCarrier: 20000 });
        expect(o.title).toContain('RETURN TO CV-68');
        expect(o.urgency).toBe('NORMAL');
    });

    it('singularises a lone contact', () => {
        expect(flightObjective({ ...flightBase, airborneContacts: 1 }).title).toBe('SPLASH 1 CONTACT');
    });
});
