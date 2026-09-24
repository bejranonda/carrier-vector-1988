import { describe, it, expect } from 'vitest';
import { pilotMenuItems, plainInstruction, wrapMenuIndex, type PilotMenuContext } from './PilotMenu';

function ctx(over: Partial<PilotMenuContext> = {}): PilotMenuContext {
    return {
        airborne: false,
        onDeckReady: false,
        autopilotFlying: false,
        recoveryOn: false,
        hudDensityLabel: 'FIRST FLIGHT',
        muted: false,
        ...over
    };
}

describe('pilotMenuItems', () => {
    it('always starts with RESUME', () => {
        expect(pilotMenuItems(ctx())[0].id).toBe('RESUME');
    });

    it('offers LAUNCH only on the catapult', () => {
        expect(pilotMenuItems(ctx()).some(i => i.id === 'LAUNCH')).toBe(false);
        expect(pilotMenuItems(ctx({ onDeckReady: true })).some(i => i.id === 'LAUNCH')).toBe(true);
    });

    it('offers the flight items only while airborne', () => {
        const grounded = pilotMenuItems(ctx());
        expect(grounded.some(i => i.id === 'FLY_FOR_ME')).toBe(false);
        expect(grounded.some(i => i.id === 'TAKE_ME_HOME')).toBe(false);

        const airborne = pilotMenuItems(ctx({ airborne: true }));
        expect(airborne.some(i => i.id === 'FLY_FOR_ME')).toBe(true);
        expect(airborne.some(i => i.id === 'TAKE_ME_HOME')).toBe(true);
    });

    it('relabels FLY_FOR_ME to taking the stick back once the autopilot has it', () => {
        const flying = pilotMenuItems(ctx({ airborne: true, autopilotFlying: true }));
        const item = flying.find(i => i.id === 'FLY_FOR_ME');
        expect(item?.label).toBe('TAKE BACK THE STICK');
    });

    it('says recovery is already on rather than offering it twice', () => {
        const item = pilotMenuItems(ctx({ airborne: true, recoveryOn: true })).find(i => i.id === 'TAKE_ME_HOME');
        expect(item?.label).toBe('RECOVERY: ON');
    });

    it('always offers the system items: controls, instruments, sound, restart, mission select', () => {
        const ids = pilotMenuItems(ctx()).map(i => i.id);
        for (const id of ['CONTROLS', 'INSTRUMENTS', 'SOUND', 'RESTART', 'MISSION_SELECT'] as const) {
            expect(ids).toContain(id);
        }
    });

    it('every item has a unique key', () => {
        const keys = pilotMenuItems(ctx({ onDeckReady: true, airborne: true })).map(i => i.key);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('plainInstruction', () => {
    it('translates every key the game actually uses', () => {
        for (const key of ['ENTER', 'W', 'F', 'SPACE', 'TAB', '1-4']) {
            expect(plainInstruction(key).length).toBeGreaterThan(10);
        }
    });

    it('mentions L for a recovery objective with no key of its own', () => {
        expect(plainInstruction(undefined, 'TRAP ABOARD')).toMatch(/\bL\b/);
    });

    it('never throws on an unknown key', () => {
        expect(() => plainInstruction('Z', 'SOMETHING ELSE')).not.toThrow();
    });
});

describe('wrapMenuIndex', () => {
    it('wraps forward past the end', () => {
        expect(wrapMenuIndex(3, 3)).toBe(0);
    });

    it('wraps backward past the start', () => {
        expect(wrapMenuIndex(-1, 3)).toBe(2);
    });

    it('passes an in-range index through unchanged', () => {
        expect(wrapMenuIndex(1, 3)).toBe(1);
    });

    it('never throws on an empty list', () => {
        expect(wrapMenuIndex(5, 0)).toBe(0);
    });
});
