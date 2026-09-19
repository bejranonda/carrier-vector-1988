import { describe, it, expect, vi } from 'vitest';
import { VectorRenderer } from './VectorRenderer';
import type { WireframeMesh } from './VectorRenderer';
import type { Vector3 } from '../flight/AircraftPhysics';

/**
 * VectorRenderer's constructor calls canvas.getContext('2d'), which the
 * node test environment doesn't provide. A minimal fake context lets us
 * exercise the real pipeline (transformToCamera, projectCameraPoint,
 * near-plane clipping, renderMesh's world transform) headlessly, since none
 * of that math actually depends on canvas drawing behaviour.
 */
function makeFakeCanvas(width = 800, height = 600) {
    const ctx = {
        fillStyle: '', strokeStyle: '', lineWidth: 0, shadowColor: '', shadowBlur: 0,
        globalAlpha: 1, globalCompositeOperation: 'source-over',
        fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        save: vi.fn(), restore: vi.fn(), setTransform: vi.fn()
    };
    const canvas = {
        width, height,
        getContext: () => ctx as unknown as CanvasRenderingContext2D
    } as unknown as HTMLCanvasElement;
    return { canvas, ctx };
}

describe('VectorRenderer projection pipeline', () => {
    it('projects a point directly ahead to screen center', () => {
        const { canvas } = makeFakeCanvas(800, 600);
        const renderer = new VectorRenderer(canvas, 380);

        const camPoint = renderer.transformToCamera(
            { x: 0, y: 0, z: 1000 },
            { x: 0, y: 0, z: 0 }, 0, 0, 0
        );
        expect(camPoint.z).toBeCloseTo(1000, 5);

        const screen = renderer.projectCameraPoint(camPoint);
        expect(screen.x).toBeCloseTo(400, 5); // width/2
        expect(screen.y).toBeCloseTo(300, 5); // height/2
    });

    it('moves a point to the right of screen center as camera yaws toward it', () => {
        const { canvas } = makeFakeCanvas(800, 600);
        const renderer = new VectorRenderer(canvas, 380);

        // A point to the world +X side, camera facing +Z (yaw=0): should
        // project to the right of center.
        const camPoint = renderer.transformToCamera(
            { x: 500, y: 0, z: 1000 },
            { x: 0, y: 0, z: 0 }, 0, 0, 0
        );
        const screen = renderer.projectCameraPoint(camPoint);
        expect(screen.x).toBeGreaterThan(400);
    });

    // REGRESSION: transformToCamera used to rotate by -pitch and -roll where
    // the world->camera transform needs +pitch and +roll, so the cockpit view
    // was mirrored about the horizon and about the vertical axis. Checking it
    // against the aircraft's own orientation basis - the one AircraftPhysics
    // uses for lift and thrust - is what makes that impossible to reintroduce.
    it('agrees with the aircraft orientation basis for every axis', () => {
        const { canvas } = makeFakeCanvas(800, 600);
        const renderer = new VectorRenderer(canvas, 380);
        const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;

        const cases: [Vector3, Vector3, number, number, number][] = [
            [{ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, 0.2, 0, 0],
            [{ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, 0, 0.3, 0],
            [{ x: 100, y: 50, z: 1000 }, { x: 0, y: 0, z: 0 }, 0, 0, 0.4],
            [{ x: 120, y: -80, z: 900 }, { x: 10, y: 20, z: -5 }, 0.25, -0.4, 0.3],
            [{ x: -40, y: 900, z: -600 }, { x: 5, y: 120, z: 30 }, -0.6, 2.1, -0.8]
        ];

        for (const [p, cam, pitch, yaw, roll] of cases) {
            const { forward, up, right } = VectorRenderer.basisVectors(pitch, yaw, roll);
            const d: Vector3 = { x: p.x - cam.x, y: p.y - cam.y, z: p.z - cam.z };
            const actual = renderer.transformToCamera(p, cam, pitch, yaw, roll);

            expect(actual.x).toBeCloseTo(dot(d, right), 6);
            expect(actual.y).toBeCloseTo(dot(d, up), 6);
            expect(actual.z).toBeCloseTo(dot(d, forward), 6);
        }
    });

    it('drops the horizon BELOW screen centre when the nose is pitched up', () => {
        const { canvas } = makeFakeCanvas(800, 600);
        const renderer = new VectorRenderer(canvas, 380);

        const pitch = 0.2;
        // Level with the camera and dead ahead: the true horizon direction,
        // with no depression angle from altitude to muddy the comparison.
        const camPos = { x: 0, y: 1000, z: 0 };
        const horizon = renderer.projectCameraPoint(
            renderer.transformToCamera({ x: 0, y: 1000, z: 60000 }, camPos, pitch, 0, 0)
        );

        expect(horizon.y).toBeGreaterThan(300);
        // And it must land where the HUD pitch ladder draws its 00 rung,
        // which is fov * tan(pitch) below centre.
        expect(horizon.y).toBeCloseTo(300 + renderer.fov * Math.tan(pitch), 0);
    });

    it('puts the flight path marker on the horizon rung in level flight', () => {
        const { canvas } = makeFakeCanvas(800, 600);
        const renderer = new VectorRenderer(canvas, 380);

        // Level flight at 8 degrees angle of attack: the velocity vector is
        // horizontal, so the FPM belongs exactly on the horizon.
        const pitch = 8 * (Math.PI / 180);
        const camPos = { x: 0, y: 1200, z: 0 };
        const fpm = renderer.projectCameraPoint(
            renderer.transformToCamera({ x: 0, y: 1200, z: 5000 }, camPos, pitch, 0, 0)
        );
        const ladderRung = 300 + renderer.fov * Math.tan(pitch);

        expect(fpm.y).toBeCloseTo(ladderRung, 3);
    });

    it('rolls the world opposite to the aircraft roll input', () => {
        const { canvas } = makeFakeCanvas(800, 600);
        const renderer = new VectorRenderer(canvas, 380);

        // Banking RIGHT must swing a point that was straight up over to the
        // LEFT of the screen, not the right.
        const above = renderer.projectCameraPoint(
            renderer.transformToCamera({ x: 0, y: 500, z: 1000 }, { x: 0, y: 0, z: 0 }, 0, 0, 0.5)
        );
        expect(above.x).toBeLessThan(400);
    });

    it('inverts screen Y so a world point above camera projects above center', () => {
        const { canvas } = makeFakeCanvas(800, 600);
        const renderer = new VectorRenderer(canvas, 380);

        const camPoint = renderer.transformToCamera(
            { x: 0, y: 200, z: 1000 },
            { x: 0, y: 0, z: 0 }, 0, 0, 0
        );
        const screen = renderer.projectCameraPoint(camPoint);
        expect(screen.y).toBeLessThan(300); // above center = smaller Y in canvas space
    });
});

describe('VectorRenderer.depthFade', () => {
    it('is fully opaque at or before the near-fade distance', () => {
        expect(VectorRenderer.depthFade(0)).toBe(1.0);
        expect(VectorRenderer.depthFade(VectorRenderer.NEAR_FADE)).toBe(1.0);
    });

    it('floors at MIN_FADE_ALPHA at or beyond the far-fade distance', () => {
        expect(VectorRenderer.depthFade(VectorRenderer.FAR_FADE)).toBeCloseTo(VectorRenderer.MIN_FADE_ALPHA, 5);
        expect(VectorRenderer.depthFade(VectorRenderer.FAR_FADE * 2)).toBeCloseTo(VectorRenderer.MIN_FADE_ALPHA, 5);
    });

    it('decreases monotonically between the near and far fade distances', () => {
        const mid1 = VectorRenderer.depthFade(2000);
        const mid2 = VectorRenderer.depthFade(4000);
        const mid3 = VectorRenderer.depthFade(6000);
        expect(mid1).toBeGreaterThan(mid2);
        expect(mid2).toBeGreaterThan(mid3);
    });
});

describe('VectorRenderer.renderMesh backward compatibility', () => {
    it('produces identical world-space endpoints with pitch=roll=0 as the original yaw-only formula', () => {
        const { canvas, ctx } = makeFakeCanvas();
        const renderer = new VectorRenderer(canvas, 380);

        const mesh: WireframeMesh = {
            lines: [{ p1: { x: 3, y: 2, z: -5 }, p2: { x: -4, y: 1, z: 6 } }]
        };
        const worldPos: Vector3 = { x: 100, y: 50, z: 200 };
        const yaw = 0.7;

        // Reproduce the ORIGINAL yaw-only world transform formula exactly
        // (this is what renderMesh computed before pitch/roll support was added).
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const expectedP1: Vector3 = {
            x: worldPos.x + (mesh.lines[0].p1.x * cy + mesh.lines[0].p1.z * sy),
            y: worldPos.y + mesh.lines[0].p1.y,
            z: worldPos.z + (mesh.lines[0].p1.z * cy - mesh.lines[0].p1.x * sy)
        };

        const drawLineSpy = vi.spyOn(renderer, 'drawLine');
        renderer.renderMesh(mesh, worldPos, yaw, { x: 0, y: 0, z: -1000 }, 0, 0, 0);

        expect(drawLineSpy).toHaveBeenCalledTimes(1);
        const calledP1 = drawLineSpy.mock.calls[0][0] as Vector3;
        expect(calledP1.x).toBeCloseTo(expectedP1.x, 6);
        expect(calledP1.y).toBeCloseTo(expectedP1.y, 6);
        expect(calledP1.z).toBeCloseTo(expectedP1.z, 6);
        void ctx;
    });

    it('rotates a mesh point upward in world space when a positive pitch is supplied', () => {
        const { canvas } = makeFakeCanvas();
        const renderer = new VectorRenderer(canvas, 380);

        // A point straight out the "nose" (local +Z) should rise in world Y
        // when the mesh is pitched nose-up.
        const mesh: WireframeMesh = { lines: [{ p1: { x: 0, y: 0, z: 10 }, p2: { x: 0, y: 0, z: 10 } }] };
        const drawLineSpy = vi.spyOn(renderer, 'drawLine');

        renderer.renderMesh(mesh, { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: -1000 }, 0, 0, 0, undefined, 0.5, 0);
        const p1 = drawLineSpy.mock.calls[0][0] as Vector3;
        expect(p1.y).toBeGreaterThan(0);
    });
});
