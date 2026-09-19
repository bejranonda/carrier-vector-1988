# Approach & Method

Design philosophy and engineering method behind Carrier Vector: 1988.

---

## 1. Core Philosophy

**Constraint as a design driver.** The zero-dependency rule is the organising
principle. Forbidding Three.js forces every transform, clip and projection to be
written explicitly, which keeps the entire rendering path inspectable and
testable — and produces the authentic vector-display look as a natural
consequence rather than a post-effect bolted onto a modern engine.

**Simulate, then present.** Systems are modelled as real physical relationships
(dynamic pressure, radar range equations, crew fatigue) and the presentation
layer reports them. Nothing is faked for effect: when the RWR screams, a real
line-of-sight ray actually connects a SAM to your aircraft.

**Mechanics must have consequence.** The most important lesson from this
codebase's history: a system that is beautifully implemented but wired to
nothing is worth zero. The radar, RCS and terrain-masking model was
sophisticated and completely inert because missiles had no collision check.
Every system must be able to change the game state.

## 2. Dual-Loop Architecture

The game deliberately alternates between two loops operating on different
timescales, coupled through shared resources.

### Macro — Flight Deck Logistics

A deterministic tick-based queuing simulation. Crews with stamina work an
aircraft through a state machine; fatigue slows turnaround by up to 60%, so
sustained high-tempo operations degrade your ability to launch. A threat
director advances strike packages along a timeline toward the carrier.

### Micro — 3D Vector Tactical Sortie

A fixed-timestep 6-DOF flight simulation. Energy management is the core skill:
lift costs induced drag, induced drag scales super-linearly with G, so every
hard turn is paid for in airspeed.

### The coupling

This is what makes it a game rather than two demos:

- Ordnance and fuel you load are **deducted from finite carrier stocks**
- Packages you fail to intercept **damage the deck you launch from**
- Lost airframes are **permanently gone**; at zero hull integrity the mission ends
- Time spent managing the deck is time the threat timeline keeps advancing

## 3. Rendering Pipeline

### Pure linear algebra projection

World point → translate by `−camPos` → apply `−yaw`, `−pitch`, `−roll` → clip
against `z = 2.0 m` → perspective divide `x' = x·f/z + x₀`. Every mesh, terrain
line, weapon tracer and HUD reticle flows through this same path, which is why
the HUD can be made to overlay the world exactly.

### The two-layer composite

Phosphor persistence is the defining property of a vector CRT, and it works by
*not* clearing the frame. Applied naively to the visible canvas it destroys HUD
legibility, because text redraws in place while its older copies decay beneath it.

The resolution is a layered pipeline:

```
worldLayer (offscreen, persistent)   ← 3D vectors; decays each frame
     │ downscale ¼ → threshold → blur
bloomLayer (offscreen, ¼ size)
     ↓
visible canvas (hard-cleared each frame)
     ← drawImage(world) → 'lighter' drawImage(bloom) → HUD drawn crisp on top
```

Two non-obvious details make this work:

1. **Decay must be frame-rate independent.** `α = 1 − e^(−Δt/τ)`. A constant
   per-frame alpha gives 2.4× longer trails at 144 Hz than at 60 Hz.
2. **The decay target must be strictly darker than the background.** Decaying
   toward `#051008` never converges under 8-bit channel rounding — a channel at
   6 rounds back to 6 forever — leaving permanent burn-in everywhere the beam
   has been. Decaying toward `#030a04` is strictly decreasing and reaches the floor.

### Bloom without shaders

No WebGL, so the threshold is done arithmetically: a `multiply` self-composite
squares every channel (`v → v²/255`), collapsing the dark background to black
while saturated phosphor survives. The ¼-scale downscale provides the first blur
pass for free via the browser's bilinear filtering.

## 4. Simulation Method

### Fixed timestep

The render loop feeds wall-clock elapsed time into an accumulator which reports
how many 120 Hz substeps to run, carrying the remainder forward. Excess beyond 8
substeps is **discarded rather than queued** — otherwise a backgrounded tab
produces a frame that tries to simulate hundreds of steps, which takes longer
than a frame, which grows the backlog further: the classic spiral of death.

120 Hz rather than 60 Hz because the aerodynamics use explicit Euler
integration, whose error is proportional to step size. Halving `dt` halves the
error on the stiff lift/drag coupling essentially for free.

Control input is applied **inside** the fixed tick, not from a separate timer,
so control authority is exactly time-consistent across machines.

### Collision correctness

