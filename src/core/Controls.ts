/**
 * CARRIER VECTOR: 1988 - Control Binding Schema
 *
 * SINGLE SOURCE OF TRUTH for every key binding, consumed by the input
 * handler, the in-game help overlay, the mission briefing, and the README
 * control table.
 *
 * This exists because the README previously documented "W / Down Arrow =
 * Pitch Down" while the code actually bound W together with ArrowUp to
 * pitch UP - both the pairing and the direction were wrong. Deriving the
 * docs from the same table the game reads makes that class of drift
 * impossible.
 */

export type ControlContext = 'GLOBAL' | 'FLIGHT' | 'DECK' | 'BRIEFING';
export type ControlGroup = 'FLIGHT' | 'WEAPONS' | 'DECK OPS' | 'MISSION SELECT' | 'SYSTEM';

export interface Binding {
    /** Normalized (lowercased) key names as reported by KeyboardEvent.key. */
    keys: readonly string[];
    /** Human-readable key combination for display. */
    display: string;
    label: string;
    context: ControlContext;
    group: ControlGroup;
}

export const CONTROL_SCHEMA: readonly Binding[] = [
    // --- Flight ---
    { keys: ['w', 'arrowup'], display: 'W / UP', label: 'Pitch nose UP', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['s', 'arrowdown'], display: 'S / DOWN', label: 'Pitch nose DOWN', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['a', 'arrowleft'], display: 'A / LEFT', label: 'Bank left (hold W to tighten the turn)', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['d', 'arrowright'], display: 'D / RIGHT', label: 'Bank right (hold W to tighten the turn)', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['q'], display: 'Q', label: 'Rudder left (fine aim only)', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['e'], display: 'E', label: 'Rudder right (fine aim only)', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['shift'], display: 'SHIFT', label: 'Throttle up (past 100% = afterburner)', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['control'], display: 'CTRL', label: 'Throttle down', context: 'FLIGHT', group: 'FLIGHT' },

    // --- Weapons ---
    { keys: [' '], display: 'SPACE', label: 'Fire selected weapon', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['1'], display: '1', label: '20mm Vulcan cannon', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['2'], display: '2', label: 'AIM-9 Sidewinder', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['3'], display: '3', label: 'Mk.82 iron bomb', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['4'], display: '4', label: 'AGM-88 HARM (radiating SAMs only)', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['x'], display: 'X', label: 'Release chaff - breaks a SAM lock', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['b'], display: 'B', label: 'Weapons bay (open = RCS x4)', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['t'], display: 'T', label: 'Designate next target (SHIFT+T steps back)', context: 'FLIGHT', group: 'WEAPONS' },
    { keys: ['y'], display: 'Y', label: 'Release the designation', context: 'FLIGHT', group: 'WEAPONS' },

    // --- Flight assistance ---
    { keys: ['f'], display: 'F', label: 'Cycle flight assist: MANUAL / ASSIST / AUTO', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['g'], display: 'G', label: 'Terrain-following autopilot (on by default)', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['l'], display: 'L', label: 'Recovery assist - flies the approach home', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['v'], display: 'V', label: 'Padlock camera onto the locked target', context: 'FLIGHT', group: 'FLIGHT' },
    { keys: ['backspace'], display: 'BACKSPACE', label: 'Rewind 5 seconds (2 uses per sortie)', context: 'FLIGHT', group: 'FLIGHT' },

    // --- Deck operations ---
    { keys: ['enter'], display: 'ENTER', label: 'Launch from catapult', context: 'DECK', group: 'DECK OPS' },
    { keys: ['1'], display: '1', label: 'Decrease planned fuel (-500 L)', context: 'DECK', group: 'DECK OPS' },
    { keys: ['2'], display: '2', label: 'Increase planned fuel (+500 L)', context: 'DECK', group: 'DECK OPS' },
    { keys: ['3'], display: '3', label: 'AIM-9 Sidewinder loadout', context: 'DECK', group: 'DECK OPS' },
    { keys: ['4'], display: '4', label: 'Mk.82 bomb loadout', context: 'DECK', group: 'DECK OPS' },
    { keys: ['r'], display: 'R', label: 'Rush the turnaround (costs crew stamina)', context: 'DECK', group: 'DECK OPS' },
    { keys: ['v'], display: 'V', label: 'Threat level: CADET / REGULAR / VETERAN', context: 'DECK', group: 'DECK OPS' },

    // --- Mission select (briefing screen) ---
    { keys: ['arrowleft', 'arrowright'], display: '← / →', label: 'Change selected mission', context: 'BRIEFING', group: 'MISSION SELECT' },
    { keys: ['arrowup', 'arrowdown'], display: '↑ / ↓', label: 'Change map (endless mode only)', context: 'BRIEFING', group: 'MISSION SELECT' },
    { keys: ['1', '2', '3', '4', '5', '6'], display: '1-6', label: 'Pick a mission directly', context: 'BRIEFING', group: 'MISSION SELECT' },
    { keys: ['enter'], display: 'ENTER', label: 'Fly the selected mission', context: 'BRIEFING', group: 'MISSION SELECT' },
    { keys: ['s'], display: 'S', label: 'Skip the deck and start airborne', context: 'BRIEFING', group: 'MISSION SELECT' },
    { keys: ['d'], display: 'D', label: "Today's daily sortie (one seed for everyone)", context: 'BRIEFING', group: 'MISSION SELECT' },
    { keys: ['v'], display: 'V', label: 'Threat level: CADET / REGULAR / VETERAN', context: 'BRIEFING', group: 'MISSION SELECT' },

    // --- System (available everywhere) ---
    { keys: ['h', 'f1'], display: 'H / F1', label: 'Show control reference', context: 'GLOBAL', group: 'SYSTEM' },
    { keys: ['escape'], display: 'ESC', label: 'Close overlay', context: 'GLOBAL', group: 'SYSTEM' },
    { keys: ['tab'], display: 'TAB', label: 'Cockpit / flight deck view', context: 'GLOBAL', group: 'SYSTEM' },
    { keys: ['m'], display: 'M', label: 'Mute / unmute audio', context: 'GLOBAL', group: 'SYSTEM' },
    { keys: ['o'], display: 'O', label: 'Ops tempo: ARCADE / SIM', context: 'GLOBAL', group: 'SYSTEM' },
    { keys: ['k'], display: 'K', label: 'Controls: AUTO / TOUCH / KEYBOARD', context: 'GLOBAL', group: 'SYSTEM' },
    { keys: ['c'], display: 'C', label: 'Colour palette: classic / colour-blind', context: 'GLOBAL', group: 'SYSTEM' },
    { keys: ['u'], display: 'U', label: 'HUD density: ARCADE / PRO', context: 'FLIGHT', group: 'SYSTEM' },
    { keys: ['i'], display: 'I', label: 'Invert pitch (flight-sim stick)', context: 'FLIGHT', group: 'FLIGHT' }
];

