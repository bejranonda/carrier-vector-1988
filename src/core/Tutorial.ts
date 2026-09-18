/**
 * CARRIER VECTOR: 1988 - Contextual Flight Coach & Training Sequence
 *
 * Pure logic, deliberately free of canvas/DOM so the whole thing is
 * headlessly testable. The renderer asks this module "what should the
 * pilot be told right now?" and draws whatever string comes back.
 *
 * Two layers:
 *  1. A priority-ranked contextual coach. Many conditions can be true at
 *     once (stalled AND low fuel AND missile inbound); the pilot can only
 *     act on one, so we always surface the most lethal one first.
 *  2. A first-run training sequence that walks a new pilot through the
 *     control set, each step advancing only once the pilot demonstrates it.
 */

export type HintSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Hint {
    text: string;
    severity: HintSeverity;
}

/** Everything the coach is allowed to look at. Keeps the coupling explicit. */
export interface CoachSnapshot {
    isStalled: boolean;
    rwrState: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH';
    altitudeAgl: number;      // metres above ground
    verticalSpeed: number;    // m/s, negative = descending
    fuel: number;             // litres remaining
    airSpeed: number;         // m/s
    damage: number;           // 0-100
    distanceToCarrier: number;// metres
    isAirborne: boolean;
    bayOpen: boolean;
}

/**
 * Ordered most-lethal-first. The first rule whose predicate matches wins,
 * so rule order here IS the priority policy.
 */
const COACH_RULES: { match: (s: CoachSnapshot) => boolean; hint: Hint }[] = [
    {
        match: (s) => s.isStalled,
        hint: { text: 'STALL - PUSH NOSE DOWN [S] AND ADD POWER [SHIFT]', severity: 'CRITICAL' }
    },
    {
        match: (s) => s.altitudeAgl < 150 && s.verticalSpeed < -5,
        hint: { text: 'TERRAIN - PULL UP [W]', severity: 'CRITICAL' }
    },
    {
        match: (s) => s.rwrState === 'LAUNCH',
        hint: { text: 'MISSILE INBOUND - DIVE BELOW THE RIDGE LINE TO BREAK LOCK', severity: 'CRITICAL' }
    },
    {
        match: (s) => s.damage >= 60,
        hint: { text: 'HEAVY BATTLE DAMAGE - RETURN TO CARRIER IMMEDIATELY', severity: 'CRITICAL' }
    },
    {
        match: (s) => s.fuel < 800,
        hint: { text: 'BINGO FUEL - COME LEFT AND RETURN TO THE BOAT', severity: 'WARNING' }
    },
    {
        match: (s) => s.rwrState === 'TRACK',
        hint: { text: 'RADAR LOCK - DESCEND INTO THE CANYON TO MASK', severity: 'WARNING' }
    },
    {
        match: (s) => s.bayOpen && s.rwrState !== 'SILENT',
        hint: { text: 'BAY DOORS OPEN - RCS x4.0, CLOSE THEM [B]', severity: 'WARNING' }
    },
    {
        match: (s) => s.distanceToCarrier < 2500 && s.airSpeed > 95,
        hint: { text: 'TOO FAST FOR THE TRAP - REDUCE TO BELOW 90 M/S [CTRL]', severity: 'WARNING' }
    },
    {
        // Slow is CORRECT on final approach, so only nag when far from the boat.
        // Otherwise this rule fires during every landing and drowns out the meatball cue.
        match: (s) => s.airSpeed < 120 && s.distanceToCarrier > 2500,
        hint: { text: 'LOW AIRSPEED - ADVANCE THROTTLE [SHIFT]', severity: 'WARNING' }
    },
    {
        match: (s) => s.rwrState === 'SEARCH',
        hint: { text: 'SAM RADAR SEARCHING - STAY LOW', severity: 'INFO' }
    },
    {
        match: (s) => s.distanceToCarrier < 2500,
        hint: { text: 'ON APPROACH - LINE UP WITH THE DECK, FLY THE MEATBALL', severity: 'INFO' }
    }
];

