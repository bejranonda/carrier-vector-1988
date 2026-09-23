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
| `THEME.key` | Cyan — the player's own agency: keys they can press, and the thing they have chosen |
| `THEME.caution` | Caution / ready |
| `THEME.alert` | Lethal / hostile |
| `WORLD.*` | 3D wireframe colours, kept separate from UI chrome |

Rules:

- **Every UI colour must clear 4.5:1 contrast against `THEME.ground`**, checked at
  the darkest point of the vignette. `Theme.test.ts` asserts this; add new tokens
  there too.
- **Labels are neutral, values carry the colour.** A desaturated green label turns
  to mud under the vignette, which is exactly what happened before.
- **Cyan marks the player's own agency** — a key they can press, or the thing they
  have selected: the highlighted mission pill, the armed weapon, the designated
  target. Draw keys with `keycap()`, not as `[ENTER]` inside a sentence; players
  skim for something that looks pressable. Nothing the *world* does is ever cyan,
  so a cyan mark on the glass always means "this is yours".
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

  **This rule was written, and then broken seven times.** The solvers place the
  *side* instruments; seven elements drawn directly in `HUD.ts` — the objective
  strip, the compass tape, the warning banner, the coach ticker, the pill bar,
  the assist annunciator and the keycap strip — carried their own hand-written
  offsets, and by v1.8.0 four pairs of them were being drawn into the same
  rectangle on every frame at 1440x900 (see Known Issues #62). So, explicitly:

  - **Vertical position is a band, and bands are derived.** `HUD.BAND` (top
    stack) and `HudLayout.BOTTOM_STACK` (bottom stack) compute each band's top
    from its predecessor's bottom plus a gap. Never write a literal `y` for a
    HUD element; add it to the stack.
  - **A band's height belongs to the stack too.** `BAND_H.objective` is what
    `drawObjectiveStrip` draws AND what the overlap test measures. The moment a
    draw call uses a height the stack does not know about, the test is checking
    fiction.
  - **Every stack exports its rectangles** (`bandRects()`,
    `bottomStackRects()`) and has a test asserting they are pairwise disjoint,
    at every viewport height and every touch reserve.
  - **Reserving space for decluttering is not the same as placing an element.**
    `HUD.instrumentBoxes()` already reserved the annunciator's band — but only
    so floating contact labels would avoid it. The pill bar and the keycap strip
    never consulted it and printed straight through. A reservation that only one
    consumer honours is not a layout.
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
- **Nothing flashes faster than 2.5 Hz, ever.** Route every blink through
  `blinkVisible()`. This is WCAG 2.3.1, not a style choice: faster flashing can
  trigger photosensitive seizures, and the banners shipped at 4.5 Hz. And when
  blinking is switched off, the element stays **lit** — a warning that
  disappears is worse than one that does not flash.
- **Honour `prefers-reduced-motion` on the canvas, not just in CSS.** Camera
  shake and the full-screen flash are exactly what the preference exists for.
  Scale them through `GameLoop.motion`; never read the media query at a call
  site.
- **A layout solver must fit what it is not allowed to drop.** `essential`
  means the panel cannot be shed, which makes squeezing it the solver's
  problem — packing it at its intrinsic height and letting the caller draw it
  off-screen is the one outcome the solver exists to prevent. Growing and
  squeezing are the same computation; do both.
- **The camera's field of view is an angle, not a pixel count.** `fov` is
  derived from the viewport in `VectorRenderer.resize()`. A fixed focal length
  means small screens see a narrower slice of the world, and the world is the
  reason anyone is here — on a phone it showed as an empty black cockpit.
- **A label must earn its place.** Anything floating over the world —
  a range tag, a callout, a designator — goes through
  `LabelDeclutter.placeLabels()` with the instrument rectangles as keepouts.
  Two labels on one spot are worth less than one label, and a label over an
  instrument costs more than it gives. Dropping it is a valid outcome: the
  bracket still marks the contact.
- **Touch mode is a way in, not a second game.** `Platform`, `TouchLayout`
  and `TouchInput` produce the same `PilotInput` and call the same public
  methods the keyboard does. If a feature needs a parallel implementation for
  touch, the feature is wrong, not the input.
- **A control a thumb cannot hit does not exist.** 44 px minimum, anchored in
  the bottom corners, inside the safe-area insets, never over the centre
  symbology - and every one of those is asserted in `TouchLayout.test.ts`
  across seven handsets. Add a control, extend the matrix.
- **A layout solver must know what else is on the screen.** The HUD and deck
  solvers take a reserve for the thumb controls; without it the instruments
  were drawn straight through the stick and the fire button. When space runs
  out, shed by priority rather than clipping, and say in a comment what
  carries the shed information instead.
- **Presentation may never reach the simulation.** Camera shake is added to
  the camera angles in `drawCockpitSim()` and nowhere else; the flash, the
  callouts and the hit marker read state and never write it. The whole test
  suite rests on a deterministic fixed timestep, and a shake that fed back into
  the flight model would turn every timing assertion into a coin flip. A smoke
  test asserts the attitude is untouched after a full-strength shake.
- **Nothing connects to `AudioContext.destination`.** Every voice goes through
  a category bus to the master bus and the compressor - that is what keeps a
  busy fight from clipping and what lets an alert outrank the engine. The bus
  levels and the spatial maths live in `audio/AudioMix.ts`, which is pure and
  tested; `SoundFX` only makes sound. Beds (engine, airflow, threat) stay below
  events, and alerts stay above everything, because an alert is an instruction.
- **A world event is placed, a cockpit event is not.** Anything that happens
  out there - a kill, a SAM launch, an explosion - is panned and attenuated
  from its real position, so the mix carries tactical information. Your own
  gun, your own warnings and the UI are centred, because that is where they
  are.
- **Timings are data, not literals.** Deck-crew durations live in
  `core/Pacing.ts` and arrive through `ThreatProfile.timing`. They default to
  the original simulation numbers, so `SIM` is a promise the tests enforce
  rather than a claim.
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
- **A mechanic has to cut both ways or it is not a mechanic.** Terrain masking
  hid the player from the SAM belt and hid nothing from the player, which made
  the designate key free reconnaissance and quietly cheapened the thing the game
  is about. Before adding to a system, check whether its existing rule is being
  applied symmetrically.
- **An optimisation may only serve an answer it has.** Line of sight is
  throttled to a few times a second because it is a ray march, but a contact the
  cache has never seen must be resolved on the spot: a cache that returns "not
  visible" for something it never looked at is not a cache, it is a wrong
  answer with a timer on it.
- **A recovery law has to know which way it is recovering.** The stall limiter
  answered every stall with a push, which is right for a positive-alpha stall
  and is the accelerator pedal for a negative-alpha one. Any law that "unloads",
  "centres" or "returns to neutral" should be checked on both sides of zero.
- **Scope a feature to what the simulation will actually do, then say so.** The
  recovery assist was going to fly the whole recovery. It could not - heading
  changes here come from the rudder and the velocity vector does not follow -
  and the honest answer was to narrow it to the ball and the speed and write
  down why, not to keep tuning until a test passed on one starting state.
- **Ask what the SETTING changes, not just what it sets.** Assist level changes
  how much of the aeroplane you fly; ops tempo changes how long you wait; threat
  level changes how hard the fight is. Three settings that each answer a
  different question are a menu. Three that all make it "easier" are a mess.
- **Every option added to a row is a pixel taken from the row.** The briefing's
  secondary line was a single centred row, and it silently started clipping its
  first and last item once there were enough settings to matter. A row that can
  grow has to wrap, shed by priority, or be measured by a test.
- **A hardened target is not killed by a near miss.** That single number
  (`hitRadius`) is what makes a bombing run a skill, so any cue that helps aim
  it — the CCIP cross, the designator diamond — must be computed from the same
  integration the live weapon uses, never an approximation of it.
- **A working, tested, invisible feature is not a shipped feature.** The
  colour-blind palette existed for a full release behind a key in the full
  control reference, with nothing pointing at it. "Never chosen" and "chose
  the default" have to be distinguishable (`storedX()` beside `loadX()`) or a
  discoverability hint can neither appear nor ever retire itself.
- **Match the precedent exactly, not a stricter version of it.** A new hint
  copied from an existing one (`CAT SHOT`) added an extra bounds check the
  original never had, "to be safe" — and that check silently killed the new
  hint on the exact layout where the original renders fine. Copying a working
  pattern means copying it, not improving it on the way past.
- **A second axis has to cost the same currency the first one already
  spends.** The deck's rushed turnaround needed no new subsystem because crew
  stamina already scaled task speed; the choice was making that resource
  spendable on purpose instead of only lost to attrition.
- **Gate on the condition, not on having remembered to reset a flag.** A
  per-task "already used" lockout needs resetting at every place a new task
  can begin - miss one and the feature is either always available or never
  available again. A crew rush is gated on stamina headroom instead, which
  needs no reset because the condition it checks is never stale.

## 10. AI-Assisted Development & Prompt Engineering Standards

To any human developer or AI agent tasked with modifying this codebase, heed the following directives. Our core philosophy is strict, and our math is pure. If you violate these rules, your code will be rejected.

### 10.1. Core Architectural Guardrails
- **Mandatory Reading:** Before suggesting or implementing any logic changes, you MUST read `docs/APPROACH_AND_METHOD.md` and `docs/reviews/v1.3.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md`.
- **Zero-Dependency Rule:** Do NOT import Three.js, Babylon, gl-matrix, or any npm runtime package. Hand-write all linear algebra and audio algorithms.
- **Logic vs. Rendering Separation:** All simulation states, aerodynamic integration, and carrier state machines MUST reside in pure TypeScript classes (`src/flight/`, `src/carrier/`, `src/campaign/`) completely decoupled from `CanvasRenderingContext2D` and `AudioContext`.
- **Headless Test Discipline:** Every new state machine, aerodynamic rule, camera transform, or tactical logic MUST be backed by headless unit tests in Vitest before touching the rendering layer.

### 10.2. Specific Subsystem Implementation Rules

#### Cockpit Voice System ("Bitchin' Betty")
- Zero runtime npm dependencies. Use either native Web Speech API (`window.speechSynthesis`) or procedural phonetic formant synthesis in `WebAudioSystem.ts`.
- Must implement a strict priority queue (Priority 1: Missile Launch Warning; Priority 2: Pull-Up; Priority 3: Stall; Priority 4: Bingo Fuel).
- Must enforce a 4.0-second de-bounce cooldown per alert type to prevent repetitive audio spam.
- Must provide an accessibility toggle to mute voice warnings independently of sound effects.

#### Padlock Target-Tracking Camera
- Must smoothly interpolate the camera look-at orientation vector toward `designatedTarget.position` in 3D world space using ease-out cubic interpolation (`Δt = 250ms`).
- Must strictly clamp look angles to realistic canopy limits: azimuth `|ψ_cam| ≤ 110°`, elevation `−30° ≤ θ_cam ≤ 60°`.
- Must NEVER alter the underlying aircraft physics basis vectors (`right`, `up`, `forward`); only the camera projection matrix rotates.

#### Vector Fragmentation Debris ("Juice")
- Target destruction must decompose 3D wireframe models into 10–16 individual line segment entities with outward radial explosion velocity (`15–40 m/s`), gravity (`g = 9.81 m/s²`), and aerodynamic drag (`C_D ≈ 0.8`).
- Debris objects must be allocated from a pre-warmed pool or bounded array to guarantee zero garbage-collection allocations in the hot loop.
- Screen-shake impulses must decay exponentially over 150ms and scale inversely with distance to the explosion (`impulse / (1 + distance / 500)`).

#### Arcade Time-Rewind ("Oops" Button)
- Must use a fixed-capacity circular buffer pre-allocated at initialization to avoid dynamic allocations and GC pauses during flight.
- Sampling rate: 20 Hz over 5.0 seconds (100 snapshot entries).
- Safety guarantee: Retain current accumulated airframe damage upon rewind to prevent invulnerability exploits during dogfights.
- Budget: Strictly enforce a maximum of 2 rewind triggers per sortie in ARCADE and ASSIST modes; disable in MANUAL flight assist mode.

#### Rogue-lite Campaign State Machine
- Must maintain operational fleet persistence (24 F-14, 12 A-6, finite ordnance pools, carrier hull integrity) across sequential sorties.
- Neutralizing Early Warning Radars in radar-equipped sectors must deterministically apply a 40% attenuation factor (`0.6x`) to enemy interceptor scramble times and SAM density across adjacent sectors.
- All campaign state logic must remain pure TypeScript with complete serialization support and headless test coverage.

### 10.3. The 4-Block Master Prompt Formula
When directing AI assistants on this repository, structure all prompts into 4 explicit blocks:
1. **Context & Guardrails:** *"Zero runtime dependencies, fixed timestep 1/120s, pure logic in `src/...` decoupled from Canvas2D."*
2. **The Exact Task:** *"Implement [Feature] in [Exact File Paths]."*
3. **Game Feel & Behavior:** *"Focus on easing functions, visual feedback, and audio transients."*
4. **Verification & Tests:** *"Write headless Vitest tests in `tests/...` and ensure 100% pass before touching Canvas2D."*

## 11. Rules added in v1.5.0 (each one encodes a bug that already shipped)

- **Never hardcode a key name in user-facing text.** Every key named in a scenario
  card, phase, hint or banner must exist in `CONTROL_SCHEMA` and must be the key that
  performs the action described. `Scenarios.test.ts` asserts both. The tutorial once
  told beginners to press `[A]` for autopilot; `[A]` is roll left.
- **A feature is not done until it is reachable.** The guided tutorial was built and
  closed as resolved while `recommendScenario()` routed nobody to it. Verify the
  outcome a player sees, not that the code exists.
- **A test must not encode the bug.** Three tests asserted the broken behaviour (empty
  drone timeline, wrong flag, `contactsAlive: 0`). When a test and a design intent
  disagree, suspect the test.
- **Run `npx tsc --noEmit` as well as vitest.** vitest does not typecheck; eight type
  errors sat in an "all tests passing" tree.
- **One geometry, one solver.** A hit-tester must consume the same solver as the
  renderer (`solveArcadeBar`). Two copies had drifted 8 px apart.
- **Tune from measurement, not intuition.** `SAM_MISSILE.maxTurnRateRadPerSec` was set by
  flying the law against a jet and recording closest approach; the table is in the
  source and the envelope is asserted. Change the constant, re-measure.
- **No parallel difficulty numbers.** Counterplay depth belongs in visible physics
  (the missile's turn limit), not a hidden per-difficulty probability.
- **Player ordnance may be more forgiving than enemy ordnance**, on purpose, and the
  asymmetry is documented where the constant lives.
- **A weapon with no boresight cone must not launch along the nose.** The first HARM did
  and diverged from any site not roughly ahead; it launches at the target now.
- **Offer, don't ask.** First-run hints (colour-blind palette, stick flip) appear on the
  briefing until the setting is touched, then retire. Prefer that to a modal question.
- **One look.** Do not add a second screen style; every style is another thing a beginner
  must understand before flying.

## 12. Rules added in v1.6.0 (each one encodes a bug that already shipped)

- **A duplicated formula needs a test that checks the *properties*, not the copies.** The orientation
  basis exists in `AircraftPhysics` and `VectorRenderer`. Their tests compared the basis with itself, so
  a sign error present in both copies passed. Assert what must be true of any correct basis: unit
  length, mutually orthogonal, and "a right bank tilts lift right".
- **Test a control through the input, in the running loop.** If the claim is "holding D turns the jet",
  the test holds D in a `GameLoop` and reads the heading. Unit tests of `applyRollInput` proved nothing
  about it. This caught a leaking bank cap that no function-level test could.
- **Decide a limit by the state you were in, not the state you ended up in.** A cap tested on the
  *result* of the step (`cos(roll) > 0.26` after adding the increment) lets the first step past the cap
  through; the value it guards sits at 0.259.
- **Verify a review's cause before building its fix.** Reviews are reliable about what a player felt and
  unreliable about why. Read the code path, then measure it.
- **Don't clamp an angle; fold it.** A clamp at +-88 degrees was a wall the player hit in the middle
  of a loop. Reflecting the Euler triple through vertical keeps the attitude continuous.
- **An arcade assist lives behind a switch and the raw model stays testable.** `turnAssist` defaults to
  0 in the physics; the game loop opts in. Physics tests keep exercising the honest model.
- **A death is a state with a duration.** Anything that ends the player's control needs a beat where
  they can see it end and read why. Route every source through one trigger.
- **A warning before a punishment.** A guns solution that fires on the frame it forms is an ambush, not
  a fight. Give the player a callout and a beat, and let some bursts miss.
- **Instructions that name a key must name the key that exists.** `[T]` designates, `[SPACE]` fires, `[X]`
  chaffs. Two hints that told the player different things at the same moment (banner vs. ticker) is a bug.
- **Give a first time its own moment.** A one-shot latch, persisted, on the channel the player is already
  watching. Do not build a menu for it.


## 13. Rules added in v1.9.0 (each one encodes a bug that already shipped)

Found by the first review to run the live build in a browser and look at
rendered frames. Five suites of source-reading review had missed all of them.

- **Look at the pixels.** A rendering defect is invisible to source review and to
  a passing test suite. 921 tests were green while the mission order and the
  compass tape were printed through each other at the default desktop size. Run
  the build, screenshot every screen, at desktop and phone size, before claiming
  a UI works. The twenty-minute Playwright harness that found this is worth more
  than the next thousand lines of review.

- **A "decluttering" change must not delete an instrument the player flies by.**
  ARCADE mode suppressed the whole pitch ladder to keep the centre clean, which
  also deleted the artificial horizon — so the default HUD had no attitude
  reference at all. Clutter is a `PADLOCK` pill that is always on screen. A
  horizon line is not clutter. When hiding a group, enumerate what is inside it.

- **A coaching rule must not be true by construction.** `distanceToCarrier < 2500
  && airSpeed > 95` describes a landing approach and also describes *every
  catapult launch ever made*, so the game's most-seen hint told beginners to
  decelerate into a stall. Before shipping a hint, ask what other states satisfy
  its predicate — especially the states the game itself creates.

- **Two instructions on screen at once is a bug, even when both are correct.**
  `CLIMB TO 2,500 FT` above `REDUCE TO BELOW 90 M/S` is not dense UI, it is
  contradictory UI. The objective strip, the coach ticker, the warning banner and
  the contact tags need one arbiter, not four independent ones.

- **A safety flag has to be honoured everywhere the danger lives.**
  `combatShielded` was checked in four places, all protecting the player's
  aircraft, and nowhere in the deck's own damage path — so the "zero hostiles"
  tutorial took 15% of the player's carrier. When adding a flag that means
  "nothing here can hurt anything", grep every site that reduces a health value.

- **A scenario's prose is a contract the code must keep.** "Zero combat
  hostiles", "Running out of fuel is the only way to end this badly", "the blast
  doors close in four minutes" — a test should assert each of these against
  behaviour. Prose that the simulation contradicts is worse than no prose,
  because the player trusts it.

- **A test must cover the state the game actually produces.**
  `BankToTurn.test.ts` asserts bank-and-pull out-turns bank alone, using 0.6
  stick for 6 s from 220 m/s. True there; the game gives full deflection from a
  nose-high state at decaying speed, where heading change falls to ~0.25 deg/s.
  When a test encodes a player-facing promise, pin it at the input the player
  actually uses, from the state the game actually starts them in.

- **If the phone build is clearer than the desktop build, the desktop build is
  wrong.** The deck screen renders as 8 panels and ~35 numbers on desktop and as
  4 panels and one LAUNCH button on a phone, from the same code. Constraints
  produced the better design. Ship it everywhere and gate the dense version on
  player experience, not on viewport width.

- **Every beginner feature that adds to the screen must name what it removes.**
  Thirteen consecutive accessibility features all added a HUD element. The screen
  ran out of room and elements began to overlap. A new pill, ticker or banner
  needs a deletion attached to it in the same pull request.

- **A release that changes a documented limitation updates the limitation in the
  same commit.** `KNOWN_ISSUES.md` claimed pitch was clamped at +-88 degrees for
  two releases after v1.7.0 removed the clamp. Stale docs are read by humans and
  by AI agents, and both act on them.

## 14. Rules added in v1.10.0 (each one encodes a bug that already shipped)

- **Measure a recommendation before you build it.** The v1.9.0 review said
  "ease the roll to the cap"; the roll already reached it in 0.45 s. The real
  cause was a physics defect no review had looked for. A recommendation is a
  hypothesis about a cause - check the cause, then build.
- **A stability or damping term acts about a body axis, not a world axis.** The
  weathervane rotated the nose about the world vertical; banked, the restoring
  moment is mostly nose-down, and nothing supplied it. Write rates in the body
  frame and map them through the Euler kinematics.
- **A controller chasing a moving target needs a feed-forward.** A proportional
  altitude law on a glideslope always lags it; one damped toward zero attitude
  settles below any slope that needs nose-up. Damp the flight-path angle, and
  feed the target's own path angle forward.
- **An integral-only controller cannot anticipate.** The autothrottle held idle
  until the jet was already slow. Feed the rate of change back.
- **A number that should be derived must be derived.** A fixed 70 m/s approach
  speed was only flyable on one airframe. Derive targets from the physics
  (`onSpeedApproachSpeed`), and bound them by what the rules accept.
- **One solver per rectangle, used by the drawer AND the hit-tester.** Three
  separate click-vs-draw drifts shipped (the ARCADE pill bar, the PRO chips, the
  corner buttons). If a click can land on it, its geometry lives in `HudLayout`
  and both sides call the same function - and a test asserts the rects are equal.
- **Deleting a drawn element means deleting its click areas.** The keycap strip
  was removed and its shortcuts stayed clickable as invisible traps.
- **Any "the game promises X" flag must be honoured at every site.** A launch
  that clamped the ship's stock but not the jet's load produced free bombs. Grep
  every place the promised quantity is consumed.
- **A warning announces a threat, not an assistance.** A protection that quietly
  helps (the terrain floor on a climb) must not paint a red alarm.
- **A frame must not be able to end the game silently.** Catch per frame, log,
  continue; stop only on a persistent failure, and then say so on screen with a
  way back.
- **Screen budgets are tests.** `HudDensity.test.ts` holds FIRST_FLIGHT to 3
  optional regions and ARCADE to 8. Raise one only on purpose, in review.
- **Run `npm run playtest` before every release.** It is not in the deploy gate
  (its turn-rate check is wall-clock based), so it is on the release checklist
  instead. A release whose harness has not been run has not been looked at.
