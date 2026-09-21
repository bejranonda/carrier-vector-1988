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

## 2. The 4-Tier Architecture & Gameplay Loops

The game alternates across four coupled timescales, from instantaneous reflex to strategic campaign persistence:

### 1. Micro-Loop (0–5 seconds) — Gun Boresight & Kinetic Payoff
Boresight lead tracking, missile lock tone acquisition, weapon release, and immediate visceral feedback: 3D vector line fragmentation debris tumbling in space, camera-shake impulses, and audio transient hit pings.

### 2. Meso-Loop (30–90 seconds) — Tactical Intercept & Evasion
Energy management during dogfights, terrain-masking dives below radar horizon, and Padlock camera target tracking (`V` key) to keep visual contact with bandits during high-G turns.

### 3. Macro-Loop (5–15 minutes) — Flight Deck Operations & Sortie Recovery
A deterministic tick-based queuing simulation. Crews with stamina work an aircraft through a state machine; fatigue slows turnaround by up to 60%, so sustained high-tempo operations degrade launch capability. Players can rush turnaround (`R`), trading crew stamina for immediate progress. The sortie concludes with an authentic carrier recovery approach (meatball, AoA indexer, 3-wire trap).

### 4. Meta-Loop (Campaign) — Persistent Rogue-lite Fleet Strategy
The carrier acts as an operational mobile base navigating a node-based strategic map of the Norwegian Sea:
- **Finite Logistics:** The air wing starts with 24 F-14 Tomcat and 12 A-6 Intruder airframes, finite aviation fuel (JP-5), and ordnance pools.
- **Permanent Attrition:** Shot-down aircraft and expended ordnance are permanently deducted from the fleet roster across sorties.
- **Strategic Cause & Effect:** Striking an enemy Early Warning Radar outpost disables SAM coordination in adjacent nodes, clearing corridors for subsequent deep-strike packages.

### 2.5. Subsystem Mathematical Models

#### Padlock Target-Tracking Camera
In combat flight, maintaining visual contact ("padlock") on a maneuvering target is paramount. The camera look-at orientation vector $\mathbf{v}_{\text{look}}$ interpolates from the aircraft boresight $\mathbf{u}_{\text{forward}}$ toward the designated target position $\mathbf{p}_{\text{tgt}}$:

$$\mathbf{d} = \frac{\mathbf{p}_{\text{tgt}} - \mathbf{p}_{\text{ac}}}{\|\mathbf{p}_{\text{tgt}} - \mathbf{p}_{\text{ac}}\|}$$

Target-relative camera angles in aircraft body axes:
$$\psi_{\text{tgt}} = \text{atan2}(\mathbf{d} \cdot \mathbf{u}_{\text{right}},\, \mathbf{d} \cdot \mathbf{u}_{\text{forward}})$$
$$\theta_{\text{tgt}} = \text{asin}(\mathbf{d} \cdot \mathbf{u}_{\text{up}})$$

Clamped to physical human canopy limits:
$$\psi_{\text{cam}} = \text{clamp}(\psi_{\text{tgt}}, -110^\circ, +110^\circ)$$
$$\theta_{\text{cam}} = \text{clamp}(\theta_{\text{tgt}}, -30^\circ, +60^\circ)$$

Camera rotation smoothly transitions over $\Delta t = 250\text{ ms}$ using ease-out cubic interpolation: $f(t) = 1 - (1 - t)^3$. The underlying aerodynamic physics basis is strictly invariant during padlock look-at.

#### Cockpit Voice Alert Architecture ("Bitchin' Betty")
Synthesized voice warnings bypass visual attention channels, delivering immediate critical telemetry. Alerts are dispatched through a deterministic priority queue with a 4.0-second de-bounce lockout per warning type:
1. **Priority 1 (`CRITICAL`):** *"WARNING: MISSILE LAUNCH"* — Hostile SAM guidance radar lock active.
2. **Priority 2 (`TERRAIN`):** *"PULL UP, PULL UP"* — Altitude $y < 200\text{ m}$ and vertical velocity $v_y < -30\text{ m/s}$.
3. **Priority 3 (`AERODYNAMIC`):** *"STALL, STALL"* — Angle of attack $|\alpha| > 18^\circ$ with authority degradation.
4. **Priority 4 (`LOGISTICS`):** *"BINGO FUEL"* — Fuel reserve $< 15\%$ capacity.

Zero external audio files: synthesized via the browser's native `window.speechSynthesis` or procedural phonetic formant synthesis in `WebAudioSystem.ts`.

#### Vector Fragmentation Explosion Kinetics
Target destruction breaks 3D wireframe line segments into $N \in [10, 16]$ physical line entities. Each fragment $i$ inherits parent velocity $\mathbf{v}_{\text{parent}}$ plus radial blast velocity $\mathbf{v}_{\text{blast}}$ and random 3D angular velocity $\boldsymbol{\omega}$:

