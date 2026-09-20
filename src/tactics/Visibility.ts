/**
 * CARRIER VECTOR: 1988 - What The Pilot Can Actually See
 *
 * WHY THIS EXISTS
 * Target designation ranked every live contact within twenty kilometres
 * regardless of whether the player could see or detect it. You could
 * designate a launcher through a mountain, and cycling the scope told you
 * where everything was - which made the designation key a free reconnaissance
 * tool and quietly undermined terrain masking, the mechanic the whole game is
 * built around. Masking only cut one way: terrain hid YOU from the radar, and
 * hid nothing from you.
 *
 * The policy here is deliberately not "line of sight, uniformly", because
 * that would be wrong in two directions:
 *
 *  - A **hardened structure** is on the briefing card. You know where the
 *    submarine pen is before you start the engines; not being able to
 *    designate it while you run the fjord toward it would be nonsense.
 *  - A **launcher does not move**. Once you have seen one - or it has
 *    painted you, which tells you exactly where it is - you know. Dropping
 *    that knowledge the moment you duck behind a ridge would punish the
 *    correct tactic, which is to mask and come back.
 *  - An **aircraft** does move, so a remembered position is a lie within
 *    seconds. Those need live line of sight.
 *
 * The policy is pure and tested; the ray marching stays in
 * `SensorTacticsManager.checkLOS`, which already exists and is already tested.
 */

import type { Vector3 } from '../flight/AircraftPhysics';

export type ContactKind = 'AIR' | 'SAM' | 'STRUCTURE';

export interface VisibilityContact {
    id: string;
    kind: ContactKind;
    position: Vector3;
}

export const VISIBILITY_TUNING = {
    /**
     * How often line of sight is re-evaluated, seconds.
     *
     * `checkLOS` marches a ray at 40 m per sample, so a 7 km look costs about
     * 175 terrain lookups. Ten candidates every frame at 60 Hz would be a
     * hundred thousand lookups a second for information that cannot
     * meaningfully change in 16 ms - and the budget it would eat is a phone's.
     */
    refreshSeconds: 0.12
} as const;

/**
 * Can this contact be designated, given what is known about it?
 *
 * Pure: the caller supplies the line-of-sight answer and whether the contact
 * has been discovered before.
 */
export function isDesignatable(kind: ContactKind, hasLos: boolean, discovered: boolean): boolean {
    switch (kind) {
        // Briefed before the sortie: you know where it is by definition.
        case 'STRUCTURE':
            return true;
        // Moves. A remembered position is stale within seconds.
        case 'AIR':
            return hasLos;
        // Does not move: seeing it once, or being painted by it, is enough.
        case 'SAM':
            return hasLos || discovered;
    }
}

/**
 * Tracks what the pilot can see, and what they have learned.
 *
 * Throttled: line of sight is re-marched a few times a second rather than
 * every frame, and the answer is cached in between.
 */
export class VisibilityTracker {
    private visible = new Set<string>();
    private discovered = new Set<string>();
    /**
     * Every id the last refresh looked at, whatever it concluded. The throttle
     * is only allowed to serve a cached answer for a contact that HAS one:
     * a package that spawns, or a launcher that comes alive, must resolve on
     * the tick it appears rather than sitting undesignatable for up to 120 ms
     * while the window runs down.
     */
    private evaluated = new Set<string>();
    private nextRefreshAt = 0;

    /**
     * Record that a site has given itself away - by radiating, or by being
     * seen. Sticky for the rest of the sortie.
     */
    public markDiscovered(id: string) {
        this.discovered.add(id);
    }

    public hasDiscovered(id: string): boolean {
        return this.discovered.has(id);
    }

    /**
     * Re-evaluate, at most every `refreshSeconds` - but always immediately for
     * a contact this tracker has never looked at. `hasLos` is only called on a
     * refresh tick, so a caller can hand it an expensive ray march.
     */
    public update(
        nowSeconds: number,
        contacts: readonly VisibilityContact[],
        hasLos: (position: Vector3) => boolean
    ) {
        if (nowSeconds < this.nextRefreshAt && !this.hasUnevaluated(contacts)) return;
        this.nextRefreshAt = nowSeconds + VISIBILITY_TUNING.refreshSeconds;

        this.visible.clear();
        this.evaluated.clear();
        for (const contact of contacts) {
            const los = hasLos(contact.position);
            this.evaluated.add(contact.id);
            // Seeing a launcher is how you learn where it is.
            if (los && contact.kind === 'SAM') this.discovered.add(contact.id);
            if (isDesignatable(contact.kind, los, this.discovered.has(contact.id))) {
                this.visible.add(contact.id);
            }
        }
    }

    private hasUnevaluated(contacts: readonly VisibilityContact[]): boolean {
        for (const contact of contacts) {
            if (!this.evaluated.has(contact.id)) return true;
        }
        return false;
    }

    public isVisible(id: string): boolean {
        return this.visible.has(id);
    }

    /** Forget everything. A new sortie starts blind. */
    public reset() {
        this.visible.clear();
        this.discovered.clear();
        this.evaluated.clear();
        this.nextRefreshAt = 0;
    }
}
