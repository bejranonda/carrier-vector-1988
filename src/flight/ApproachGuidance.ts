/**
 * CARRIER VECTOR: 1988 - Assisted Carrier Approach
 *
 * WHY THIS EXISTS
 * The trap is the best thing in this game and the hardest, and the autopilot
 * deliberately refuses to fly it: `resolveControls()` hands the aeroplane back
 * the moment the approach starts, because nobody wants the one skill in the
 * game done for them.
 *
 * That was the right call for a keyboard and the wrong one for a phone. Touch
 * mode makes flying and fighting comfortable and leaves the trap exactly as
 * hard as it was - on a virtual stick, with a thumb over the altimeter. The
 * result is a game that a handset can play right up until the part that ends
 * the sortie.
 *
 * So the assist flies the BALL AND THE SPEED, and nothing else. On final it
 * holds the glideslope and the approach speed; lineup stays entirely the
 * player's, and so does the last seven hundred metres, where it hands even the
 * ball back. Holding a three and a half degree slope to a moving deck with a
 * thumb over the altimeter is the part that does not work on a phone. Steering
 * left and right is just flying, which touch controls are already good at.
 *
 * It is also the part this flight model can actually be trusted to do. An
 * earlier version of this file flew the whole recovery - a pattern join, a
 * hundred and forty degrees of turn, a descent and a deceleration - and it put
 * the jet in the sea with great consistency, because heading changes here come
 * from the rudder and the velocity vector does not follow them without a pull
 * the altitude hold will not command. Pitch and throttle it does well. So pitch
 * and throttle is what it is allowed to have.
 *
 * GEOMETRY. The carrier sits at the world origin with its deck running along
 * +Z, so the final approach course is a heading of zero, up the wake from
 * negative Z. The wires are at Z = -95..-115 (`ScoreKeeper.gradeTrap`) and the
 * deck is twenty metres above the water.
 *
 * Pure: geometry in, guidance out. No terrain, no physics, no canvas.
 */

export type ApproachPhase = 'JOIN' | 'FINAL' | 'HANDOVER';

export interface ApproachPosition {
    x: number;
    y: number;
    z: number;
}

