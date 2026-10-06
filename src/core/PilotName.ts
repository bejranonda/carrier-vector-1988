/**
 * CARRIER VECTOR: 1988 - The pilot's name (v2.3.0)
 *
 * Optional, asked for only when a pilot first shares, and only ever used on
 * what they share: the picture card and the challenge link, so the friend
 * who opens it reads "ANNA CHALLENGES YOU" instead of "a challenge". Kept on
 * this device; there is no account and no server.
 */

import { cleanPilotName } from './Challenge';

const STORAGE_KEY = 'carrier-vector-1988.pilotName';

export function loadPilotName(): string | null {
    try {
        return cleanPilotName(globalThis.localStorage?.getItem(STORAGE_KEY));
    } catch {
        return null;
    }
}

/** Store a cleaned name, or forget it (null or nothing usable). */
export function savePilotName(raw: string | null): string | null {
    const name = cleanPilotName(raw);
    try {
        if (name) globalThis.localStorage?.setItem(STORAGE_KEY, name);
        else globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
        // Best effort: the name still goes on this share.
    }
    return name;
}
