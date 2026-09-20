# Implementation Plan — Fun, Polish & Onboarding Pass

**Status:** Complete (2026-09-19)
**Baseline:** commit `faa7c8d` — 3,378 lines, 16 tests, clean typecheck
**Result:** 112 tests, `strict: true`, zero runtime dependencies retained

---

## 1. Context

The original mission specification asked for a dual-loop retro vector game. That
game already existed and was technically complete: every specified module (deck
logistics, 6-DOF aerodynamics, radar LOS/RCS, wireframe projection, bridge loop)
was genuinely implemented, with near-plane clipping, an 18° stall model, a 3.5×
afterburner burn and the ×4.0 bay-open RCS multiplier all present and tested.

The problem was that it was **not playable as a game**. Investigation found:

| Finding | Evidence |
| --- | --- |
| Nothing could kill the player | `SensorTacticsManager.update()` flew SAM missiles at the player but had **no hit detection whatsoever** — `missileActive` cleared only on fuel burnout or LOS loss. The entire RWR / terrain-masking / RCS system had zero consequence. |
| No fail state | `carrierHealth` floored at 0 and nothing read it. No game over, no score. |
| Enemies were inert | The complete enemy AI was three lines of position integration. MiGs flew straight lines forever and never fired. |
| Every run was identical | `generateThreatTimeline()` returned a hardcoded 3-element literal. After ~440 s the game had nothing left. |
| The dual loop was severed | The launch path called a reset routine that hardcoded fuel to 4500 and forced `AIRBORNE`, discarding the player's planned payload and clobbering `CATAPULT_LAUNCHING`. Deck management had no effect on flight. |
| The deck screen broke on normal windows | 137 lines of absolute-pixel `fillText` at hardcoded x = 50/420/800. Below ~1250 px the threat panel ran off-screen and the scramble banner overlapped the crew list. |
| No phosphor persistence | The renderer hard-cleared every frame; the CRT look was CSS-only. The defining property of a vector display was absent. |
| Zero player guidance | No title, briefing, control list or objectives. The player booted into a cockpit at 750 m and was told nothing. |

## 2. Design Decisions

1. **Full combat stakes** — SAM missiles get proximity fuzing; MiGs manoeuvre and shoot; hull at 0% ends the mission with a debrief.
2. **Scripted opening, then endless procedural waves** — the three curated packages remain act one; a seeded PRNG escalates thereafter.
3. **Guided cold start, skippable** — boot → briefing → deck → catapult → cockpit, with `S` to quick-start airborne.
4. **Landing aids + graded traps** — meatball, AoA indexer, approach data block; traps graded 1–4 wire.

## 3. Work Completed

### Phase 1 — Repair the foundations

| Item | File | Change |
| --- | --- | --- |
| Lethal SAMs | `tactics/RadarLOS.ts` | Swept-sphere proximity fuze (40 m), `missileImpacts[]` consumed per tick |
| Damage model | `flight/AircraftPhysics.ts` | `damage`, `fuelLeakRate`, `applyDamage()`, `repair()`; compounds with stall |
| Dual-loop reconnect | `core/GameLoop.ts`, `main.ts` | `requestCatapultLaunch()` applies planned payload; deck owns the launch clock |
| Fixed timestep | `core/Timestep.ts` | 120 Hz accumulator, max 8 substeps, spiral-of-death guard; input folded into the fixed tick |
| Mission failure | `carrier/DeckManager.ts` | `missionState`, `RECOVERY_TRAP` de-rig phase made reachable |
| Bullet ballistics | `flight/Weapons.ts` | Semi-implicit Euler gravity (was a per-frame `dt²` constant); bullets now damage SAM sites |
| Hygiene | `tsconfig.json`, `index.html` | `strict: true`, favicon 404 fixed, dead template assets deleted, `import type` compliance |

### Phase 2 — Make it fun

