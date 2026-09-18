# CARRIER VECTOR: 1988

**A retro CRT vector flight simulator and aircraft carrier deck management game — built in pure TypeScript with zero 3D engine dependencies.**

### ▶ [**PLAY IN YOUR BROWSER**](https://bejranonda.github.io/carrier-vector-1988/)

[![Play Now](https://img.shields.io/badge/▶_PLAY-online-00ff66?style=for-the-badge)](https://bejranonda.github.io/carrier-vector-1988/)

[![CI](https://github.com/bejranonda/carrier-vector-1988/actions/workflows/deploy.yml/badge.svg)](https://github.com/bejranonda/carrier-vector-1988/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/tests-112%20passing-00ff66)](https://vitest.dev/)
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
npm run test     # 112 headless Vitest tests
npm run preview  # serve the production build
```

**Requirements:** Node 18+ and any modern browser. No GPU, no WebGL, no build-time asset pipeline.

## How to Play

1. **Boot & Briefing** — The CRT warms up, then the mission briefing explains the situation. Press `ENTER` to man your aircraft (or `S` to skip straight to airborne).
2. **On the deck** — Set your payload with `1`–`4`. More fuel means longer endurance; more ordnance means more kills but a heavier, draggier jet.
3. **Launch** — When the turnaround reaches `CATAPULT_READY`, press `ENTER` for the cat shot. The camera rides the stroke into the cockpit.
4. **Intercept** — Kill the inbound packages *before their ETA hits zero*. Bombers (Tu-22M) cost 35% hull integrity if they get through; fighters cost 15%.
5. **Survive the SAMs** — When your RWR screams `LAUNCH`, **descend below the ridge line**. Breaking line of sight breaks the lock and kills the missile in flight.
6. **Trap aboard** — Come home under 90 m/s, between 18–30 m altitude, within 190 m of the boat. Fly the meatball; a 3-wire is a perfect trap.

Hull integrity reaching zero ends the mission. Survive waves to raise your score and rank from **NUGGET** to **ADMIRAL**.

> **New player tip:** press `H` at any time for the full control reference. A contextual coach also calls out stalls, terrain, missile launches and approach guidance as they happen.

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

### System

| Key | Action |
| --- | --- |
| `TAB` | Toggle cockpit ↔ flight deck view |
| `H` / `F1` | Control reference overlay |
| `ESC` | Close overlay |
| `M` | Mute / unmute |
| `P` | Cycle CRT post-processing quality |

> Control bindings are defined once in [`src/core/Controls.ts`](src/core/Controls.ts) and consumed by the input handler, the help overlay, and the briefing — so this table cannot drift from the code.

## Features

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

### Presentation
- **Phosphor persistence** — vectors decay over ~60 ms leaving authentic CRT trails
- **Additive bloom pass** with a `multiply` pseudo-threshold, at ¼ resolution
- Distance haze, horizon ring, and a scrolling sea lattice for depth and motion cues
- Fully **responsive deck layout** that reflows from 3 columns to 1
- Procedurally synthesized Web Audio: engine whine, afterburner roar, RWR tones, flak

## Architecture

```
src/
├── core/
│   ├── GameLoop.ts        # The bridge loop: fixed timestep, phases, view dispatch
│   ├── Timestep.ts        # Fixed-timestep accumulator with spiral-of-death guard
│   ├── Controls.ts        # Single source of truth for key bindings
│   ├── Tutorial.ts        # Contextual coach + first-run training sequence
│   └── ScoreKeeper.ts     # Scoring, trap grading, rank ladder
├── flight/
│   ├── AircraftPhysics.ts # 6-DOF aerodynamics, stall, damage
│   └── Weapons.ts         # Ballistics, homing, explosions
├── tactics/
│   ├── RadarLOS.ts        # Terrain, SAM sites, LOS raycasting, RCS, RWR
│   └── EnemyAI.ts         # INGRESS / ENGAGE / RTB behaviour
├── carrier/
│   └── DeckManager.ts     # Inventory, crews, state machine, threat director
├── renderer/
│   ├── VectorRenderer.ts  # 3D pipeline: camera transform, near-plane clip, projection
│   ├── PostProcess.ts     # Phosphor persistence + bloom compositor
│   ├── HUD.ts             # Pitch ladder, FPM, tapes, RWR, landing aids
│   ├── DeckLayout.ts      # Pure responsive panel solver
│   ├── DeckView.ts        # Flight deck instruments
│   └── BriefingScreen.ts  # Boot sequence, briefing, help, debrief
├── audio/SoundFX.ts       # Web Audio synthesis
└── main.ts                # Entry point and input dispatch
```

### Zero-Dependency Policy

This project has **no runtime dependencies at all**. Every piece of 3D math is implemented from scratch:

- Camera transforms are hand-written rotation matrices
- Near-plane clipping interpolates line segments against `z = 2.0 m`
- Perspective projection is an explicit divide: `x' = x·f/z + x₀`, `y' = −y·f/z + y₀`
- Terrain is an analytic heightfield with bilinear interpolation
- All audio is synthesized from oscillators and noise buffers

## Simulation Models

**Perspective projection** — world → camera (translate, then −yaw/−pitch/−roll) → near-plane clip → perspective divide.

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

**112 headless tests** across 11 suites — physics, ballistics, radar/RCS, carrier state machine, enemy AI, layout geometry, scoring, the tutorial rules engine, the timestep accumulator, projection math, and a full GameLoop integration smoke test that drives every phase through a stubbed Canvas2D context.

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