$$\mathbf{v}_i(0) = \mathbf{v}_{\text{parent}} + v_{\text{radial}} \cdot \hat{\mathbf{r}}_i, \quad v_{\text{radial}} \in [15, 40]\text{ m/s}$$
$$\mathbf{a}_i(t) = \mathbf{g} - \frac{1}{2}\rho \|\mathbf{v}_i\| \mathbf{v}_i \frac{C_D A}{m}$$

Fragments arc ballistically toward sea level while phosphor line alpha decays over $\tau_{\text{debris}} = 1.2\text{ s}$. Screen-shake impulse $I_{\text{shake}} = \frac{I_0}{1 + d / 500}$ decays exponentially over $150\text{ ms}$.

## 3. Rendering Pipeline

### Pure linear algebra projection

World point → translate by `−camPos` → **project onto the aircraft's own right /
up / forward basis** → clip against `z = 2.0 m` → perspective divide
`x' = x·f/z + x₀`. Every mesh, terrain line, weapon tracer and HUD reticle flows
through this same path, which is why the HUD can be made to overlay the world
exactly.

The basis projection is deliberate and replaced a hand-composed
`−yaw, −pitch, −roll` rotation that had the sign of pitch and roll backwards.
`AircraftPhysics` already computes `forward`, `up` and `right` to resolve thrust
and lift; reusing *those* vectors means the camera cannot disagree with the
flight model, because they are the same three numbers. See §7.

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

**Post-Mortem Note:** Recent playtesting (`AI_DESIGN_REVIEW.md`) revealed a critical flaw in this approach. Delivering the "Flight checkout" (Step 4) during a live combat scenario (e.g., launching directly into a SAM belt) forces the player to learn controls while actively dodging missiles. The tutorial and the combat fight for the player's attention, and if the player pitches up to test controls, they break terrain masking and die. Future updates will isolate the onboarding into a dedicated, safe, narrative-driven mission to fix this pacing issue.

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

## 6d. Maps as Data

The same argument as §6c, applied to the world. Every mission shared one
hardcoded height function and three SAM sites nailed into the sensor manager's
constructor, so variety had to come entirely from objectives and learning the
map once removed most of the tension from all five.

```
TerrainProfile = height function + SAM order of battle + corridor landmarks
```

`TacticalTerrain` samples a profile into its grid and `SensorTacticsManager`
builds its launchers from one; neither knows which map it has. The interesting
part is not the refactor, it is what a map is allowed to be: **a map carries
obligations, and the test suite is where they are written down.** A map must
have a navigable corridor, a clear approach tube off the bow, and somewhere that
terrain masks a radar — because a map that quietly cannot mask breaks a core
mechanic with no error message anywhere.

Stating those as tests rather than as intentions caught five real defects,
including a 300 m cliff step 1.2 km off the bow that appeared out of flat sea on
every launch, and an "open sea" map whose launchers sat on island peaks and were
therefore masked by their own islands — which would have silently given the
nowhere-to-hide map total cover.

It also caught a defect in a *mission*: moving the intro scenario onto the open
sea would have made its flight-checkout step "descend until the RWR goes silent"
unsatisfiable. The map was fine; the pairing was not.

## 6e. Assistance as Control Law

The 6-DOF model is the reason the project is interesting and, for a new player,
a wall: the first several sorties end in a canyon wall, and the game behind the
flying is never seen. The temptation is to soften the aeroplane. The method
taken instead is to let the player choose how much of it to fly, and to
implement every level as **control law rather than state manipulation**:

```
keyboard → PilotInput → resolveControls(level, state, input, nav) → ControlDemand
        → the same applyPitchInput / applyRollInput / applyYawInput the pilot uses
```

Nothing in an assist may write position, velocity or attitude. That single rule
is what keeps the simulation honest: at every level the aircraft is somewhere it
could have flown itself, and `MANUAL` is the identity function, so the raw
flight model is provably unchanged.

Writing the laws against the real flight model surfaced three things:

- **A terrain floor must measure time, not height.** A floor engaging at 180 m
  AGL has one second to work with at 60 m/s against a 1.35 rad/s pitch rate — it
  watches the aircraft hit the ground while gently disagreeing. Seconds to
  impact is the quantity that scales correctly with speed, which is why real
  terrain-avoidance systems use it.
- **This flight model has no bank-to-turn yaw coupling.** `AircraftPhysics`
  changes `yaw` only through the rudder; banking tilts the lift vector and
  curves the flight *path* while the nose keeps pointing where it pointed. A
  bank-only autopilot therefore banks beautifully and never captures a bearing.
  Discovering that from a failing convergence test, rather than from a player
  reporting that the autopilot "doesn't work", is the whole argument for testing
  control laws as pure functions.
- **Every protection must answer what it makes impossible.** The ground-proximity
  laws had to stand down on a carrier approach, because an approach *is* a
  controlled descent to a deck 20 m above the water — and the default assist
  level would otherwise have made the best thing in the game unreachable.

