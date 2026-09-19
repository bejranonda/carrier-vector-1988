/**
 * CARRIER VECTOR: 1988 - Flight Assist & Tactical Autopilot
 *
 * WHY THIS EXISTS
 * The flight model is a real 6-DOF simulation with a stall, induced drag and
 * a 40-metre-wide arresting-gear envelope. That is the point of it - but it
 * also means a new player spends their first several sorties flying into a
 * canyon wall, and never sees the game that is behind the flying. Testing the
 * canyon strike by script made that obvious: the jet was on its back in a
 * fjord before the mission had begun.
 *
 * The answer is not to make the aeroplane easier. It is to let the player
 * choose how much of it they want to fly:
 *
 *   MANUAL  - nothing between you and the aerodynamics, as before
 *   ASSIST  - the jet levels itself when you let go, refuses to stall, and
 *             pulls up out of the dirt. You still fly it everywhere.
 *   AUTO    - the jet flies the mission profile itself and you fight: pick a
 *             target, choose a weapon, decide when to shoot and when to break
 *
 * All of it is control law, not teleportation: the assist produces the same
 * stick and throttle demands a pilot would, and the same physics integrates
 * them. Nothing here can put the aircraft somewhere it could not have flown.
 *
 * Pure functions, no canvas and no aircraft instance - so the laws are
 * unit-testable, which matters when a bug here flies you into a cliff.
 */

export type AssistLevel = 'MANUAL' | 'ASSIST' | 'AUTO';

export const ASSIST_LEVELS: readonly AssistLevel[] = ['MANUAL', 'ASSIST', 'AUTO'];

export interface AssistSpec {
    id: AssistLevel;
    label: string;
    blurb: string;
}

export const ASSIST_SPECS: readonly AssistSpec[] = [
    { id: 'MANUAL', label: 'MANUAL', blurb: 'no assistance - the raw flight model' },
    { id: 'ASSIST', label: 'ASSIST', blurb: 'auto-level, stall limiter and a terrain floor' },
    { id: 'AUTO', label: 'AUTOPILOT', blurb: 'the jet flies, you fight' }
];

export function nextAssistLevel(level: AssistLevel): AssistLevel {
    const i = ASSIST_LEVELS.indexOf(level);
    return ASSIST_LEVELS[(i + 1) % ASSIST_LEVELS.length];
}

export function assistSpec(level: AssistLevel): AssistSpec {
    return ASSIST_SPECS.find(s => s.id === level) ?? ASSIST_SPECS[0];
}

/** Everything the control laws are allowed to see about the aircraft. */
export interface FlightState {
    pitch: number;          // radians, positive nose-up
    roll: number;           // radians, positive right wing down
    yaw: number;            // radians, 0 = +Z
    alpha: number;          // radians, angle of attack
    airSpeed: number;       // m/s
    throttle: number;       // 0..1.5
    altitudeAgl: number;    // metres
    verticalSpeed: number;  // m/s
    isStalled: boolean;
    /**
     * True when the aircraft is flying a carrier approach. An approach is a
     * deliberate descent to a deck twenty metres above the water, so the
     * ground-proximity laws below have to stand aside for it - otherwise the
     * default assist level makes landing, the hardest and best thing in the
     * game, literally impossible.
     */
    onApproach: boolean;
}

/** What the player is currently asking for, -1..1 per axis. */
export interface PilotInput {
    pitch: number;
    roll: number;
    /** -1 retard, +1 advance, 0 leave it alone. */
    throttle: number;
}

/** What the assist decided to hand the flight model. */
export interface ControlDemand {
    pitch: number;
    roll: number;
    /**
     * Rudder demand, -1..1. Only the autopilot uses this; at MANUAL and ASSIST
     * the rudder stays entirely the pilot's.
     *
     * It is not decoration. This flight model has no bank-to-turn yaw
     * coupling: banking tilts the lift vector and curves the flight PATH, but
     * the nose keeps pointing where it pointed, so a bank-only autopilot banks
     * beautifully and never captures the bearing. The rudder is what actually
     * moves the heading here, so the autopilot flies a coordinated turn -
     * bank for the turn, rudder to bring the nose round with it.
     */
    yaw: number;
    /** Throttle rate demand, -1..1. */
    throttle: number;
    /** Set when the assist overrode the pilot, for the HUD to annunciate. */
    override: 'NONE' | 'STALL' | 'TERRAIN' | 'LEVEL' | 'AUTOPILOT';
}

/** A place the autopilot is trying to get to. */
export interface NavTarget {
    /** Bearing to steer, radians, same convention as yaw. */
    bearing: number;
    /** Altitude above ground to hold, metres. */
    altitudeAgl: number;
    /** Airspeed to hold, m/s. */
    airSpeed: number;
    /** Roll limit, radians - gentler for an approach than for a intercept. */
    maxBank?: number;
}

// ---------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------

