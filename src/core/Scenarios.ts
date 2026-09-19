/**
 * CARRIER VECTOR: 1988 - Selectable Scenarios & Mission Director
 *
 * The game had exactly one mode: defend the carrier against endless waves
 * until the hull gives out. Every system needed for more was already there -
 * a canyon with a navigable corridor, radar line-of-sight, hardened SAM
 * sites, iron bombs, graded traps - but nothing ever asked the player to use
 * them in a particular order, so the bomb was dead weight and the canyon was
 * only ever cover.
 *
 * A scenario is a piece of data: how to set the world up, an ordered list of
 * phases, and the conditions that end it. The director walks the phases
 * against a snapshot of the world each tick. Everything in this file is pure
 * - no canvas, no DOM, no subsystem imports - so mission logic and every
 * piece of mission prose is unit-testable.
 *
 * On the strike scenario: it is an original mission built from the tactical
 * vocabulary this simulation already models (a terrain-masked low-level
 * ingress, a pop-up delivery against a hardened target with a tight hit
 * radius, then an egress through a live SAM belt). The canyon-run archetype
 * is a staple of the genre going back to 1983; nothing here is lifted from
 * any particular film's fiction, names or branding.
 */

import type { AircraftLoadout } from '../flight/AircraftPhysics';
import type { InboundStrikePackage, ThreatProfile } from '../carrier/DeckManager';
import type { StrikeTargetSpec } from '../tactics/StrikeTarget';
import type { ObjectiveStep } from './Objectives';
import { formatEta } from './Objectives';

export type ScenarioId =
    | 'CARRIER_DEFENSE'
    | 'CANYON_STRIKE'
    | 'IRON_HAND'
    | 'LAST_STAND'
    | 'CARRIER_QUALS';

/** Everything a phase or an end condition is allowed to look at. */
export interface MissionSnapshot {
    /** Seconds since the scenario started (deck time, not wall clock). */
    missionSeconds: number;
    isAirborne: boolean;
    hasLaunched: boolean;
    /** True once the jet is back on deck after a trap. */
    isRecovered: boolean;

    altitudeMsl: number;
    altitudeAgl: number;
    airSpeed: number;
    fuel: number;
    damage: number;

    distanceToCarrier: number;
    /** Horizontal range to the scenario's strike target, or null if none. */
    distanceToStrikeTarget: number | null;
    strikeTargetDestroyed: boolean;
    strikeTargetHits: number;

    samSitesAlive: number;
    samSitesTotal: number;
    contactsAlive: number;
    liveInboundPackages: number;
    soonestEtaSeconds: number | null;
    packagesLeaked: number;

    carrierHealth: number;
    airframesLost: number;
    spareAirframes: number;
    traps: number;
    perfectTraps: number;
    bombsRemaining: number;
    rwrState: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH';
}

export interface MissionPhase {
    id: string;
    /** Imperative, 2-5 words. Rendered large. */
    title: string;
    detail: (s: MissionSnapshot) => string;
    /** Key the player should press now, if any. */
    key?: string;
    urgency?: ObjectiveStep['urgency'];
    /** True when the phase is satisfied and the mission moves on. */
    isComplete: (s: MissionSnapshot) => boolean;
    /**
     * This phase is about the flight deck, so it stays on screen while the
     * jet is on deck. Without it, a pilot who lost a jet mid-raid was told
     * "RUN THE FJORD - 8.1 km to the pen" while sitting in the hangar; the
     * deck's own orders (and the mission clock) are what they need there.
     */
    onDeck?: boolean;
    /** Line written to the tactical log when this phase begins. */
    callout?: string;
}

/** A briefing card. Three per scenario, shown before launch. */
export interface ScenarioCard {
    n: string;
    title: string;
    body: string;
    keys: [string, string][];
}

export interface ScenarioSetup {
    threat: ThreatProfile;
    /** Skip the deck and start over the canyon. */
    startAirborne?: boolean;
    /** Remove the SAM belt entirely (used by carrier qualification). */
    noSamSites?: boolean;
    strikeTarget?: StrikeTargetSpec;
    /** Hard deadline, in seconds from the start of the scenario. */
    timeLimitSeconds?: number;
    /**
     * While this returns false the clock is hidden and the deadline cannot
     * fail the mission. Without it the strike window kept counting down
     * through the egress and the recovery, implying a deadline on getting
     * home that does not exist.
     */
    timeLimitActive?: (s: MissionSnapshot) => boolean;
    /** Run the six-step flight checkout. Only the intro mode wants it. */
    showTrainingChecklist?: boolean;
    /** Payload the deck crew has already hung on the jet. */
    loadout?: AircraftLoadout;
}

