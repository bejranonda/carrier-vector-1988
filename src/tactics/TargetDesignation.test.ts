import { describe, it, expect } from 'vitest';
import {
    DESIGNATION_TUNING,
    pickTargetAt,
    TargetTracker,
    pursuitNav,
    rankTargets,
    solveTarget,
    type DesignatableTarget,
    type ShooterState
} from './TargetDesignation';

/** Shooter at the origin, 1000 m up, pointing down +Z. */
function shooter(over: Partial<ShooterState> = {}): ShooterState {
    return {
        position: { x: 0, y: 1000, z: 0 },
        forward: { x: 0, y: 0, z: 1 },
        ...over
    };
}

function target(over: Partial<DesignatableTarget> = {}): DesignatableTarget {
    return {
        id: 'T1',
        kind: 'AIR',
        name: 'MiG-29',
        position: { x: 0, y: 1000, z: 2000 },
        ...over
    };
}

describe('solveTarget geometry', () => {
    it('measures slant range in three dimensions', () => {
        const s = solveTarget(shooter(), target({ position: { x: 300, y: 1400, z: 0 } }));
        expect(s.range).toBeCloseTo(500, 6);
    });

    it('reports a bearing in the same convention as yaw', () => {
        const ahead = solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: 500 } }));
        const right = solveTarget(shooter(), target({ position: { x: 500, y: 1000, z: 0 } }));
        const behind = solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: -500 } }));
        const left = solveTarget(shooter(), target({ position: { x: -500, y: 1000, z: 0 } }));
        expect(ahead.bearing).toBeCloseTo(0, 6);
        expect(right.bearing).toBeCloseTo(Math.PI / 2, 6);
        expect(behind.bearing).toBeCloseTo(Math.PI, 6);
        expect(left.bearing).toBeCloseTo(Math.PI * 1.5, 6);
    });

    it('always reports a bearing inside one turn', () => {
        for (const x of [-4000, -100, 0, 100, 4000]) {
            for (const z of [-4000, -100, 0, 100, 4000]) {
                const s = solveTarget(shooter(), target({ position: { x, y: 1000, z } }));
                expect(s.bearing).toBeGreaterThanOrEqual(0);
                expect(s.bearing).toBeLessThan(Math.PI * 2);
            }
        }
    });

    it('reads aspect as 1 dead ahead and -1 dead astern', () => {
        expect(solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: 900 } })).aspect).toBeCloseTo(1, 6);
        expect(solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: -900 } })).aspect).toBeCloseTo(-1, 6);
        expect(solveTarget(shooter(), target({ position: { x: 900, y: 1000, z: 0 } })).aspect).toBeCloseTo(0, 6);
    });

    it('measures aspect against the airframe, not the world', () => {
        // Nose 90 degrees right: a contact off the right wing is now ahead.
        const s = solveTarget(
            shooter({ forward: { x: 1, y: 0, z: 0 } }),
            target({ position: { x: 900, y: 1000, z: 0 } })
        );
        expect(s.aspect).toBeCloseTo(1, 6);
        expect(s.offBoresight).toBeCloseTo(0, 5);
    });

    it('tolerates a non-unit forward vector', () => {
        const s = solveTarget(
            shooter({ forward: { x: 0, y: 0, z: 14 } }),
            target({ position: { x: 0, y: 1000, z: 900 } })
        );
        expect(s.aspect).toBeCloseTo(1, 6);
    });
});

describe('weapon envelopes', () => {
    it('puts an air contact ahead and in range inside the missile envelope', () => {
        const s = solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: 3000 } }));
        expect(s.inMissileEnvelope).toBe(true);
        expect(s.recommendedWeapon).toBe('SIDEWINDER');
    });

    it('refuses a missile shot outside the seeker field of view', () => {
        const s = solveTarget(shooter(), target({ position: { x: 3000, y: 1000, z: 1000 } }));
        expect(s.aspect).toBeLessThan(DESIGNATION_TUNING.seekerAspect);
        expect(s.inMissileEnvelope).toBe(false);
    });

    it('refuses a missile shot too close to arm and too far to reach', () => {
        const close = solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: 100 } }));
        const far = solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: 12000 } }));
        expect(close.inMissileEnvelope).toBe(false);
        expect(far.inMissileEnvelope).toBe(false);
    });

    it('never offers a Sidewinder against a ground target', () => {
        for (const kind of ['SAM', 'STRUCTURE'] as const) {
            const s = solveTarget(shooter(), target({ kind, position: { x: 0, y: 40, z: 3000 } }));
            expect(s.inMissileEnvelope).toBe(false);
        }
    });

    it('opens the gun envelope only when close and tracking tightly', () => {
        const tracking = solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: 900 } }));
        const wide = solveTarget(shooter(), target({ position: { x: 400, y: 1000, z: 900 } }));
        const distant = solveTarget(shooter(), target({ position: { x: 0, y: 1000, z: 4000 } }));
        expect(tracking.inGunEnvelope).toBe(true);
        expect(wide.inGunEnvelope).toBe(false);
        expect(distant.inGunEnvelope).toBe(false);
    });

    it('recommends the bomb for a hardened structure at any range, and never the gun', () => {
        for (const z of [200, 900, 6000]) {
            const s = solveTarget(shooter(), target({ kind: 'STRUCTURE', position: { x: 0, y: 30, z } }));
            expect(s.recommendedWeapon).toBe('BOMB');
            expect(s.inGunEnvelope).toBe(false);
        }
    });

    it('recommends strafing a SAM site once it is inside gun range', () => {
        const close = solveTarget(
            shooter({ position: { x: 0, y: 60, z: 0 } }),
            target({ kind: 'SAM', position: { x: 0, y: 40, z: 800 } })
        );
        const far = solveTarget(shooter(), target({ kind: 'SAM', position: { x: 0, y: 40, z: 5000 } }));
        expect(close.recommendedWeapon).toBe('GUN');
        expect(far.recommendedWeapon).toBe('BOMB');
    });
});

