import { describe, it, expect } from 'vitest';
import { ScoreKeeper } from '../core/ScoreKeeper';
import {
    APPROACH_TUNING as T,
    DEFAULT_APPROACH_ASSIST,
    approachCaption,
    approachGuidance,
    glideslopeAltitude,
    inApproachCorridor,
    loadApproachAssist,
    saveApproachAssist
} from './ApproachGuidance';

const at = (x: number, y: number, z: number) => ({ x, y, z });

/** A point on the centreline at the range the glideslope wants. */
const onSlope = (rangeToWires: number) =>
    at(0, glideslopeAltitude(rangeToWires), T.touchdownZ - rangeToWires);

describe('glideslopeAltitude', () => {
    it('meets the deck at the wires', () => {
        expect(glideslopeAltitude(0)).toBe(T.deckHeight);
    });

    it('rises with range', () => {
        expect(glideslopeAltitude(2000)).toBeGreaterThan(glideslopeAltitude(1000));
    });

    it('is the standard three and a half degrees', () => {
        const rise = glideslopeAltitude(1000) - T.deckHeight;
        expect(Math.atan2(rise, 1000) * (180 / Math.PI)).toBeCloseTo(3.5, 3);
    });

    it('does not go below the deck behind the wires', () => {
        expect(glideslopeAltitude(-500)).toBe(T.deckHeight);
    });
});

describe('the aim point', () => {
    /**
     * The guidance aims at a number that lives in ScoreKeeper. If either
     * moves, the assist quietly starts flying people to a bolter.
     */
    it('is a grade the wires actually take', () => {
        expect(ScoreKeeper.gradeTrap(T.touchdownZ)).not.toBe('BOLTER');
    });

    it('is the three wire', () => {
        expect(ScoreKeeper.gradeTrap(T.touchdownZ)).toBe(3);
    });

    it('flies an approach speed the arresting gear will accept', () => {
        // The trap check refuses anything at or above 95 m/s.
        expect(T.approachSpeed).toBeLessThan(95);
    });
});

describe('inApproachCorridor', () => {
    it('accepts a jet astern, on the centreline, inside capture range', () => {
        expect(inApproachCorridor(onSlope(3000))).toBe(true);
    });

    it('rejects a jet that is past the wires', () => {
        expect(inApproachCorridor(at(0, 200, T.touchdownZ + 300))).toBe(false);
    });

    it('rejects a jet too far off the centreline', () => {
        expect(inApproachCorridor(at(T.corridorHalfWidth + 200, 200, -3000))).toBe(false);
    });

    it('rejects a jet beyond capture range', () => {
        expect(inApproachCorridor(at(0, 400, T.touchdownZ - T.captureRange - 500))).toBe(false);
    });
});

