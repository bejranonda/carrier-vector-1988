/**
 * CARRIER VECTOR: 1988 - CRT Phosphor Post-Processing Pipeline
 *
 * Renders the 3D vector world into an offscreen buffer so it can carry
 * phosphor persistence (glowing decay trails - the defining property of a
 * real vector CRT like Battlezone or Asteroids), then composites it to the
 * visible canvas with an additive bloom pass.
 *
 * ARCHITECTURE - why an offscreen buffer instead of just not clearing:
 * Persistence works by *not* fully clearing the frame. If that were applied
 * to the visible canvas, every HUD readout would smear into an illegible
 * green smudge, because HUD text redraws in place each frame while older
 * copies decay underneath it. So:
 *
 *   worldLayer (offscreen, persistent)  <- 3D vectors only; decays each frame
 *        |  downscale 1/4
 *   bloomLayer (offscreen, 1/4 size)    <- threshold + blur
 *        v
 *   visible canvas (hard-cleared)       <- world + bloom, THEN crisp HUD on top
 *
 * Zero dependencies: plain Canvas2D contexts only.
 */

import { THEME } from './Theme';

export type PostQuality = 'OFF' | 'LOW' | 'HIGH';

export class PostProcess {
    public quality: PostQuality = 'HIGH';
    public bloomStrength = 0.32;

    private worldCanvas: HTMLCanvasElement;
    private worldContext: CanvasRenderingContext2D;
    private bloomCanvas: HTMLCanvasElement;
    private bloomContext: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private dpr = 1;

    /** Feature-detected once: Canvas2D `filter` is unsupported on some older Safari. */
    private readonly supportsFilter: boolean;

    constructor(width: number, height: number, dpr: number = 1) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.dpr = Math.max(1, dpr);

        this.worldCanvas = document.createElement('canvas');
        const wctx = this.worldCanvas.getContext('2d');
        if (!wctx) throw new Error('PostProcess: could not create world layer 2D context');
        this.worldContext = wctx;

        this.bloomCanvas = document.createElement('canvas');
        const bctx = this.bloomCanvas.getContext('2d');
        if (!bctx) throw new Error('PostProcess: could not create bloom layer 2D context');
        this.bloomContext = bctx;

        this.supportsFilter = 'filter' in this.bloomContext;
        this.sizeBuffers();
    }

    /**
     * Size the offscreen buffers to DEVICE pixels and pre-scale the world
     * context, so the persistent vector layer renders at the same native
     * resolution as the visible canvas while callers keep working in CSS
     * pixels.
     */
    private sizeBuffers() {
        this.worldCanvas.width = Math.round(this.width * this.dpr);
        this.worldCanvas.height = Math.round(this.height * this.dpr);
        this.worldContext.setTransform?.(this.dpr, 0, 0, this.dpr, 0, 0);

        this.bloomCanvas.width = Math.max(1, Math.floor(this.worldCanvas.width / 4));
        this.bloomCanvas.height = Math.max(1, Math.floor(this.worldCanvas.height / 4));
        this.hardClear();
    }

    /** The canvas the VectorRenderer should draw the 3D world into. */
    public get worldTarget(): HTMLCanvasElement {
        return this.worldCanvas;
    }

    public get worldCtx(): CanvasRenderingContext2D {
        return this.worldContext;
    }

    public resize(width: number, height: number, dpr: number = this.dpr) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.dpr = Math.max(1, dpr);
        this.sizeBuffers();
    }

    /** Fully reset the world layer. Used on resize and on view/phase changes. */
    public hardClear() {
        this.worldContext.globalAlpha = 1;
        this.worldContext.globalCompositeOperation = 'source-over';
        this.worldContext.shadowBlur = 0;
        this.worldContext.shadowColor = 'transparent';
        this.worldContext.fillStyle = THEME.ground;
        this.worldContext.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Composite the persistent world layer (plus bloom) onto the visible
     * canvas. The destination is expected to already be cleared; the HUD is
     * drawn afterwards so it stays perfectly crisp.
     */
    public composite(dest: CanvasRenderingContext2D) {
        dest.save();
        dest.globalAlpha = 1;
        dest.globalCompositeOperation = 'source-over';
        dest.drawImage(this.worldCanvas, 0, 0, this.width, this.height);

        if (this.quality !== 'OFF' && this.bloomStrength > 0) {
            this.renderBloom();
            dest.globalCompositeOperation = 'lighter';
            dest.globalAlpha = this.bloomStrength;
            dest.drawImage(this.bloomCanvas, 0, 0, this.width, this.height);
        }

        dest.globalAlpha = 1;
        dest.globalCompositeOperation = 'source-over';
        dest.restore();
    }

    /**
     * Build the bloom layer from the world layer.
     *
     * 1. Downscale to 1/4 - the browser's bilinear filtering gives the first
     *    blur pass for free.
     * 2. Pseudo-threshold via a 'multiply' self-composite, which squares each
     *    channel (v -> v^2/255). The dark background collapses to near-black
     *    while saturated phosphor strokes survive, so bloom highlights the
     *    beam instead of fogging the whole screen.
     * 3. Blur, then the caller composites additively with 'lighter'.
     */
    private renderBloom() {
        const bw = this.bloomCanvas.width;
        const bh = this.bloomCanvas.height;
        const bctx = this.bloomContext;

        bctx.globalAlpha = 1;
        bctx.globalCompositeOperation = 'source-over';
        bctx.clearRect(0, 0, bw, bh);
        bctx.imageSmoothingEnabled = true;
        bctx.drawImage(this.worldCanvas, 0, 0, bw, bh);

        // Pseudo-threshold: squares every channel, killing the dim background.
        bctx.globalCompositeOperation = 'multiply';
        bctx.drawImage(this.bloomCanvas, 0, 0);
        bctx.globalCompositeOperation = 'source-over';

        if (this.quality === 'HIGH') {
            if (this.supportsFilter) {
                bctx.filter = 'blur(2px)';
                bctx.drawImage(this.bloomCanvas, 0, 0);
                bctx.filter = 'none';
            } else {
                // 4-tap offset fallback approximating a small Gaussian.
                bctx.globalAlpha = 0.25;
                bctx.drawImage(this.bloomCanvas, 1, 0);
                bctx.drawImage(this.bloomCanvas, -1, 0);
                bctx.drawImage(this.bloomCanvas, 0, 1);
                bctx.drawImage(this.bloomCanvas, 0, -1);
                bctx.globalAlpha = 1;
            }
        }
    }

    /**
     * Frame-rate independent phosphor decay alpha for a given elapsed time
     * and decay time constant. Pure - exported for headless testing.
     *
     * Remaining brightness after t seconds is e^(-t/tau), so the per-frame
     * composite alpha is 1 - e^(-dt/tau). Using a CONSTANT alpha instead
     * would make trails ~2.4x longer on a 144Hz display than at 60Hz.
     */
    public static decayAlpha(dt: number, tau: number = 0.06): number {
        if (!Number.isFinite(dt) || dt <= 0) return 0;
        return Math.min(1, Math.max(0.02, 1 - Math.exp(-dt / tau)));
    }

    /**
     * Adaptive quality ladder with hysteresis, driven by rolling average
     * frame time. Pure - exported for headless testing.
     */
    public static nextQuality(current: PostQuality, avgFrameMs: number): PostQuality {
        if (avgFrameMs > 30) return 'OFF';
        if (avgFrameMs > 22) return current === 'HIGH' ? 'LOW' : current;
        if (avgFrameMs < 14) {
            if (current === 'OFF') return 'LOW';
            if (current === 'LOW') return 'HIGH';
        }
        return current;
    }
}
