/**
 * CARRIER VECTOR: 1988 - Terrain Following
 *
 * WHY THIS EXISTS
 * The autopilot held a bearing, an altitude and a speed, and nothing looked
 * forward. Ground clearance was kept by `terrainFloor()`, which works by
 * pulling up once the ground is already close - a reactive law, and a
 * reactive law can only ever climb OVER terrain. In a fjord that is exactly
 * the wrong answer: the ridge you just cleared is the ridge the SA-6 belt was
 * watching, and handing the jet to the autopilot on the `CANYON_STRIKE`
 * ingress got you locked.
 *
 * Terrain following is the anticipatory half. It samples the ground ahead
 * along the track and asks, for each sample, "how high do I have to be RIGHT
 * NOW to be `clearance` above that point when I get there?" - which is lower
 * than the ridge itself, because there is time to climb on the way. The
 * highest of those answers is the altitude to fly. The jet therefore starts up
 * the face of a ridge before it arrives, crosses it with the set clearance,
 * and - because the answer drops away the moment the ridge is behind - sinks
 * back into the valley instead of cruising at ridge height with everything
 * that lives there looking straight at it.
 *
 * Pure. The terrain is injected as an elevation function, so this is testable
 * against a synthetic ridge with no terrain generator, no renderer and no
 * flight model.
 */

/** One point on the ground track ahead of the aircraft. */
export interface GroundSample {
    /** Metres ahead along the track. */
    distance: number;
    /** Terrain elevation there, metres MSL. */
    elevation: number;
}

export const TF_TUNING = {
    /**
     * Height to hold above flat ground, metres.
     *
     * Deliberately just above `ASSIST_TUNING.floorAgl` (180). Below that the
     * terrain floor starts blending in a pull-up on height alone, and a
     * terrain follower that sets an altitude the floor immediately fights is
     * two laws arguing through the elevator. Two hundred metres also sits well
     * under the ridge lines on all three maps, which is the whole point.
     */
    setClearance: 200,
    /**
     * How far ahead to look, in seconds of flight. Distance rather than time
     * would be wrong at both ends: 4 km is next to no warning at Mach 0.9 and
     * an eternity at approach speed.
     */
    lookaheadSeconds: 14,
    /** Clamps on the above, metres. */
    minLookahead: 1200,
    maxLookahead: 7000,
    /** Samples along the track. Fourteen at 7 km is a reading every 500 m. */
    samples: 14,
    /**
     * Climb rate the planner may assume, m/s.
     *
     * Conservative on purpose - the jet can beat this clean and level, and
     * cannot while banked, low on energy or carrying bombs. Assuming a climb
     * rate you do not have is how a terrain follower flies into the ridge it
     * was planning to clear.
     */
    assumedClimbRate: 22,
    /** Speed floor for the time-to-reach maths, m/s. */
    minPlanningSpeed: 60
} as const;

export interface TerrainFollowingResult {
    /** Altitude above the ground directly below to command, metres. */
    altitudeAgl: number;
    /** The sample that set the answer, for the HUD and for tests. */
    drivenBy: GroundSample | null;
    /** True when a ridge ahead - not the ground below - is setting the altitude. */
    climbing: boolean;
}

/**
 * How far ahead to sample, given the current speed.
 */
export function lookaheadDistance(airSpeed: number, tuning = TF_TUNING): number {
    const raw = Math.max(0, airSpeed) * tuning.lookaheadSeconds;
    return Math.min(tuning.maxLookahead, Math.max(tuning.minLookahead, raw));
}

/**
 * Walk the ground track ahead of the aircraft, sampling terrain elevation.
 *
 * Pure given `elevationAt`. The track is the aircraft's heading projected onto
 * the ground - not its velocity vector, because in a banked turn the velocity
 * vector is already swinging and sampling along it makes the commanded
 * altitude oscillate with the roll.
 */
export function sampleGroundTrack(
    position: { x: number; z: number },
    yaw: number,
    airSpeed: number,
    elevationAt: (x: number, z: number) => number,
    tuning = TF_TUNING
): GroundSample[] {
    const reach = lookaheadDistance(airSpeed, tuning);
    const dirX = Math.sin(yaw);
    const dirZ = Math.cos(yaw);

    const out: GroundSample[] = [];
    for (let i = 1; i <= tuning.samples; i++) {
        const distance = (reach * i) / tuning.samples;
        out.push({
            distance,
            elevation: elevationAt(position.x + dirX * distance, position.z + dirZ * distance)
        });
    }
    return out;
}

/**
 * The altitude to fly, as height above the ground directly below.
 *
 * For each sample the required MSL altitude is
 *
 *     elevation + clearance - climbRate * (distance / speed)
 *
 * i.e. the ridge height, plus the clearance, minus what can be climbed on the
 * way there. Near samples subtract almost nothing and dominate; far ones
 * subtract a lot and usually fall below the flat-ground answer, which is why
 * the jet does not start climbing for a mountain six kilometres out.
 */
export function terrainFollowingAltitude(
    samples: readonly GroundSample[],
    elevationBelow: number,
    airSpeed: number,
    tuning = TF_TUNING
): TerrainFollowingResult {
    const speed = Math.max(tuning.minPlanningSpeed, airSpeed);

    // The floor: the set clearance over the ground we are actually above.
    let bestMsl = elevationBelow + tuning.setClearance;
    let drivenBy: GroundSample | null = null;

    for (const sample of samples) {
        const climbAvailable = tuning.assumedClimbRate * (sample.distance / speed);
        const requiredMsl = sample.elevation + tuning.setClearance - climbAvailable;
        if (requiredMsl > bestMsl) {
            bestMsl = requiredMsl;
            drivenBy = sample;
        }
    }

    return {
        altitudeAgl: Math.max(tuning.setClearance, bestMsl - elevationBelow),
        drivenBy,
        climbing: drivenBy !== null
    };
}

// ---------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------

/**
 * On by default.
 *
 * The autopilot's job is to fly the aeroplane the way a competent pilot
 * would, and a competent pilot does not cross a ridge line at two thousand
 * feet inside a SAM belt. A player who wants the old behaviour - or who finds
 * the valley-hugging uncomfortable to watch - is one key away from it.
 */
export const DEFAULT_TERRAIN_FOLLOWING = true;

const STORAGE_KEY = 'carrier-vector-1988.terrainFollowing';

/** Best-effort restore; storage can throw or be blocked and the game must boot. */
export function loadTerrainFollowing(): boolean {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (raw === 'on') return true;
        if (raw === 'off') return false;
        return DEFAULT_TERRAIN_FOLLOWING;
    } catch {
        return DEFAULT_TERRAIN_FOLLOWING;
    }
}

export function saveTerrainFollowing(on: boolean) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
        // The setting still holds for this session.
    }
}