- `tactics/EnemyAI.ts` — `INGRESS` / `ENGAGE` / `RTB` behaviour. Fighters pursue and fire; **bombers ignore the player entirely** and drive for the carrier, creating the core tactical tension.
- `carrier/DeckManager.ts` — `mulberry32` seeded PRNG and `generateWave()` with escalating package counts, tightening ETAs and rising bomber probability.
- `core/ScoreKeeper.ts` — kills, trap grades, hull preserved, airframes lost; NUGGET → ADMIRAL rank ladder.
- `renderer/HUD.ts` — Fresnel meatball, AoA approach indexer, approach data block.

### Phase 3 — Make it attractive

- `renderer/PostProcess.ts` — offscreen world layer with phosphor persistence, ¼-scale bloom with a `multiply` pseudo-threshold, adaptive quality ladder.
- `renderer/VectorRenderer.ts` — `decayClear()`, distance haze, full pitch/roll mesh orientation.
- `renderer/DeckLayout.ts` + `DeckView.ts` — pure responsive panel solver plus instrument chrome, an animated top-down deck plan, and a PPI threat rose.
- `core/GameLoop.ts` — horizon ring and scrolling sea lattice for depth and motion cues.

### Phase 4 — Teach the player

- `core/Tutorial.ts` — priority-ranked contextual coach and a six-step first-run training sequence.
- `core/Controls.ts` — single source of truth for bindings, consumed by input, help, briefing and README.
- `renderer/BriefingScreen.ts` — CRT warm-up envelope, mission briefing over an orbiting carrier, help overlay, debrief.

## 4. Key Technical Decisions

**Two-layer canvas composite.** Phosphor persistence works by *not* clearing. Applied
to the visible canvas it would smear HUD text into an illegible smudge. The 3D world
therefore renders into an offscreen buffer that carries the decay; the visible canvas
is hard-cleared, the world is composited onto it, and the HUD is drawn crisply on top.

**Decay floor must be darker than the background.** Decaying toward `#051008` does not
converge under 8-bit channel rounding — a channel at 6 decaying toward a floor of 5
rounds back to 6 forever, leaving a permanent ghost. The decay target is `#030a04`,
strictly below every channel of the background, making the iteration strictly decreasing.

**Swept-sphere fuzing.** At 480 m/s with `dt` clamped to 0.1 s, a missile advances 48 m
per tick — more than the 40 m fuze radius. A naive end-of-tick distance check tunnels
straight through the target. The fuze tests the closest point on the travel segment.

**HUD symbology derived from `fov`.** The flight path marker used 520 px/rad and the
pitch ladder 8.5 px/deg (≈487 px/rad) while the renderer projected at fov = 380, so
world-referenced symbols never sat on the real horizon. Both now derive from
`fov·tan(Δ)`, or project a probe point through the actual camera pipeline.

**Single catapult clock.** Two independent timers previously raced for the same 2.5 s
window: `DeckManager.catapultTimer` and `GameLoop.catapultProgress`. Because
`deck.update()` ran first, it flipped the state to `AIRBORNE` before the GameLoop's
completion branch could fire, so the branch never executed. The GameLoop now derives
progress from the deck's clock and reacts to the state-transition *edge*.

## 5. Verification

- `npx tsc --noEmit` — zero errors under `strict: true`
- `npm run test` — 112 tests across 11 suites (at the time of this pass; see §7)
- `npm run build` — clean production bundle (~80 kB, 25 kB gzipped)
- `npm run dev` — verified serving; manual pass on boot → briefing → deck → catapult → sortie → trap

## 6. Deliberate Non-Goals

- **Enemy cannon fire is hit-scan**, not a projectile subsystem. The alignment/range gate in `EnemyAI` establishes the solution; modelling enemy bullets as entities was judged not worth the complexity.
- **Device pixel ratio is pinned at 1:1.** Chunky pixels are the intended aesthetic and keep the bloom pass cheap. *(Reversed in the readability pass — see §7.)*
- **Euler angles retained** rather than quaternions; pitch is clamped to ±88° to avoid gimbal singularities.

---

## 7. Follow-up Pass — Readability & Comprehension

**Status:** Complete
**Trigger:** player feedback — "it's not easy to understand how to play", and
"the screen is not easy to read because of textures"
**Result:** 184 tests across 17 suites, `strict: true`, zero runtime dependencies retained