export const ASSIST_TUNING = {
    /** Alpha the limiter will not let the pilot pull past, radians (~15deg). */
    alphaLimit: 0.26,
    /**
     * Fraction of the alpha limit at which the limiter STARTS to bite. Below
     * it the pilot has the whole aeroplane. A limiter that scales every pull
     * from zero alpha upward quietly halves the jet's manoeuvrability and
     * leaves the HUD annunciating a stall warning in level flight.
     */
    alphaGate: 0.6,
    /** Below this AGL the terrain floor starts to fight a descent. */
    floorAgl: 180,
    /** Hard floor - full pull regardless of stick, metres AGL. */
    hardFloorAgl: 70,
    /**
     * Seconds to impact at which the floor begins to resist, and at which it
     * commands a full pull.
     *
     * Time, not height, is what makes this work. A height-only floor set at
     * 180 m cannot save a jet diving at 60 m/s: by the time it engages there
     * is one second left and the pitch rate is 1.35 rad/s, so it watches the
     * aeroplane hit the ground while gently disagreeing. Closure rate is the
     * quantity that matters, exactly as a real terrain-avoidance system uses
     * it.
     */
    impactWarnSeconds: 8,
    impactPullSeconds: 4,
    /** How fast the wings level themselves with no roll input, per second. */
    levelRollGain: 1.6,
    /** How firmly pitch is held when the stick is centred. */
    levelPitchGain: 1.2,
    /** Autopilot bank per radian of heading error. */
    headingGain: 1.5,
    /** Autopilot rudder per radian of heading error. */
    rudderGain: 1.1,
    /** Autopilot pitch per metre of altitude error. */
    altitudeGain: 0.0016,
    /** Autopilot throttle per m/s of speed error. */
    speedGain: 0.05,
    defaultMaxBank: 1.05
} as const;

