/**
 * CARRIER VECTOR: 1988 - Desktop Pointer Interactivity & Hit Testing
 *
 * Pure geometry hit-testing for desktop mouse clicks and hover events.
 * Decoupled from Canvas2D and DOM so all click detection, button rects,
 * and boundary conditions are 100% headlessly testable with Vitest.
 */

import type { Rect } from './DeckLayout';
import type { HudLayout, ArcadeBarSlotId } from './HudLayout';
import { HUD_METRICS, arcadeBarFlags, cornerButtonRects, proChipRects, solveArcadeBar } from './HudLayout';
import type { HudDensity } from '../core/HudDensity';

export type DeckAction =
    | 'LAUNCH'
    | 'RUSH'
    | 'FUEL_MINUS'
    | 'FUEL_PLUS'
    | 'AIM9_CYCLE'
    | 'BOMB_CYCLE'
    | 'SWITCH_COCKPIT'
    | 'HELP';

export type HudAction =
    | 'WEAPON_GUN'
    | 'WEAPON_AIM9'
    | 'WEAPON_BOMB'
    | 'WEAPON_HARM'
    | 'ASSIST_CYCLE'
    | 'TIME_REWIND'
    | 'PADLOCK'
    | 'HUD_MODE'
    | 'PITCH_INVERT'
    | 'SWITCH_DECK'
    | 'HELP';

export interface ClickableArea<T> {
    id: T;
    rect: Rect;
    label: string;
}

/** Check if point (x, y) is inside Rect */
export function pointInRect(x: number, y: number, r: Rect): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export interface DeckStateSnapshot {
    aircraftState: string;
    canRush: boolean;
    plannedFuel: number;
    sidewinders: number;
    ironBombs: number;
}

/**
 * Computes all clickable button rectangles on the flight deck screen.
 */
export function solveDeckClickableAreas(
    _width: number,
    _height: number,
    deck: DeckStateSnapshot,
    panels: Record<string, Rect>
): ClickableArea<DeckAction>[] {
    const areas: ClickableArea<DeckAction>[] = [];

    // 1. Header: Cockpit switch tab button (top right)
    const headerRect = panels.header || panels.HEADER;
    if (headerRect) {
        const btnW = 140;
        const btnH = 28;
        areas.push({
            id: 'SWITCH_COCKPIT',
            rect: {
                x: headerRect.x + headerRect.w - btnW - 8,
                y: headerRect.y + 6,
                w: btnW,
                h: btnH
            },
            label: 'COCKPIT VIEW (TAB)'
        });
    }

    // 2. Turnaround Panel: Launch Catapult or Rush Crew Button
    const turnaround = panels.turnaround || panels.TURNAROUND;
    if (turnaround) {
        const isReady = deck.aircraftState === 'CATAPULT_READY';
        if (isReady) {
            areas.push({
                id: 'LAUNCH',
                rect: {
                    x: turnaround.x + 12,
                    y: turnaround.y + turnaround.h - 46,
                    w: Math.max(120, turnaround.w - 24),
                    h: 36
                },
                label: 'CATAPULT LAUNCH (ENTER)'
            });
        } else if (deck.canRush) {
            areas.push({
                id: 'RUSH',
                rect: {
                    x: turnaround.x + 12,
                    y: turnaround.y + turnaround.h - 46,
                    w: Math.max(120, turnaround.w - 24),
                    h: 36
                },
                label: 'RUSH CREW (R)'
            });
        }
    }

    // 3. Payload Panel: Fuel [-] / [+] and Ordnance click targets
    const payload = panels.payload || panels.PAYLOAD;
    if (payload) {
        const top = payload.y + 40;
        const step = Math.max(20, Math.min(32, (payload.h - 48) / 4));

        // Fuel steppers
        const fuelY = top;
        areas.push({
            id: 'FUEL_MINUS',
            rect: { x: payload.x + 10, y: fuelY - 10, w: 26, h: 22 },
            label: '-500L'
        });
        areas.push({
            id: 'FUEL_PLUS',
            rect: { x: payload.x + 40, y: fuelY - 10, w: 26, h: 22 },
            label: '+500L'
        });

        // Sidewinder cycle button
        const aim9Y = top + step;
        areas.push({
            id: 'AIM9_CYCLE',
            rect: { x: payload.x + 10, y: aim9Y - 10, w: 56, h: 22 },
            label: '+2 AIM9'
        });

        // Bomb cycle button
        const bombY = top + step * 2;
        areas.push({
            id: 'BOMB_CYCLE',
            rect: { x: payload.x + 10, y: bombY - 10, w: 56, h: 22 },
            label: '+1 BOMB'
        });
    }

    // 4. Footer shortcuts
    const footer = panels.footer || panels.FOOTER;
    if (footer) {
        areas.push({
            id: 'HELP',
            rect: { x: footer.x + footer.w - 180, y: footer.y + 12, w: 80, h: 24 },
            label: 'HELP (H)'
        });
    }

    return areas;
}

/**
 * Hit-test a mouse click on the flight deck.
 */