describe('approachGuidance', () => {
    it('joins the pattern from abeam the boat', () => {
        const g = approachGuidance(at(4000, T.joinAltitude, 0));
        expect(g.phase).toBe('JOIN');
        expect(g.altitudeMsl).toBe(T.joinAltitude);
        expect(g.airSpeed).toBe(T.joinSpeed);
    });

    /**
     * A jet asked to lose a thousand metres, turn through a hundred and eighty
     * degrees and slow to approach speed at the same time does all three by
     * trading its energy for none of them, and arrives in the sea. That is not
     * hypothetical - it is what the first version of this did from an entirely
     * ordinary "take me home" press.
     */
    it('walks a high jet down in steps instead of commanding the whole descent', () => {
        const high = approachGuidance(at(4000, 3000, 0));
        expect(high.altitudeMsl).toBe(3000 - T.maxDescentStep);
        expect(high.altitudeMsl).toBeGreaterThan(T.joinAltitude);
    });

    it('steps a high jet down on final too, without ever going below the slope', () => {
        const range = 3000;
        const slope = glideslopeAltitude(range);
        const g = approachGuidance(at(0, slope + 1500, T.touchdownZ - range));
        expect(g.altitudeMsl).toBeGreaterThan(slope);
        expect(g.altitudeMsl).toBe(slope + 1500 - T.maxDescentStep);
    });

    it('does not step a jet that is already low, or make it climb to a step', () => {
        const range = 3000;
        const slope = glideslopeAltitude(range);
        const low = approachGuidance(at(0, slope - 200, T.touchdownZ - range));
        expect(low.altitudeMsl).toBeCloseTo(slope, 6);
    });

    /**
     * A join that flew straight at the boat would put the jet over the deck
     * pointing the wrong way. It has to go behind it first.
     */
    it('steers to a point astern, not to the boat', () => {
        // Ahead of the boat on the centreline: the join point is behind it,
        // so the turn is through 180 degrees, not a straight run at the deck.
        const g = approachGuidance(at(0, 900, 2000));
        expect(Math.abs(g.bearing)).toBeCloseTo(Math.PI, 3);
    });

    it('offsets the join heading when the jet is off to one side', () => {
        const g = approachGuidance(at(6000, 900, -3000));
        // The join point is astern and to the left, so the heading is
        // somewhere in the left-hand half plane.
        expect(g.bearing).toBeLessThan(0);
        expect(g.phase).toBe('JOIN');
    });

    it('flies the final approach course once in the corridor', () => {
        const g = approachGuidance(onSlope(3000));
        expect(g.phase).toBe('FINAL');
        expect(g.bearing).toBeCloseTo(T.finalCourse, 6);
        expect(g.airSpeed).toBe(T.approachSpeed);
        expect(g.maxBank).toBe(T.finalMaxBank);
    });

    it('commands the glideslope altitude for the range', () => {
        const g = approachGuidance(onSlope(2000));
        expect(g.altitudeMsl).toBeCloseTo(glideslopeAltitude(2000), 6);
        expect(g.glideslopeError).toBeCloseTo(0, 6);
    });

    it('reports being high and being low', () => {
        const high = approachGuidance(at(0, glideslopeAltitude(2000) + 120, T.touchdownZ - 2000));
        const low = approachGuidance(at(0, glideslopeAltitude(2000) - 120, T.touchdownZ - 2000));
        expect(high.glideslopeError).toBeGreaterThan(0);
        expect(low.glideslopeError).toBeLessThan(0);
    });

    /**
     * Right of the centreline means steering LEFT. Getting this sign wrong
     * produces an assist that flies you further out with every correction.
     */
    it('steers back toward the centreline from the right', () => {
        const g = approachGuidance(at(400, glideslopeAltitude(3000), T.touchdownZ - 3000));
        expect(g.bearing).toBeLessThan(T.finalCourse);
        expect(g.lineupError).toBeGreaterThan(0);
    });

    it('steers back toward the centreline from the left', () => {
        const g = approachGuidance(at(-400, glideslopeAltitude(3000), T.touchdownZ - 3000));
        expect(g.bearing).toBeGreaterThan(T.finalCourse);
        expect(g.lineupError).toBeLessThan(0);
    });

    it('caps the lineup correction rather than turning perpendicular', () => {
        const g = approachGuidance(at(T.corridorHalfWidth, glideslopeAltitude(3000), T.touchdownZ - 3000));
        expect(Math.abs(g.bearing - T.finalCourse)).toBeLessThanOrEqual(T.maxLineupCorrection + 1e-9);
    });

    /**
     * The whole design: the assist stops before the interesting part.
     */
    it('hands the aeroplane back at short final', () => {
        expect(approachGuidance(onSlope(T.handoverRange - 50)).phase).toBe('HANDOVER');
        expect(approachGuidance(onSlope(T.handoverRange + 50)).phase).toBe('FINAL');
    });

    it('hands back with the boat close enough to see', () => {
        // Ten seconds or so at approach speed, not thirty.
        expect(T.handoverRange / T.approachSpeed).toBeLessThan(15);
        expect(T.handoverRange / T.approachSpeed).toBeGreaterThan(5);
    });

    /**
     * Phase is a function of position, never of history, so the guidance can
     * never get stuck in a mode the aeroplane has flown out of.
     */
    it('goes back to joining if the jet leaves the corridor', () => {
        expect(approachGuidance(onSlope(3000)).phase).toBe('FINAL');
        expect(approachGuidance(at(T.corridorHalfWidth + 500, 400, T.touchdownZ - 3000)).phase)
            .toBe('JOIN');
        expect(approachGuidance(onSlope(3000)).phase).toBe('FINAL');
    });

    it('never commands an altitude below the deck', () => {
        for (const range of [-500, 0, 200, 700, 3000, 6900]) {
            expect(approachGuidance(onSlope(range)).altitudeMsl)
                .toBeGreaterThanOrEqual(T.deckHeight);
        }
    });
});

describe('approachCaption', () => {
    it('says what the assist is doing in each phase', () => {
        // Out of the corridor it is a cue, not a hand-over: it says where to go.
        expect(approachCaption(approachGuidance(at(9000, 900, 0)))).toContain('ASTERN');
        expect(approachCaption(approachGuidance(onSlope(3000)))).toContain('BALL AND SPEED');
    });

    /**
     * Lineup is the player's job now, so the caption has to actually tell
     * them which way to go - and get the direction right.
     */
    it('calls the lineup correction the right way round', () => {
        const range = 3000;
        const slope = glideslopeAltitude(range);
        const right = approachCaption(approachGuidance(at(400, slope, T.touchdownZ - range)));
        const left = approachCaption(approachGuidance(at(-400, slope, T.touchdownZ - range)));
        expect(right).toContain('STEER LEFT');
        expect(left).toContain('STEER RIGHT');
    });

    it('says nothing about steering once it is on the centreline', () => {
        expect(approachCaption(approachGuidance(onSlope(3000)))).toContain('ON CENTRELINE');
    });

    it('says plainly when the aeroplane has been handed back', () => {
        const caption = approachCaption(approachGuidance(onSlope(200)));
        expect(caption).toContain('YOUR AEROPLANE');
    });
});

describe('approach assist preference', () => {
    const store = () => {
        const map = new Map<string, string>();
        return {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => { map.set(k, v); }
        };
    };

    it('defaults to off, because the trap is the game', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        expect(loadApproachAssist()).toBe(DEFAULT_APPROACH_ASSIST);
        expect(DEFAULT_APPROACH_ASSIST).toBe(false);
    });

    it('round-trips both states', () => {
        (globalThis as { localStorage?: unknown }).localStorage = store();
        saveApproachAssist(true);
        expect(loadApproachAssist()).toBe(true);
        saveApproachAssist(false);
        expect(loadApproachAssist()).toBe(false);
    });

    it('survives storage that throws', () => {
        (globalThis as { localStorage?: unknown }).localStorage = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        };
        expect(loadApproachAssist()).toBe(DEFAULT_APPROACH_ASSIST);
        expect(() => saveApproachAssist(true)).not.toThrow();
    });
});
