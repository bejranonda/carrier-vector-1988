import { describe, expect, it } from 'vitest';
import { KILL_FX_TUNING, KillFxSystem, ringProgress, ringRadiusPx } from './KillFx';

describe('KillFxSystem', () => {
    it('spawns, ages and retires effects', () => {
        const fx = new KillFxSystem();
        fx.spawn({ x: 0, y: 100, z: 2000 }, '+250', '#fff');
        expect(fx.live).toHaveLength(1);
        fx.update(KILL_FX_TUNING.life / 2);
        expect(fx.live).toHaveLength(1);
        fx.update(KILL_FX_TUNING.life);
        expect(fx.live).toHaveLength(0);
    });

    it('copies the spawn position so a moving wreck cannot drag the effect', () => {
        const fx = new KillFxSystem();
        const p = { x: 1, y: 2, z: 3 };
        fx.spawn(p, '', '#fff');
        p.x = 999;
        expect(fx.live[0].position.x).toBe(1);
    });

    it('never holds more than the live cap', () => {
        const fx = new KillFxSystem();
        for (let i = 0; i < 20; i++) fx.spawn({ x: i, y: 0, z: 0 }, '', '#fff');
        expect(fx.live).toHaveLength(KILL_FX_TUNING.maxLive);
        expect(fx.live[fx.live.length - 1].position.x).toBe(19);
    });
});

describe('ring geometry', () => {
    it('expands monotonically from 0 to 1', () => {
        expect(ringProgress(0, 1)).toBe(0);
        expect(ringProgress(1, 1)).toBe(1);
        expect(ringProgress(0.5, 1)).toBeGreaterThan(0.5);
        expect(ringProgress(2, 1)).toBe(1);
    });

    it('keeps a far kill readable and a near one bounded', () => {
        const base = { position: { x: 0, y: 0, z: 0 }, age: 1, life: 1, text: '', color: '#fff', weight: 1 };
        const far = ringRadiusPx(base, 8000, 600);
        const near = ringRadiusPx(base, 50, 600);
        expect(far).toBeGreaterThanOrEqual(KILL_FX_TUNING.minRingPx);
        expect(near).toBeLessThanOrEqual(KILL_FX_TUNING.maxRingPx);
        expect(near).toBeGreaterThan(far);
    });
});
