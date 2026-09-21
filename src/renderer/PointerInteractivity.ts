/**
 * CARRIER VECTOR: 1988 - Desktop Pointer Interactivity & Hit Testing
 *
 * Pure geometry hit-testing for desktop mouse clicks and hover events.
 * Decoupled from Canvas2D and DOM so all click detection, button rects,
 * and boundary conditions are 100% headlessly testable with Vitest.
 */

import type { Rect } from './DeckLayout';
import type { HudLayout, ArcadeBarSlotId } from './HudLayout';
import { HUD_METRICS, solveArcadeBar } from './HudLayout';

export type DeckAction =
    | 'LAUNCH'
    | 'RUSH'
    | 'FUEL_MINUS'
    | 'FUEL_PLUS'
    | 'AIM9_CYCLE'
    | 'BOMB_CYCLE'
    | 'SWITCH_COCKPIT'
    | 'HELP'
    | 'STYLE';

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
        areas.push({
            id: 'STYLE',
            rect: { x: footer.x + footer.w - 90, y: footer.y + 12, w: 80, h: 24 },
            label: 'STYLE (P)'
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
    hudDensity: 'ARCADE' | 'PRO';
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
            showCountermeasure: false,
            showRewind: true,
            showPadlock: true
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

        // Top right controls: Deck View, HUD Mode, and Flight Stick Mode
        const rightBtnW = 100;
        areas.push({
            id: 'SWITCH_DECK',
            rect: { x: width - rightBtnW - 20, y: 16, w: rightBtnW, h: 30 },
            label: 'DECK (TAB)'
        });
        areas.push({
            id: 'HUD_MODE',
            rect: { x: width - rightBtnW * 2 - 28, y: 16, w: rightBtnW, h: 30 },
            label: 'HUD: ARCADE'
        });
        const stickBtnW = 104;
        areas.push({
            id: 'PITCH_INVERT',
            rect: { x: width - rightBtnW * 2 - stickBtnW - 36, y: 16, w: stickBtnW, h: 30 },
            label: state.pitchInverted ? 'STICK: REAL (I)' : 'STICK: DIR (I)'
        });
    } else {
        // --- PRO HUD SYSTEMS PANEL WEAPONS ---
        const sysH = 150;
        const sysX = HUD_METRICS.edge;
        const sysY = height - sysH - 54;

        // In Pro HUD, the weapon chips sit at bottom of systems panel:
        const chipY = sysY + sysH - 28;
        const chipW = 68;
        const chipH = 22;

        areas.push({
            id: 'WEAPON_GUN',
            rect: { x: sysX + 12, y: chipY, w: chipW, h: chipH },
            label: '1 GUN'
        });
        areas.push({
            id: 'WEAPON_AIM9',
            rect: { x: sysX + 12 + chipW + 6, y: chipY, w: chipW, h: chipH },
            label: '2 AIM9'
        });
        areas.push({
            id: 'WEAPON_BOMB',
            rect: { x: sysX + 12 + (chipW + 6) * 2, y: chipY, w: chipW, h: chipH },
            label: '3 MK82'
        });
        areas.push({
            id: 'WEAPON_HARM',
            rect: { x: sysX + 12 + (chipW + 6) * 3, y: chipY, w: chipW, h: chipH },
            label: '4 HARM'
        });

        // Bottom keybar clickable shortcuts
        const y = height - 34;
        areas.push({
            id: 'ASSIST_CYCLE',
            rect: { x: 280, y, w: 90, h: 24 },
            label: 'ASSIST (F)'
        });
        areas.push({
            id: 'PADLOCK',
            rect: { x: 380, y, w: 90, h: 24 },
            label: 'PADLOCK (V)'
        });
        areas.push({
            id: 'SWITCH_DECK',
            rect: { x: 480, y, w: 90, h: 24 },
            label: 'DECK (TAB)'
        });
        areas.push({
            id: 'HUD_MODE',
            rect: { x: width - 130, y: 16, w: 110, h: 28 },
            label: 'HUD: PRO'
        });
        areas.push({
            id: 'PITCH_INVERT',
            rect: { x: width - 245, y: 16, w: 105, h: 28 },
            label: state.pitchInverted ? 'STICK: REAL (I)' : 'STICK: DIR (I)'
        });
    }

    return areas;
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
