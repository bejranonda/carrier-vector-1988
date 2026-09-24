/**
 * CARRIER VECTOR: 1988 - The Pilot Menu
 *
 * WHY THIS EXISTS
 * A beginner playtest said it plainly: "I should have menu to click and
 * select what to do." Before v1.11.0 the only way out of a bad situation
 * in flight was ESC, which closed the control-reference overlay and nothing
 * else - there was no pause, no way back to mission select without dying or
 * finishing, and no button a mouse-only player could find. This is that
 * menu: a short, always-reachable list of things a player can DO, in plain
 * words, with the current objective restated at the top so opening it also
 * answers "what am I supposed to be doing right now".
 *
 * Pure: a list of items derived from a snapshot of the game's state. No
 * canvas, no DOM - `GameLoop` supplies the context and acts on the id the
 * player picks, and `PilotMenuView` is the only thing that draws it.
 */

export type PilotMenuItemId =
    | 'RESUME'
    | 'LAUNCH'
    | 'FLY_FOR_ME'
    | 'TAKE_ME_HOME'
    | 'CONTROLS'
    | 'INSTRUMENTS'
    | 'SOUND'
    | 'RESTART'
    | 'MISSION_SELECT';

export interface PilotMenuItem {
    id: PilotMenuItemId;
    /** Short, always visible. */
    label: string;
    /** One clause of plain-words explanation underneath. */
    detail: string;
    /** The keycap shown beside it - a digit, so it doubles as a shortcut. */
    key: string;
}

export interface PilotMenuContext {
    /** The jet is flying, as opposed to on deck. */
    airborne: boolean;
    /** On the catapult, ready to go. */
    onDeckReady: boolean;
    /** The autopilot currently has the aeroplane (assist level AUTO). */
    autopilotFlying: boolean;
    /** The recovery ("take me home") assist is engaged. */
    recoveryOn: boolean;
    /** Current HUD density, for the label - see `HUD_DENSITY_LABEL`. */
    hudDensityLabel: string;
    muted: boolean;
}

/**
 * The menu's contents for the current moment, most useful item first.
 *
 * RESUME is always first and always present - it is what ESC undoes, and a
 * menu whose first item is not "go back to what I was doing" trains players
 * to be afraid of opening it. Every other item only appears when it would
 * actually do something: LAUNCH only on the catapult, TAKE_ME_HOME only in
 * the air, and so on - a menu item that does nothing when pressed is worse
 * than not having it.
 */
export function pilotMenuItems(ctx: PilotMenuContext): PilotMenuItem[] {
    const items: PilotMenuItem[] = [
        { id: 'RESUME', label: 'RESUME', detail: 'Back to the cockpit. Nothing else changes.', key: 'ESC' }
    ];

    if (ctx.onDeckReady) {
        items.push({ id: 'LAUNCH', label: 'LAUNCH', detail: 'Take the catapult shot.', key: '1' });
    }

    if (ctx.airborne) {
        items.push(ctx.autopilotFlying
            ? { id: 'FLY_FOR_ME', label: 'TAKE BACK THE STICK', detail: 'Switch off the autopilot and fly by hand.', key: '2' }
            : { id: 'FLY_FOR_ME', label: 'LET THE AUTOPILOT FLY', detail: "Ghost-Lead holds her steady. Press F anytime to take her back.", key: '2' });

        items.push(ctx.recoveryOn
            ? { id: 'TAKE_ME_HOME', label: 'RECOVERY: ON', detail: 'Already flying you back to the boat.', key: '3' }
            : { id: 'TAKE_ME_HOME', label: 'TAKE ME HOME', detail: 'Fly the approach back to the carrier for you.', key: '3' });
    }

    items.push(
        { id: 'CONTROLS', label: 'SHOW ALL CONTROLS', detail: 'Every key, for later. You only need a few now.', key: '4' },
        { id: 'INSTRUMENTS', label: `INSTRUMENTS: ${ctx.hudDensityLabel}`, detail: 'More or fewer numbers on the screen.', key: '5' },
        { id: 'SOUND', label: ctx.muted ? 'SOUND: OFF' : 'SOUND: ON', detail: 'Mute or unmute the game.', key: '6' },
        { id: 'RESTART', label: 'RESTART THIS SORTIE', detail: 'Start the same mission over from the deck.', key: '7' },
        { id: 'MISSION_SELECT', label: 'MISSION SELECT', detail: 'Back to the briefing to fly something else.', key: '8' }
    );

    return items;
}

/** Wrap an index into `[0, count)`, for moving the selection with arrow keys. */
export function wrapMenuIndex(index: number, count: number): number {
    if (count <= 0) return 0;
    return ((index % count) + count) % count;
}

/**
 * The objective strip's key, in the player's own words - not "the game's".
 *
 * Every scenario writes its own `title` and `detail`, and both already say
 * what to aim for; what neither says is which physical key does it, in a
 * sentence rather than a keycap. This is what the pilot menu's "YOUR JOB
 * NOW" panel reads out loud when a confused player opens it. `title` is
 * matched only when `key` alone is not specific enough (the recovery phase
 * sets no `key` at all, because the objective strip already shows `L` as
 * part of its own detail text).
 */
export function plainInstruction(key: string | undefined, title = ''): string {
    switch (key) {
        case 'ENTER': return 'Press ENTER (or click LAUNCH) to go.';
        case 'W': return 'Hold W (or the up arrow) to raise the nose.';
        case 'F': return 'Press F to cycle MANUAL / ASSIST / AUTOPILOT.';
        case 'SPACE': return 'Press SPACE to fire the selected weapon.';
        case 'TAB': return 'Press TAB to switch between the cockpit and the deck.';
        case '1-4': return 'Press 1, 2, 3 or 4 to plan fuel and weapons.';
    }
    if (/TRAP|RECOVER|HOME/.test(title)) {
        return 'Fly back over the boat. Press L and the autopilot flies the approach for you.';
    }
    return 'Open this menu anytime (ESC) if you are not sure what to do.';
}