export interface ScenarioDef {
    id: ScenarioId;
    name: string;
    /** One line, shown under the name on the selector. */
    tagline: string;
    /** 1 (training) to 5 (brutal). */
    difficulty: number;
    /** Roughly how long a run takes, for the selector. */
    duration: string;
    setup: ScenarioSetup;
    cards: ScenarioCard[];
    /** One line naming what ends the run badly. */
    lossCondition: string;
    phases: MissionPhase[];
    /** Non-null means the mission has failed, with this reason. */
    failure: (s: MissionSnapshot) => string | null;
    /** Headline shown on a successful debrief. */
    victoryTitle: string;
    victoryDetail: string;
}

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

const KM = (m: number | null) => (m === null ? '--' : `${(m / 1000).toFixed(1)} km`);

/** The canyon corridor runs up +Z from the carrier at the origin. */
export const CANYON = {
    /** Half-width of the navigable slot in the canyon floor. */
    slotHalfWidth: 500,
    /** Deep in the fjord, past all three SAM sites. */
    targetZ: 10400
} as const;

const HARDENED_PEN: StrikeTargetSpec = {
    id: 'TARGET-ALPHA',
    name: 'HARDENED SUBMARINE PEN',
    description: 'Rock-cut pen at the head of the fjord, blast doors open for a resupply window',
    x: 60,
    z: CANYON.targetZ,
    height: 46,
    // Tight on purpose: a hardened target is not killed by a near miss, so
    // this has to be an aimed delivery rather than a lob from altitude.
    hitRadius: 55,
    hitsRequired: 1
};

function surgePackages(): InboundStrikePackage[] {
    // Everything arrives at once, from every bearing. The carrier cannot
    // survive this by attrition - the player has to prioritise the bombers.
    return [
        pkg('SURGE-1', 'Tu-22', 1, 20, 150),
        pkg('SURGE-2', 'MiG-23', 3, 95, 170),
        pkg('SURGE-3', 'Tu-22', 1, 200, 210),
        pkg('SURGE-4', 'MiG-23', 2, 285, 240),
        pkg('SURGE-5', 'Tu-22', 1, 340, 300)
    ];
}

function pkg(
    id: string,
    aircraftType: 'MiG-23' | 'Tu-22',
    count: number,
    bearingDeg: number,
    etaSeconds: number
): InboundStrikePackage {
    const label = aircraftType === 'Tu-22' ? 'Tu-22M Backfire' : 'MiG-23 Flogger';
    return {
        id,
        description: `Inbound ${label}${count > 1 ? ` x${count}` : ''}`,
        aircraftType,
        count,
        bearingDeg,
        etaSeconds,
        isIntercepted: false,
        hasAttacked: false
    };
}

/**
 * Shared failure: hull gone, or every airframe on the boat expended with the
 * pilot on deck and nothing left to launch.
 */
function carrierLost(s: MissionSnapshot): string | null {
    if (s.carrierHealth <= 0) return 'CV-68 was knocked out of the fight.';
    if (s.spareAirframes <= 0 && !s.isAirborne) return 'No airframes left on the boat.';
    return null;
}

/** Phase shared by every scenario that starts on the deck. */
function launchPhase(detail: string): MissionPhase {
    return {
        id: 'LAUNCH',
        title: 'GET AIRBORNE',
        detail: () => detail,
        key: 'ENTER',
        urgency: 'ACTION',
        onDeck: true,
        isComplete: (s) => s.hasLaunched
    };
}

/** Phase shared by every scenario that ends with a trap. */
function recoverPhase(): MissionPhase {
    return {
        id: 'RECOVER',
        title: 'TRAP ABOARD',
        detail: (s) =>
            `Bring the jet home: ${KM(s.distanceToCarrier)} to the boat. Cross the ramp under 90 m/s at 18-28 m.`,
        urgency: 'ACTION',
        isComplete: (s) => s.isRecovered,
        callout: 'RTB. CHARLIE ON ARRIVAL.'
    };
}

// ---------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------