### Root causes found

Both complaints had concrete causes rather than being matters of taste.

| Finding | Evidence |
| --- | --- |
| The cockpit was washed red | `drawLine()` armed `shadowColor`/`shadowBlur` for its glow and never cleared them, so `decayClear()`'s translucent full-screen fill painted a full-screen *shadow* in the last vector's colour — usually SAM red — accumulating every frame. Measured median background `rgb(107,24,21)` against an intended `rgb(3,10,4)`. |
| The view fought the controls | `transformToCamera()` rotated by `-pitch` and `-roll` where world→camera needs `+pitch` and `+roll`. Pulling the nose up moved the terrain *up* the screen, rolling right rolled the world the wrong way, and the pitch ladder drew its horizon rung exactly as far below centre as the real horizon was above it. |
| Texture was not optional | The scanline mask and a 92%-black vignette were an always-on CSS overlay with no control, on top of a 6.7 Hz global flicker animation. |
| Nothing stated the objective | The deck screen's only call to action was 12px grey footer text under eight panels of inventory; the cockpit had twelve instruments and no goal. |
| Safety warnings were suppressed | The training prompt outranked every coach rule, so a first-time pilot saw no stall, terrain or missile warnings for their whole first sortie. |
| Layouts broke off the nominal size | At 900x620 the deck screen drew the crew list, payload rows and whole log panel past the bottom edge; at 1440x900 it left a ~220px dead band. In the cockpit, fixed `cx - 300` offsets drew the airspeed block underneath the training checklist at 900x700. |

### Work completed

| Area | Change |
| --- | --- |
| Renderer | Shadow-state reset (`resetShadow()`); camera transform rebuilt on the physics basis vectors; world palette moved to `Theme` |
| Display | `DisplayMode.ts` — one `CLEAN` / `MODERN` / `RETRO` ladder covering persistence, bloom, per-stroke glow, scanlines and vignette; persisted to `localStorage`; `MODERN` default |
| Theme | `Theme.ts` — colour tokens, type scale, and `panel` / `plate` / `keycap` / `bar` / `row` / `fitText` primitives |
| Resolution | Device-pixel-accurate canvas (capped 2x) for the visible and offscreen layers |
| Guidance | `Objectives.ts` — always-on objective for both loops, driving a deck orders panel and a HUD objective strip; coach priority corrected |
| Onboarding | Briefing rebuilt as three phase cards with keycaps; training shown as a six-step checklist; click-to-continue on menu screens |
| Layout | `DeckLayout` shrink → drop-by-priority → grow; new `HudLayout` solver for the cockpit |
| Retention | `HighScore.ts` — personal best on the briefing and debrief |
| Performance | Per-stroke glow confined to `RETRO`: 23.7 ms → 19.2 ms per frame at 1600x900; adaptive quality ladder finally driven by a rolling frame-time average |

### Verification

- `npx tsc --noEmit` — zero errors under `strict: true`
- `npm run test` — 184 tests across 17 suites
- `npm run build` — clean production bundle (~103 kB, ~34 kB gzipped)
- Browser pass in Chromium at 800x620 through 2560x1440, at 1x and 2x device
  pixel ratio, across all three display modes, with pixel sampling to confirm
  the background wash is gone and frame-time sampling to confirm the cost

---

## 8. Follow-up Pass — Missions, Maps, Assist & Progression

**Status:** Complete
**Trigger:** player requests, in order — "can we integrate a mission like the
final mission in Top Gun 2 as a selectable scenario, and provide more fun and
attractive scenarios"; then "put more maps?", "review workflow, story, UX for
increasing fun factors", and "should we put assistant, autopilot or semi-auto
to increase fun, e.g. let autopilot fly, user can easily select what to shoot".
**Result:** 367 tests across 23 suites, `strict: true`, zero runtime
dependencies retained

### 8a. Selectable scenarios

