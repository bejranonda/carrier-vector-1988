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
- **Always reset `shadowBlur` / `shadowColor` after a glow stroke.** Canvas shadow
  state is sticky. `drawLine()` once left it armed, so `decayClear()`'s
  translucent full-screen fill painted a full-screen *shadow* in whatever colour
  the last vector was — usually SAM red — and it accumulated frame over frame
  until the whole cockpit sat under a maroon wash (measured median background
  `rgb(107,24,21)` instead of `rgb(3,10,4)`). Use `resetShadow()`, and note the
  hot path deliberately avoids `save()`/`restore()` for cost reasons.
- **The per-stroke glow is a RETRO-only luxury.** A Canvas2D shadow is applied per
  `stroke()` and the terrain mesh issues thousands per frame: 23.7 ms/frame with
  it at 1600x900 versus 16.7 ms without. `MODERN` gets its glow from the bloom
  pass instead, which is 1/4 resolution and whole-layer. Do not reintroduce a
  per-stroke shadow outside `DisplayMode.vectorGlow`.
- **Device pixel ratio is followed, capped at 2x.** The backing store (visible and
  offscreen) is `CSS px x dpr` with the 2D contexts pre-scaled, so all layout code
  still works in CSS pixels. The old 1:1 `image-rendering: pixelated` canvas was
  deliberate retro chunkiness but made 10-12px HUD glyphs unreadable on HiDPI;
  `RETRO` display mode carries the look instead. The 2x cap keeps the bloom pass
  affordable on 3x/4x phone displays.
- **Screen texture belongs to the display mode, not to individual draw calls.**
  Persistence, bloom, per-stroke glow, the scanline mask and the vignette are all
  fields of a `DisplayModeSpec` (`CLEAN` / `MODERN` / `RETRO`), cycled with `P`
  and persisted to `localStorage`. Do not hardcode an effect that a player
  cannot turn off.

## 4. Colour, Type & Legibility

**All colour comes from `src/renderer/Theme.ts`.** Never write a hex literal into
a drawing call — the old screens each carried their own `#00ff66` / `#00aa44` and
the result was a display on which nothing read as more important than anything
else.

| Token | Use |
| --- | --- |
| `THEME.ground` | Page and canvas ground |
| `THEME.ink` | Headline values you must read at a glance |
| `THEME.phosphor` | Primary instrument colour |
| `THEME.muted` | Labels and secondary copy — deliberately NEUTRAL, not green |
| `THEME.key` | Cyan, reserved exclusively for key names |
| `THEME.caution` | Caution / ready |
| `THEME.alert` | Lethal / hostile |
| `WORLD.*` | 3D wireframe colours, kept separate from UI chrome |

Rules:

- **Every UI colour must clear 4.5:1 contrast against `THEME.ground`**, checked at
  the darkest point of the vignette. `Theme.test.ts` asserts this; add new tokens
  there too.
- **Labels are neutral, values carry the colour.** A desaturated green label turns
  to mud under the vignette, which is exactly what happened before.
- **Cyan means "this is a key you can press"** and nothing else. Draw keys with
  `keycap()`, not as `[ENTER]` inside a sentence — players skim for something that
  looks pressable.
- **Body text is drawn with NO shadow glow**, on a translucent `plate()`. Glow
  fattens 12px monospace strokes until they smear, and legibility must never
  depend on what part of the wireframe happens to be behind the text.
- **Clamp text you did not measure.** Canvas has no overflow handling; run any
  variable-length string through `fitText()` or it paints straight through the
  edge of its panel.
- **The persistence decay target must remain strictly darker than the background.**
  Decaying toward the background colour does not converge under 8-bit rounding and
  leaves a permanent burnt-in ghost. The decay floor is strictly below every
  channel of the ground colour, making the iteration strictly decreasing.
- Bloom strength stays ≤ 0.55; above that the screen turns into green fog.

## 8. TypeScript & Testing Discipline

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

## 9. Single Sources of Truth

- **Key bindings live in `src/core/Controls.ts`** and nowhere else. The input
  handler, help overlay, briefing and README control table all derive from it.
  (The README previously documented `W` as "Pitch Down" paired with `Down Arrow`
  when the code bound it with `ArrowUp` to pitch *up* — both wrong.)
- **One clock per mechanic.** The catapult stroke is timed solely by
  `DeckManager.catapultTimer`; the renderer derives progress from it and reacts
  to the state-transition edge. Two parallel timers previously raced and the
  completion branch never fired.
