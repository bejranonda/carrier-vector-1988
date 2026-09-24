import { describe, it, expect } from 'vitest';
import {
    pointInRect,
    solveDeckClickableAreas,
    hitTestDeck,
    solveHudClickableAreas,
    hitTestHud
} from './PointerInteractivity';
import { solveHudLayout, solveArcadeBar, arcadeBarFlags, cornerButtonRects, proChipRects } from './HudLayout';

describe('PointerInteractivity', () => {
    describe('pointInRect', () => {
        it('accurately identifies points inside and outside a rectangle', () => {
            const r = { x: 10, y: 20, w: 100, h: 50 };
            expect(pointInRect(15, 25, r)).toBe(true);
            expect(pointInRect(10, 20, r)).toBe(true);
            expect(pointInRect(110, 70, r)).toBe(true);
            expect(pointInRect(9, 25, r)).toBe(false);
            expect(pointInRect(111, 25, r)).toBe(false);
            expect(pointInRect(50, 71, r)).toBe(false);
        });
    });

    describe('solveDeckClickableAreas & hitTestDeck', () => {
        const panels = {
            header: { x: 24, y: 10, w: 900, h: 50 },
            turnaround: { x: 24, y: 70, w: 280, h: 200 },
            payload: { x: 320, y: 70, w: 280, h: 200 },
            footer: { x: 24, y: 550, w: 900, h: 40 }
        };

        it('detects catapult launch click when ready', () => {
            const deck = {
                aircraftState: 'CATAPULT_READY',
                canRush: false,
                plannedFuel: 3500,
                sidewinders: 4,
                ironBombs: 2
            };
            const areas = solveDeckClickableAreas(1000, 600, deck, panels);
            const launchArea = areas.find(a => a.id === 'LAUNCH');
            expect(launchArea).toBeDefined();

            // Hit test inside launch button
            const hit = hitTestDeck(
                launchArea!.rect.x + 10,
                launchArea!.rect.y + 10,
                1000,
                600,
                deck,
                panels
            );
            expect(hit).toBe('LAUNCH');
        });

        it('detects rush click when turnaround can be rushed', () => {
            const deck = {
                aircraftState: 'ARMING_REFUELING',
                canRush: true,
                plannedFuel: 3500,
                sidewinders: 4,
                ironBombs: 2
            };
            const areas = solveDeckClickableAreas(1000, 600, deck, panels);
            const rushArea = areas.find(a => a.id === 'RUSH');
            expect(rushArea).toBeDefined();

            const hit = hitTestDeck(
                rushArea!.rect.x + 5,
                rushArea!.rect.y + 5,
                1000,
                600,
                deck,
                panels
            );
            expect(hit).toBe('RUSH');
        });

        it('detects cockpit switch button in header', () => {
            const deck = {
                aircraftState: 'AIRBORNE',
                canRush: false,
                plannedFuel: 3500,
                sidewinders: 4,
                ironBombs: 2
            };
            const areas = solveDeckClickableAreas(1000, 600, deck, panels);
            const cockpitBtn = areas.find(a => a.id === 'SWITCH_COCKPIT');
            expect(cockpitBtn).toBeDefined();

            const hit = hitTestDeck(
                cockpitBtn!.rect.x + 5,
                cockpitBtn!.rect.y + 5,
                1000,
                600,
                deck,
                panels
            );
            expect(hit).toBe('SWITCH_COCKPIT');
        });

        it('detects fuel stepper buttons', () => {
            const deck = {
                aircraftState: 'ARMING_REFUELING',
                canRush: false,
                plannedFuel: 3500,
                sidewinders: 4,
                ironBombs: 2
            };
            const areas = solveDeckClickableAreas(1000, 600, deck, panels);
            const fuelMinus = areas.find(a => a.id === 'FUEL_MINUS');
            const fuelPlus = areas.find(a => a.id === 'FUEL_PLUS');
            expect(fuelMinus).toBeDefined();
            expect(fuelPlus).toBeDefined();

            expect(hitTestDeck(fuelMinus!.rect.x + 2, fuelMinus!.rect.y + 2, 1000, 600, deck, panels)).toBe('FUEL_MINUS');
            expect(hitTestDeck(fuelPlus!.rect.x + 2, fuelPlus!.rect.y + 2, 1000, 600, deck, panels)).toBe('FUEL_PLUS');
        });
    });

    describe('solveHudClickableAreas & hitTestHud', () => {
        const layout = solveHudLayout({ width: 1280, height: 720, showApproach: false, hasChecklist: false });

        it('detects weapon pills in arcade HUD mode', () => {
            const state = {
                selectedWeapon: 'GUN' as const,
                assistLabel: 'assist',
                hudDensity: 'ARCADE' as const,
                padlockActive: false,
                rewindsRemaining: 2
            };
            const areas = solveHudClickableAreas(1280, 720, layout, state);
            const gunPill = areas.find(a => a.id === 'WEAPON_GUN');
            const aim9Pill = areas.find(a => a.id === 'WEAPON_AIM9');
            const bombPill = areas.find(a => a.id === 'WEAPON_BOMB');
            const assistPill = areas.find(a => a.id === 'ASSIST_CYCLE');
            const rewindPill = areas.find(a => a.id === 'TIME_REWIND');

            expect(gunPill).toBeDefined();
            expect(aim9Pill).toBeDefined();
            expect(bombPill).toBeDefined();
            expect(assistPill).toBeDefined();
            expect(rewindPill).toBeDefined();

            expect(hitTestHud(aim9Pill!.rect.x + 5, aim9Pill!.rect.y + 5, 1280, 720, layout, state)).toBe('WEAPON_AIM9');
            expect(hitTestHud(assistPill!.rect.x + 5, assistPill!.rect.y + 5, 1280, 720, layout, state)).toBe('ASSIST_CYCLE');
        });

        /**
         * Regression, v1.10.0: the hit-tester passed its own pill flags
         * (no chaff pill) while the renderer drew the chaff pill, so every click
         * on ASSIST / REWIND / PADLOCK landed 104 px left of the visible pill.
         * Both now read `arcadeBarFlags`; this pins them to the same rects.
         */
        it('puts every clickable pill exactly where the renderer draws it', () => {
            for (const ctxState of [
                { rewindsRemaining: 2, hasDesignation: true, padlockActive: false },
                { rewindsRemaining: 0, hasDesignation: false, padlockActive: false },
                { rewindsRemaining: 1, hasDesignation: false, padlockActive: true }
            ]) {
                const state = {
                    selectedWeapon: 'GUN' as const,
                    assistLabel: 'assist',
                    hudDensity: 'ARCADE' as const,
                    ...ctxState
                };
                const drawn = solveArcadeBar({ width: 1280, height: 720, weaponCount: 4, ...arcadeBarFlags(ctxState) });
                const clickable = solveHudClickableAreas(1280, 720, layout, state);
                const pairs: [string, string][] = [
                    ['WEAPON_0', 'WEAPON_GUN'], ['ASSIST', 'ASSIST_CYCLE'],
                    ['REWIND', 'TIME_REWIND'], ['PADLOCK', 'PADLOCK']
                ];
                for (const [slotId, actionId] of pairs) {
                    const slot = drawn.find(d => d.id === slotId);
                    const area = clickable.find(a => a.id === actionId);
                    expect(Boolean(area), `${actionId} clickable iff drawn`).toBe(Boolean(slot));
                    if (slot && area) expect(area.rect).toEqual(slot.rect);
                }
            }
        });

        it('clicks the PRO chips and corner buttons exactly where they are drawn (#45)', () => {
            const state = { selectedWeapon: 'GUN' as const, assistLabel: 'assist', hudDensity: 'PRO' as const, padlockActive: false };
            const areas = solveHudClickableAreas(1440, 900, layout, state);
            const chips = proChipRects(900);
            expect(areas.find(a => a.id === 'WEAPON_GUN')?.rect).toEqual(chips[0]);
            expect(areas.find(a => a.id === 'WEAPON_HARM')?.rect).toEqual(chips[3]);
            const corner = cornerButtonRects(1440);
            expect(areas.find(a => a.id === 'HUD_MODE')?.rect).toEqual(corner.hud);
            expect(areas.find(a => a.id === 'SWITCH_DECK')?.rect).toEqual(corner.deck);
            expect(areas.find(a => a.id === 'PITCH_INVERT')?.rect).toEqual(corner.stick);
        });

        it('leaves no invisible click traps where the removed keycap strip was', () => {
            const state = { selectedWeapon: 'GUN' as const, assistLabel: 'assist', hudDensity: 'PRO' as const, padlockActive: false };
            // The old strip's ASSIST / PADLOCK / DECK shortcuts were registered here.
            for (const x of [300, 400, 500]) {
                expect(hitTestHud(x, 900 - 30, 1440, 900, layout, state)).toBeNull();
            }
        });

        it('offers no HUD buttons in FIRST_FLIGHT, so a click designates instead', () => {
            const areas = solveHudClickableAreas(1280, 720, layout, {
                selectedWeapon: 'GUN', assistLabel: 'assist', hudDensity: 'FIRST_FLIGHT', padlockActive: false
            });
            expect(areas).toEqual([]);
        });

        it('shows REWIND only while charges remain, and PADLOCK only with a designation', () => {
            expect(arcadeBarFlags({ rewindsRemaining: 0, hasDesignation: false, padlockActive: false }))
                .toEqual({ showCountermeasure: true, showRewind: false, showPadlock: false });
            expect(arcadeBarFlags({ rewindsRemaining: 2, hasDesignation: true, padlockActive: false }))
                .toEqual({ showCountermeasure: true, showRewind: true, showPadlock: true });
        });

        it('detects deck switch button and hud mode toggle', () => {
            const state = {
                selectedWeapon: 'GUN' as const,
                assistLabel: 'assist',
                hudDensity: 'ARCADE' as const,
                padlockActive: false
            };
            const areas = solveHudClickableAreas(1280, 720, layout, state);
            const deckBtn = areas.find(a => a.id === 'SWITCH_DECK');
            const hudModeBtn = areas.find(a => a.id === 'HUD_MODE');

            expect(deckBtn).toBeDefined();
            expect(hudModeBtn).toBeDefined();

            expect(hitTestHud(deckBtn!.rect.x + 5, deckBtn!.rect.y + 5, 1280, 720, layout, state)).toBe('SWITCH_DECK');
            expect(hitTestHud(hudModeBtn!.rect.x + 5, hudModeBtn!.rect.y + 5, 1280, 720, layout, state)).toBe('HUD_MODE');
        });

        it('returns empty areas in touch mode because touch controls handle input', () => {
            const touchLayout = solveHudLayout({ width: 800, height: 400, showApproach: false, hasChecklist: false, touchMode: true });
            const state = {
                selectedWeapon: 'GUN' as const,
                assistLabel: 'assist',
                hudDensity: 'ARCADE' as const,
                padlockActive: false
            };
            const areas = solveHudClickableAreas(800, 400, touchLayout, state);
            expect(areas).toHaveLength(0);
        });
    });
});