Five missions, each a `ScenarioDef` in `core/Scenarios.ts`: world setup,
ordered phases, a failure predicate and its own prose. The canyon strike is an
**original** low-level fjord raid against a hardened submarine pen — no names,
fiction or branding lifted from any film. Supporting work: `StrikeTarget` (a
target a near miss does not kill), CCIP bombing prediction from the same
ballistic integration the live bomb uses, and a mission director that tests
victory **before** failure, because both can become true on the same tick.

### 8b. Maps

| Finding | Evidence |
| --- | --- |
| Every mission shared one world | One hardcoded height function plus three SAM sites nailed into `SensorTacticsManager`'s constructor. Learning the map once removed most of the tension from all five missions. |
| A map can silently break a mechanic | `OPEN_SEA`'s first draft put its launchers on island peaks, where each one is masked by its own island — quietly giving the "nowhere to hide" map total cover. |
| A map can silently break a mission | Moving the intro scenario to `OPEN_SEA` would have made its flight-checkout step "descend until the RWR goes silent" unsatisfiable. |
| A clamped height function leaves a cliff | `SHATTERED_RIDGE` originally clamped its ridge field off at `z < 1400`, producing a 300 m wall 1.2 km off the bow, out of flat sea, on every launch. |

`tactics/TerrainProfiles.ts` makes a map data, and `TerrainProfiles.test.ts`
states the guarantees: navigable corridor, clear approach tube, masking
possible. Those tests found five real defects, including the last two rows
above.

### 8c. Flight assist and autopilot

| Finding | Evidence |
| --- | --- |
| A height-based terrain floor cannot save a dive | At 180 m AGL and 60 m/s sink there is one second left, against a 1.35 rad/s pitch rate. The floor now measures seconds to impact. |
| A bank-only autopilot never turns | `AircraftPhysics` changes `yaw` only via `applyYawInput`; banking curves the flight path but not the heading. The autopilot flies bank **and** rudder. |
| A protection that is always on is not a protection | The first alpha limiter scaled *every* pull from zero alpha upward, halving manoeuvrability and pinning a `STALL` caption to the glass permanently. It now bites only in the last 40% of the margin. |
| The assists would have made landing impossible | A carrier approach is a controlled descent to a deck 20 m above the water. Ground-proximity laws stand down on an approach, and the autopilot hands the jet back on final. |

### 8d. Target designation

`T` cycles a priority-ordered scope; the designation drives the HUD bracket,
the weapon recommendation, the Sidewinder's seeker and the autopilot's
intercept. Before it, every contact drew an identical bracket and the missile
chose its own target, so the player had positional agency but no tactical
agency.

### 8e. Progression

`core/MissionRecords.ts` — per-scenario best, completions and attempts; a
cleared tick on the selector; a `START HERE` recommendation; a "next up" line on
the debrief. A brand-new player is pointed at the mission carrying the flight
checkout rather than the one with the fewest difficulty pips.

The full design reasoning, including what was deliberately **not** changed, is
in [FUN_REVIEW.md](FUN_REVIEW.md).

### Verification

- `npx tsc --noEmit` — zero errors under `strict: true`
- `npm run test` — 367 tests across 23 suites
- `npm run build` — clean production bundle (~139 kB, ~46 kB gzipped)
- Browser pass in Chromium at 1440x900, 1024x700 and 820x560: all five
  missions selected and flown, designation and all three assist levels
  exercised, terrain pull-up triggered deliberately, no console errors

---

## 9. Follow-up Pass — Pacing, Feel, Sound & the Daily Sortie

**Status:** Complete
**Trigger:** "review to improve the game to make hit in the market and fun to
play", followed by "integrate sound effects to the game"
**Result:** 487 tests across 28 suites, `strict: true`, zero runtime
dependencies retained

### The findings, measured

| Finding | Evidence |
| --- | --- |
| Nothing happened for the first minute | Contacts spawned 8.3 km out (~35 s of transit) under a HUD announcing the first package at 150 s. |
| Every sortie after the first cost 32 s of progress bars | `HANGAR_MAINTENANCE` (18 s) → `ARMING_REFUELING` (14 s), after a loss *and* after a successful trap. |
| Nothing had weight | No camera shake existed. One 20 mm round inside an 18 m radius destroyed any aircraft, so the gun had two states: nothing, and an explosion. The trap resolved as an instant view switch. |
| Nothing left the tab | A single global best score across five scenarios of different length. |
| The mix was not a mix | Every voice connected to `AudioContext.destination`: no bus, no compression, no stereo, and enemy cannon fire played the player's own gun sound. |