export const APPROACH_TUNING = {
    /** Deck height above the water, metres. */
    deckHeight: 20,
    /** Aim point: the 3 wire, the grade a good trap gets. */
    touchdownZ: -100,
    /** Final approach course, radians. Zero is +Z, straight up the wake. */
    finalCourse: 0,
    /** Standard glideslope, degrees. */
    glideslopeDegrees: 3.5,
    /**
     * Speed to fly the approach, m/s.
     *
     * The wires only take a jet below 95 m/s, and arriving exactly at the
     * limit means any float at all is a bolter. Seventy is comfortably inside
     * it and still well clear of the stall.
     */
    approachSpeed: 70,
    /**
     * Ceiling on the derived approach speed (see `approachSpeedFor`). The
     * wires take a jet only below 95 m/s; 88 leaves margin for a gust of
     * throttle on short final.
     */
    maxApproachSpeed: 88,
    /** Speed to fly the join, m/s - brisker, since it can be a long way. */
    joinSpeed: 200,
    /**
     * Speed to fly the short, tight reversal when the aeroplane is already
     * astern but pointed the wrong way, m/s.
     *
     * `joinSpeed` and `joinMaxBank` are tuned for a long transit that can
     * afford a wide, gentle turn; here the aeroplane may be only a few
     * hundred metres from the boat, so the turn has to close in a radius far
     * smaller than that transit turn's ~11 km. Slower and tighter (see
     * `homeTurnMaxBank`) keeps the turn radius under a kilometre, so the
     * reversal finishes without ever leaving the corridor it started in.
     */
    homeTurnSpeed: 110,
    /** Bank for the close-in reversal above - steeper than the transit join. */
    homeTurnMaxBank: 0.7,
    /**
     * Altitude to fly the join at, metres.
     *
     * A transit altitude, not a pattern altitude. The way home from a canyon
     * strike crosses ridge lines close to two thousand metres, and a textbook
     * four-hundred-metre join flies into them - which it did, at five
     * kilometres, repeatably. Coming down is the final leg's job, and the
     * final leg is over open water.
     */
    joinAltitude: 1400,
    /**
     * Pattern altitude, metres.
     *
     * The approach levels off here and lets the glideslope come DOWN to it,
     * rather than descending along the slope from wherever it happened to
     * start. That is how it is flown for real, and here it is also the only
     * thing that works: a jet cannot descend steeply and decelerate at the
     * same time - gravity down the flight path cancels the drag - so an
     * assist that tried delivered the aeroplane to short final beautifully
     * positioned and a hundred knots too fast to take a wire. Levelling off
     * first turns one impossible task into two easy ones, and the slope is
     * intercepted from below at about 4.6 km with a minute of stabilised
     * approach in hand.
     */
    patternAltitude: 300,
    /**
     * Height above pattern altitude at which the approach slows down, metres.
     */
    slowDownAbove: 250,
    /**
     * Speed above the approach speed at which the boards come out, m/s.
     *
     * This airframe is clean and has no dedicated speedbrake, and at idle on a
     * three and a half degree slope it settles at about a hundred and seventy
     * metres a second - which the arresting gear will not take at any price.
     * Gravity down the flight path simply cancels the drag. The only drag
     * device modelled is the weapons bay, which nearly triples parasitic drag
     * when open, and which is exactly what a real carrier aeroplane's boards
     * are for on an approach. The RCS penalty that comes with it does not
     * matter three miles behind your own boat.
     */
    boardsOutAbove: 10,
    /**
     * Range from the wires at which the aeroplane is handed back, metres.
     *
     * About ten seconds at approach speed: enough to see the deck, settle,
     * and make the last corrections yourself, which is the whole point of
     * not flying the trap for the player.
     */
    handoverRange: 700,
    /** How far astern the join point sits, metres. */
    joinDistance: 9000,
    /** Half-width of the corridor inside which the final course is flown. */
    corridorHalfWidth: 3000,
    /** Furthest out the glideslope is flown rather than joined, metres. */
    captureRange: 14000,
    /**
     * Heading error, radians, beyond which the corridor is not flyable even
     * from a good position - see `inApproachCorridor`.
     *
     * Regression, v1.11.0: a jet 265 m astern of the wires but pointed 194
     * degrees off the final course (heading was never checked, only position)
     * was classified FINAL and, under the autopilot, simply held that heading
     * forever - "take me home" flew the aeroplane away from the carrier for
     * good. Sixty degrees is inside what `finalMaxBank` and the lineup
     * correction can actually turn out of; anything wider is a job for JOIN,
     * which turns the aeroplane around first.
     */
    finalHeadingTolerance: Math.PI / 3,
    /** Radians of lineup correction per metre of lateral error. */
    lineupGain: 0.0006,
    /**
     * Radians of lineup correction per m/s of drift across the centreline.
     *
     * The damping term, and it is not optional. Position feedback alone is a
     * second-order system with no damping in it: the jet turns toward the
     * centreline, arrives with the drift it built up, sails through, turns
     * back, and each swing is bigger than the last. A first attempt entered
     * final seven hundred metres right of centre and reached short final
     * seventeen hundred metres LEFT of it.
     */
    lineupRateGain: 0.013,
    /** Cap on that correction - a 30 degree intercept, no more. */
    maxLineupCorrection: 0.52,
    /** Bank limits: gentle on final, ordinary on the join. */
    finalMaxBank: 0.45,
    joinMaxBank: 0.35,
    /**
     * Most the guidance may ask the aeroplane to come down, in metres below
     * where it currently is.
     *
     * Without this the assist commands the whole descent at once. A jet asked
     * to lose a thousand metres, turn through a hundred and eighty degrees and
     * slow from Mach 0.7 to approach speed simultaneously does all three by
     * trading its energy for none of them, and arrives in the sea - which is
     * exactly what the first version of this did from a perfectly ordinary
     * "take me home" press. Following the aeroplane down in steps turns one
     * impossible command into a series of easy ones.
     */
    maxDescentStep: 160,
    /**
     * Bank beyond which the guidance will not ask for any descent at all,
     * radians.
     *
     * In this flight model a sustained bank IS a descent: the lift vector
     * tilts, the vertical component goes, and the altitude hold cannot get it
     * back without pulling hard enough to depart. Asking for a descent ON TOP
     * of that spiralled a perfectly good jet into the sea from eight
     * kilometres out, every time, with the terrain floor pulling to the
     * vertical at the end of it. So: turn, or come down, not both. Wings
     * roughly level is the licence to descend.
     */
    descentBankLimit: 0.3
} as const;

