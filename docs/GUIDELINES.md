# Contributor Guidelines

Rules that keep this project coherent. These are not stylistic preferences —
several encode bugs that have already been fixed once.

---

## 1. Zero External Engine Policy

**Never introduce Three.js, Babylon.js, Pixi.js, or maths libraries like gl-matrix.**
This project has **zero runtime dependencies** and that is a defining constraint,
not an accident. All 3D projection, matrix transformation, physics integration
and audio synthesis is hand-written linear algebra.

Permitted: plain `CanvasRenderingContext2D` and `AudioContext` — including
**offscreen `<canvas>` buffers** used for post-processing. Offscreen 2D contexts
are still zero-dependency and are required by the phosphor/bloom pipeline.

Dev dependencies (TypeScript, Vite, Vitest) are fine. Runtime dependencies are not.

## 2. Physics Guardrails

- **Simulation runs on a fixed timestep** (`FIXED_DT = 1/120 s`). Never advance
  physics with a raw `requestAnimationFrame` delta, and never run gameplay logic
  on a separate `setInterval` — control authority must track real elapsed time.
- **Integrate consistently.** Use semi-implicit Euler: update velocity, then
  position. Do not apply closed-form displacement terms using a per-frame `dt`
  where accumulated time-of-flight is meant (this was a real bug in bullet
  ballistics: `-0.5*g*dt²` made tracers fly dead flat).
- **Free energy generation is forbidden.** Lift, drag, thrust and gravity must
  balance physically. Hard turns must bleed airspeed via induced drag.
- **Guard against tunnelling.** Any fast-moving projectile collision check must
  test the swept travel *segment*, not just the end-of-tick position. A SAM
  covers ~48 m per tick against a 40 m fuze radius.
- Any new flight dynamic, carrier state transition or sensor formula **must ship
  with headless Vitest tests**.

## 3. Rendering & Performance

- **World-referenced HUD symbology must derive its scale from
  `VectorRenderer.fov`** — never a hardcoded px/rad or px/degree constant.
  Use `fov · tan(Δangle)`, or project a probe point through the real camera
  pipeline. Hardcoded constants silently desynchronise the HUD from the 3D scene.
- Cull by distance (8,000 m) and stride terrain sampling; the terrain grid is by
  far the heaviest draw.
- **Never apply phosphor persistence to the visible canvas.** Persistence works by
  not clearing, which would smear HUD text into an illegible blur. The 3D world
  renders to an offscreen layer that carries the decay; the visible canvas is
  hard-cleared, composited, and the HUD drawn crisply on top.
- Device pixel ratio is deliberately pinned at 1:1. Chunky pixels are the intended
  aesthetic and keep the bloom pass cheap. Do not "fix" this.

## 4. CRT Phosphor Aesthetics

Palette — do not introduce colours outside this set:

| Colour | Use |
| --- | --- |
| `#00ff66` | Primary phosphor |
| `#00aa44` | Dim / secondary |
| `#33aa33` | Ridge lines |
| `#1d8a2c` | Horizon, upper slopes |
| `#00632a` | Sea, canyon floor |
| `#004400` | Low terrain |
| `#051008` | Background (hard clear) |
| `#030a04` | Persistence decay floor |
| `#ffaa00` | Warning |
| `#ffff33` | Runway / ready |
| `#ff3333` | Alert / hostile |

- `shadowBlur = 4` for standard glow strokes.
- **The persistence decay target must remain strictly darker than the background.**
  Decaying toward `#051008` does not converge under 8-bit rounding and leaves a
  permanent burnt-in ghost. `#030a04` is strictly below every channel of the
  background, making the decay iteration strictly decreasing.
- Bloom strength stays ≤ 0.55; above that the screen turns into green fog.

## 5. TypeScript & Testing Discipline

- **`strict: true` is mandatory.** Maintain zero errors under `npx tsc --noEmit`.
  Do **not** add `noUncheckedIndexedAccess` — it produces 55+ errors in the
  ballistics code for no real safety gain here.
- `erasableSyntaxOnly` is enabled: **no parameter properties** (`constructor(public x)`),
  no enums. Declare fields explicitly and assign in the constructor body.
- Always use `import type { ... }` for type-only imports (`verbatimModuleSyntax`
  is on). This also keeps DOM-touching modules out of the node test module graph.
- **Pure logic must live in a DOM-free module** so it can be tested in the node
  environment. There is no `vitest.config.ts` and no jsdom — a module that
  touches `document` at import time cannot be tested. Extract pure maths
  (`depthFade`, `decayAlpha`, `computeDeckLayout`, `gradeTrap`, `warmupEnvelope`)
  out of rendering classes deliberately.
- Canvas-dependent code can still be integration-tested with a stubbed 2D context
  — see `src/core/GameLoop.smoke.test.ts`.

## 6. Single Sources of Truth

- **Key bindings live in `src/core/Controls.ts`** and nowhere else. The input
  handler, help overlay, briefing and README control table all derive from it.
  (The README previously documented `W` as "Pitch Down" paired with `Down Arrow`
  when the code bound it with `ArrowUp` to pitch *up* — both wrong.)
- **One clock per mechanic.** The catapult stroke is timed solely by
  `DeckManager.catapultTimer`; the renderer derives progress from it and reacts
  to the state-transition edge. Two parallel timers previously raced and the
  completion branch never fired.
- **Layout comes from `computeDeckLayout()`**, never hardcoded pixel coordinates.
  Absolute positioning is what broke the deck screen below 1250 px wide.
