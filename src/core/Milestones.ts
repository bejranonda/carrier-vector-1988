/**
 * CARRIER VECTOR: 1988 - First-time milestones
 *
 * WHY THIS EXISTS
 * A rookie who dies and dies again had nothing to show for it: the first
 * kill looked exactly like the fiftieth, and the first trap aboard the boat -
 * the hardest thing in the game - was a callout like any other. A
 * beginner's first time is the moment they decide whether the game is for
 * them, so each "first" gets one louder line, once, and is remembered across
 * sessions so it is never cheapened by repetition.
 *
 * Deliberately tiny: a table and a one-way latch. No score, no menu, no
 * achievements screen - the reward is the moment itself, at the second it
 * happens, in the channel the player is already looking at.
 *
 * Storage is injected so the latch is asserted headlessly; the game passes
 * localStorage (best effort - a blocked store just means the fanfare can
 * repeat, which is a far better failure than a crash on boot).
 */

export type MilestoneId = 'FIRST_BLOOD' | 'FIRST_TRAP' | 'CHAFF_SAVE' | 'FIRST_LOOP';

export interface MilestoneDef {
    id: MilestoneId;
    /** The big line. */
    title: string;
    /** The smaller line under it. */
    detail: string;
}

export const MILESTONES: Record<MilestoneId, MilestoneDef> = {
    FIRST_BLOOD: {
        id: 'FIRST_BLOOD',
        title: 'FIRST BLOOD!',
        detail: 'Your first kill. Ghost-Lead: "Good shooting, rookie."'
    },
    FIRST_TRAP: {
        id: 'FIRST_TRAP',
        title: 'FIRST TRAP - WELCOME ABOARD',
        detail: 'Landing on a carrier is the hardest thing in naval aviation.'
    },
    CHAFF_SAVE: {
        id: 'CHAFF_SAVE',
        title: 'CHAFF SAVED YOU',
        detail: 'You broke a missile lock. That is how you survive SAMs.'
    },
    FIRST_LOOP: {
        id: 'FIRST_LOOP',
        title: 'OVER THE TOP',
        detail: 'Your first loop. The jet goes anywhere you point it.'
    }
};

export interface MilestoneStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'carrier-vector-1988.milestones';

export class Milestones {
    private done = new Set<MilestoneId>();
    private readonly store: MilestoneStore | null;

    constructor(store: MilestoneStore | null = null) {
        this.store = store;
        try {
            const raw = store?.getItem(STORAGE_KEY);
            if (raw) {
                for (const id of JSON.parse(raw) as string[]) {
                    if (id in MILESTONES) this.done.add(id as MilestoneId);
                }
            }
        } catch {
            // Corrupt or blocked storage: start fresh rather than fail to boot.
        }
    }

    has(id: MilestoneId): boolean {
        return this.done.has(id);
    }

    /**
     * Latch a milestone. Returns its definition the FIRST time only, null
     * every time after - so the caller can `if (const m = claim(...))` and
     * never has to remember whether it already announced it.
     */
    claim(id: MilestoneId): MilestoneDef | null {
        if (this.done.has(id)) return null;
        this.done.add(id);
        try {
            this.store?.setItem(STORAGE_KEY, JSON.stringify([...this.done]));
        } catch {
            // Best effort.
        }
        return MILESTONES[id];
    }
}