/**
 * Returns the single highest-priority hint for the current state, or null
 * if everything is nominal and the pilot should be left alone.
 */
export function getContextualHint(snapshot: CoachSnapshot): Hint | null {
    if (!snapshot.isAirborne) return null;

    for (const rule of COACH_RULES) {
        if (rule.match(snapshot)) return rule.hint;
    }
    return null;
}

// ---------------------------------------------------------------------
// First-run training sequence
// ---------------------------------------------------------------------

export type TrainingStepId =
    | 'PITCH'
    | 'ROLL'
    | 'THROTTLE'
    | 'BAY'
    | 'GUNS'
    | 'MASKING'
    | 'COMPLETE';

export interface TrainingStep {
    id: TrainingStepId;
    prompt: string;
    /** Pilot has demonstrated this step. */
    isSatisfied: (s: TrainingProgress) => boolean;
}

/** Cumulative evidence that the pilot has exercised each control. */
export interface TrainingProgress {
    pitchInputSeconds: number;
    rollInputSeconds: number;
    throttleChanged: boolean;
    bayToggled: boolean;
    gunFired: boolean;
    hasBeenMasked: boolean;
}

export const TRAINING_STEPS: TrainingStep[] = [
    {
        id: 'PITCH',
        prompt: 'TRAINING 1/6 - PITCH: HOLD [W] NOSE UP / [S] NOSE DOWN',
        isSatisfied: (p) => p.pitchInputSeconds >= 1.0
    },
    {
        id: 'ROLL',
        prompt: 'TRAINING 2/6 - ROLL: HOLD [A] LEFT / [D] RIGHT TO BANK',
        isSatisfied: (p) => p.rollInputSeconds >= 1.0
    },
    {
        id: 'THROTTLE',
        prompt: 'TRAINING 3/6 - THROTTLE: [SHIFT] ADVANCE / [CTRL] RETARD. PAST 100% IS AFTERBURNER',
        isSatisfied: (p) => p.throttleChanged
    },
    {
        id: 'BAY',
        prompt: 'TRAINING 4/6 - PRESS [B] TO CYCLE THE WEAPONS BAY. OPEN DOORS QUADRUPLE YOUR RADAR SIGNATURE',
        isSatisfied: (p) => p.bayToggled
    },
    {
        id: 'GUNS',
        prompt: 'TRAINING 5/6 - PRESS [SPACE] TO FIRE THE 20MM VULCAN. [1] GUN [2] AIM-9 [3] MK.82',
        isSatisfied: (p) => p.gunFired
    },
    {
        id: 'MASKING',
        prompt: 'TRAINING 6/6 - DESCEND BELOW THE RIDGE LINE UNTIL THE RWR GOES SILENT (TERRAIN MASKED)',
        isSatisfied: (p) => p.hasBeenMasked
    }
];

export class TrainingSequence {
    public progress: TrainingProgress = {
        pitchInputSeconds: 0,
        rollInputSeconds: 0,
        throttleChanged: false,
        bayToggled: false,
        gunFired: false,
        hasBeenMasked: false
    };

    private stepIndex = 0;
    public isActive = true;

    public get currentStep(): TrainingStep | null {
        if (!this.isActive || this.stepIndex >= TRAINING_STEPS.length) return null;
        return TRAINING_STEPS[this.stepIndex];
    }

    public get isComplete(): boolean {
        return this.stepIndex >= TRAINING_STEPS.length;
    }

    /** Advance past any steps the pilot has now satisfied. */
    public update() {
        while (
            this.stepIndex < TRAINING_STEPS.length &&
            TRAINING_STEPS[this.stepIndex].isSatisfied(this.progress)
        ) {
            this.stepIndex++;
        }
    }

    public skip() {
        this.isActive = false;
        this.stepIndex = TRAINING_STEPS.length;
    }
}