const CARRIER_DEFENSE: ScenarioDef = {
    id: 'CARRIER_DEFENSE',
    name: 'CARRIER DEFENSE',
    tagline: 'Endless waves. How long can you hold CV-68?',
    difficulty: 2,
    duration: 'Endless',
    setup: { threat: { endlessWaves: true }, showTrainingChecklist: true },
    cards: [
        {
            n: '1',
            title: 'ON THE DECK',
            body: 'Crews arm and fuel your jet. Set the payload, then take the cat shot.',
            keys: [['1-4', 'payload'], ['ENTER', 'launch']]
        },
        {
            n: '2',
            title: 'INTERCEPT',
            body: 'Kill the inbound strike packages before their ETA reaches zero. Drop below the ridge line to break a SAM lock.',
            keys: [['WASD', 'fly'], ['SPACE', 'fire']]
        },
        {
            n: '3',
            title: 'TRAP ABOARD',
            body: 'Come back under 90 m/s at 18-28 m, rearm, and go again. Each wave is harder than the last.',
            keys: [['SHIFT', 'power'], ['CTRL', 'idle']]
        }
    ],
    lossCondition: 'Every package that gets through hits CV-68. At 0% hull integrity the mission is over.',
    // No scripted phases: the generic deck/flight objectives carry this mode.
    phases: [],
    failure: (s) => (s.carrierHealth <= 0 ? 'CV-68 was knocked out of the fight.' : null),
    victoryTitle: 'MISSION COMPLETE',
    victoryDetail: 'The strike group is still in the fight.'
};

const CANYON_STRIKE: ScenarioDef = {
    id: 'CANYON_STRIKE',
    name: 'CANYON STRIKE',
    tagline: 'One bomb, one pen, four minutes. Stay below the ridge line.',
    difficulty: 5,
    duration: '~6 min',
    setup: {
        threat: {
            // The sky is deliberately quiet: the canyon is the enemy here.
            openingTimeline: [],
            endlessWaves: false,
            inventory: { ironBombs: 6, sidewinders: 8 },
            plannedFuel: 4800
        },
        strikeTarget: HARDENED_PEN,
        timeLimitSeconds: 240,
        // The window is the raid window. Once the pen is down the clock has
        // done its job and the egress is not a race.
        timeLimitActive: (s) => !s.strikeTargetDestroyed,
        loadout: { vulcanAmmo: 500, sidewinders: 2, ironBombs: 2 }
    },
    cards: [
        {
            n: '1',
            title: 'INGRESS LOW',
            body: 'Run the fjord below the ridge line. Above it the SAM belt has line of sight and you will not survive the transit. Keep the RWR quiet.',
            keys: [['ENTER', 'launch'], ['CTRL', 'slow down']]
        },
        {
            n: '2',
            title: 'PUT IT IN THE PEN',
            body: 'The pen is hardened: only a bomb inside 55 m counts. Pop up late, select the Mk.82, and aim it in. A near miss does nothing.',
            keys: [['3', 'select bomb'], ['SPACE', 'release']]
        },
        {
            n: '3',
            title: 'GET OUT',
            body: 'The moment the pen goes up, the belt goes weapons-free and the alert flight scrambles. Clear the fjord, then trap aboard.',
            keys: [['SHIFT', 'burner'], ['2', 'AIM-9']]
        }
    ],
    lossCondition: 'The blast doors close in four minutes. Lose a jet and you can rearm and go again - but the clock does not stop.',
    phases: [
        launchPhase('Armed with two Mk.82. Take the cat shot and head up the fjord on 000.'),
        {
            id: 'INGRESS',
            title: 'RUN THE FJORD',
            detail: (s) =>
                `${KM(s.distanceToStrikeTarget)} to the pen. Stay below the ridge line - ${
                    s.rwrState === 'SILENT' ? 'the belt has not seen you' : 'they are looking right at you'
                }.`,
            urgency: 'ACTION',
            isComplete: (s) => (s.distanceToStrikeTarget ?? Infinity) < 2600,
            callout: 'FEET DRY. RUNNING THE FJORD.'
        },
        {
            id: 'STRIKE',
            title: 'ATTACK THE PEN',
            detail: (s) =>
                s.bombsRemaining > 0
                    ? `${KM(s.distanceToStrikeTarget)} out. Mk.82 selected with [3] - a bomb has to land inside 55 m. ${s.bombsRemaining} left.`
                    : 'Out of bombs. Trap aboard and rearm - the window is still running.',
            key: 'SPACE',
            urgency: 'URGENT',
            isComplete: (s) => s.strikeTargetDestroyed,
            callout: 'IN HOT ON THE PEN.'
        },
        {
            id: 'EGRESS',
            title: 'CLEAR THE FJORD',
            detail: (s) =>
                `Pen is down. The belt is weapons-free and fighters are up - ${KM(
                    s.distanceToStrikeTarget
                )} clear so far.`,
            urgency: 'URGENT',
            isComplete: (s) => (s.distanceToStrikeTarget ?? 0) > 7000,
            callout: 'TARGET DESTROYED. EGRESS, EGRESS!'
        },
        recoverPhase()
    ],
    failure: (s) => {
        if (s.carrierHealth <= 0) return 'CV-68 was knocked out of the fight.';
        if (s.missionSeconds > 240 && !s.strikeTargetDestroyed) {
            return 'The blast doors closed. The pen survived the window.';
        }
        // Losing a jet used to end the raid outright, which made one mistake
        // fatal and left the four-minute window doing nothing. Losing one now
        // costs you the ~30s hangar-and-rearm cycle instead - the clock is the
        // punishment, and a fast pilot can still make the window.
        if (s.spareAirframes <= 0 && !s.isAirborne) return 'No airframes left to fly the raid.';
        return null;
    },
    victoryTitle: 'TARGET DESTROYED',
    victoryDetail: 'The pen is rubble and you are back aboard. Textbook.'
};