describe('rankTargets', () => {
    const contacts: DesignatableTarget[] = [
        { id: 'far-ahead', kind: 'AIR', name: 'A', position: { x: 0, y: 1000, z: 7000 } },
        { id: 'near-ahead', kind: 'AIR', name: 'B', position: { x: 0, y: 1000, z: 1500 } },
        { id: 'near-behind', kind: 'AIR', name: 'C', position: { x: 0, y: 1000, z: -1200 } }
    ];

    it('puts the nearest contact ahead of the nose first', () => {
        const ranked = rankTargets(shooter(), contacts);
        expect(ranked[0].target.id).toBe('near-ahead');
    });

    it('sorts a contact astern last even when it is closer', () => {
        const ranked = rankTargets(shooter(), contacts);
        expect(ranked[ranked.length - 1].target.id).toBe('near-behind');
    });

    it('drops contacts beyond designation range', () => {
        const ranked = rankTargets(shooter(), [
            ...contacts,
            { id: 'ghost', kind: 'AIR', name: 'D', position: { x: 0, y: 1000, z: 40000 } }
        ]);
        expect(ranked.map(r => r.target.id)).not.toContain('ghost');
    });

    it('is a stable total order for identically placed contacts', () => {
        const twins: DesignatableTarget[] = [
            { id: 'b', kind: 'AIR', name: 'B', position: { x: 0, y: 1000, z: 2000 } },
            { id: 'a', kind: 'AIR', name: 'A', position: { x: 0, y: 1000, z: 2000 } }
        ];
        expect(rankTargets(shooter(), twins).map(r => r.target.id)).toEqual(['a', 'b']);
        expect(rankTargets(shooter(), [...twins].reverse()).map(r => r.target.id)).toEqual(['a', 'b']);
    });

    it('returns nothing for an empty scope', () => {
        expect(rankTargets(shooter(), [])).toEqual([]);
    });
});

describe('TargetTracker', () => {
    const contacts: DesignatableTarget[] = [
        { id: 'one', kind: 'AIR', name: 'A', position: { x: 0, y: 1000, z: 1500 } },
        { id: 'two', kind: 'AIR', name: 'B', position: { x: 0, y: 1000, z: 4000 } },
        { id: 'three', kind: 'SAM', name: 'C', position: { x: 200, y: 40, z: 6000 } }
    ];

    it('starts with nothing designated', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        expect(tracker.designatedId).toBeNull();
        expect(tracker.designated()).toBeNull();
    });

    it('locks the best candidate on the first press', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        expect(tracker.cycle()?.target.id).toBe('one');
    });

    it('steps forward through the ranked list and wraps', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        const order = [tracker.cycle(), tracker.cycle(), tracker.cycle(), tracker.cycle()]
            .map(s => s?.target.id);
        expect(order).toEqual(['one', 'two', 'three', 'one']);
    });

    it('steps backward too', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        expect(tracker.cycle(-1)?.target.id).toBe('three');
        expect(tracker.cycle(-1)?.target.id).toBe('two');
    });

    it('holds the lock across refreshes while the target lives', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        tracker.cycle();
        tracker.cycle(); // 'two'
        for (let i = 0; i < 10; i++) tracker.refresh(shooter(), contacts);
        expect(tracker.designatedId).toBe('two');
    });

    it('keeps the lock when the ranking reshuffles underneath it', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        tracker.cycle();
        tracker.cycle(); // 'two', currently second
        // Turn the jet around: the whole list reorders.
        tracker.refresh(shooter({ forward: { x: 0, y: 0, z: -1 } }), contacts);
        expect(tracker.designatedId).toBe('two');
    });

    it('drops the lock when the target is destroyed and brackets nothing', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        tracker.cycle();
        expect(tracker.designatedId).toBe('one');
        tracker.refresh(shooter(), contacts.filter(c => c.id !== 'one'));
        expect(tracker.designatedId).toBeNull();
        expect(tracker.designated()).toBeNull();
    });

    it('cycles from a dropped lock back to the best remaining candidate', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        tracker.cycle();
        tracker.refresh(shooter(), contacts.filter(c => c.id !== 'one'));
        expect(tracker.cycle()?.target.id).toBe('two');
    });

    it('designates a specific target by id, and refuses an unknown one', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        expect(tracker.designateById('three')?.target.id).toBe('three');
        expect(tracker.designateById('nope')).toBeNull();
        expect(tracker.designatedId).toBeNull();
    });

    it('releases the lock on demand', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        tracker.cycle();
        tracker.clear();
        expect(tracker.designatedId).toBeNull();
    });

    it('survives an empty scope without designating a ghost', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), []);
        expect(tracker.cycle()).toBeNull();
        expect(tracker.designatedId).toBeNull();
        expect(tracker.autoAcquire()).toBeNull();
    });

    it('auto-acquires top candidate when unlocked, and preserves existing lock', () => {
        const tracker = new TargetTracker();
        tracker.refresh(shooter(), contacts);
        expect(tracker.designatedId).toBeNull();
        const acquired = tracker.autoAcquire();
        expect(acquired?.target.id).toBe('one');
        expect(tracker.designatedId).toBe('one');

        // Second call preserves current lock
        tracker.designateById('two');
        expect(tracker.autoAcquire()?.target.id).toBe('two');
        expect(tracker.designatedId).toBe('two');
    });
});

