/**
 * CARRIER VECTOR: 1988 - Thumb Control Placement
 *
 * The third layout solver in this project, for the same reason as the other
 * two: absolute pixel coordinates break the moment a real device is not the
 * size you developed on. Phones are worse than desktops here - the usable
 * area is bounded not by the viewport but by where a thumb can actually
 * reach, and that changes with every handset.
 *
 * The rules this encodes:
 *
 *  - Controls live in the bottom corners, inside a thumb arc from where the
 *    hands hold the device. The middle of the screen is for the game.
 *  - Nothing may cover the centre symbology, because the pitch ladder, the
 *    flight path marker and the designation bracket are how you fly.
 *  - Touch targets are at least 44 px, which is the smallest thing a thumb
 *    hits reliably, and are measured from the safe-area inset rather than
 *    the raw viewport, so a notch or a home indicator does not eat them.
 *
 * Pure geometry, no canvas - so "no control overlaps another", "everything is
 * reachable" and "nothing covers the centre" are assertions rather than
 * hopes. `TouchControls.ts` draws what this returns.
 */

export interface TouchRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface TouchCircle {
    cx: number;
    cy: number;
    r: number;
}

/** Everything the input layer and the renderer need to agree on. */
export interface TouchLayout {
    /** The whole viewport, minus safe-area insets. */
    safe: TouchRect;
    /** Where the flight stick lives. The thumb may wander inside this. */
    stickZone: TouchRect;
    /** Resting position and radius of the stick itself. */
    stick: TouchCircle;
    /** Throttle track, outboard of the stick. */
    throttle: TouchRect;
    /** Primary weapon release. */
    fire: TouchCircle;
    /** Cycle designation. */
    target: TouchCircle;
    /** Weapon selection, bottom up: gun, missile, bomb, HARM. */
    weapons: TouchRect[];
    /**
     * Chaff, above the target button under the right thumb (Known Issues #44).
     * A touch pilot had no countermeasure at all, so a SAM launch on a phone
     * could only be survived by terrain masking. Always present - it is the
     * answer to a missile, and has to be learnable before one arrives.
     */
    chaff: TouchCircle;
    /** Menu / pause, top corner, deliberately small and out of the way. */
    menu: TouchRect;
    /**
     * Recovery assist toggle, inboard of the menu.
     *
     * A mode switch rather than a combat control, so it sits in the top band
     * with the menu instead of under a resting thumb - it is pressed once a
     * sortie, and pressing it by accident in a turn would be worse than
     * reaching for it.
     */
    recover: TouchRect;
    /** Deck-screen launch button, shown instead of the flight controls. */
    launch: TouchRect;
    /** Half-width of the centre band no control may enter. */
    centreKeepout: number;
}

export const TOUCH_METRICS = {
    /** Smallest reliable touch target. */
    minTarget: 44,
    edge: 14,
    stickRadius: 46,
    stickZone: 150,
    fireRadius: 42,
    targetRadius: 32,
    weaponW: 58,
    weaponH: 40,
    throttleW: 34,
    /** The centre of the screen belongs to the symbology, not to buttons. */
    keepoutHalf: 150
} as const;