/** How much authority a protection must take before the HUD calls it out. */
const ANNUNCIATE_EPSILON = 0.02;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Smallest signed angle from `from` to `to`, in radians. */
export function angleDelta(from: number, to: number): number {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

// ---------------------------------------------------------------------
// Laws
// ---------------------------------------------------------------------

/**
 * Stall limiter. Blocks further nose-up demand as alpha approaches the limit,
 * and actively pushes if the wing has already let go. It never blocks a push,
 * so the pilot can always unload.
 */
export function stallLimiter(state: FlightState, pitchDemand: number): number {
    if (state.isStalled) return Math.min(pitchDemand, -0.6);
    if (pitchDemand <= 0) return pitchDemand;

    const { alphaLimit, alphaGate } = ASSIST_TUNING;
    const gate = alphaLimit * alphaGate;
    if (state.alpha <= gate) return pitchDemand;

    const margin = (alphaLimit - state.alpha) / (alphaLimit - gate);
    return pitchDemand * clamp(margin, 0, 1);
}

/**
 * Terrain floor. Blends in a pull-up as ground clearance decays, weighted by
 * how fast the aircraft is closing on the ground - a gentle descent at 150m
 * is fine, the same height going down at 40 m/s is not.
 */
export function terrainFloor(state: FlightState, pitchDemand: number): number {
    if (state.onApproach) return pitchDemand;

    const { floorAgl, hardFloorAgl, impactWarnSeconds, impactPullSeconds } = ASSIST_TUNING;
    if (state.altitudeAgl <= hardFloorAgl) return Math.max(pitchDemand, 1);

    const sink = Math.max(0, -state.verticalSpeed);
    const secondsToImpact = sink > 0.5
        ? (state.altitudeAgl - hardFloorAgl) / sink
        : Number.POSITIVE_INFINITY;

    // Plenty of height AND plenty of time: the pilot owns the aeroplane.
    if (secondsToImpact >= impactWarnSeconds && state.altitudeAgl >= floorAgl) return pitchDemand;

    const byTime = clamp(
        (impactWarnSeconds - secondsToImpact) / (impactWarnSeconds - impactPullSeconds),
        0, 1
    );
    // Height on its own only ever contributes a partial pull: sitting low and
    // level over a fjord floor is a valid thing to be doing, and the floor
    // must not take the aeroplane away from a pilot who is doing it well.
    const byHeight = clamp(1 - (state.altitudeAgl - hardFloorAgl) / (floorAgl - hardFloorAgl), 0, 1) * 0.6;
    const urgency = Math.max(byTime, byHeight);

    // Blend toward a pull rather than snapping to it, so the floor feels like
    // the aeroplane resisting rather than the controls being taken away.
    return pitchDemand * (1 - urgency) + urgency;
}

/**
 * Wings-level / attitude-hold. Applies only on axes the pilot is not touching,
 * so it assists rather than fights.
 */
export function attitudeHold(state: FlightState, input: PilotInput): { pitch: number; roll: number } {
    const t = ASSIST_TUNING;
    const roll = Math.abs(input.roll) > 0.01
        ? input.roll
        : clamp(-state.roll * t.levelRollGain, -1, 1);

    // With the wings level, hold the current flight path instead of letting
    // the nose wander; while banked, let the pitch rate be the pilot's.
    const pitch = Math.abs(input.pitch) > 0.01
        ? input.pitch
        : clamp(-state.pitch * t.levelPitchGain * Math.cos(state.roll), -1, 1);

    return { pitch, roll };
}

/**
 * Full autopilot: fly a bearing, an altitude and a speed. Bank to turn, pitch
 * for altitude, throttle for speed - the same order of priority a pilot uses.
 */
export function autopilotDemand(state: FlightState, target: NavTarget): ControlDemand {
    const t = ASSIST_TUNING;
    const maxBank = target.maxBank ?? t.defaultMaxBank;

    const headingError = angleDelta(state.yaw, target.bearing);
    const desiredBank = clamp(headingError * t.headingGain, -maxBank, maxBank);
    const roll = clamp((desiredBank - state.roll) * 2.2, -1, 1);

    const altError = target.altitudeAgl - state.altitudeAgl;
    // Bleed the climb demand off as bank increases: pulling hard while banked
    // is how an autopilot flies itself into a stall.
    const bankFactor = Math.max(0.25, Math.cos(state.roll));
    let pitch = clamp(altError * t.altitudeGain * bankFactor, -0.8, 0.9);
    // Hold the nose where the climb rate wants it rather than chasing altitude
    // with attitude, which oscillates.
    pitch = clamp(pitch - state.pitch * 0.8, -1, 1);

    const yaw = clamp(headingError * t.rudderGain, -1, 1);

    const throttle = clamp((target.airSpeed - state.airSpeed) * t.speedGain, -1, 1);

    return { pitch, roll, yaw, throttle, override: 'AUTOPILOT' };
}

/**
 * The one entry point the simulation calls. Order matters: the terrain floor
 * outranks the stall limiter (a stall at 2000 m is survivable, a controlled
 * descent into a ridge is not), and both outrank whatever the autopilot or
 * the pilot wanted.
 */
export function resolveControls(
    level: AssistLevel,
    state: FlightState,
    input: PilotInput,
    navTarget: NavTarget | null
): ControlDemand {
    if (level === 'MANUAL') {
        return {
            pitch: input.pitch, roll: input.roll, yaw: 0,
            throttle: input.throttle, override: 'NONE'
        };
    }

    let demand: ControlDemand;
    // The autopilot does not land. Rolling onto final hands the aeroplane
    // back with the assists still on, because a trap is the one part of this
    // game nobody wants flown for them.
    if (level === 'AUTO' && navTarget && !state.onApproach) {
        demand = autopilotDemand(state, navTarget);
        // A nudge on the stick still gets through, so the player can break
        // out of an autopilot turn without first switching it off.
        if (Math.abs(input.pitch) > 0.01) demand.pitch = input.pitch;
        if (Math.abs(input.roll) > 0.01) {
            demand.roll = input.roll;
            // A pilot rolling out of an autopilot turn does not want the
            // rudder still feeding into it.
            demand.yaw = 0;
        }
        if (Math.abs(input.throttle) > 0.01) demand.throttle = input.throttle;
    } else {
        const held = attitudeHold(state, input);
        const levelling = Math.abs(input.pitch) <= 0.01 || Math.abs(input.roll) <= 0.01;
        demand = {
            pitch: held.pitch,
            roll: held.roll,
            yaw: 0,
            throttle: input.throttle,
            override: levelling ? 'LEVEL' : 'NONE'
        };
    }

    // Annunciate only a protection that is actually taking authority away.
    // Both laws blend rather than switch, so an exact inequality would flash
    // the caption at the pilot over a hundredth of a unit of stick.
    const afterStall = stallLimiter(state, demand.pitch);
    if (afterStall < demand.pitch - ANNUNCIATE_EPSILON) demand.override = 'STALL';

    const afterFloor = terrainFloor(state, afterStall);
    if (afterFloor > afterStall + ANNUNCIATE_EPSILON) demand.override = 'TERRAIN';

    demand.pitch = clamp(afterFloor, -1, 1);
    demand.roll = clamp(demand.roll, -1, 1);
    demand.yaw = clamp(demand.yaw, -1, 1);
    demand.throttle = clamp(demand.throttle, -1, 1);
    return demand;
}

// ---------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------

/**
 * ASSIST, not MANUAL. A first-time player has no idea the flight model has a
 * stall in it, and a game whose opening minute is a crash into a fjord wall
 * teaches nothing. Everything is still hand-flown at this level - the assists
 * only intervene at the edges - and the pilot who wants the raw aeroplane is
 * one key away from it.
 */
export const DEFAULT_ASSIST_LEVEL: AssistLevel = 'ASSIST';

const STORAGE_KEY = 'carrier-vector-1988.assistLevel';

function isAssistLevel(value: unknown): value is AssistLevel {
    return typeof value === 'string' && (ASSIST_LEVELS as readonly string[]).includes(value);
}

/** Best-effort restore; storage can throw or be blocked and the game must boot. */
export function loadAssistLevel(): AssistLevel {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        return isAssistLevel(raw) ? raw : DEFAULT_ASSIST_LEVEL;
    } catch {
        return DEFAULT_ASSIST_LEVEL;
    }
}

export function saveAssistLevel(level: AssistLevel) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, level);
    } catch {
        // The setting still holds for this session.
    }
}