const IRON_HAND: ScenarioDef = {
    id: 'IRON_HAND',
    name: 'IRON HAND',
    tagline: 'Roll back the SAM belt. Three sites, one jet.',
    difficulty: 3,
    duration: '~8 min',
    setup: {
        threat: {
            openingTimeline: [pkg('CAP-1', 'MiG-23', 2, 40, 420)],
            endlessWaves: false,
            inventory: { ironBombs: 12 },
            plannedFuel: 5000
        },
        loadout: { vulcanAmmo: 500, sidewinders: 2, ironBombs: 4 }
    },
    cards: [
        {
            n: '1',
            title: 'ARM FOR SEAD',
            body: 'Load Mk.82s - bombs are what kill a launcher. Sidewinders are for the CAP that turns up later.',
            keys: [['4', 'more bombs'], ['ENTER', 'launch']]
        },
        {
            n: '2',
            title: 'WORK THE BELT',
            body: 'Three sites up the fjord. Break each lock behind a ridge, then come over the top and bomb the launcher.',
            keys: [['3', 'select bomb'], ['SPACE', 'release']]
        },
        {
            n: '3',
            title: 'RELOAD AND REPEAT',
            body: 'Four bombs a sortie. Trap aboard, rearm and go back for the rest - the boat is your magazine.',
            keys: [['TAB', 'deck'], ['ENTER', 'relaunch']]
        }
    ],
    lossCondition: 'Lose the carrier and the campaign ends. Losing airframes just costs you time.',
    phases: [
        launchPhase('Armed for SEAD. Get up the fjord and start on the belt.'),
        {
            id: 'SEAD',
            title: 'KILL THE SAM BELT',
            detail: (s) =>
                `${s.samSitesAlive} of ${s.samSitesTotal} launchers still up. A bomb within 180 m kills one; 40 cannon hits also does it.`,
            key: 'SPACE',
            urgency: 'ACTION',
            isComplete: (s) => s.samSitesAlive === 0,
            callout: 'CLEARED HOT ON THE SAM BELT.'
        },
        recoverPhase()
    ],
    failure: carrierLost,
    victoryTitle: 'BELT ROLLED BACK',
    victoryDetail: 'Every launcher in the fjord is off the air and you are back aboard.'
};