The tactical autopilot is where this stops being an accessibility feature and
becomes a second game: with the flying handled and a designation key to choose
targets with, the player's whole attention moves to *which contact, which
weapon, when to shoot, when to break*. See [FUN_REVIEW.md](FUN_REVIEW.md).

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
| `recordBestScore` / `mergeMissionResult` | Personal-best comparison, per-mission records, corrupt-storage handling |
| `recommendScenario` | Which mission to suggest next, for any record set |
| `TerrainProfile.heightAt` | Per-map navigability invariants: corridor, approach tube, masking |
| `stallLimiter` / `terrainFloor` / `attitudeHold` / `autopilotDemand` | Each control law in isolation, plus `resolveControls`' order of authority |
| `solveTarget` / `rankTargets` | Designation geometry, weapon envelopes, stable cycle order |
| `assistCaption` | What the annunciator is allowed to say, and when it must stay silent |
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

## 8. Defence, Counterplay & the HARM (v1.5.0)

**The missile is a guidance law, not a vector.** The SAM used to set
`missileVel = normalise(aircraft - missile) * 480` every tick: an unbounded turn rate, so
no manoeuvre could ever work. `tactics/MissileGuidance.ts` replaces it with lead pursuit
(`leadInterceptPoint`, the quadratic for the flight time at which missile and target
coincide) under a bounded turn (`rotateToward`, with an antiparallel guard against NaN).
`guideMissile` returns a new heading so the law stays pure and testable.

**Measure the envelope, then pin it.** The turn rate was chosen by simulation: fly the law
against a 250 m/s jet, record closest approach across turn rates and reaction times. At
0.30 rad/s even an instant break dies; at 0.20 a break wins at point-blank and chaff is
pointless; 0.25 satisfies all three needed behaviours (straight = hit, early break vs a
distant launch = live, close launch = still hit). The tests assert exactly that gradient.

**Chaff is deterministic on purpose.** `flight/Countermeasures.ts` is a cartridge count, a
recycle timer and a decoy expiry expressed as absolute mission time (so it survives being
written by the weapons bridge and read by the sensor tick without a second clock). No
probability: the rule is one sentence a beginner can learn in one sortie, the cost is
scarcity, and the depth lives in the guidance law where the player can see it.

**HARM = the radar state machine, reused.** The four-state RWR model (`SILENT / SEARCH /
TRACK / LAUNCH`) already existed. The HARM needs one fact from it - *is this site radiating
right now?* - so `WeaponsWorld` gained an optional `threats` snapshot. Acquisition has no
cone (passive RF); the round is committed to the site's bearing at release, then corrects
under `HARM_TUNING.maxTurnRateRadPerSec`; a site that goes SILENT latches `wentBallistic`.

**Death teaches.** `core/PostMortem.ts` maps a `LossCause` (SAM / CANNON / TERRAIN + who) to
one causal line and one tip. GameLoop records the source where damage is applied and clears
it every sortie so a stale cause can never be shown.

**A first flight that cannot fail.** `combatShielded` now also catches a descent into the
sea (the wingman hauls the jet clear) and floors fuel, while leaving the glideslope near the
boat alone, since that is the lesson.

## 9. Turning, Radar and Dying Well (v1.6.0)

### How this release was worked

1. **Take the human's words as data, the reviewer's causes as hypotheses.** Every claim in the review was
   checked against the code before anything was built. Five were wrong or stale (the hint ticker
   existed; the Arcade HUD was the default; the training sortie existed; two more maps existed; the
   proposed turn formula would have turned at ~4 deg/s). The symptoms were all real.
2. **Measure before designing.** A ten-line probe test of "bank right for five seconds" showed the path
   curving the *wrong way* - a defect the review never mentioned and the design would have papered over.
3. **Test through the input, not the function.** The physics-level tests passed while the game loop
   did not turn: the roll cap tested `cos(roll)` *after* the step, so it leaked at exactly 75 degrees.
   Only a test that held the `D` key in a running `GameLoop` and asked "did the heading change?" saw it.

### Turning is three layers, each doing one job

- **Correct lift direction** (the orthonormal basis): the physically real, weak effect.
- **Body-rate pitch mapping**: what "bank and pull" means. Strong, and it is the player's to control.
- **Turn assist**: the arcade layer. A held bank asks for back-pressure so the arrow keys alone turn.
  Kept out of the raw physics (`turnAssist = 0` by default) so the honest model is still testable and
  the game loop is what opts in.

The alpha limiter is what makes the third layer safe: it spends the wing's lift at its limit and no
further, so the assist cannot stall the jet.

### The radar is a projection, so it is a pure function

`RadarMath.radarProject` takes positions and a heading and returns pixels; the HUD only draws. That is
why the geometry has tests (ahead is up, right is right, turning rotates the picture, out-of-range
contacts pin to the rim) and the drawing has none.

### Dying is a state, not an event

`replaceAirframe` used to *be* the loss. It is now the trigger for a `dying` state that the sortie loop
counts down, and `finishAirframeLoss` is the old body. Every death source (cannon, SAM, terrain) calls
the same trigger, so none needed to change and none can skip the sequence. Existing tests that assumed
an instant cut were changed to sit through the 2.6 s - and to assert the cockpit is still up during it.

### Fairness for the guns is two numbers

An aim time (a warning) and a hit chance (a miss you can hear). Together they turn "I was dead" into
"something lined me up, I could have broken" without touching the AI's steering.