### What the work found

- **A height-agnostic claim about pacing was wrong.** The first sortie always
  launched immediately - the deck opens `CATAPULT_READY`. The 14 s arming
  applies to re-launches. The smoke test caught it, and both the tests and the
  module's rationale were corrected rather than the test being bent to fit.
- **The smoke harness had been lying quietly.** `runFrames()` restarted its
  timestamp at zero on every call, so a second call cost a frame and
  `runFrames(game, 1)` in a loop advanced the simulation not at all. Now
  monotonic.
- **Four browser-only layout defects** in the daily card: the prompt drew
  through the card, the card overflowed a 560 px window, the daily panel
  truncated its own text, and the ✈ glyph is absent from the game's monospace
  font.

### Verification

- `npx tsc --noEmit`, `npm run test` (487), `npm run build`
- Chromium, briefing to first kill: **ARCADE 9.6 s, SIM no kill in 120 s**
- Web Audio instrumented in-browser: one connection to `destination` (the
  compressor); pan +0.85 right, −0.85 left, 0 ahead, culled out of earshot;
  peak levels with the sim paused - engine 0.15, cannon 0.15, kill 0.28, RWR
  launch 0.38, wire catch 0.39
- Debrief and daily card at 1440×900, 1024×700, 820×560 and 760×520, no
  console errors

---

## 10. Follow-up Pass — Mobile

**Status:** Complete
**Trigger:** "can we add a mobile phone player mode? Consider to integrate
carefully and optimally."
**Result:** 573 tests across 32 suites, `strict: true`, zero runtime
dependencies retained

### The approach

Not a second implementation. `AUTOPILOT` (from §8c) flies the aeroplane and
designation (§8d) picks the target, so the mobile game already existed and
needed a way in rather than a rewrite. Touch input produces the same
`PilotInput` the keyboard does and calls the same public methods.

| Module | Role |
| --- | --- |
| `core/Platform.ts` | Scheme detection from touch points, pointer coarseness, hover and viewport; stored override |
| `renderer/TouchLayout.ts` | Pure placement and hit-testing; overlap, reachability and centre-keepout tested across seven handsets |
| `core/TouchInput.ts` | Pointer binding, relative stick origin, absolute throttle, tap queue |
| `renderer/TouchControls.ts` | Chrome for the above, plus the landscape prompt |

### What the work found

| Finding | Evidence |
| --- | --- |
| `setPointerCapture` can throw, and it ran first | A throw inside `pointerdown` aborted the handler, so the stick and the weapon pills registered nothing at all. Registering the touch first, capture after in a try/catch, fixed it. |
| The instruments knew nothing about the controls | At 568x320 the airspeed block, RWR scope, systems strip and both key bars drew straight through the stick and fire button. |
| The first reserve model was wrong | Reserving the thumb columns horizontally drove the pitch ladder to its 24 px hard floor. The columns are only occupied at the bottom; lifting the instrument centre is what was needed. |
| The deck solver can overflow | It grows panels to fill the content box and never drops an `essential` one, so a short screen overflows. The phone spec asks for row counts that fit. |
| A one-row panel drew outside itself | The turnaround progress bar sat at a fixed `+46` from the panel top. Now clamped inside. |

### Verification

- `npx tsc --noEmit`, `npm run test` (573), `npm run build`
- Emulated iPhone SE, iPhone 12, Galaxy S9+ and iPad Mini in Chromium:
  scheme detection, mission pill taps, launch button, virtual stick (roll
  0.000 -> 0.535 from a thumb drag), throttle track, weapon pills, fire, and
  tap-to-designate end to end, with no console errors
- Portrait orientation shows the rotate prompt and swallows input

---