export interface ApproachGuidance {
    phase: ApproachPhase;
    /** Heading to steer, radians. */
    bearing: number;
    /** Altitude to hold, metres above sea level. */
    altitudeMsl: number;
    /** Speed to hold, m/s. */
    airSpeed: number;
    maxBank: number;
    /** Distance to the aim point along the deck axis, metres. Negative = past it. */
    rangeToWires: number;
    /** Height above the glideslope, metres. Positive is high. */
    glideslopeError: number;
    /** Lateral offset from the centreline, metres. Positive is right. */
    lineupError: number;
}

/** Altitude the glideslope wants at a given range from the wires. */
/** Approach tuning with numeric fields widened, so values can be derived at runtime. */
export type ApproachTuning = { readonly [K in keyof typeof APPROACH_TUNING]: number };

/**
 * The approach speed to fly: the airframe's on-speed speed, bounded by what the
 * guidance can use. The floor is the historical 70 m/s; the ceiling keeps the
 * jet slow enough for the wires, which reject anything at or above 95 m/s.
 */
export function approachSpeedFor(onSpeed: number, tuning: ApproachTuning = APPROACH_TUNING): number {
    return Math.max(tuning.approachSpeed, Math.min(tuning.maxApproachSpeed, onSpeed));
}

export function glideslopeAltitude(rangeToWires: number, tuning: ApproachTuning = APPROACH_TUNING): number {
    const slope = Math.tan(tuning.glideslopeDegrees * (Math.PI / 180));
    return tuning.deckHeight + slope * Math.max(0, rangeToWires);
}

