/**
 * CARRIER VECTOR: 1988 - "What do I do right now?" Director
 *
 * The single biggest comprehension gap in the game was that neither screen
 * ever stated the CURRENT objective. The deck screen showed eight panels of
 * inventory numbers with the only meaningful action ([ENTER]) as grey 12px
 * text in the footer; the cockpit showed twelve instruments and no goal.
 *
 * The contextual coach in Tutorial.ts answers "what is about to kill me".
 * This answers the different, always-present question: "what is this phase
 * of the game asking of me, and which key does it?"
 *
 * Pure logic, no canvas - so the phrasing is unit-testable.
 */

import type { AircraftDeckState } from '../carrier/DeckManager';

export interface ObjectiveStep {
    /** Imperative, 2-4 words. Rendered large. */
    title: string;
    /** One clause of why / how. Rendered small underneath. */
    detail: string;
    /** Key the player should press now, if any. Rendered as a keycap. */
    key?: string;
    /** True when the player must wait for the sim rather than act. */
    waiting?: boolean;
    urgency: 'NORMAL' | 'ACTION' | 'URGENT';
    /**
     * Seconds left on a scenario's clock. Rendered as a large countdown beside
     * the objective, because a deadline the player cannot see is not a
     * deadline - it is an ambush.
     */
    countdownSeconds?: number;
}

export interface DeckObjectiveSnapshot {
    aircraftState: AircraftDeckState;
    taskProgressPct: number;
    scrambleAlert: boolean;
    /** Seconds until the soonest un-intercepted package attacks, or null. */
    soonestEtaSeconds: number | null;
    liveInboundCount: number;
    spareAirframes: number;
}

export interface FlightObjectiveSnapshot {
    liveInboundCount: number;
    soonestEtaSeconds: number | null;
    /** Contacts currently airborne and alive in the tactical area. */
    airborneContacts: number;
    fuel: number;
    damage: number;
    distanceToCarrier: number;
    rwrState: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH';
}

/** mm:ss for a countdown, clamped at zero. */
export function formatEta(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds)) return '--:--';
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The deck loop is a state machine, so the objective is a direct function
 * of the state the aircraft is in. Waiting states say so explicitly
 * ("crews are working") rather than leaving the player pressing keys at a
 * screen that ignores them.
 */
export function deckObjective(s: DeckObjectiveSnapshot): ObjectiveStep {
    switch (s.aircraftState) {
        case 'CATAPULT_READY':
            return {
                title: 'LAUNCH NOW',
                detail: s.soonestEtaSeconds !== null
                    ? `Jet is armed and on Cat 1. Nearest inbound hits in ${formatEta(s.soonestEtaSeconds)}.`
                    : 'Jet is armed and on Cat 1.',
                key: 'ENTER',
                urgency: s.scrambleAlert ? 'URGENT' : 'ACTION'
            };

        case 'ARMING_REFUELING':
            return {
                title: 'CREWS ARE ARMING YOUR JET',
                detail: `Fuelling and loading ordnance - ${Math.floor(s.taskProgressPct)}% complete. Adjust the next sortie's payload while you wait.`,
                key: '1-4',
                waiting: true,
                urgency: 'NORMAL'
            };

        case 'HANGAR_MAINTENANCE':
            return {
                title: 'AIRCRAFT IN THE HANGAR',
                detail: `Bringing a fresh airframe up to the deck - ${Math.floor(s.taskProgressPct)}% complete. ${s.spareAirframes} spare airframes left.`,
                waiting: true,
                urgency: 'NORMAL'
            };

        case 'DAMAGED_REPAIR':
            return {
                title: 'BATTLE DAMAGE REPAIR',
                detail: `Mechanics are patching the airframe - ${Math.floor(s.taskProgressPct)}% complete.`,
                waiting: true,
                urgency: 'NORMAL'
            };

        case 'RECOVERY_TRAP':
            return {
                title: 'RECOVERING AIRCRAFT',
                detail: 'Aircraft is on the wire and being struck below for turnaround.',
                waiting: true,
                urgency: 'NORMAL'
            };

        case 'CATAPULT_LAUNCHING':
            return {
                title: 'CAT SHOT',
                detail: 'Hold on - the shuttle is taking you off the bow.',
                waiting: true,
                urgency: 'ACTION'
            };

        case 'AIRBORNE':
            return {
                title: 'YOU ARE AIRBORNE',
                detail: `Switch to the cockpit and intercept ${s.liveInboundCount} inbound package${s.liveInboundCount === 1 ? '' : 's'}.`,
                key: 'TAB',
                urgency: 'ACTION'
            };
    }
}

/**
 * Airborne, the objective walks the sortie: intercept -> then come home.
 * Fuel and damage override the intercept goal, because at that point going
 * home IS the objective, not a distraction from it.
 */
export function flightObjective(s: FlightObjectiveSnapshot): ObjectiveStep {
    const onApproach = s.distanceToCarrier < 3000;

    if (s.damage >= 60) {
        return {
            title: 'RETURN TO THE BOAT',
            detail: `Airframe at ${Math.round(100 - s.damage)}% - fly heading back to CV-68 and trap aboard.`,
            urgency: 'URGENT'
        };
    }

    if (s.fuel < 800) {
        return {
            title: 'BINGO FUEL - RECOVER',
            detail: `${Math.round(s.fuel)} L remaining. Break off and land back on the carrier.`,
            urgency: 'URGENT'
        };
    }

    if (s.airborneContacts > 0) {
        const eta = formatEta(s.soonestEtaSeconds);
        return {
            title: `SPLASH ${s.airborneContacts} CONTACT${s.airborneContacts === 1 ? '' : 'S'}`,
            detail: s.rwrState === 'LAUNCH'
                ? 'Missile in the air - descend below the ridge line to break the lock first.'
                : `Kill the inbounds before the deck is hit. Nearest impact in ${eta}.`,
            key: 'SPACE',
            urgency: s.rwrState === 'LAUNCH' ? 'URGENT' : 'ACTION'
        };
    }

    if (onApproach) {
        return {
            title: 'TRAP ABOARD',
            detail: 'Line up with the deck, fly the meatball, cross the ramp under 90 m/s at 18-28 m.',
            urgency: 'ACTION'
        };
    }

    return {
        title: 'AREA CLEAR - RETURN TO CV-68',
        detail: 'No contacts airborne. Fly back to the carrier and trap aboard to rearm for the next wave.',
        urgency: 'NORMAL'
    };
}
