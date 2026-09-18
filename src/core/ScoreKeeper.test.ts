import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreKeeper, SCORE_VALUES } from './ScoreKeeper';

describe('ScoreKeeper', () => {
    let score: ScoreKeeper;

    beforeEach(() => {
        score = new ScoreKeeper();
    });

    it('starts at zero score with the entry rank', () => {
        expect(score.totalScore).toBe(0);
        expect(score.rank).toBe('ENSIGN');
    });

    it('values bombers higher than fighters, since bombers threaten the carrier', () => {
        expect(SCORE_VALUES.BOMBER).toBeGreaterThan(SCORE_VALUES.FIGHTER);

        score.recordKill('BOMBER');
        const bomberScore = score.totalScore;

        const fighterKeeper = new ScoreKeeper();
        fighterKeeper.recordKill('FIGHTER');

        expect(bomberScore).toBeGreaterThan(fighterKeeper.totalScore);
    });

    it('accumulates mixed kills correctly', () => {
        score.recordKill('FIGHTER');
        score.recordKill('FIGHTER');
        score.recordKill('BOMBER');
        score.recordKill('SAM');

        expect(score.breakdown.fighterKills).toBe(2);
        expect(score.breakdown.bomberKills).toBe(1);
        expect(score.breakdown.samKills).toBe(1);
        expect(score.totalScore).toBe(
            2 * SCORE_VALUES.FIGHTER + SCORE_VALUES.BOMBER + SCORE_VALUES.SAM
        );
    });

    it('awards a bonus for a 3-wire trap over any other wire', () => {
        score.recordTrap(3);
        const perfect = score.totalScore;

        const other = new ScoreKeeper();
        other.recordTrap(1);

        expect(perfect).toBeGreaterThan(other.totalScore);
        expect(score.breakdown.perfectTraps).toBe(1);
    });

    it('penalises bolters and lost airframes', () => {
        score.recordTrap('BOLTER');
        expect(score.totalScore).toBeLessThan(0);
        expect(score.breakdown.bolters).toBe(1);
        expect(score.breakdown.traps).toBe(0);

        const lost = new ScoreKeeper();
        lost.recordAirframeLost();
        expect(lost.totalScore).toBe(SCORE_VALUES.AIRFRAME_LOST);
    });

    it('promotes through the rank ladder as score climbs', () => {
        expect(score.rank).toBe('ENSIGN');

        for (let i = 0; i < 6; i++) score.recordKill('BOMBER'); // 1500
        expect(score.rank).toBe('LIEUTENANT');

        for (let i = 0; i < 20; i++) score.recordKill('BOMBER'); // +5000 = 6500
        expect(score.rank).toBe('CAPTAIN');
    });

    it('drops to NUGGET when score goes negative', () => {
        score.recordAirframeLost();
        expect(score.totalScore).toBeLessThan(0);
        expect(score.rank).toBe('NUGGET');
    });

    describe('gradeTrap', () => {
        it('grades the 3-wire as the target wire', () => {
            expect(ScoreKeeper.gradeTrap(-100)).toBe(3);
        });

        it('grades a short touchdown as the 1-wire', () => {
            expect(ScoreKeeper.gradeTrap(-120)).toBe(1);
        });

        it('grades a long touchdown as the 4-wire', () => {
            expect(ScoreKeeper.gradeTrap(-90)).toBe(4);
        });

        it('calls a bolter when touching down outside the wires entirely', () => {
            expect(ScoreKeeper.gradeTrap(-200)).toBe('BOLTER');
            expect(ScoreKeeper.gradeTrap(0)).toBe('BOLTER');
        });
    });
});