/** Smallest signed angle from `a` to `b`, radians, wrapped to [-pi, pi]. */
function headingDelta(a: number, b: number): number {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

/**
 * Is the aeroplane somewhere the glideslope can be flown from - astern of the
 * wires, inside the corridor, inside capture range, and (when a heading is
 * given) actually pointed somewhere near the final course?
 *
 * Anywhere else and the answer is to go and get behind the boat first, which
 * is what the JOIN phase is for. `headingRadians` is optional and omitting it
 * keeps the pre-v1.11.0 position-only test, which every existing caller that
 * does not track heading still gets.
 */
export function inApproachCorridor(
    position: ApproachPosition,
    tuning: ApproachTuning = APPROACH_TUNING,
    headingRadians?: number
): boolean {
    const rangeToWires = tuning.touchdownZ - position.z;
    const inPosition = rangeToWires > 0
        && rangeToWires <= tuning.captureRange
        && Math.abs(position.x) <= tuning.corridorHalfWidth;
    if (!inPosition || headingRadians === undefined) return inPosition;
    return Math.abs(headingDelta(headingRadians, tuning.finalCourse)) <= tuning.finalHeadingTolerance;
}

/**
 * Where the approach wants the aeroplane to be, right now.
 *
 * Three phases, and which one is active is a function of position alone, so
 * the guidance cannot get stuck in a mode: fly out of the corridor and it
 * goes back to joining, fly back into it and it picks the glideslope up
 * again.
 */
/** What the aeroplane is doing, as far as the approach needs to know. */
export interface ApproachMotion {
    /** Bank angle, radians. */
    bank?: number;
    /** Speed across the centreline, m/s. Positive is drifting right. */
    lateralSpeed?: number;
    /**
     * Current heading, radians. Omitting it keeps the pre-v1.11.0 corridor
     * test (position only) - see `inApproachCorridor`.
     */
    heading?: number;
}

export function approachGuidance(
    position: ApproachPosition,
    motion: ApproachMotion = {},
    tuning: ApproachTuning = APPROACH_TUNING
): ApproachGuidance {
    const bank = motion.bank ?? 0;
    const lateralSpeed = motion.lateralSpeed ?? 0;
    const rangeToWires = tuning.touchdownZ - position.z;
    const lineupError = position.x;
    const glideslopeError = position.y - glideslopeAltitude(rangeToWires, tuning);

    /**
     * Never ask for the whole descent at once, and never ask for one at all
     * in a turn - see `maxDescentStep` and `descentBankLimit`.
     */
    const turning = Math.abs(bank) > tuning.descentBankLimit;
    const stepped = (target: number) => turning
        ? Math.max(target, position.y)
        : Math.max(target, position.y - tuning.maxDescentStep);

    if (!inApproachCorridor(position, tuning)) {
        /**
         * Join: where to go to start an approach - a point astern on the
         * centreline. This is a CUE and not a hand-over: the caller flies the
         * bearing on the HUD, nobody flies it for them, and the altitude and
         * speed below are what a join would be flown at rather than something
         * the autopilot is given. Ferrying the jet home is the part this
         * flight model cannot be trusted with; see the note at the top.
         */
        const joinZ = tuning.touchdownZ - tuning.joinDistance;
        const dx = 0 - position.x;
        const dz = joinZ - position.z;
        return {
            phase: 'JOIN',
            bearing: Math.atan2(dx, dz),
            altitudeMsl: stepped(tuning.joinAltitude),
            airSpeed: tuning.joinSpeed,
            maxBank: tuning.joinMaxBank,
            rangeToWires,
            glideslopeError,
            lineupError
        };
    }

    /**
     * Regression, v1.11.0: a jet already in a good POSITION but pointed the
     * wrong way used to be handed the join-point bearing above anyway, which
     * for a close-in aeroplane points to a spot even further astern - the
     * assist chased a receding point and never actually turned around. Here
     * there is nothing to route to: the aeroplane is already where it needs
     * to be, so the fix is simply to turn and face the boat.
     */
    const headingOk = motion.heading === undefined
        || Math.abs(headingDelta(motion.heading, tuning.finalCourse)) <= tuning.finalHeadingTolerance;
    if (!headingOk) {
        return {
            phase: 'JOIN',
            bearing: tuning.finalCourse,
            altitudeMsl: stepped(tuning.patternAltitude),
            airSpeed: tuning.homeTurnSpeed,
            maxBank: tuning.homeTurnMaxBank,
            rangeToWires,
            glideslopeError,
            lineupError
        };
    }

    // Final: hold the course, corrected back toward the centreline, and fly
    // the glideslope down. Right of centreline means steering left, so the
    // correction is subtracted.
    const rawCorrection = lineupError * tuning.lineupGain
        + lateralSpeed * tuning.lineupRateGain;
    const correction = Math.max(
        -tuning.maxLineupCorrection,
        Math.min(tuning.maxLineupCorrection, rawCorrection)
    );

    // Level at pattern altitude until the slope comes down to meet it.
    const slopeHere = glideslopeAltitude(rangeToWires, tuning);
    const targetMsl = Math.min(slopeHere, tuning.patternAltitude);

    return {
        phase: rangeToWires <= tuning.handoverRange ? 'HANDOVER' : 'FINAL',
        bearing: tuning.finalCourse - correction,
        altitudeMsl: stepped(targetMsl),
        airSpeed: position.y > tuning.patternAltitude + tuning.slowDownAbove
            ? tuning.joinSpeed
            : tuning.approachSpeed,
        maxBank: tuning.finalMaxBank,
        rangeToWires,
        glideslopeError,
        lineupError
    };
}

/**
 * The line the HUD shows while the assist is flying, so the player can see
 * what it is doing and when it is going to stop doing it.
 */
export function approachCaption(guidance: ApproachGuidance): string {
    switch (guidance.phase) {
        case 'JOIN':
            // The assist does not ferry the jet home; it says where home is.
            return 'RECOVERY — GET ASTERN OF THE BOAT';
        case 'FINAL': {
            const off = Math.abs(guidance.lineupError);
            const lineup = off < LINEUP_CALLOUT
                ? 'ON CENTRELINE'
                : `STEER ${guidance.lineupError > 0 ? 'LEFT' : 'RIGHT'}`;
            return `RECOVERY — BALL AND SPEED · ${lineup}`;
        }
        case 'HANDOVER':
            return 'YOUR AEROPLANE — FLY THE BALL';
    }
}

/** Lateral error, metres, inside which the approach calls itself lined up. */
export const LINEUP_CALLOUT = 60;

// ---------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------

/**
 * Off by default on a keyboard, because the trap is the game and a player who
 * has not asked for help should not be given it. Touch mode turns it on for a
 * first-time phone player, where the alternative is not landing at all.
 */
export const DEFAULT_APPROACH_ASSIST = false;

const STORAGE_KEY = 'carrier-vector-1988.approachAssist';

/**
 * The stored choice, or null when the player has never made one. Touch mode
 * uses this to turn the assist on for a phone without overriding a decision
 * somebody actually made on a keyboard.
 */
export function storedApproachAssist(): boolean | null {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (raw === 'on') return true;
        if (raw === 'off') return false;
        return null;
    } catch {
        return null;
    }
}

/** Best-effort restore; storage can throw or be blocked and the game must boot. */
export function loadApproachAssist(): boolean {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (raw === 'on') return true;
        if (raw === 'off') return false;
        return DEFAULT_APPROACH_ASSIST;
    } catch {
        return DEFAULT_APPROACH_ASSIST;
    }
}

export function saveApproachAssist(on: boolean) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
        // The setting still holds for this session.
    }
}
