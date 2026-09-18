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
- `npm run test` — 112 tests across 11 suites
- `npm run build` — clean production bundle (~80 kB, 25 kB gzipped)
- `npm run dev` — verified serving; manual pass on boot → briefing → deck → catapult → sortie → trap

## 6. Deliberate Non-Goals

- **Enemy cannon fire is hit-scan**, not a projectile subsystem. The alignment/range gate in `EnemyAI` establishes the solution; modelling enemy bullets as entities was judged not worth the complexity.
- **Device pixel ratio is pinned at 1:1.** Chunky pixels are the intended aesthetic and keep the bloom pass cheap.
- **Euler angles retained** rather than quaternions; pitch is clamped to ±88° to avoid gimbal singularities.