const PITCH_INVERT_KEY = 'carrier_vector_pitch_invert';

export function loadPitchInversion(): boolean {
    try {
        const stored = globalThis.localStorage?.getItem(PITCH_INVERT_KEY);
        if (stored !== null) return stored === 'true';
    } catch {
        // Storage unavailable
    }
    return false;
}

/**
 * The stored stick setting, or null if the player has never touched it. Lets
 * the briefing offer the flip once - arrow-up defaults to CLIMB, but a player
 * with flight-sim habits expects it to push the nose DOWN - and stop offering
 * it the moment it has been used, exactly as the colour-blind palette hint.
 */
export function storedPitchInversion(): boolean | null {
    try {
        const stored = globalThis.localStorage?.getItem(PITCH_INVERT_KEY);
        if (stored === 'true') return true;
        if (stored === 'false') return false;
    } catch {
        // Storage unavailable
    }
    return null;
}

export function savePitchInversion(inverted: boolean): void {
    try {
        globalThis.localStorage?.setItem(PITCH_INVERT_KEY, String(inverted));
    } catch {
        // Ignore storage error
    }
}

/** All bindings valid in a given context, including GLOBAL ones. */
export function bindingsFor(context: ControlContext): Binding[] {
    return CONTROL_SCHEMA.filter(b => b.context === context || b.context === 'GLOBAL');
}

/** Render a markdown table for the README, so docs can't drift from code. */
export function markdownControlTable(context: ControlContext): string {
    const rows = bindingsFor(context)
        .map(b => `| \`${b.display}\` | ${b.label} |`)
        .join('\n');
    return `| Key | Action |\n| --- | --- |\n${rows}`;
}

