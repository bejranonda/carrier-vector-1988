# CARRIER VECTOR: 1988

**A retro CRT vector flight simulator and aircraft carrier deck management game — built in pure TypeScript with zero 3D engine dependencies.**

### ▶ [**PLAY IN YOUR BROWSER**](https://bejranonda.github.io/carrier-vector-1988/)

[![Play Now](https://img.shields.io/badge/▶_PLAY-online-00ff66?style=for-the-badge)](https://bejranonda.github.io/carrier-vector-1988/)

[![CI](https://github.com/bejranonda/carrier-vector-1988/actions/workflows/deploy.yml/badge.svg)](https://github.com/bejranonda/carrier-vector-1988/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/tests-233%20passing-00ff66)](https://vitest.dev/)
[![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-00ff66)](#zero-dependency-policy)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Fly 6-DOF wireframe sorties through radar-masking canyons, then manage the flight deck that launched you. Every line of 3D projection, aerodynamics, and audio is hand-written linear algebra on a single HTML5 canvas — no Three.js, no Babylon, no Pixi, no gl-matrix.

**No install required — it runs entirely in the browser.**

---

## Table of Contents

- [Play Online](https://bejranonda.github.io/carrier-vector-1988/)
- [What is this?](#what-is-this)
- [Quick Start](#quick-start)
- [How to Play](#how-to-play)
- [Controls](#controls)
- [Features](#features)
- [Architecture](#architecture)
- [Simulation Models](#simulation-models)
- [Testing](#testing)
- [Documentation](#documentation)

---

## What is this?

Carrier Vector: 1988 is a **dual-loop simulation game** set aboard CV-68 in the Norwegian Sea. It runs entirely in the browser and combines two interlocking gameplay layers:

| Layer | What you do |
| --- | --- |
| **Macro — Flight Deck Logistics** | Allocate fuel and ordnance, watch deck crews arm and fuel your jet through a state machine, monitor an early-warning radar timeline, and take the catapult shot. |
| **Micro — 3D Vector Tactical Sortie** | Fly a fixed-timestep 6-DOF flight model, manage energy and angle of attack, hide from SAM radar behind terrain, splash inbound bombers, and trap back aboard. |

The two loops are genuinely coupled: **munitions you expend are deducted from carrier stocks**, bombers you fail to intercept damage the flight deck, and lost airframes are permanently gone.

## Quick Start

```bash
git clone https://github.com/bejranonda/carrier-vector-1988.git
cd carrier-vector-1988
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck + production bundle
npm run test     # 233 headless Vitest tests
npm run preview  # serve the production build
```

**Requirements:** Node 18+ and any modern browser. No GPU, no WebGL, no build-time asset pipeline.

## Missions

Pick a mission on the briefing screen with `←` / `→` or the number keys, then
press `ENTER`. Each one sets the world up differently, writes its own briefing
cards, and tracks its own ordered objectives.

| # | Mission | Difficulty | What it asks of you |
| --- | --- | --- | --- |
| 1 | **CARRIER DEFENSE** | ●●○○○ | The endless mode. Hold CV-68 against escalating waves for as long as you can. This is the one that teaches the game. |
| 2 | **CANYON STRIKE** | ●●●●● | A four-minute window to run the fjord below the ridge line, put a Mk.82 inside 55 m of a hardened submarine pen, and get back out through a SAM belt that has gone weapons-free. |
| 3 | **IRON HAND** | ●●●○○ | Roll back the SAM belt. Three launchers, four bombs a sortie — trap aboard and rearm as many times as it takes. |
| 4 | **LAST STAND** | ●●●●● | Five packages inbound at once and a hull already down to 70%. You cannot stop everything, so kill the bombers. |
| 5 | **CARRIER QUALS** | ●○○○○ | No enemies at all. Three traps with at least one 3-wire — the hardest skill in the game, with nothing shooting at you while you learn it. |

**CANYON STRIKE** is the set-piece. The canyon, the radar line-of-sight model and
the iron bombs were all already in the simulation; this mission is what finally
asks you to use all three in one run:

- **Ingress low.** Above the ridge line the SAM belt has line of sight and will
  kill you in the transit. Keep the RWR quiet.
- **Aim it in.** The pen is hardened — a near miss does nothing. Only a bomb
  inside 55 m counts, so the HUD draws a **CCIP** impact cross that turns amber
  and reads `RELEASE` the moment the predicted impact point is on the target.
- **Get out.** The pen going up is the signal for the belt to go weapons-free.
- **Lose a jet and you can go again** — the boat has spares and the deck will
  rearm you. What it will not do is stop the clock.

## How to Play

The briefing screen lays this out in three cards; here it is in full.

1. **Boot & mission select** — The display warms up, then the briefing screen
   offers five missions. `←` / `→` or `1`-`5` picks one; the three cards under
   the selector explain *that* mission. Press `ENTER` (or click) to fly it, or
   `S` to skip straight to airborne.
2. **On the deck** — The **CURRENT ORDERS** panel at the top of the deck screen
   always names the one thing you should do next and the key that does it. Set
   your payload with `1`–`4`: more fuel means longer endurance, more ordnance
   means more kills but a heavier, draggier jet.
3. **Launch** — When the turnaround reaches `CATAPULT READY`, press `ENTER` for
   the cat shot. The camera rides the stroke into the cockpit.
4. **Intercept** — Kill the inbound packages *before their ETA hits zero*. The
   objective strip across the top of the HUD counts the live contacts and the
   time you have left. Bombers (Tu-22M) cost 35% hull integrity if they get
   through; fighters cost 15%.
5. **Survive the SAMs** — When your RWR screams `LAUNCH`, **descend below the
   ridge line**. Breaking line of sight breaks the lock and kills the missile
   in flight.
6. **Trap aboard** — Come home under 90 m/s, between 18–30 m altitude, within
   190 m of the boat. The approach panel (meatball, AoA indexer, range and
   speed) appears automatically once you are inside 3 km and closing.

Hull integrity reaching zero ends the mission. Survive waves to raise your
score and rank from **NUGGET** to **ADMIRAL**.

> **First sortie:** a six-step **FLIGHT CHECKOUT** checklist walks you through
> pitch, roll, throttle, the weapons bay, guns and terrain masking, ticking
> each one off as you demonstrate it. A contextual coach calls out stalls,
> terrain, missile launches and approach guidance as they happen, and `H`
> shows the full control reference at any time.

### Finding the screen hard to read?

Press `P` to cycle the display mode:

| Mode | What it does |
| --- | --- |
| `CLEAN` | No vector trails, no bloom, no scanlines — maximum legibility, cheapest to draw |
| `MODERN` | **Default.** Crisp symbology with a light bloom glow and a faint vignette |
| `RETRO CRT` | The full 1988 phosphor tube: persistence trails, per-stroke glow, scanline mask, vignette |

Your choice is remembered between sessions. On a weak machine the bloom pass also
backs itself off automatically from a rolling frame-time average, without ever
exceeding the mode you picked.

## Controls

### Flight / Cockpit

| Key | Action |
| --- | --- |
| `W` / `UP` | Pitch nose **UP** |
| `S` / `DOWN` | Pitch nose **DOWN** |
| `A` / `LEFT` | Roll left |
| `D` / `RIGHT` | Roll right |
| `Q` / `E` | Rudder yaw left / right |
| `SHIFT` | Throttle up (past 100% engages afterburner) |
| `CTRL` | Throttle down |
| `SPACE` | Fire selected weapon |
| `1` / `2` / `3` | Select 20mm Vulcan / AIM-9 Sidewinder / Mk.82 bomb |
| `B` | Toggle weapons bay (open = **RCS ×4.0**) |

### Flight Deck

| Key | Action |
| --- | --- |
| `ENTER` | Launch from catapult |
| `1` / `2` | Decrease / increase planned fuel (±500 L) |
| `3` / `4` | Cycle AIM-9 / Mk.82 loadout |

### Mission Select (briefing screen)

| Key | Action |
| --- | --- |
| `←` / `→` | Change selected mission |
| `1`–`5` | Pick a mission directly |
| `ENTER` | Fly the selected mission |
| `S` | Skip the deck and start airborne |

### System

| Key | Action |
| --- | --- |
| `TAB` | Toggle cockpit ↔ flight deck view |
| `H` / `F1` | Control reference overlay |
| `ESC` | Close overlay |
| `M` | Mute / unmute |
| `P` | Cycle display mode — `CLEAN` / `MODERN` / `RETRO CRT` |

> Control bindings are defined once in [`src/core/Controls.ts`](src/core/Controls.ts) and consumed by the input handler, the help overlay, and the briefing — so this table cannot drift from the code.

## Features

### Missions
- **Five selectable scenarios** with their own world setup, briefing cards, ordered
  objectives, win conditions and loss conditions — all defined as data in one pure module
- **Hardened ground targets** with a tight hit radius, so an iron bomb is an aimed
  delivery rather than a lob
- **CCIP bombing cue** computed from the same ballistic integration the live bomb uses
- **Mission clock** with a scenario-defined window, shown on both the cockpit HUD and
  the flight deck, that stops mattering the moment its objective is met

### Flight & Combat
- **Fixed-timestep 6-DOF flight dynamics** at 120 Hz — lift, drag, thrust, gravity, and dynamic angle of attack
- **Aerodynamic stall** past α ≈ 18°, collapsing control authority to 22%
- **Induced drag scaling with G-load**, so hard turns genuinely bleed energy
- **Afterburner** with 3.5× fuel burn and a 4× thermal signature
- **Battle damage model** — degrades control authority and opens fuel leaks
- Three weapons with real ballistics: 20mm Vulcan, AIM-9 Sidewinder, Mk.82 iron bombs

### Sensors & Stealth
- **Radar line-of-sight raycasting** against the terrain heightfield
- **Terrain masking** — drop below a ridge and the lock breaks, killing missiles mid-flight
- **Radar cross-section modelling**: `RCS_eff = RCS_base × AspectFactor × (BayOpen ? 4.0 : 1.0)`
- **RWR** with `SEARCH` → `TRACK` → `LAUNCH` escalation and azimuth display
- **Lethal SAMs** with swept-sphere proximity fuzing that cannot tunnel through you at Mach 1.5

### Carrier Operations
- Deck crew stamina and task scheduling — fatigue delays your scramble
- Full aircraft state machine: `HANGAR_MAINTENANCE` → `ARMING_REFUELING` → `CATAPULT_READY` → `CATAPULT_LAUNCHING` → `AIRBORNE` → `RECOVERY_TRAP` → `DAMAGED_REPAIR`
- **Procedurally escalating strike waves** from a seeded PRNG after the scripted opening act
- Graded arrested recoveries (1–4 wire, or a bolter) feeding a score and rank ladder

### Presentation & Readability
- **Three display modes** (`CLEAN` / `MODERN` / `RETRO CRT`) behind one key, covering
  vector persistence, bloom, per-stroke glow, the scanline mask and the vignette
  together — and remembered between sessions
- **Device-pixel-accurate canvas** — the backing store is scaled by `devicePixelRatio`
  so symbology stays sharp on HiDPI displays
- **Phosphor persistence** — vectors decay with a frame-rate-independent time constant
- **Additive bloom pass** with a `multiply` pseudo-threshold, at ¼ resolution
- Distance haze, horizon ring, and a scrolling sea lattice for depth and motion cues
- **Always-on objective line** in both loops, derived from a pure `Objectives.ts` module
- Every HUD cluster sits on a translucent backplate, so legibility never depends on
  what part of the wireframe happens to be behind it
- Fully **responsive deck layout** that reflows from 3 columns to 1, compresses under
  vertical pressure, sheds its least important panels rather than clipping them, and
  expands to fill the height it has
- A matching **cockpit instrument solver** that places every block from the real
  viewport instead of fixed offsets, scaling and clipping the pitch ladder into
  whatever space is left — both solvers are pure and both are tested for overlap
- **Personal best** carried across sessions, shown on the briefing and the debrief
- Procedurally synthesized Web Audio: engine whine, afterburner roar, RWR tones, flak

## Architecture

```
src/
├── core/
│   ├── GameLoop.ts        # The bridge loop: fixed timestep, phases, view dispatch
│   ├── Timestep.ts        # Fixed-timestep accumulator with spiral-of-death guard
│   ├── Controls.ts        # Single source of truth for key bindings
│   ├── Tutorial.ts        # Contextual coach + first-run training checklist
│   ├── Objectives.ts      # "What do I do right now?" for both loops (pure)
│   ├── Scenarios.ts       # Selectable missions + the phase director (pure)
│   ├── HighScore.ts       # Persisted personal best
│   └── ScoreKeeper.ts     # Scoring, trap grading, rank ladder
├── flight/
│   ├── AircraftPhysics.ts # 6-DOF aerodynamics, stall, damage
│   └── Weapons.ts         # Ballistics, homing, explosions
├── tactics/
│   ├── RadarLOS.ts        # Terrain, SAM sites, LOS raycasting, RCS, RWR
│   ├── StrikeTarget.ts    # Hardened ground targets and their hit geometry
│   └── EnemyAI.ts         # INGRESS / ENGAGE / RTB behaviour
├── carrier/
│   └── DeckManager.ts     # Inventory, crews, state machine, threat director
├── renderer/
│   ├── VectorRenderer.ts  # 3D pipeline: camera transform, near-plane clip, projection
│   ├── PostProcess.ts     # Phosphor persistence + bloom compositor
│   ├── Theme.ts           # Colour tokens, typography, panel/keycap primitives
│   ├── DisplayMode.ts     # CLEAN / MODERN / RETRO ladder (canvas + CSS effects)
│   ├── HudLayout.ts       # Pure cockpit instrument placement solver
│   ├── HUD.ts             # Objective strip, pitch ladder, FPM, tapes, RWR, landing aids
│   ├── DeckLayout.ts      # Pure responsive panel solver
│   ├── DeckView.ts        # Flight deck instruments
│   └── BriefingScreen.ts  # Boot sequence, briefing, help, debrief
├── audio/SoundFX.ts       # Web Audio synthesis
└── main.ts                # Entry point and input dispatch
```

### Zero-Dependency Policy

This project has **no runtime dependencies at all**. Every piece of 3D math is implemented from scratch:

- The camera transform projects onto the aircraft's own right/up/forward basis
- Near-plane clipping interpolates line segments against `z = 2.0 m`
- Perspective projection is an explicit divide: `x' = x·f/z + x₀`, `y' = −y·f/z + y₀`
- Terrain is an analytic heightfield with bilinear interpolation
- All audio is synthesized from oscillators and noise buffers

## Simulation Models

**Perspective projection** — world → camera → near-plane clip → perspective divide.
The camera transform is the dot product of the translated point with the *same*
right / up / forward basis vectors `AircraftPhysics` uses for lift, thrust and drag,
so the view can never disagree in sign with the flight model:

```
x_cam = (p − eye) · right      y_cam = (p − eye) · up      z_cam = (p − eye) · forward
```

**Aerodynamics** — with air density `ρ = ρ₀·e^(−y/8500)` and dynamic pressure `q = ½ρv²`:

```
α          = −asin( v̂ · û_up )
C_L        = clamp(α° × 0.085, −1.0, 1.6)     (0.25 post-stall)
C_D        = C_D0 + C_L²/(π·e·AR) + stall penalty
Lift       = q · S · C_L                        along the aircraft up-vector
Drag       = q · S · C_D                        opposite the velocity vector
```

Stall triggers at `|α| > 18°`, dropping control authority to 0.22. Induced drag is amplified above 1.5 G, so sustained hard turns bleed airspeed.

**HUD symbology** is derived from the renderer's focal length, so world-referenced symbols overlay the real 3D scene exactly:

```
screen offset = fov · tan(Δangle)
```

**Missile proximity fuzing** uses a swept-sphere test — the closest point on the missile's travel *segment* to the aircraft, not its end-of-tick position. At 480 m/s the missile covers ~48 m per tick, well beyond the 40 m fuze radius, so a naive distance check would let it pass straight through you.

**Phosphor decay** is frame-rate independent: `α = 1 − e^(−Δt/τ)` with τ = 60 ms. A constant alpha would produce trails 2.4× longer at 144 Hz than at 60 Hz.

## Testing

```bash
npm run test
```

**233 headless tests** across 19 suites — physics, ballistics, radar/RCS, carrier state machine, enemy AI, deck and cockpit layout geometry, scoring, personal bests, the tutorial rules engine, the objective director, the display-mode ladder, theme contrast ratios, text fitting, scenario phase progression and end conditions, hardened-target hit geometry, CCIP prediction against the real bomb path, the timestep accumulator, projection math (including the camera transform's agreement with the flight model's own orientation basis), and a full GameLoop integration smoke test that drives every phase through a stubbed Canvas2D context.

The renderer's pure math is deliberately extracted (`depthFade`, `decayAlpha`, `computeDeckLayout`, `gradeTrap`, `warmupEnvelope`) specifically so it can be verified without a browser.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | The implementation plan behind the current revision |
| [docs/APPROACH_AND_METHOD.md](docs/APPROACH_AND_METHOD.md) | Design philosophy, dual-loop architecture, rendering pipeline |
| [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) | Mathematical reference: constants, formulas, coordinate system |
| [docs/GUIDELINES.md](docs/GUIDELINES.md) | Contributor rules — dependency policy, palette, testing discipline |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Known limitations and deliberate trade-offs |

---

## Keywords

`vector graphics game` · `retro flight simulator` · `CRT phosphor effect` · `wireframe 3D renderer` ·
`TypeScript game development` · `HTML5 canvas game` · `6-DOF flight dynamics` · `aircraft carrier simulation` ·
`radar terrain masking` · `radar cross section` · `browser game no engine` · `linear algebra 3D projection` ·
`fixed timestep game loop` · `procedural terrain` · `Web Audio synthesis` · `1980s arcade aesthetic`

## License

MIT — see [LICENSE](LICENSE).
