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
        fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn()
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