export interface SafeArea {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export const NO_INSETS: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Solve control placement for a viewport.
 *
 * Everything is anchored to the bottom corners and scaled down together on a
 * small screen, so the relationship between the controls stays the same
 * whether the device is a 667 px iPhone SE or an 1180 px tablet.
 */
export function solveTouchLayout(
    width: number,
    height: number,
    insets: SafeArea = NO_INSETS
): TouchLayout {
    const m = TOUCH_METRICS;
    const safe: TouchRect = {
        x: insets.left,
        y: insets.top,
        w: Math.max(1, width - insets.left - insets.right),
        h: Math.max(1, height - insets.top - insets.bottom)
    };

    // One scale for everything, from the tighter of the two dimensions, so a
    // short landscape phone shrinks the controls instead of stacking them.
    const scale = Math.max(0.72, Math.min(1, Math.min(safe.w / 780, safe.h / 390)));
    const edge = m.edge * scale;
    const stickR = m.stickRadius * scale;
    const zone = m.stickZone * scale;
    const fireR = m.fireRadius * scale;
    const targetR = m.targetRadius * scale;
    const throttleW = m.throttleW * scale;
    const weaponW = m.weaponW * scale;
    const weaponH = Math.max(m.minTarget, m.weaponH * scale);

    const bottom = safe.y + safe.h - edge;
    const left = safe.x + edge;
    const right = safe.x + safe.w - edge;

    // Left hand: throttle on the outside, stick inboard of it.
    const throttleH = Math.min(zone, safe.h * 0.52);
    const throttle: TouchRect = {
        x: left,
        y: bottom - throttleH,
        w: throttleW,
        h: throttleH
    };

    const stickZoneX = throttle.x + throttle.w + edge * 0.6;
    const stickZone: TouchRect = {
        x: stickZoneX,
        y: bottom - zone,
        w: zone,
        h: zone
    };
    const stick: TouchCircle = {
        cx: stickZone.x + stickZone.w / 2,
        cy: stickZone.y + stickZone.h / 2,
        r: stickR
    };

    // Right hand: fire under the thumb, target above it, weapons inboard.
    const fire: TouchCircle = {
        cx: right - fireR,
        cy: bottom - fireR,
        r: fireR
    };
    const target: TouchCircle = {
        cx: fire.cx,
        cy: fire.cy - fireR - targetR - edge * 0.7,
        r: targetR
    };

    const weaponsRight = fire.cx - fireR - edge;
    const weapons: TouchRect[] = [0, 1, 2, 3].map(i => ({
        x: weaponsRight - weaponW,
        y: bottom - weaponH * (i + 1) - edge * 0.5 * i,
        w: weaponW,
        h: weaponH
    }));

    const chaffR = targetR * 0.95;
    const chaff: TouchCircle = {
        cx: fire.cx,
        cy: target.cy - targetR - chaffR - edge * 0.7,
        r: chaffR
    };

    const menu: TouchRect = {
        x: right - m.minTarget,
        y: safe.y + edge,
        w: m.minTarget,
        h: m.minTarget
    };

    const recover: TouchRect = {
        x: menu.x - m.minTarget - edge * 0.5,
        y: menu.y,
        w: m.minTarget,
        h: m.minTarget
    };

    // The deck screen has one job, so it gets one big button in the middle
    // bottom, where both thumbs can reach it.
    const launchW = Math.min(safe.w * 0.5, 260 * scale);
    const launch: TouchRect = {
        x: safe.x + safe.w / 2 - launchW / 2,
        y: bottom - Math.max(m.minTarget, 56 * scale),
        w: launchW,
        h: Math.max(m.minTarget, 56 * scale)
    };

    return {
        safe,
        stickZone,
        stick,
        throttle,
        fire,
        target,
        weapons,
        chaff,
        menu,
        recover,
        launch,
        centreKeepout: m.keepoutHalf * scale
    };
}

export type TouchControlId =
    | 'STICK' | 'THROTTLE' | 'FIRE' | 'TARGET'
    | 'WEAPON_GUN' | 'WEAPON_MISSILE' | 'WEAPON_BOMB' | 'WEAPON_HARM' | 'CHAFF'
    | 'MENU' | 'RECOVER' | 'LAUNCH' | 'WORLD';

const inRect = (r: TouchRect, x: number, y: number) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const inCircle = (c: TouchCircle, x: number, y: number, slop = 0) =>
    Math.hypot(x - c.cx, y - c.cy) <= c.r + slop;

/**
 * Which control a touch landed on. `WORLD` means it hit none of them, which
 * is a meaningful answer: a tap on the world is how a target gets picked.
 *
 * Buttons are hit-tested with a little slop because a thumb is not a mouse,
 * and in priority order so that overlapping slop never makes a control
 * unreachable.
 */
export function hitTest(
    layout: TouchLayout,
    x: number,
    y: number,
    context: 'FLIGHT' | 'DECK' = 'FLIGHT'
): TouchControlId {
    const slop = 8;
    if (inRect(layout.menu, x, y)) return 'MENU';

    if (context === 'DECK') {
        return inRect(layout.launch, x, y) ? 'LAUNCH' : 'WORLD';
    }

    if (inRect(layout.recover, x, y)) return 'RECOVER';

    if (inCircle(layout.fire, x, y, slop)) return 'FIRE';
    if (inCircle(layout.target, x, y, slop)) return 'TARGET';
    if (inCircle(layout.chaff, x, y, slop)) return 'CHAFF';

    const weaponIds: TouchControlId[] = ['WEAPON_GUN', 'WEAPON_MISSILE', 'WEAPON_BOMB', 'WEAPON_HARM'];
    for (let i = 0; i < layout.weapons.length; i++) {
        if (inRect(layout.weapons[i], x, y)) return weaponIds[i];
    }

    if (inRect(layout.throttle, x, y)) return 'THROTTLE';
    if (inRect(layout.stickZone, x, y)) return 'STICK';
    return 'WORLD';
}

/**
 * Stick deflection for a touch, as -1..1 per axis. The thumb's first contact
 * sets the origin, so the stick meets the finger rather than the finger
 * hunting for the stick - the single biggest difference between a virtual
 * stick that works and one that does not.
 */
export function stickDeflection(
    origin: { x: number; y: number },
    x: number,
    y: number,
    radius: number
): { pitch: number; roll: number } {
    const dx = (x - origin.x) / radius;
    const dy = (y - origin.y) / radius;
    // `+ 0` normalises negative zero, which `-dy` produces at rest and which
    // reads as a stick that is very slightly deflected to anything comparing
    // against 0.
    const clamp = (v: number) => Math.min(1, Math.max(-1, v)) + 0;
    return {
        // Screen y grows downward; pulling the thumb back pitches up.
        pitch: clamp(-dy),
        roll: clamp(dx)
    };
}

/** Throttle setting for a touch on the track: 1 at the top, 0 at the bottom. */
export function throttleFraction(track: TouchRect, y: number): number {
    const t = 1 - (y - track.y) / track.h;
    return Math.min(1, Math.max(0, t));
}
