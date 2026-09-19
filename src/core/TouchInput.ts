/**
 * CARRIER VECTOR: 1988 - Touch Input State
 *
 * Turns a set of live pointers into the same demand the keyboard produces:
 * an analog pitch/roll/throttle, plus button edges. The flight model, the
 * assist laws and the weapons all stay exactly as they are - touch mode adds
 * a way to ask, not a second game.
 *
 * Two things here are the difference between a virtual stick that works and
 * one that everybody hates:
 *
 *  1. **The stick meets the thumb.** Its origin is wherever the finger first
 *     landed inside the stick zone, not a fixed circle the thumb has to find.
 *  2. **Each finger owns its control.** A pointer is bound to whatever it
 *     touched down on and keeps it until release, so sliding off the fire
 *     button mid-turn does not silently hand your stick input to the
 *     throttle.
 *
 * Pure: it holds pointer state and answers questions about it, with no DOM
 * and no canvas, so multi-touch behaviour is testable.
 */

import { hitTest, stickDeflection, throttleFraction } from '../renderer/TouchLayout';
import type { TouchControlId, TouchLayout } from '../renderer/TouchLayout';

export interface PointerSample {
    id: number;
    x: number;
    y: number;
}

/** A control press that has just begun - consumed once by the game loop. */
export interface TouchTap {
    control: TouchControlId;
    x: number;
    y: number;
}

export interface TouchDemand {
    pitch: number;
    roll: number;
    /** Absolute throttle 0..1.5, or null when no thumb is on the track. */
    throttle: number | null;
    /** True while the fire control is held (the cannon fires continuously). */
    firing: boolean;
    /** Where the stick is being held, for the renderer. */
    stickOrigin: { x: number; y: number } | null;
    stickPosition: { x: number; y: number } | null;
}

interface BoundPointer {
    control: TouchControlId;
    originX: number;
    originY: number;
    x: number;
    y: number;
}

export class TouchInput {
    private pointers = new Map<number, BoundPointer>();
    private taps: TouchTap[] = [];

    /** A pointer went down: bind it to whatever it landed on. */
    public down(sample: PointerSample, layout: TouchLayout, context: 'FLIGHT' | 'DECK' = 'FLIGHT') {
        const control = hitTest(layout, sample.x, sample.y, context);
        this.pointers.set(sample.id, {
            control,
            originX: sample.x,
            originY: sample.y,
            x: sample.x,
            y: sample.y
        });
        // Every press is reported once. The game loop decides what a tap on
        // the world means - which is "designate whatever is under it".
        this.taps.push({ control, x: sample.x, y: sample.y });
    }

    /** A bound pointer moved. Unbound pointers are ignored, not re-bound. */
    public move(sample: PointerSample) {
        const bound = this.pointers.get(sample.id);
        if (!bound) return;
        bound.x = sample.x;
        bound.y = sample.y;
    }

    public up(id: number) {
        this.pointers.delete(id);
    }

    /** Lift every finger - used when the window loses focus. */
    public clear() {
        this.pointers.clear();
        this.taps.length = 0;
    }

    /** Presses since the last call. Consuming them clears the queue. */
    public consumeTaps(): TouchTap[] {
        const taps = this.taps;
        this.taps = [];
        return taps;
    }

    public get activeCount(): number {
        return this.pointers.size;
    }

    /** True while a given control is held down. */
    public isHeld(control: TouchControlId): boolean {
        for (const p of this.pointers.values()) if (p.control === control) return true;
        return false;
    }

    /** The current flight demand from every held control. */
    public demand(layout: TouchLayout): TouchDemand {
        let pitch = 0;
        let roll = 0;
        let throttle: number | null = null;
        let stickOrigin: { x: number; y: number } | null = null;
        let stickPosition: { x: number; y: number } | null = null;

        for (const p of this.pointers.values()) {
            if (p.control === 'STICK') {
                const d = stickDeflection({ x: p.originX, y: p.originY }, p.x, p.y, layout.stick.r);
                pitch = d.pitch;
                roll = d.roll;
                stickOrigin = { x: p.originX, y: p.originY };
                stickPosition = { x: p.x, y: p.y };
            } else if (p.control === 'THROTTLE') {
                // The track covers the whole range including afterburner, so a
                // thumb at the top is asking for everything the jet has.
                throttle = throttleFraction(layout.throttle, p.y) * 1.5;
            }
        }

        return {
            pitch,
            roll,
            throttle,
            firing: this.isHeld('FIRE'),
            stickOrigin,
            stickPosition
        };
    }
}
