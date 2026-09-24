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
    /**
     * The jet is flying toward the carrier, not away from it. Undefined is
     * treated as "not approaching", so a caller that has not measured closure
     * cannot accidentally re-enable the launch-time false positive.
     */
    closingOnCarrier?: boolean;
    /** A fighter has held a guns solution on the player within the last few seconds. */
    gunsTracking?: boolean;
    /** The nearest live hostile aircraft, or null when the sky is empty. */
    bandit?: {
        /** In the forward hemisphere and close enough to be worth engaging. */
        ahead: boolean;
        /** Designated with [T]. */
        locked: boolean;
        /** Inside the envelope of a weapon the pilot carries. */
        inRange: boolean;
    } | null;
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
        hint: { text: 'MISSILE INBOUND - CHAFF [X], THEN BREAK BEHIND A RIDGE', severity: 'CRITICAL' }
    },
    {
        match: (s) => !!s.gunsTracking,
        hint: { text: 'BANDIT ON YOUR TAIL - BANK HARD AND PULL, DO NOT FLY STRAIGHT', severity: 'CRITICAL' }
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
        /**
         * Only when the pilot is actually recovering.
         *
         * `distanceToCarrier < 2500 && airSpeed > 95` is true BY CONSTRUCTION
         * for the first several seconds of every catapult shot in the game -
         * you leave the boat fast and you leave it from nought metres away. So
         * the single most-seen hint in the game fired on every launch, told a
         * brand-new pilot to decelerate below 90 m/s while the objective strip
         * directly above it said CLIMB, and would have stalled them if obeyed.
         * Requiring a descent toward the deck confines it to the one phase of
         * flight it was written for.
         */
        match: (s) => s.distanceToCarrier < 2500
            && s.airSpeed > 95
            && s.closingOnCarrier === true
            && s.altitudeAgl < 400
            && s.verticalSpeed < 2,
        hint: { text: 'TOO FAST FOR THE TRAP - REDUCE TO BELOW 90 M/S [CTRL]', severity: 'WARNING' }
    },
    {
        // Slow is CORRECT on final approach, so only nag when far from the boat.
        // Otherwise this rule fires during every landing and drowns out the meatball cue.
        match: (s) => s.airSpeed < 120 && s.distanceToCarrier > 2500,
        hint: { text: 'LOW AIRSPEED - ADVANCE THROTTLE [SHIFT]', severity: 'WARNING' }
    },
    {
        match: (s) => !!s.bandit?.locked && s.bandit.inRange,
        hint: { text: 'IN RANGE - FIRE [SPACE]', severity: 'INFO' }
    },
    {
        match: (s) => !!s.bandit?.locked,
        hint: { text: 'LOCKED - TURN TOWARD THE BANDIT UNTIL IT IS IN RANGE', severity: 'INFO' }
    },
    {
        match: (s) => !!s.bandit?.ahead,
        hint: { text: 'BANDIT AHEAD - PRESS [T] TO LOCK ON', severity: 'INFO' }
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

/**
 * What the objective strip is currently asking for, as far as arbitration
 * cares. A structural subset of `ObjectiveStep`, kept here so this module
 * stays free of imports.
 */
export interface ObjectiveSummary {
    urgency: 'NORMAL' | 'ACTION' | 'URGENT';
    key?: string;
}

/** Objective keys that mean "fight now" - attack coaching agrees with these. */
const ATTACK_KEYS = new Set(['SPACE', 'T', '1', '2', '3', '4']);

/**
 * One instruction at a time.
 *
 * The objective strip, the coach ticker and the contact tags used to issue
 * orders independently. Measured on v1.9.0, 4 s after the training cat shot:
 * `CLIMB TO 2,500 FT` on the strip and `LOCKED - TURN TOWARD THE BANDIT` on the
 * ticker directly below it. Each was correct on its own; together they were
 * two different orders, and a beginner cannot obey both.
 *
 * Policy, in order:
 *  1. Safety always speaks - any CRITICAL or WARNING hint.
 *  2. An active training checkout step speaks next.
 *  3. Routine INFO coaching speaks only if it does not compete with the
 *     objective: when the objective is itself an order (ACTION / URGENT) that
 *     is not an attack, the objective IS the instruction and the ticker is
 *     silent. Attack coaching ("IN RANGE - FIRE") still speaks during an
 *     attack objective, because there it is the same instruction, sharper.
 */
export function arbitrateHint(
    contextual: Hint | null,
    trainingPrompt: string | null,
    objective: ObjectiveSummary | null
): Hint | null {
    if (contextual && contextual.severity !== 'INFO') return contextual;
    if (trainingPrompt) return { text: trainingPrompt, severity: 'INFO' };
    if (!contextual) return null;

    const objectiveIsAnOrder = objective !== null && objective.urgency !== 'NORMAL';
    const objectiveIsAttack = objective?.key !== undefined && ATTACK_KEYS.has(objective.key);
    if (objectiveIsAnOrder && !objectiveIsAttack) return null;
    return contextual;
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
    /** 2-3 word label for the on-screen checklist. */
    short: string;
    /** Key(s) the step is asking for, drawn as keycaps on the checklist. */
    keys: string[];
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
        short: 'PITCH',
        keys: ['W', 'S'],
        prompt: 'TRAINING 1/6 - PITCH: HOLD [W] NOSE UP / [S] NOSE DOWN',
        isSatisfied: (p) => p.pitchInputSeconds >= 1.0
    },
    {
        id: 'ROLL',
        short: 'ROLL',
        keys: ['A', 'D'],
        prompt: 'TRAINING 2/6 - BANK: HOLD [A] LEFT / [D] RIGHT - THE JET TURNS WHERE YOU BANK',
        isSatisfied: (p) => p.rollInputSeconds >= 1.0
    },
    {
        id: 'THROTTLE',
        short: 'THROTTLE',
        keys: ['SHIFT', 'CTRL'],
        prompt: 'TRAINING 3/6 - THROTTLE: [SHIFT] ADVANCE / [CTRL] RETARD. PAST 100% IS AFTERBURNER',
        isSatisfied: (p) => p.throttleChanged
    },
    {
        id: 'BAY',
        short: 'WEAPONS BAY',
        keys: ['B'],
        prompt: 'TRAINING 4/6 - PRESS [B] TO CYCLE THE WEAPONS BAY. OPEN DOORS QUADRUPLE YOUR RADAR SIGNATURE',
        isSatisfied: (p) => p.bayToggled
    },
    {
        id: 'GUNS',
        short: 'FIRE GUNS',
        keys: ['SPACE'],
        prompt: 'TRAINING 5/6 - PRESS [SPACE] TO FIRE THE 20MM VULCAN. [1] GUN [2] AIM-9 [3] MK.82',
        isSatisfied: (p) => p.gunFired
    },
    {
        id: 'MASKING',
        short: 'TERRAIN MASK',
        keys: ['W', 'S'],
        prompt: 'TRAINING 6/6 - DESCEND BELOW THE RIDGE LINE UNTIL THE RWR GOES SILENT (TERRAIN MASKED)',
        isSatisfied: (p) => p.hasBeenMasked
    }
];

export interface ChecklistItem {
    label: string;
    keys: string[];
    state: 'DONE' | 'ACTIVE' | 'PENDING';
}

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

    /**
     * Checklist view of the training sequence for the HUD. A new pilot could
     * previously only ever see the single current prompt, with no idea how
     * many steps there were or how far along they had got.
     */
    public checklist(): ChecklistItem[] {
        if (!this.isActive || this.isComplete) return [];
        return TRAINING_STEPS.map((step, i) => ({
            label: step.short,
            keys: step.keys,
            state: i < this.stepIndex ? 'DONE' : i === this.stepIndex ? 'ACTIVE' : 'PENDING'
        }));
    }
}