const LAST_STAND: ScenarioDef = {
    id: 'LAST_STAND',
    name: 'LAST STAND',
    tagline: 'Five packages, all at once, and a hull already holed.',
    difficulty: 5,
    duration: '~5 min',
    setup: {
        threat: {
            openingTimeline: surgePackages(),
            endlessWaves: false,
            startWave: 6,
            inventory: { carrierHealth: 70, spareAirframes: 2, sidewinders: 12 },
            plannedFuel: 4200
        },
        loadout: { vulcanAmmo: 600, sidewinders: 6, ironBombs: 0 }
    },
    cards: [
        {
            n: '1',
            title: 'SCRAMBLE',
            body: 'Five packages are already inbound and the hull is down to 70%. No time to plan a payload - launch.',
            keys: [['ENTER', 'launch now']]
        },
        {
            n: '2',
            title: 'BOMBERS FIRST',
            body: 'A Backfire costs 35% hull, a Flogger 15%. You cannot stop everything, so kill the ones that hurt.',
            keys: [['2', 'AIM-9'], ['SPACE', 'fire']]
        },
        {
            n: '3',
            title: 'STAY UP',
            body: 'Two spare airframes. Trapping aboard to rearm costs a minute you may not have - spend your missiles well.',
            keys: [['SHIFT', 'burner'], ['1', 'guns']]
        }
    ],
    lossCondition: 'The hull starts at 70%. Three bombers through and it is over.',
    phases: [
        launchPhase('Five packages inbound and the hull already holed. Get off the deck.'),
        {
            id: 'DEFEND',
            title: 'STOP THE RAID',
            detail: (s) =>
                `${s.liveInboundPackages} package${s.liveInboundPackages === 1 ? '' : 's'} still inbound, nearest in ${formatEta(
                    s.soonestEtaSeconds
                )}. Hull at ${Math.round(s.carrierHealth)}%.`,
            key: 'SPACE',
            urgency: 'URGENT',
            isComplete: (s) => s.liveInboundPackages === 0,
            callout: 'ALL AIRCRAFT ENGAGE. DEFEND THE BOAT.'
        },
        recoverPhase()
    ],
    failure: carrierLost,
    victoryTitle: 'RAID BROKEN',
    victoryDetail: 'The strike group is still afloat. That should not have worked.'
};

const CARRIER_QUALS: ScenarioDef = {
    id: 'CARRIER_QUALS',
    name: 'CARRIER QUALS',
    tagline: 'No enemies. Just you, the boat, and the hardest skill in the game.',
    difficulty: 1,
    duration: '~5 min',
    setup: {
        threat: { openingTimeline: [], endlessWaves: false, plannedFuel: 4000 },
        noSamSites: true,
        startAirborne: true,
        loadout: { vulcanAmmo: 0, sidewinders: 0, ironBombs: 0 }
    },
    cards: [
        {
            n: '1',
            title: 'FLY THE PATTERN',
            body: 'You start airborne, clean, with the deck behind you. Come round and set up a long straight-in from astern.',
            keys: [['WASD', 'fly'], ['CTRL', 'slow down']]
        },
        {
            n: '2',
            title: 'FLY THE BALL',
            body: 'Inside 3 km the approach panel appears. Keep the yellow ball level with the datum bars and the indexer on ON SPEED.',
            keys: [['SHIFT', 'power'], ['CTRL', 'idle']]
        },
        {
            n: '3',
            title: 'THREE TRAPS',
            body: 'Land three times, at least one of them a 3-wire. Bolters cost nothing but your pride - go round and try again.',
            keys: [['TAB', 'deck'], ['ENTER', 'relaunch']]
        }
    ],
    lossCondition: 'Nothing can shoot you down. Running the tanks dry is the only way to end this badly.',
    phases: [
        {
            id: 'QUALS',
            title: 'THREE TRAPS, ONE 3-WIRE',
            detail: (s) =>
                `${s.traps} of 3 traps logged, ${s.perfectTraps} perfect. ${KM(s.distanceToCarrier)} to the boat.`,
            urgency: 'ACTION',
            isComplete: (s) => s.traps >= 3 && s.perfectTraps >= 1,
            callout: 'CLEARED FOR CARRIER QUALIFICATION.'
        }
    ],
    failure: (s) => (s.airframesLost >= 3 ? 'Three airframes written off. Qualification failed.' : null),
    victoryTitle: 'QUALIFIED',
    victoryDetail: 'Three traps and a 3-wire. You can take the boat at night now.'
};

export const SCENARIOS: readonly ScenarioDef[] = [
    CARRIER_DEFENSE,
    CANYON_STRIKE,
    IRON_HAND,
    LAST_STAND,
    CARRIER_QUALS
];

export const DEFAULT_SCENARIO: ScenarioId = 'CARRIER_DEFENSE';