export function hitTestDeck(
    x: number,
    y: number,
    width: number,
    height: number,
    deck: DeckStateSnapshot,
    panels: Record<string, Rect>
): DeckAction | null {
    const areas = solveDeckClickableAreas(width, height, deck, panels);
    for (const a of areas) {
        if (pointInRect(x, y, a.rect)) return a.id;
    }
    return null;
}

export interface HudStateSnapshot {
    selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' | 'HARM';
    assistLabel: string;
    hudDensity: HudDensity;
    /** Rewind charges left - the REWIND pill is only there while this is > 0. */
    rewindsRemaining?: number;
    /** A target is designated - the PADLOCK pill is only there when it is. */
    hasDesignation?: boolean;
    padlockActive: boolean;
    pitchInverted?: boolean;
}

/**
 * Computes all clickable button rectangles on the flight HUD.
 */
export function solveHudClickableAreas(
    width: number,
    height: number,
    layout: HudLayout,
    state: HudStateSnapshot
): ClickableArea<HudAction>[] {
    const areas: ClickableArea<HudAction>[] = [];

    // When touch mode is active, touch controls handle input.
    if (layout.touchMode) return areas;

    // FIRST_FLIGHT draws no buttons, so a click falls through to
    // click-to-designate - the one thing a mouse is obviously for in flight.
    if (state.hudDensity === 'FIRST_FLIGHT') return areas;

    const isArcade = state.hudDensity === 'ARCADE';

    if (isArcade) {
        // --- ARCADE HUD BOTTOM STRIP ---
        // Same solver `HUD.ts` uses to draw this row, so the click targets
        // can never drift from what is actually on screen. The status pill
        // isn't clickable, so `statusTextWidth` is left undefined - the
        // solver then simply omits that slot.
        const bar = solveArcadeBar({
            width,
            height,
            weaponCount: 4,
            // The SAME flags the renderer uses. This passed its own
            // (showCountermeasure: false) while the renderer drew the chaff
            // pill, so every click on ASSIST / REWIND / PADLOCK landed 104 px
            // left of the pill on screen.
            ...arcadeBarFlags({
                rewindsRemaining: state.rewindsRemaining ?? 0,
                hasDesignation: state.hasDesignation ?? false,
                padlockActive: state.padlockActive
            })
        });
        const slotActions: Partial<Record<ArcadeBarSlotId, HudAction>> = {
            WEAPON_0: 'WEAPON_GUN',
            WEAPON_1: 'WEAPON_AIM9',
            WEAPON_2: 'WEAPON_BOMB',
            WEAPON_3: 'WEAPON_HARM',
            ASSIST: 'ASSIST_CYCLE',
            REWIND: 'TIME_REWIND',
            PADLOCK: 'PADLOCK'
        };
        const slotLabels: Partial<Record<ArcadeBarSlotId, string>> = {
            WEAPON_0: '1 GUN',
            WEAPON_1: '2 AIM-9',
            WEAPON_2: '3 MK82',
            WEAPON_3: '4 HARM',
            ASSIST: `ASSIST [${state.assistLabel.toUpperCase()}]`,
            REWIND: 'REWIND 5S',
            PADLOCK: state.padlockActive ? 'LOCK: ON' : 'PADLOCK'
        };
        for (const s of bar) {
            const id = slotActions[s.id];
            if (!id) continue;
            areas.push({ id, rect: s.rect, label: slotLabels[s.id] ?? '' });
        }

        pushCornerButtons(areas, width, state);
    } else {
        // --- PRO: the systems panel's weapon chips, from the renderer's solver.
        // Nothing else along the bottom is clickable: the keycap strip whose
        // shortcuts used to be registered here was removed in v1.10.0, and
        // leaving its click areas behind made them invisible traps.
        if (height >= HUD_METRICS.compactSystemsHeight) {
            const ids: HudAction[] = ['WEAPON_GUN', 'WEAPON_AIM9', 'WEAPON_BOMB', 'WEAPON_HARM'];
            const labels = ['1 GUN', '2 AIM9', '3 MK82', '4 HARM'];
            proChipRects(height).forEach((rect, i) => areas.push({ id: ids[i], rect, label: labels[i] }));
        }
        pushCornerButtons(areas, width, state);
    }

    return areas;
}

/** The top-right buttons, from the same solver the renderer uses. */
function pushCornerButtons(areas: ClickableArea<HudAction>[], width: number, state: HudStateSnapshot) {
    const r = cornerButtonRects(width);
    areas.push({ id: 'SWITCH_DECK', rect: r.deck, label: 'DECK (TAB)' });
    areas.push({ id: 'HUD_MODE', rect: r.hud, label: `HUD: ${state.hudDensity}` });
    areas.push({
        id: 'PITCH_INVERT',
        rect: r.stick,
        label: state.pitchInverted ? 'STICK: REAL (I)' : 'STICK: DIR (I)'
    });
}

/**
 * Hit-test a mouse click on the cockpit flight HUD.
 */
export function hitTestHud(
    x: number,
    y: number,
    width: number,
    height: number,
    layout: HudLayout,
    state: HudStateSnapshot
): HudAction | null {
    const areas = solveHudClickableAreas(width, height, layout, state);
    for (const a of areas) {
        if (pointInRect(x, y, a.rect)) return a.id;
    }
    return null;
}