Fast objects require swept tests. A SAM at 480 m/s advances ~48 m per tick
against a 40 m fuze radius, so an end-of-tick distance check tunnels straight
through the target. The fuze instead finds the closest point on the travel
segment:

```
t* = clamp( ((P − A)·(B − A)) / |B − A|², 0, 1 )
```

### Determinism where it matters

Procedural waves use a seeded `mulberry32` PRNG rather than `Math.random()`, so
a campaign is reproducible and the escalation curve is directly unit-testable.
Terrain is analytic rather than noise-based for the same reason — and because a
random heightfield could produce a canyon that breaks the terrain-masking mechanic.

## 5. Responsive Layout as a Solved Problem

The deck screen was originally absolute-positioned and clipped below 1250 px.
Rather than tuning coordinates, layout is now a **pure function**:

```
computeDeckLayout(specs, { width, height }) → { panels: Record<string, Rect>, ... }
```

Panels declare a minimum width and row count; the solver picks a column count by
breakpoint, packs flow panels into the shortest column (ties to the leftmost, for
determinism), pins banners to the top and the log to the bottom, and compresses
row height under vertical pressure.

Because it is pure geometry with no canvas involvement, the properties that
actually matter are directly assertable: **no panel escapes the viewport and no
two panels overlap**, verified across 28 viewport size combinations.

## 6. Onboarding Design

### Progressive disclosure

1. **Display warm-up** — establishes the aesthetic before any demand on the player
2. **Briefing** — three numbered phase cards (deck → intercept → recover), each
   carrying its own keycaps, plus one unmistakable call to action
3. **Guided cold start** — begins on the deck, so the dual-loop structure is learned by doing
4. **Flight checkout** — a six-step checklist that ticks off as each control is demonstrated
5. **Contextual coach** — thereafter, only speaks when something needs attention

### Two channels, never confused

The game answers two different questions, and conflating them was the original
comprehension failure.

| Channel | Question | Source |
| --- | --- | --- |
| Objective (orders panel / HUD strip) | *What is this phase of the game asking of me, and which key does it?* | `core/Objectives.ts` |
| Coach (ticker) | *What is about to kill me?* | `core/Tutorial.ts` |

The objective is **always** present. Before, neither screen ever stated one: the
deck showed eight panels of inventory with `[ENTER]` as 12px grey footer text,
and the cockpit showed twelve instruments and no goal. Both channels are pure
modules, so their phrasing is unit-tested rather than eyeballed.

A third rule keeps them honest: **one message per condition.** A missile launch
used to be announced simultaneously by the warning banner, the coach ticker and
the objective strip; the HUD now suppresses the ticker when the banner already
covers the same cause.

### The coach is a priority-ranked rule list

Many conditions can be true simultaneously — stalled *and* low on fuel *and*
under missile attack. The player can only act on one, so rules are evaluated
most-lethal-first and exactly one cue is surfaced.

Encoding this as a pure ordered list makes priority conflicts *testable*
assertions rather than emergent behaviour discovered in flight. That caught a
real bug: an early rule nagged "LOW AIRSPEED — ADVANCE THROTTLE" during landing
approaches, where flying slow is precisely correct.

It also caught a worse one. The *training prompt* was returned first and
unconditionally, outranking every safety rule — so a first-time pilot, exactly
the player who needs them most, had stall, terrain and missile-launch warnings
suppressed for the whole of their first sortie. Contextual hints now win, and
the training prompt takes the channel only when nothing else needs it.

## 6b. Readability as an Engineering Property

Legibility was treated as measurable, not as taste.

- **Contrast is asserted.** Every UI token must clear 4.5:1 against the ground
  colour; `Theme.test.ts` computes the ratios. The old palette put desaturated
  green labels under a 92%-black vignette and a scanline mask, which put the
  readouts that mattered most well under 3:1.
- **Backgrounds are measured.** The cockpit's median background pixel is sampled
  in a real browser. That is how a shadow-state leak was found: `drawLine()` left
  `shadowColor` armed, so the persistence fill painted a full-screen *shadow* in
  the last vector's colour every frame, accumulating to `rgb(107,24,21)` where
  `rgb(3,10,4)` was intended.
- **Geometry is solved, then asserted.** Both screens have a pure layout solver
  with tests that nothing overlaps and nothing leaves the viewport, across a
  matrix of viewport sizes.
- **Effects are a player choice.** Persistence, bloom, per-stroke glow, scanlines
  and vignette are fields of one `DisplayModeSpec`, cycled with `P` and
  remembered across sessions. An effect a player cannot turn off is a defect.