export function scenarioById(id: ScenarioId): ScenarioDef {
    return SCENARIOS.find(s => s.id === id) ?? SCENARIOS[0];
}

export function scenarioAt(index: number): ScenarioDef {
    const n = SCENARIOS.length;
    return SCENARIOS[((index % n) + n) % n];
}

// ---------------------------------------------------------------------
// Director
// ---------------------------------------------------------------------

export type MissionOutcome = 'ACTIVE' | 'SUCCESS' | 'FAILED';

export interface MissionStatus {
    outcome: MissionOutcome;
    phaseIndex: number;
    phase: MissionPhase | null;
    /** Set once, when the outcome stops being ACTIVE. */
    reason: string | null;
    /** Seconds left on the scenario clock, or null when untimed. */
    secondsRemaining: number | null;
    /** Phases newly entered on this tick, for the caller to log. */
    callouts: string[];
}

/**
 * Walks a scenario's phases against the world each tick.
 *
 * Deliberately a small stateful object rather than a pure reducer: phase
 * progress is monotonic (a completed phase never un-completes when the world
 * changes back), which is exactly the property a reducer over a snapshot
 * cannot express on its own.
 */
export class MissionDirector {
    public readonly scenario: ScenarioDef;
    private phaseIndex = 0;
    private outcome: MissionOutcome = 'ACTIVE';
    private reason: string | null = null;
    private pendingCallouts: string[] = [];

    constructor(scenario: ScenarioDef) {
        this.scenario = scenario;
        const first = scenario.phases[0];
        if (first?.callout) this.pendingCallouts.push(first.callout);
    }

    public update(s: MissionSnapshot): MissionStatus {
        if (this.outcome === 'ACTIVE') {
            // Advance through every phase the snapshot already satisfies, so a
            // single tick that completes two phases does not stall on the first.
            while (
                this.phaseIndex < this.scenario.phases.length &&
                this.scenario.phases[this.phaseIndex].isComplete(s)
            ) {
                this.phaseIndex++;
                const next = this.scenario.phases[this.phaseIndex];
                if (next?.callout) this.pendingCallouts.push(next.callout);
            }

            // Victory is checked FIRST. A pilot who completes the last phase
            // on the same tick that a failure condition becomes true - landing
            // the final sortie with the last airframe, say - has finished the
            // mission, and a mission you have already completed cannot fail.
            const allPhasesDone =
                this.scenario.phases.length > 0 &&
                this.phaseIndex >= this.scenario.phases.length;

            if (allPhasesDone) {
                this.outcome = 'SUCCESS';
                this.reason = this.scenario.victoryDetail;
            } else {
                const failed = this.scenario.failure(s);
                if (failed) {
                    this.outcome = 'FAILED';
                    this.reason = failed;
                }
            }
        }

        const callouts = this.pendingCallouts;
        this.pendingCallouts = [];

        return {
            outcome: this.outcome,
            phaseIndex: this.phaseIndex,
            phase: this.scenario.phases[this.phaseIndex] ?? null,
            reason: this.reason,
            secondsRemaining: this.secondsRemaining(s),
            callouts
        };
    }

    /** The mission clock, whatever objective ends up being displayed. */
    public clock(s: MissionSnapshot): number | null {
        return this.outcome === 'ACTIVE' ? this.secondsRemaining(s) : null;
    }

    private secondsRemaining(s: MissionSnapshot): number | null {
        const { timeLimitSeconds, timeLimitActive } = this.scenario.setup;
        if (timeLimitSeconds === undefined) return null;
        if (timeLimitActive && !timeLimitActive(s)) return null;
        return Math.max(0, timeLimitSeconds - s.missionSeconds);
    }

    /**
     * Current phase rendered as the objective both screens already draw, or
     * null when the caller's own director should speak instead - which is the
     * case for an air phase while the jet is on the deck.
     */
    public objective(s: MissionSnapshot): ObjectiveStep | null {
        const phase = this.scenario.phases[this.phaseIndex];
        if (!phase || this.outcome !== 'ACTIVE') return null;
        if (!phase.onDeck && !s.isAirborne) return null;
        return {
            title: phase.title,
            detail: phase.detail(s),
            key: phase.key,
            urgency: phase.urgency ?? 'NORMAL',
            countdownSeconds: this.secondsRemaining(s) ?? undefined
        };
    }
}