- **Layout comes from a solver, never hardcoded pixel coordinates.**
  `computeDeckLayout()` owns the deck screen and `solveHudLayout()` owns the
  cockpit. Absolute positioning broke the deck screen below 1250px wide, and
  fixed `cx - 300` offsets drew the cockpit's airspeed block underneath the
  training checklist at 900x700. Both solvers are pure and both have tests
  asserting that nothing overlaps and nothing leaves the viewport — extend those
  matrices when adding a panel.
- **The camera transform is derived from the aircraft's own basis vectors.**
  `transformToCamera()` projects onto the same right / up / forward vectors
  `AircraftPhysics` uses for lift and thrust. It previously composed rotation
  matrices by hand and had the sign of pitch and roll backwards, so pulling the
  nose up moved the terrain *up* the screen and the pitch ladder contradicted the
  3D world. Never hand-roll that composition again.
- **"What do I do now" comes from `src/core/Objectives.ts`**, which is pure and
  covers every deck state. The deck orders panel and the cockpit objective strip
  both read it, so the two loops can never disagree about the goal.
- **A mission is data, not code.** `src/core/Scenarios.ts` holds the world setup,
  the ordered phases, the failure predicate and every line of prose for each
  selectable mission. It imports no subsystem and touches no canvas, so mission
  logic and mission copy are both unit-testable. Adding a mission means adding a
  `ScenarioDef` — if you find yourself branching on a `ScenarioId` inside
  `GameLoop`, the thing you need belongs in `ScenarioSetup` instead.
- **A map is data too.** `src/tactics/TerrainProfiles.ts` holds every height
  function and every SAM order of battle. `TacticalTerrain` samples a profile
  and `SensorTacticsManager` builds its launchers from one; neither knows which
  map it is. A new map is a new `TerrainProfile` plus the invariants in
  `TerrainProfiles.test.ts` — do not add one without making those pass, because
  a map that cannot mask a radar breaks a core mechanic silently.
- **Flight assistance is control law, never teleportation.**
  `src/flight/FlightAssist.ts` produces the same stick, rudder and throttle
  demands a pilot would, and `GameLoop` feeds them to the same
  `applyPitchInput` / `applyRollInput` / `applyYawInput` the keyboard uses.
  Nothing in an assist may set position, velocity or attitude directly: if the
  assist can put the aircraft somewhere it could not have flown, the simulation
  is lying to the player.

## 7. Mission Rules

- **A mission you have completed cannot fail.** The director checks victory
  before failure, because both can become true on the same tick — landing the
  final sortie on the last airframe is a win, not a loss.
- **Phase progress is monotonic.** A completed phase never un-completes when the
  world moves back; that is why the director is a small stateful object rather
  than a reducer over a snapshot.
- **One mistake must not end a run that has a clock.** `CANYON_STRIKE` used to
  fail outright on a lost airframe, which made the four-minute window
  decorative. Losing a jet now costs the ~30s hangar-and-rearm cycle, and the
  clock does the punishing.
- **An air phase hands the objective line back to the deck.** A phase without
  `onDeck` returns `null` from `objective()` while the jet is on deck, so a
  pilot in the hangar is told what the hangar is doing — not "RUN THE FJORD,
  8.1 km to the pen". The mission clock follows them across either way.
- **The assists stand down where the mission needs them to.** Ground-proximity
  protection is inhibited on a carrier approach and the autopilot disengages on
  final, because an approach *is* a controlled descent to a deck 20 m above the
  water. Any new protection must answer the question "what legitimate thing does
  this make impossible?" before it ships.
- **An annunciator that is always lit is not an annunciator.** Auto-levelling
  happens on every frame the stick is centred and is deliberately silent.
  Captions are reserved for a protection actually taking authority away, and
  only past a threshold — otherwise the one caption that matters
  (`TERRAIN — AUTO PULL-UP`) is the one the player has learned to ignore.
- **A designation outlives its frame, not its target.** The lock is stored as an
  id and re-solved every tick, so a contact that dies drops the lock rather than
  leaving the HUD bracketing wreckage or, worse, a recycled id.
- **A hardened target is not killed by a near miss.** That single number
  (`hitRadius`) is what makes a bombing run a skill, so any cue that helps aim
  it — the CCIP cross, the designator diamond — must be computed from the same
  integration the live weapon uses, never an approximation of it.
