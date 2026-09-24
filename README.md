# CARRIER VECTOR: 1988

**A retro CRT vector flight simulator and aircraft carrier deck management game — built in pure TypeScript with zero 3D engine dependencies.**

### ▶ [**PLAY IN YOUR BROWSER**](https://bejranonda.github.io/carrier-vector-1988/)

[![Play Now](https://img.shields.io/badge/▶_PLAY-online-00ff66?style=for-the-badge)](https://bejranonda.github.io/carrier-vector-1988/)

[![CI](https://github.com/bejranonda/carrier-vector-1988/actions/workflows/deploy.yml/badge.svg)](https://github.com/bejranonda/carrier-vector-1988/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/tests-989%20passing-00ff66)](https://vitest.dev/)
[![Playtest](https://img.shields.io/badge/browser%20checks-28%20passing-00ff66)](#testing)
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
npm run test     # 989 headless Vitest tests
npm run playtest # 28 checks in a real browser, screenshots to playtest-output/
npm run preview  # serve the production build
```

**Requirements:** Node 18+ and any modern browser. No GPU, no WebGL, no build-time asset pipeline.

## Missions

Pick a mission on the briefing screen with `←` / `→` or the number keys, then
press `ENTER`. Each one sets the world up differently, writes its own briefing
cards, and tracks its own ordered objectives.

| # | Mission | Difficulty | Map | What it asks of you |
| --- | --- | --- | --- | --- |
| 1 | **CARRIER DEFENSE** | ●●○○○ | BJORNFJORD | The endless mode. Hold CV-68 against escalating waves for as long as you can. |
| 2 | **CANYON STRIKE** | ●●●●● | BJORNFJORD | A four-minute window to run the fjord below the ridge line, put a Mk.82 inside 55 m of a hardened submarine pen, and get back out through a SAM belt that has gone weapons-free. |
| 3 | **IRON HAND** | ●●●○○ | KVITOYA RIDGES | Roll back the SAM belt. Four launchers behind four ridges: lock each radiating site with an **AGM-88 HARM**, and bomb any that go quiet. |
| 4 | **LAST STAND** | ●●●●● | NORWEGIAN SEA | Five packages inbound at once and a hull already down to 70%. You cannot stop everything, so kill the bombers. |
| 5 | **CARRIER QUALS** | ●○○○○ | NORWEGIAN SEA | No enemies at all. Three traps with at least one 3-wire — the hardest skill in the game, with nothing shooting at you while you learn it. |
| 6 | **TRAINING SORTIE** | ●○○○○ | NORWEGIAN SEA | **Where a new pilot starts.** A guided flight with Ghost-Lead: launch, climb, engage the autopilot, splash a real target drone, trap aboard. Nothing can shoot you and the wingman hauls you clear of the sea, so it cannot end in a crash. |

### The three maps

A map is data — a height function, a SAM order of battle, and the landmarks a
scenario places things against. Each one is a different bargain with the terrain.

| Map | What it is | What it does to you |
| --- | --- | --- |
| **BJORNFJORD** | One deep slot, vertical walls | Total cover, no choices. The route is the mission. |
| **NORWEGIAN SEA** | Open water and a few skerries | Nowhere to mask. Against a lock the answer is speed, aspect and the bay doors. Also the sane place to learn to land. |
| **KVITOYA RIDGES** | Ridge after ridge, each gap offset from the last | Cover is available but brief, and only if you are in the right gap. The low route weaves. |

Every map is unit-tested for the same guarantees: a low corridor wide enough to
turn in, a clear approach tube off the bow, and terrain that can actually mask a
radar. Those tests caught a 300 m cliff step 1.2 km off the bow and a belt of
SAM sites masked by their own island.

**CANYON STRIKE** is the set-piece. The canyon, the radar line-of-sight model and
the iron bombs were all already in the simulation; this mission is what finally
asks you to use all three in one run:

- **Ingress low.** Above the ridge line the SAM belt has line of sight and will
  kill you in the transit. Watch the SAM arc on the radar rim.
- **Aim it in.** The pen is hardened — a near miss does nothing. Only a bomb
  inside 55 m counts, so the HUD draws a **CCIP** impact cross that turns amber
  and reads `RELEASE` the moment the predicted impact point is on the target.
- **Get out.** The pen going up is the signal for the belt to go weapons-free.
- **Lose a jet and you can go again** — the boat has spares and the deck will
  rearm you. What it will not do is stop the clock.

## How to Play

**Your first flight is deliberately small.** A new pilot is routed to the
TRAINING SORTIE and flies the **FIRST FLIGHT** HUD: the horizon, speed, altitude,
one line saying what to do, the armed weapon, and a single steering cue on a ring
round the gunsight that says where to go (`BOAT 4.2 KM · TURN LEFT`) - no
compass, no radar, no row of buttons. The deck shows four panels, not eight.
Finish the training sortie (`WINGS EARNED`) and the full instruments unlock; `U`
switches between **FIRST FLIGHT / ARCADE / PRO** at any time and is remembered.

The briefing screen lays the rest out in three cards; here it is in full.

1. **Boot & mission select** — The display warms up, then the briefing screen
   offers six missions. `←` / `→` or `1`-`6` picks one; the three cards under
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
5. **Survive the SAMs** — When a red `MISSILE LEFT` / `RIGHT` chevron appears on
   the ring round the gunsight, press `X` for chaff (the `CHF` button on a phone),
   then **descend below the ridge line**. Breaking line of sight breaks the lock
   and kills the missile in flight. A fighter lining up a guns shot on you
   sounds a rising three-pip warble - break hard.
6. **Trap aboard** — Come home under 90 m/s, between 18–30 m altitude, within
   190 m of the boat. The approach panel (meatball, AoA indexer, range and
   speed) appears automatically once you are inside 3 km and closing.

Hull integrity reaching zero ends the mission. Survive waves to raise your
score and rank from **NUGGET** to **ADMIRAL**.

### How much of the aeroplane do you want to fly?

Press `F` to cycle. The setting is remembered between sessions, and every level
is a control law feeding the same physics — nothing here can put the jet
somewhere it could not have flown.

| Level | What it does |
| --- | --- |
| `MANUAL` | Nothing between you and the aerodynamics. |
| `ASSIST` | **Default.** The jet levels itself when you let go, refuses to pull into a stall, and pulls up out of the dirt. Afterburner is a held boost: let go of `SHIFT` and it comes back to military power. You still fly it everywhere. |
| `AUTOPILOT` | The jet flies and you fight: pick a target, pick a weapon, decide when to shoot and when to break. |

The ground-proximity protections stand down on a carrier approach — an approach
*is* a deliberate descent to a deck 20 m above the water — and the autopilot
hands the aeroplane back when you turn onto final. Nobody wants the trap flown
for them.

### Picking what to shoot

`T` steps through everything shootable, nearest-ahead first; `SHIFT`+`T` steps
back; `Y` releases. The designated target gets a solid box, a range, and the
weapon its geometry actually supports — and then the rest of the game follows
it: the Sidewinder guides on *that* contact instead of whichever one it liked,
and the autopilot flies the intercept. If it is off the glass, a chevron on the
boresight ring tells you which way to turn.

The scope only offers what you can actually see. Hardened structures are on the
briefing card, so they are always available; an aircraft needs line of sight,
because it moves and a remembered position is a lie within seconds; a launcher
needs line of sight *or* to have given itself away already — seen once, or
having painted you — because it does not move. So terrain masking cuts both
ways: the ridge that hides you from the SAM belt hides the SAM belt from you,
and climbing to find the launchers is a decision with a price.

## Playing on a phone

Open it on a handset and it hands you thumbs instead of a keyboard. There is
no separate mobile build and no cut-down game: the flight model, the assist
laws, the weapons and the missions are the same ones the keyboard drives.

What makes that possible is that two earlier features already existed —
**AUTOPILOT** flies the aeroplane, and **designation** chooses the target — so
a phone player is a weapons officer rather than a pilot short of eight fingers.

| Control | What it does |
| --- | --- |
| Left thumb | Virtual stick. It centres wherever your thumb lands, not on a fixed circle you have to find. |
| Far left track | Throttle, afterburner included. |
| **Tap a contact** | Designates it. Pointing at the thing you want is the natural gesture; the `TGT` button still cycles anything off the glass. |
| `FIRE` | Releases the armed weapon, or holds the trigger on the cannon. |
| Weapon pills | Gun / AIM-9 / Mk.82 / HARM, with rounds remaining. |
| `CHF` | Chaff, above `TGT` under the right thumb. It lights amber the moment a missile is in the air at you. |
| `RCVY` | Recovery assist. It flies the ball and the speed on final and hands back at short final — the trap is still yours. |
| ☰ | Pause and the full control reference. |

A phone starts on `AUTOPILOT` with the recovery assist on and the cheapest
display mode, unless you have already chosen otherwise — a three and a half
degree slope to a moving deck, on a virtual stick, with a thumb over the
altimeter, is the one part of the game touch controls could not do — and asks
you to turn the device if you are holding it
upright — the cockpit needs a landscape screen to hold its instruments.

Detection is a heuristic, so press `K` to cycle `AUTO` / `TOUCH` / `KEYBOARD`
if it guesses wrong. Desktop players get tap-to-designate with the mouse too.

### The Daily Sortie

Press `D` on the briefing. It is the endless carrier defence, seeded from
today's date, so **every player in the world flies the identical campaign** —
the same packages, in the same order, at the same time. The debrief prints a
four-line card and `C` copies it:

```
CARRIER VECTOR: 1988 — DAILY SORTIE #262
WAVE 7 · 18,400 PTS · LT COMMANDER
●●●● ◆◆ ▲▲  4 splashed · 2 SAM · 2 traps (1 perfect) · hull 62%
attempt 2 · carrier-vector-1988
```

Unlimited attempts; the card says which one it was. Locking the day to a
single try punishes exactly the person who has just found the game.

### Ops tempo

Press `O`. The deck cycle and the threat timeline have two settings, and the
difference is not subtle.

| Tempo | What it is | Briefing → first kill |
| --- | --- | --- |
| `ARCADE` | **Default.** Fast deck, contacts closer in, a spare airframe on the catapult ~3 s after a loss. | **9.6 s**, measured in Chromium |
| `SIM` | Every original timing: 14 s arming, contacts 8.3 km out, the full 32 s hangar-and-rearm cycle. | no kill inside a 2-minute budget |

`SIM` is the better simulation and the worse first impression. Both are one
key apart, so you can have either.

### Progress

Each mission keeps its own best score and completion count. The selector ticks
what you have cleared, marks one mission `START HERE`, and the debrief tells you
what to fly next. Nothing is locked — the five-pip missions are selectable from
the first run if you want them.

> **First sortie:** a six-step **FLIGHT CHECKOUT** checklist walks you through
> pitch, roll, throttle, the weapons bay, guns and terrain masking, ticking
> each one off as you demonstrate it. A contextual coach calls out stalls,
> terrain, missile launches and approach guidance as they happen, and `H`
> shows the full control reference at any time.

### One screen style

The game has a single look — crisp symbology, a light bloom glow, a faint
phosphor trail and vignette. There used to be three (`CLEAN` / `MODERN` /
`RETRO CRT`) behind a key, and a beginner had to pick a look before flying.
`prefers-reduced-motion` still calms the shake and flashes, `C` still swaps in
the colour-blind palette, and on a weak machine the bloom pass backs itself off
automatically from a rolling frame-time average.

## Controls

### Flight / Cockpit

| Key | Action |
| --- | --- |
| `W` / `UP` | Pitch nose **UP** |
| `S` / `DOWN` | Pitch nose **DOWN** |
| `A` / `LEFT` | Bank left — **the jet turns left** (add `W` to tighten) |
| `D` / `RIGHT` | Bank right — **the jet turns right** (add `W` to tighten) |
| `Q` / `E` | Rudder left / right (fine aim only — you do not need it to turn) |
| `SHIFT` | Throttle up (past 100% engages afterburner) |
| `CTRL` | Throttle down |
| `SPACE` | Fire selected weapon |
| `1` / `2` / `3` / `4` | Select 20mm Vulcan / AIM-9 Sidewinder / Mk.82 bomb / AGM-88 HARM |
| `X` | **Release chaff** — breaks every SAM lock on you (12 per sortie, short recycle) |
| `B` | Toggle weapons bay (open = **RCS ×4.0**) |
| `T` | Designate next target (`SHIFT`+`T` steps back) |
| `Y` | Release the designation |
| `F` | Cycle flight assist — `MANUAL` / `ASSIST` / `AUTOPILOT` |
| `G` | Autopilot terrain following (hug the valleys; on by default) |
| `L` | Recovery assist — flies the ball and the speed, hands back at short final |
| `V` | Padlock camera onto the locked target |
| `U` | HUD and deck detail — `FIRST FLIGHT` / `ARCADE` / `PRO` (remembered) |
| `I` | Flip the stick: `UP` = climb (default) or `UP` = dive (flight-sim style) |
| `BACKSPACE` | Time rewind (5 seconds flight restore, 2 uses per sortie) |
| `O` | Cycle ops tempo — `ARCADE` / `SIM` pacing |
| `C` | Cycle colour palette — classic phosphor / colour-blind |
| `K` | Cycle controls — `AUTO` / `TOUCH` / `KEYBOARD` |

> **AZERTY, QWERTZ, Dvorak:** the stick keys (`W` `A` `S` `D` `Q` `E`) are read
> by *position*, so they sit under the same fingers on any keyboard layout. On
> AZERTY that is `Z` `Q` `S` `D` `A` `E`. Every other shortcut follows the label
> on the key.

### Flight Deck

| Key | Action |
| --- | --- |
| `ENTER` | Launch from catapult |
| `1` / `2` | Decrease / increase planned fuel (±500 L) |
| `3` / `4` | Cycle AIM-9 / Mk.82 loadout |
| `R` | Rush the turnaround — costs crew stamina |
| `V` | Cycle threat level — `CADET` / `REGULAR` / `VETERAN` |
| `U` | Brief deck (4 panels) / full deck — follows the HUD setting |

### Mission Select (briefing screen)

| Key | Action |
| --- | --- |
| `←` / `→` | Change selected mission |
| `1`–`6` | Pick a mission directly |
| `ENTER` | Fly the selected mission |
| `↑` / `↓` | Change map (endless carrier defence only) |
| `S` | Skip the deck and start airborne |
| `D` | Fly today's daily sortie |
| `V` | Cycle threat level — `CADET` / `REGULAR` / `VETERAN` |

### System

| Key | Action |
| --- | --- |
| `TAB` | Toggle cockpit ↔ flight deck view |
| `H` / `F1` | Control reference overlay |
| `ESC` | Close overlay |
| `M` | Mute / unmute |
| `C` | Cycle colour palette — classic phosphor / colour-blind |

> **Every binding above is defined once** in [`src/core/Controls.ts`](src/core/Controls.ts)
> and consumed by the input handler, the help overlay and the briefing, so a key
> can never mean two different things in two different places.
>
> The *prose* in this table is hand-written, and is deliberately more expansive
> than the in-game labels (which must fit a narrow column). It can therefore
> drift; `markdownControlTable()` in the same module regenerates the canonical
> version if you want to check it. Earlier text here claimed the table "cannot
> drift from the code" — that was never true, and is corrected in v1.9.0.

## Features

### Missions & Campaign
- **Three maps**, each a pure height function plus a SAM order of battle, each with
  unit-tested navigability guarantees
- **Six selectable scenarios** with their own world setup, briefing cards, ordered
  objectives, win conditions and loss conditions — including the safe `TRAINING SORTIE`
- **Persistent Rogue-lite Campaign State Machine**: Air wing logistics (24 F-14s, 12 A-6s, finite ordnance, carrier hull) across a 7-sector Norwegian Sea theater with Early Warning Radar threat attenuation.
- **Hardened ground targets** with a tight hit radius, so an iron bomb is an aimed
  delivery rather than a lob
- **CCIP bombing cue** computed from the same ballistic integration the live bomb uses
- **Mission clock** with a scenario-defined window, shown on both the cockpit HUD and
  the flight deck, that stops mattering the moment its objective is met

### Flight Assist & Autopilot
- **Three assist levels behind one key** — `MANUAL`, `ASSIST` and `AUTOPILOT` — all of
  them pure control laws feeding the same physics, so the assist can only fly the jet
  where the jet could have gone
- **Alpha limiter** that bites only in the last 40% of the margin, so ordinary
  manoeuvring is untaxed and the annunciator is not permanently lit
- **Terrain floor measured in seconds to impact**, not in metres — a height-only floor
  cannot save a jet descending at 60 m/s, because it engages with one second left
- **Coordinated autopilot turns**: this flight model has no bank-to-turn yaw coupling,
  so the autopilot flies bank *and* rudder — capped, and led by the bank rather than by
  the heading error, because full rudder held at 220 m/s departs the aeroplane instead
  of turning it
- **Symmetric stall recovery**: the wing can let go at negative alpha too, and unloading
  means moving alpha toward *zero*, not pushing regardless
- **Terrain following** (`G`, on by default): the autopilot samples the ground ahead and
  asks how high it must be *now* to clear each point by its set clearance when it gets
  there — so it climbs the face of a ridge early, crosses it with clearance, and sinks
  back into the valley instead of cruising in plain view of the SAM belt
- **Recovery assist** (`L`): on final it flies the ball and the speed and hands the
  aeroplane back at short final. Lineup stays yours, and so does the trap
- **Protections stand down on the approach**, and the autopilot hands the aeroplane back
  when you turn final

### Difficulty & Accessibility
- **Threat level** (`V`) — `CADET` / `REGULAR` / `VETERAN`, which move a scenario along
  the escalation curve wave generation already implements, rather than a second set of
  difficulty numbers to keep in sync with the first
- **Map choice on the endless mode** (`↑` / `↓` at the briefing): holding the boat in a
  fjord, over open water and in a ridge field are three different problems. The scripted
  missions keep their own terrain, because each is about *its* canyon
- **Colour-blind palette** (`C`): green-for-us against red-for-them is the one pairing a
  deuteranope or protanope cannot separate, so the alternative moves onto the
  blue-yellow axis — cyan instruments, amber hostiles, violet keycaps. The briefing
  names it directly (`try colour-blind palette`) until the setting has ever been
  touched, so it isn't a feature you have to already know to go looking for
- **Flash rate capped at 2.5 Hz** for every blinking warning, under the WCAG 2.3.1 limit
- **`prefers-reduced-motion` honoured on the canvas**, not just in the CSS: camera shake
  off, impact flash damped, warnings lit rather than blinking

### Target Designation
- **One key cycles a priority-ordered scope** — air contacts, SAM sites and hardened
  structures, nearest-ahead first, with a stable order that does not reshuffle under
  the key
- **The designation drives everything downstream**: the HUD bracket, the recommended
  weapon for the current range and aspect, the Sidewinder's seeker, and the autopilot's
  intercept
- **Gated on what the pilot can see** — structures are briefed, aircraft need live line
  of sight, launchers need line of sight or to have been found already, so masking
  hides the threat from you as well as you from it
- **Off-boresight steering chevron** when the designated target is not on the glass
- A lock drops itself the moment its target dies, so the HUD never brackets wreckage

### Flight & Combat
- **Bank to turn.** Hold `A`/`D` and the jet turns; add `W` and it tightens. A turn assist holds the wing
  at its limit without stalling it, an upright bank stops at 75°, and loops, Immelmanns and Split-S go
  over the top (pitch folds through vertical instead of hitting a wall)
- **A death you can read.** The cockpit holds for 2.6 s in slow motion with `MAYDAY - AIRFRAME LOST` and
  the killer named, before the deck
- **Fair guns.** A fighter needs 0.7 s of solution before it fires and you get a `GUNS TRACKING` warning;
  60% of bursts hit
- **First-time milestones** — `FIRST BLOOD!`, `FIRST TRAP`, `CHAFF SAVED YOU`, `OVER THE TOP`
- **Fixed-timestep 6-DOF flight dynamics** at 120 Hz — lift, drag, thrust, gravity, and dynamic angle of attack
- **Aerodynamic stall** past α ≈ 18°, collapsing control authority to 22%
- **Induced drag scaling with G-load**, so hard turns genuinely bleed energy
- **Afterburner** with 3.5× fuel burn and a 4× thermal signature
- **Battle damage model** — degrades control authority and opens fuel leaks
- Four weapons with real ballistics and guidance: 20mm Vulcan, AIM-9 Sidewinder, Mk.82 iron bombs, AGM-88 HARM

### Sensors & Stealth
- **Radar line-of-sight raycasting** against the terrain heightfield
- **Terrain masking, both ways** — drop below a ridge and the lock breaks, killing
  missiles mid-flight; the same ray march decides what your own scope is allowed to offer
- **Radar cross-section modelling**: `RCS_eff = RCS_base × AspectFactor × (BayOpen ? 4.0 : 1.0)`
- **Tactical radar** (heading-up, 12 km): the carrier with its distance (`CV 8.4NM`), every live bandit as a
  red triangle pointing the way it flies, hardened objectives as yellow diamonds, your designated target
  ringed, and SAM warnings (`SEARCH` → `TRACK` → `LAUNCH`) as an arc on the rim toward the site
- **Lethal SAMs** with swept-sphere proximity fuzing that cannot tunnel through you at Mach 1.5

### Carrier Operations
- Deck crew stamina and task scheduling — fatigue delays your scramble
- Full aircraft state machine: `HANGAR_MAINTENANCE` → `ARMING_REFUELING` → `CATAPULT_READY` → `CATAPULT_LAUNCHING` → `AIRBORNE` → `RECOVERY_TRAP` → `DAMAGED_REPAIR`
- **Rush the turnaround** (`R`) — push the crew past their ordinary pace for an
  immediate jump in progress, paid for in the stamina that pace depends on, so
  it costs *the next* turnaround too. The deck's only choice used to be made
  once, before the cat shot; this gives the rest of it one
- **Procedurally escalating strike waves** from a seeded PRNG after the scripted opening act
- Graded arrested recoveries (1–4 wire, or a bolter) feeding a score and rank ladder

### Mobile
- **Touch mode built on the autopilot and designation**, not a separate game:
  same flight model, same missions, reached with two thumbs
- **A virtual stick that centres where your thumb lands**, with each pointer
  bound to the control it touched down on for the life of the gesture
- **Tap a contact to designate it** — on any device, mouse included
- **A third pure layout solver** for thumb placement, tested for overlap,
  reachability and a clear centre across seven handsets
- **The instruments know the controls exist**: the HUD and deck solvers take a
  reserve and shed what will not fit rather than drawing over a button
- Safe-area insets, landscape prompt, audio unlock on first touch, and no
  scroll, zoom or rubber-band

### Feel & Juice
- **3D Vector Line Fragmentation Debris**: Exploding aircraft and SAM sites shatter into 10–16 physics-driven wireframe line segments with outward blast impulses (15–40 m/s), gravity, drag, terrain bouncing, and phosphor alpha fading over 1.2s
- **Padlock Target-Tracking Camera (`V`)**: Slaves the pilot's view to the designated contact within human canopy limits (±110° azimuth, -30°/+60° elevation) with 250ms ease-out cubic transitions
- **Arcade 5-Second Time Rewind (`Backspace`)**: Zero-allocation circular buffer of flight telemetry allowing recovery from terrain impacts and flight stalls (2 uses per sortie)
- **Camera shake** on a trauma model — squared amplitude, so a cannon round and
  a missile strike read as different events — applied to the camera only, never
  to the flight model
- **Rounds wound rather than instantly kill**: ~4 hits for a fighter, ~9 for a
  bomber, inside a 12 m radius, with a hit marker and a tick per round
- **Kill callouts** (`SPLASH ONE`, `SAM DOWN`, `3-WIRE`) in their own channel,
  capped so a furball cannot bury the screen
- **The trap gets its moment**: the camera holds in the cockpit, the wire grade
  stamps over the deck, and the arresting gear is the loudest sound in the game
- **Impact flash** — red when something hits you, green when you kill something

### Sound & Avionics
- **Synthesized Cockpit Voice Warnings ("Bitchin' Betty")**: Native browser speech synthesis tuned to 1980s military avionics (female voice, priority queue, 4.0s de-bounce) announcing `MISSILE LAUNCH`, `PULL UP`, `STALL WARNING`, and `BINGO FUEL`
- **A real mix**: every voice runs `[panner] → category bus → master →
  compressor → out`. Nothing connects to the output directly, so a busy fight
  compresses instead of clipping
- **Stereo placement and distance attenuation** for world events — a SAM firing
  off your left wing is information, not noise. Verified in-browser: right wing
  `+0.85`, left `−0.85`, dead ahead `0`, out of earshot culled entirely
- **Alerts cut through**: the RWR and master caution sit on the loudest bus, the
  engine and airflow beds on the quietest
- **A threat drone generated from the tactical situation** rather than composed,
  so the tension is always telling the truth
- **Airflow over the canopy** scaled by airspeed, and a **pre-stall buffet** that
  starts before the wing lets go
- **Incoming fire has its own voice** — it used to play your own cannon sound,
  so being shot at and shooting were indistinguishable
- Still zero audio assets: every sound is oscillators and noise buffers

### Defence & Arsenal
- **A SAM you can out-fly.** The missile flies lead pursuit under a *bounded turn rate* (0.25 rad/s),
  tuned by measurement: fly straight and you are hit; break hard at once against a distant launch and
  you live for free; break late against a close one and you still die — so chaff has a job
- **Chaff (`X`)** always breaks the lock, 12 cartridges a sortie, with a recycle delay so it cannot be
  held down. A decoyed site cannot re-launch while the cloud is up
- **Time-to-impact** on the warning banner, and a muted `X` on the radar once a lock is broken
- **AGM-88 HARM (`4`)** locks the nearest *radiating* site with no boresight cone. If the site shuts
  down mid-flight the round goes ballistic and misses — bait it into emitting, then kill it
- **A post-mortem** on the failed debrief: what killed you, and one line on what to do differently

### Presentation & Readability
- **One screen style** — no look to choose before flying
- **Device-pixel-accurate canvas** — the backing store is scaled by `devicePixelRatio`
  so symbology stays sharp on HiDPI displays
- **Phosphor persistence** — vectors decay with a frame-rate-independent time constant
- **Additive bloom pass** with a `multiply` pseudo-threshold, at ¼ resolution
- Distance haze, horizon ring, and a scrolling sea lattice for depth and motion cues
- **A field of view that is an angle, not a pixel count** — every screen sees the
  same slice of the world vertically, and a wider one sees more to the sides
- **Decluttered HUD labels** — contact range tags are placed nearest-first around
  their bracket, never stacking on each other or covering an instrument
- **Flash-safe warnings** — nothing blinks faster than 2.5 Hz, inside the WCAG
  2.3.1 limit, and `prefers-reduced-motion` turns off the camera shake and damps
  the impact flash while leaving every warning lit
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
- **Per-mission records** — best score, completions and attempts for each scenario,
  with a cleared tick on the selector and a suggested mission to fly next
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
│   ├── MissionRecords.ts  # Per-scenario bests, completions and attempts (pure)
│   ├── DailySortie.ts     # Date-seeded run, result merge, share card (pure)
│   ├── Pacing.ts          # ARCADE / SIM deck timings and threat scaling (pure)
│   ├── ThreatLevel.ts     # CADET / REGULAR / VETERAN escalation offset (pure)
│   ├── Accessibility.ts   # Flash-rate cap and reduced-motion settings (pure)
│   ├── Platform.ts        # Control-scheme detection and override (pure)
│   ├── TouchInput.ts      # Pointer binding, stick and throttle demand (pure)
│   ├── Callouts.ts        # SPLASH ONE / SAM DOWN / 3-WIRE, with lifetimes (pure)
│   ├── Milestones.ts      # First blood / first trap / chaff save / first loop, persisted (pure)
│   └── ScoreKeeper.ts     # Scoring, trap grading, rank ladder
├── flight/
│   ├── AircraftPhysics.ts # 6-DOF aerodynamics, bank-to-turn, loops, stall, damage
│   ├── FlightAssist.ts    # MANUAL / ASSIST / AUTOPILOT control laws (pure)
│   ├── TerrainFollowing.ts # Look-ahead ground clearance for the autopilot (pure)
│   ├── ApproachGuidance.ts # Glideslope, lineup and the handover point (pure)
│   └── Weapons.ts         # Ballistics, homing, explosions
├── tactics/
│   ├── TerrainProfiles.ts # The three maps: height functions + SAM order of battle
│   ├── RadarLOS.ts        # Terrain, SAM sites, LOS raycasting, RCS, RWR
│   ├── StrikeTarget.ts    # Hardened ground targets and their hit geometry
│   ├── TargetDesignation.ts # Target ranking, weapon envelopes, pursuit nav (pure)
│   ├── Visibility.ts        # What the pilot can see and has learned (pure)
│   └── EnemyAI.ts         # INGRESS / ENGAGE / RTB behaviour
├── carrier/
│   └── DeckManager.ts     # Inventory, crews, state machine, threat director
├── renderer/
│   ├── VectorRenderer.ts  # 3D pipeline: camera transform, near-plane clip, projection
│   ├── PostProcess.ts     # Phosphor persistence + bloom compositor
│   ├── CameraShake.ts     # Trauma model for cockpit shake (pure, view-only)
│   ├── LabelDeclutter.ts  # Pure HUD label placement and keepouts
│   ├── TouchLayout.ts     # Pure thumb-control placement and hit-testing
│   ├── TouchControls.ts   # Thumb-control chrome and the rotate prompt
│   ├── Theme.ts           # Colour tokens, typography, panel/keycap primitives
│   ├── DisplayMode.ts     # the single screen style (canvas + CSS effects)
│   ├── HudLayout.ts       # Pure cockpit instrument placement solver
│   ├── HUD.ts             # Objective strip, pitch ladder, FPM, tapes, tactical radar, landing aids
│   ├── RadarMath.ts       # Heading-up radar projection (pure)
│   ├── DeckLayout.ts      # Pure responsive panel solver
│   ├── DeckView.ts        # Flight deck instruments
│   └── BriefingScreen.ts  # Boot sequence, briefing, help, debrief
├── audio/
│   ├── AudioMix.ts        # Bus levels, spatialisation, beds (pure)
│   └── SoundFX.ts         # Web Audio synthesis and the bus graph
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

**989 headless tests** across 55 suites — physics, ballistics, radar/RCS, carrier state machine, enemy AI, deck and cockpit layout geometry, scoring, personal bests and per-mission records, the tutorial rules engine, the objective director, the display-mode ladder, theme contrast ratios, text fitting, scenario phase progression and end conditions, mission recommendation, hardened-target hit geometry, CCIP prediction against the real bomb path, map navigability invariants, the flight-assist control laws, target ranking and weapon envelopes, ops-tempo timings, camera-shake decay, callout lifetimes, the daily seed and share card, mix structure and audio spatialisation, control-scheme detection, thumb-control placement across seven handsets, multi-touch input binding, field-of-view consistency across screen sizes, HUD label decluttering, flash-rate and reduced-motion limits, designation visibility rules, terrain-following geometry, carrier approach guidance, rushed-turnaround stamina accounting, palette contrast under a colour-blindness simulation, threat-level escalation, the timestep accumulator, projection math (including the camera transform's agreement with the flight model's own orientation basis, and that a bank tilts the horizon and the lift the right way), bank-to-turn and loops through the vertical, the tactical radar geometry, the first-time milestone latch, the enemy guns aim-time and hit chance, and a full GameLoop integration smoke test that drives every phase through a stubbed Canvas2D context.

Some of those tests exist because they are the cheapest way to state a rule the
game would otherwise break silently: every map must have a navigable corridor
and a place to mask; the terrain floor must save a dive that the flight model
can actually recover from; and the same suicidal input must lose the airframe at
`MANUAL` and survive at `ASSIST`.

The renderer's pure math is deliberately extracted (`depthFade`, `decayAlpha`, `computeDeckLayout`, `gradeTrap`, `warmupEnvelope`) specifically so it can be verified without a browser.

### In a real browser

```bash
npm run playtest              # 28 checks, screenshots + report in playtest-output/
PLAYTEST_SLOW=1 npm run playtest   # adds the 40-second idle-on-deck check
```

Unit tests prove what the code does; they cannot see the screen. Five review
suites and 921 green tests missed four HUD elements printed on top of each other,
because nothing ever looked at a frame. `scripts/playtest.mjs` starts its own
dev server and plays the first session in headless Chromium - desktop, laptop,
two phones, portrait, and a forced crash - asserting what a player would feel
(a new pilot on the small HUD, no contradictory orders, a held bank that
actually turns, chaff that works on a phone, a crash that shows a recovery
screen). Run it before every release; it is not in the deploy gate because its
turn-rate check is timed against the wall clock.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | The implementation plan behind the current revision |
| [docs/APPROACH_AND_METHOD.md](docs/APPROACH_AND_METHOD.md) | Design philosophy, dual-loop architecture, rendering pipeline |
| [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) | Mathematical reference: constants, formulas, coordinate system |
| [docs/GUIDELINES.md](docs/GUIDELINES.md) | Contributor rules — dependency policy, palette, testing discipline |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Known limitations and deliberate trade-offs (Issues #1–#82, status summary at the top) |
| [docs/FUN_REVIEW.md](docs/FUN_REVIEW.md) | Design review of workflow, story and UX — what was changed to make it more fun, and what is still open |
| [docs/AI_DESIGN_REVIEW.md](docs/AI_DESIGN_REVIEW.md) | Executive summary of AI design review, playtest findings, and initial roadmap |
| [**docs/reviews/v1.10.0/**](docs/reviews/v1.10.0/README.md) | **Current suite** — how the v1.9.0 review was implemented, measured first. Start with [IMPLEMENTATION_REPORT.md](docs/reviews/v1.10.0/IMPLEMENTATION_REPORT.md) |
| [docs/reviews/v1.9.0/](docs/reviews/v1.9.0/README.md) | The first browser-instrumented playtest review |
| [docs/reviews/](docs/reviews/README.md) | Review hub: version registry, score trend, and the standing rules every review must follow |
| [docs/reviews/REVIEW_TEMPLATE.md](docs/reviews/REVIEW_TEMPLATE.md) | Standardized **12-dimension** evaluation protocol (cut from 25 in v1.9.0) |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Future Roadmap

Shipped in v1.10.0 ("Built, Measured, Launch-Ready") - the v1.9.0 review,
implemented after measuring each recommendation first:
- **The jet flies the way it looks.** A physics defect - stability acting about
  the world axis instead of the airframe's - let a banked nose drift 43° above a
  descending flight path. Fixed; with the ARCADE airframe a held bank now turns
  at 12 °/s with the nose on the horizon.
- **The recovery assist works**: it hands over within a metre of the glideslope
  (it used to ride 34 m low, or fly into the sea).
- **FIRST FLIGHT HUD and brief deck** for new pilots, a steering cue instead of a
  compass and radar, missile carets, a guns-tracking tone.
- **No free bombs, no misplaced clicks, no false alarms, no two orders at once.**
- **Pilot-customer ready**: touch chaff and HARM, AZERTY-safe keys, a crash
  screen instead of a frozen image, and a versioned feedback link.

See the [v1.10.0 suite](docs/reviews/v1.10.0/README.md).

Shipped in v1.9.0 ("Look at the Pixels") — the first release driven by a
browser-instrumented playtest rather than a source review:
- **Four pairs of HUD elements were being drawn into the same rectangle.** The
  mission order printed through the compass tape; the pill bar, the assist
  annunciator and the keycap strip shared one 35 px band; the score sat under the
  `DECK` button; help-overlay labels ran into the next column. All fixed, and the
  band stacks are now derived and covered by disjointness tests.
- **The default HUD had no artificial horizon.** ARCADE suppressed the whole pitch
  ladder — including its zero rung — so a banked jet with the horizon off-screen
  had no attitude reference at all. A horizon bar with a signed pitch readout is
  back.
- **`TOO FAST FOR THE TRAP` fired on every launch**, contradicting the objective
  strip above it and stalling beginners who obeyed it. It now requires an actual
  approach.
- **The "zero combat hostiles" training sortie took 15% of your carrier's hull at
  T+20s.** `combatShielded` is now honoured by the deck's damage path.
- Shorter control labels throughout, from the single source of truth.

See the [v1.9.0 review suite](docs/reviews/v1.9.0/README.md).

Shipped in v1.8.0 ("Visceral Feedback & Beginner Accessibility"):
- Smart target auto-acquisition in `ASSIST` (initial threat lock on takeoff) and `AUTO` (continuous pursuit navigation) modes so beginners don't fly past enemies without locking on.
- 3.8× increase in kill-confirmed screen shake and expanded 28-fragment 3D vector debris with 50 m/s explosive dispersal for visceral dogfight feedback.
- Anti-stall cruise throttle protection in `ASSIST` mode preventing stalling when cruising if the pilot has not intentionally retarded throttle.
- HUD decluttering in `ARCADE` mode (intuitive `FUEL %` instead of engineering liters).
- Prioritized emergency warnings over tutorial instructions, while tutorial prompts take priority over routine tactical notices.
- Default first-sortie routing to `TRAINING_SORTIE` on browser start for first-time pilots.

Shipped in v1.7.0: Increased the size of the radar for readability, added a comprehensive review on balancing complexity with entertainment for beginners (`docs/reviews/review-v1.7.0.md`).

Shipped in v1.6.0 ("Turn and Burn"): banking turns the jet (and the orientation bug that pushed lift the
wrong way is fixed), loops and Immelmanns work, a real tactical radar, a slow-motion death sequence that
names the killer, fairer enemy guns with a warning, attack coaching, and first-time milestones. See the
[changelog](CHANGELOG.md) and the [review corrections](docs/reviews/v1.6.0/IMPLEMENTATION_AND_CORRECTIONS.md).

Next - see the [v1.10.0 roadmap](docs/reviews/v1.10.0/RECOMMENDATIONS_AND_ROADMAP.md):

1. **A pilot-customer feedback round, before any new feature.** No new human has
   played v1.10.0. The in-game FEEDBACK link opens a pre-filled report; five new
   players, no instructions, verbatim first-two-minute reactions.
2. **A FIRST FLIGHT briefing** - the last dense screen a new pilot meets.
3. **The browser harness in CI**, non-blocking, once its turn check is
   simulation-timed.
4. **A SIM airframe pass** (#82) and a decision on the deck loop's depth.

---

## Keywords

`vector graphics game` · `retro flight simulator` · `CRT phosphor effect` · `wireframe 3D renderer` ·
`TypeScript game development` · `HTML5 canvas game` · `6-DOF flight dynamics` · `aircraft carrier simulation` ·
`radar terrain masking` · `radar cross section` · `browser game no engine` · `linear algebra 3D projection` ·
`fixed timestep game loop` · `procedural terrain` · `Web Audio synthesis` · `1980s arcade aesthetic` ·
`flight assist control laws` · `tactical autopilot` · `target designation` · `terrain avoidance` ·
`mission scenarios` · `CCIP bombing cue`

## License

MIT — see [LICENSE](LICENSE).