## 11. Follow-up Pass — Field of View, Label Declutter & v1.1.0

**Status:** Complete
**Trigger:** "review and improve what's showing on the screen... In sampling,
No landscape visible in mobile, please check? Because the Landscape is the
attractive part in the game?"
**Result:** 595 tests across 33 suites, released as **v1.1.0**

### The reported bug, and its cause

The landscape really was invisible on a phone, and the cause was one line that
had been wrong since the first build: `VectorRenderer.fov` was a fixed 380 px
focal length that `resize()` never touched.

| Viewport | Focal length | Vertical FOV |
| --- | --- | --- |
| 1440x900 desktop | 380 | ~100° |
| 568x320 phone | 380 | **~46°** |

A handset was looking down a telephoto lens. With the nose up, the ground was
entirely out of frame and the cockpit rendered as black. The angle is now the
constant (`atan(400 / 380)`, the value an 800 px window produced) and the focal
length is derived from the viewport, so every screen sees the same vertical
slice and a wider screen sees more to the sides.

### The UX review that followed

Screenshots of a busy intercept showed the second defect immediately: three
contacts in a loose trail printed three range tags inside forty pixels of each
other and across the altitude block. `renderer/LabelDeclutter.ts` now places
tags greedily, nearest first, trying four seats around each bracket and
dropping a tag rather than stacking it or covering an instrument.

Left and right alone were not enough — on a phone a head-on merge clusters the
contacts around the boresight where both sides are blocked, and every tag was
dropped. Above and below were added, and the phone got its range readouts back.

Also fixed: the objective strip reclaims the score chip's reserve in touch mode
(the chip lives in the systems line there), so a phone reads the whole
objective instead of "descend...".

### A bug the calendar found

The date rolled over mid-session and two daily-sortie tests failed. The cause
was real: `recordDailyRun()` read the clock again at the end of a run, so a
sortie begun at 23:59 was filed under the following day, against a seed it was
never flown on. The day is now fixed when the run starts.

### Verification

- `npx tsc --noEmit`, `npm run test` (595), `npm run build`
- Measured in Chromium after the fix: 93° vertical FOV on every device —
  iPhone SE (568x320), iPhone 12 (750x340), iPad Mini (1024x768) — where the
  phones previously had 46°
- Screenshots at 1440x900, 1024x700, and all three handsets: landscape visible,
  no label collisions, no instrument overdraw

---

## 12. Follow-up Pass — Flash Safety, Reduced Motion & the Solver Bug (v1.1.1)

**Status:** Complete
**Trigger:** "anything else to improve?"
**Result:** 611 tests across 34 suites

Three defects, found by auditing what the previous passes had asserted or
worked around rather than by adding anything new.

| Finding | Evidence |
| --- | --- |
| Warning banners flashed above the seizure threshold | The stall banner ran on a 220 ms period (4.5 Hz) and the missile-launch banner on 260 ms (3.8 Hz). WCAG 2.3.1 caps it at three flashes per second. |
| The canvas ignored `prefers-reduced-motion` | The CSS honoured it for the CRT flicker; the camera shake and full-screen impact flash added in §9 did not, and they are precisely what the preference is for. |
| The deck solver could draw an `essential` panel off-screen | It grew panels to fill spare space but never squeezed them when there was none. §10 worked around this by choosing row counts that fit rather than fixing it. |

Things that were checked and found **healthy**, and so left alone:

- CI already gates the Pages deploy on typecheck, the full test suite and a
  build; every merge this session is green.
- The dev-only `window.__game` handle really is stripped from the production
  bundle — `import.meta.env.DEV` is statically replaced, and the built asset
  contains no reference to it.
- No ESLint, deliberately: `strict` TypeScript with `noUnusedLocals`,
  `noUnusedParameters` and `erasableSyntaxOnly` already covers what a linter
  would catch here, and adding one now would mostly generate noise.

### Verification

- `npx tsc --noEmit`, `npm run test` (611), `npm run build`
- Four emulated handsets end to end, plus the deck screen at 568x320, where the
  squeezed turnaround panel now fits inside its own border
