/**
 * CARRIER VECTOR: 1988 - Sortie Scoring & Aviator Rank
 *
 * Pure bookkeeping: no canvas, no timers, no globals. Everything here is
 * deterministic so it can be exercised headlessly under Vitest.
 *
 * Scoring philosophy: reward interception (stopping bombers before they
 * reach the boat is the entire point of the mission), reward airmanship
 * (a clean 3-wire trap beats a bolter, bringing the jet home beats losing
 * it), and penalise attrition (lost airframes and hull damage).
 */

export type KillType = 'FIGHTER' | 'BOMBER' | 'SAM';

/** Arresting wire caught on recovery. 3-wire is the target; 1 is dangerously short. */
export type TrapGrade = 1 | 2 | 3 | 4 | 'BOLTER';

export interface ScoreBreakdown {
    fighterKills: number;
    bomberKills: number;
    samKills: number;
    traps: number;
    bolters: number;
    perfectTraps: number;   // 3-wire recoveries
    airframesLost: number;
    hullDamageTaken: number;
    wavesSurvived: number;
}

export const SCORE_VALUES = {
    FIGHTER: 100,
    BOMBER: 250,      // bombers are the real threat to the carrier
    SAM: 150,
    TRAP: 75,
    PERFECT_TRAP: 150,
    BOLTER: -25,
    AIRFRAME_LOST: -200,
    HULL_DAMAGE_PER_PCT: -10,
    WAVE_SURVIVED: 200
} as const;

export interface Rank {
    title: string;
    minScore: number;
}

/** Ascending rank ladder. Highest entry whose minScore is met wins. */
export const RANKS: Rank[] = [
    { title: 'NUGGET', minScore: -Infinity },
    { title: 'ENSIGN', minScore: 0 },
    { title: 'LIEUTENANT (JG)', minScore: 500 },
    { title: 'LIEUTENANT', minScore: 1200 },
    { title: 'LT COMMANDER', minScore: 2200 },
    { title: 'COMMANDER', minScore: 3500 },
    { title: 'CAPTAIN', minScore: 5500 },
    { title: 'ADMIRAL', minScore: 8000 }
];

export class ScoreKeeper {
    public breakdown: ScoreBreakdown = {
        fighterKills: 0,
        bomberKills: 0,
        samKills: 0,
        traps: 0,
        bolters: 0,
        perfectTraps: 0,
        airframesLost: 0,
        hullDamageTaken: 0,
        wavesSurvived: 0
    };

    public recordKill(type: KillType) {
        if (type === 'FIGHTER') this.breakdown.fighterKills++;
        else if (type === 'BOMBER') this.breakdown.bomberKills++;
        else this.breakdown.samKills++;
    }

    public recordTrap(grade: TrapGrade) {
        if (grade === 'BOLTER') {
            this.breakdown.bolters++;
            return;
        }
        this.breakdown.traps++;
        if (grade === 3) this.breakdown.perfectTraps++;
    }

    public recordAirframeLost() {
        this.breakdown.airframesLost++;
    }

    public recordHullDamage(percent: number) {
        this.breakdown.hullDamageTaken += Math.max(0, percent);
    }

    public recordWaveSurvived() {
        this.breakdown.wavesSurvived++;
    }

    public get totalScore(): number {
        const b = this.breakdown;
        return Math.round(
            b.fighterKills * SCORE_VALUES.FIGHTER +
            b.bomberKills * SCORE_VALUES.BOMBER +
            b.samKills * SCORE_VALUES.SAM +
            b.traps * SCORE_VALUES.TRAP +
            b.perfectTraps * SCORE_VALUES.PERFECT_TRAP +
            b.bolters * SCORE_VALUES.BOLTER +
            b.airframesLost * SCORE_VALUES.AIRFRAME_LOST +
            b.hullDamageTaken * SCORE_VALUES.HULL_DAMAGE_PER_PCT +
            b.wavesSurvived * SCORE_VALUES.WAVE_SURVIVED
        );
    }

    public get rank(): string {
        const score = this.totalScore;
        let current = RANKS[0].title;
        for (const r of RANKS) {
            if (score >= r.minScore) current = r.title;
        }
        return current;
    }

    /**
     * Grade a recovery from how far down the angled deck the hook caught.
     * The four arresting wires are modelled at z = -120, -110, -100, -90
     * (matching the carrier wireframe model), so touchdown Z maps directly
     * onto a wire number. Landing long (past the last wire) is a bolter.
     */
    public static gradeTrap(touchdownZ: number): TrapGrade {
        if (touchdownZ < -125 || touchdownZ > -85) return 'BOLTER';
        if (touchdownZ <= -115) return 1;
        if (touchdownZ <= -105) return 2;
        if (touchdownZ <= -95) return 3;
        return 4;
    }
}