describe('pursuitNav', () => {
    it('steers the bearing to the designated target', () => {
        const s = solveTarget(shooter(), target({ position: { x: 4000, y: 1000, z: 0 } }));
        expect(pursuitNav(s, 0).bearing).toBeCloseTo(Math.PI / 2, 6);
    });

    it('climbs to an air target co-altitude', () => {
        const s = solveTarget(shooter(), target({ position: { x: 0, y: 3000, z: 5000 } }));
        expect(pursuitNav(s, 200).altitudeAgl).toBeCloseTo(2800, 6);
    });

    it('never asks the autopilot to fly a low-level intercept into the dirt', () => {
        const s = solveTarget(shooter(), target({ position: { x: 0, y: 30, z: 5000 } }));
        expect(pursuitNav(s, 0).altitudeAgl).toBeGreaterThanOrEqual(DESIGNATION_TUNING.minInterceptAgl);
    });

    it('flies a steadier, lower profile against a ground target', () => {
        const air = pursuitNav(solveTarget(shooter(), target({ position: { x: 0, y: 6000, z: 5000 } })), 0);
        const ground = pursuitNav(
            solveTarget(shooter(), target({ kind: 'STRUCTURE', position: { x: 0, y: 30, z: 5000 } })),
            0
        );
        expect(ground.altitudeAgl).toBe(DESIGNATION_TUNING.groundRunInAgl);
        expect(ground.maxBank!).toBeLessThan(air.maxBank!);
    });

    it('produces a nav target the autopilot can actually use', () => {
        const kinds = ['AIR', 'SAM', 'STRUCTURE'] as const;
        for (const kind of kinds) {
            const nav = pursuitNav(solveTarget(shooter(), target({ kind })), 0);
            expect(Number.isFinite(nav.bearing)).toBe(true);
            expect(nav.altitudeAgl).toBeGreaterThan(0);
            expect(nav.airSpeed).toBeGreaterThan(100);
            expect(nav.maxBank!).toBeGreaterThan(0);
        }
    });
});

describe('pickTargetAt', () => {
    const scope = [
        { id: 'LEFT', x: 200, y: 300 },
        { id: 'RIGHT', x: 700, y: 280 },
        { id: 'HIGH', x: 420, y: 90 }
    ];

    it('picks the contact under the thumb', () => {
        expect(pickTargetAt(205, 305, scope)).toBe('LEFT');
        expect(pickTargetAt(690, 290, scope)).toBe('RIGHT');
    });

    it('picks the nearest when a thumb covers two of them', () => {
        const pair = [{ id: 'NEAR', x: 400, y: 300 }, { id: 'FAR', x: 445, y: 300 }];
        expect(pickTargetAt(405, 300, pair)).toBe('NEAR');
        expect(pickTargetAt(440, 300, pair)).toBe('FAR');
    });

    it('chooses nothing when the tap is nowhere near a contact', () => {
        expect(pickTargetAt(20, 20, scope)).toBeNull();
    });

    it('is forgiving, because a fingertip is not a cursor', () => {
        // ~40 px off still selects: a fingertip covers about that much.
        expect(pickTargetAt(240, 330, scope)).toBe('LEFT');
    });

    it('respects a tightened radius', () => {
        expect(pickTargetAt(260, 300, scope, 30)).toBeNull();
    });

    it('ignores a contact whose projection is not a number', () => {
        const broken = [{ id: 'BEHIND', x: Number.NaN, y: Number.NaN }, { id: 'OK', x: 300, y: 300 }];
        expect(pickTargetAt(300, 300, broken)).toBe('OK');
    });

    it('returns nothing for an empty scope', () => {
        expect(pickTargetAt(100, 100, [])).toBeNull();
    });
});