- **Cost is profiled.** The per-stroke Canvas2D shadow measured 23.7 ms/frame at
  1600x900 against 16.7 ms without it, so only `RETRO` pays for it; `MODERN`
  buys its glow from the ¼-resolution bloom pass instead.

## 6c. Missions as Data

The game shipped with one mode, and every system a second mode would need was
already present — a navigable canyon, radar line of sight, hardened SAM sites,
iron bombs, graded traps. What was missing was anything that asked the player
to use them **in a particular order**. The bomb was dead weight and the canyon
was only ever cover.

A scenario is therefore a piece of data, not a code path:

```
ScenarioDef = world setup + ordered phases + failure predicate + prose
```

`core/Scenarios.ts` imports no subsystem and touches no canvas. That has two
consequences worth stating plainly. First, mission *copy* is unit-testable —
every phase's `detail()` is exercised against hostile snapshots (a null range,
no bombs, a dead target) so the HUD can never ask a mission what to say and get
an exception. Second, `GameLoop` never branches on a mission id: if a scenario
needs something new from the world, it goes in `ScenarioSetup` and the loop
applies it generically. Adding a sixth mission touches one file.

### What the phases caught

Writing the director surfaced three design errors that a hand-rolled state
machine would have buried:

- **Failure outranked victory.** Both can become true on the same tick —
  landing the final sortie on the last airframe. A mission you have already
  completed cannot fail, so victory is tested first.
- **One crash ended the raid.** `CANYON_STRIKE` originally failed outright on a
  lost airframe, which made its four-minute window decorative: you never lived
  long enough for it to matter. Losing a jet now costs the ~30s
  hangar-and-rearm cycle and the clock does the punishing — which is the
  tension the mission was for.
- **The objective line lied on the deck.** An air phase kept insisting "RUN THE
  FJORD — 8.1 km to the pen" at a pilot sitting in the hangar. Phases now
  declare whether they are about the deck, and hand the line back when they are
  not.

The last one is the general lesson from this codebase repeated once more: a
system that is well implemented but wired to the wrong screen is worth nothing.

## 7. Testing Method

Canvas rendering cannot be asserted in a node environment, so the method is to
**extract the decidable core**:

| Extracted pure function | What it makes testable |
| --- | --- |
| `computeDeckLayout` | Deck panel clipping, overlap and drop order, at any viewport size |
| `solveHudLayout` | Cockpit instrument overlap and clipping, at any viewport size |
| `VectorRenderer.transformToCamera` | Agreement with the aircraft's own orientation basis |
| `VectorRenderer.depthFade` | Monotonic depth falloff |
| `PostProcess.decayAlpha` | Frame-rate independence of persistence |
| `ScoreKeeper.gradeTrap` | Wire grading boundaries |
| `BriefingScreen.warmupEnvelope` | Boot animation phases |
| `getContextualHint` | Coach priority policy |
| `deckObjective` / `flightObjective` | Objective phrasing and precedence, for every state |
| `MissionDirector` | Phase progression, victory/failure precedence, mission clocks |
| `StrikeTarget.registerImpact` | Hardened-target hit geometry, including the boundary |
| `WeaponsSystem.predictBombImpact` | CCIP agreement with the real bomb path |
| `fitText` | Text never overflows the panel it is drawn in |
| `DISPLAY_MODES` / `loadDisplayMode` | Effect ladder ordering and storage failure modes |
| `recordBestScore` | Personal-best comparison and corrupt-storage handling |
| `generateWave` / `mulberry32` | Determinism and escalation monotonicity |

The camera entry deserves a note: asserting a transform against the *physics*
basis, rather than against remembered numbers, is what makes a whole class of
sign error impossible. The transform had pitch and roll inverted — the cockpit
view was mirrored about the horizon and the vertical axis — and no amount of
projection unit-testing in isolation would have caught it, because the
projection was internally consistent. It was only wrong relative to the flight
model.

What remains — the wiring between subsystems — is covered by an integration
smoke test that stands up the real `GameLoop` against a stubbed Canvas2D context
and drives every phase, view and transition. That class of test is what catches
the highest-frequency defect in a project like this: not bad maths, but a
subsystem that was never actually connected.

## 8. Procedural Audio

All sound is synthesized at runtime from oscillators and noise buffers; there
are no audio assets. The engine is a sawtooth swept 70→210 Hz through a lowpass
whose cutoff tracks throttle; the afterburner adds a bandpassed white-noise
loop. RWR states map to distinct pulse rates so threat escalation is audible
without looking at the scope — which matters, because the correct response to a
launch warning is to look *outside* at the terrain.
