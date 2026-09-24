# Knowledge Base — Mathematical & Domain Reference

Quick-reference sheet for every constant, formula and identifier in the simulation.

---

## 1. Domain Summary

CV-68 operating in the Norwegian Sea, 1988. The player alternates between macro
flight-deck logistics and micro 3D vector sorties. Soviet strike packages (MiG-23
Flogger escorts, Tu-22M Backfire bombers) approach on a timeline; unintercepted
packages damage the carrier. Ground SAM sites (SA-6 Gainful, SA-8 Gecko, SA-11
Gadfly) defend the canyon corridor.

*(Note: Future AI-assisted development will evolve this static setup into a node-based, persistent Rogue-lite campaign as outlined in `docs/AI_DESIGN_REVIEW.md`.)*

## 2. Coordinate System

Right-handed, metres:

| Axis | Direction |
| --- | --- |
| `+X` | East |
| `+Y` | Up (MSL = 0) |
| `+Z` | North |

Heading `ψ = 0` faces `+Z`. Pitch `θ > 0` is nose-up. Roll `φ > 0` is right-wing-down.
Carrier deck surface sits at `y = 20 m`, centred on the world origin.

## 3. 3D Projection Pipeline

### Camera transform (world → camera)

Translate by `−camPos`, then project onto the camera's own orthonormal basis —
the **same** right / up / forward vectors `AircraftPhysics` uses for lift, thrust
and drag:

```
d      = p − camPos

forward = ( cosθ·sinψ,                  sinθ,        cosθ·cosψ )
up      = ( −sinφ·cosψ − sinθ·sinψ·cosφ, cosθ·cosφ,  sinφ·sinψ − sinθ·cosψ·cosφ )
right   = ( cosφ·cosψ − sinθ·sinψ·sinφ, −cosθ·sinφ, −cosφ·sinψ − sinθ·cosψ·sinφ )

x_cam = d · right      y_cam = d · up      z_cam = d · forward
```

**Why not three composed rotation matrices?** Because that is what it used to be,
and the composition had the sign of pitch and roll backwards — it rotated by
`−θ` and `−φ` where world→camera needs `+θ` and `+φ` (only the yaw term was
right). The consequences were severe and long-lived:

- pulling the nose **up** moved the terrain and horizon **up** the screen;
- rolling right rolled the world right instead of left;
- the pitch ladder — which is derived correctly from `fov·tan(Δ)` — drew its
  horizon rung exactly as far *below* screen centre as the real 3D horizon was
  *above* it, i.e. `2·fov·tan(θ)` apart;
- the flight path marker sat on the wrong side of the horizon in level flight.

Deriving the transform from the physics basis makes the view agree with the
flight model by construction. `VectorRenderer.test.ts` asserts the equality
directly, so the class of error cannot return. The basis is memoised per frame
(the angles are constant across a frame's thousands of `drawLine` calls).

### Near-plane clipping

`z_near = 2.0 m`. Segments entirely behind are rejected; straddling segments are
interpolated at `t = (z_near − z₁)/(z₂ − z₁)`.

### Perspective divide

```
x' =  x·f/z + x₀        f (focal length / fov) = 380
y' = −y·f/z + y₀        (Y inverted for canvas space)
```

### Mesh world transform

Object-space points are placed using basis vectors derived from the mesh's own
pitch/yaw/roll, matching `AircraftPhysics`' convention:

```
forward = ( cosθ·sinψ,  sinθ,  cosθ·cosψ )
up      = (−sinφ·cosψ − sinθ·sinψ·cosφ,  cosθ·cosφ,  sinφ·sinψ − sinθ·cosψ·cosφ )
right   = ( cosφ·cosψ − sinθ·sinψ·sinφ, −cosθ·sinφ, −cosφ·sinψ − sinθ·cosψ·sinφ )

world = worldPos + local.x·right + local.y·up + local.z·forward
```

With `θ = φ = 0` this reduces exactly to the original yaw-only two-term rotation.

### Distance haze

```
fade = 1 − (z − 600)/(8000 − 600) · (1 − 0.12),  clamped to [0.12, 1.0]
lineWidth' = lineWidth · (0.6 + 0.4·fade)
```

`FAR_FADE = 8000 m` matches `TacticalTerrain`'s draw-cull distance so lines fade
out rather than popping.

## 4. Flight Aerodynamics

### Constants

| Symbol | Value | Meaning |
| --- | --- | --- |
| `g` | 9.80665 m/s² | Gravity |
| `α_crit` | 18° | Critical angle of attack |
| `T_mil` | 95,000 N | Military thrust |
| `T_ab` | 145,000 N | Full afterburner thrust |
| `S` | 38.0 m² | Wing area |
| `ρ₀` | 1.225 kg/m³ | Sea-level air density |
| — | 1.6 L/s | Base fuel burn at 100% military |
| — | 3.5× | Afterburner burn multiplier |
| — | 11,000 kg | Empty mass |

### Atmosphere and dynamic pressure

```
ρ = ρ₀ · e^(−y/8500)
q = ½ · ρ · v²
```

### Angle of attack

```
α = −asin( v̂ · û_up )          (or the nose angle if flying backwards)
```

### Lift and drag

```
C_L = clamp(α° × 0.085, −1.0, 1.6)        non-stalled
C_L = sign(α) × 0.25                       post-stall

C_Di = C_L² / (π · e · AR)                 e = 0.78, AR = 3.5
C_Di × = 1 + (G − 1)^1.8 × 0.35            when G > 1.5
C_D  = C_D0 + C_Di + (stalled ? 0.25 : 0)  C_D0 = 0.024, +0.035 if bay open

Lift = q · S · C_L                          along û_up
Drag = q · S · C_D                          opposite v̂
G    = |Lift| / (m · g)
```

### Stall & control authority

```
stalled       = |α| > α_crit
authority     = (stalled ? 0.22 : 1.0) × (1 − damage/100 × 0.6)
control rate ∝ authority × clamp(v/150)
```

### Battle damage

```
damage        ∈ [0, 100];  100 = airframe destroyed
fuelLeakRate  = damage/100 × 8.0 L/s
```

### Mass

```
m = 11,000 + fuel×0.8 + rounds×0.25 + sidewinders×86 + bombs×227   [kg]
```

## 5. Sensor Math

### Radar cross-section

```
RCS_eff = RCS_base × AspectFactor × (BayOpen ? 4.0 : 1.0)      RCS_base = 2.4 m²

AspectFactor = max(0.5, headTailFactor + |sin β| × 1.5)
```

Detection range scales with the fourth root (radar range equation):

```
range = range_base × (RCS_eff / RCS_base)^0.25
```

Base ranges: search 12,000 m · track 7,500 m · launch 5,000 m.

### Line of sight

Ray-marched from radar to aircraft in 40 m steps; occluded if the ray dips below
the interpolated terrain elevation at any sample. Occlusion sets
`STATUS: TERRAIN MASKED`, forces RWR to `SILENT`, and **kills any missile in flight**.

The same function runs the other way, from the aircraft to each contact, to
decide what the player's own scope may offer — see §7e.

### Missile proximity fuze (swept sphere)

Closest point on the travel segment `A → B` to aircraft `P`:

```
t* = clamp( ((P − A) · (B − A)) / |B − A|² , 0, 1 )
missDistance = | A + t*(B − A) − P |

hit    if missDistance ≤ 40 m
damage = 55 × (1 − missDistance/40)
```

**Why segment-based:** at 480 m/s with `dt` clamped to 0.1 s the missile advances
48 m per tick — greater than the fuze radius — so an end-of-tick distance check
would tunnel straight through the target.

## 6. HUD Symbology

World-referenced symbols derive their scale from the renderer's focal length:

```
screenOffset = fov · tan(Δangle)
```

Nose-up is positive pitch, so the horizon rung lands **below** screen centre — and
because the camera transform is now derived from the same orientation basis, it
lands exactly on the real 3D horizon. The flight path marker projects a probe
point 5,000 m along `v̂` through the actual camera pipeline, so it sits on the
true flight path (and therefore on the horizon rung in level flight).

### Instrument placement

`solveHudLayout()` (pure, in `renderer/HudLayout.ts`) places the cockpit blocks
left-to-right from the actual viewport rather than at fixed offsets from screen
centre, and gives the pitch ladder whatever half-width is left in the middle:

```
railRight = edge + (checklist shown ? 196 : 0)
speedX    = cx − symHalf − gap − speedW        (clamped right of the rail)
symHalf   = clamp( cx − speedX − speedW − gap, 86, 205 )
altX      = min( width − edge − altW, cx + symHalf + gap )
ladder geometry scales by symHalf / 205
```

The checklist is dropped below 1150 px wide and the systems panel becomes a
one-line bottom strip below 560 px tall, since neither fits alongside the centre
instruments. Tests assert no two centre-line instruments overlap and none leaves
the viewport, across a 10 × 7 × 2 matrix of sizes.

### Guidance

| Channel | Question it answers | Module |
| --- | --- | --- |
| Objective strip / orders panel | What is this phase asking of me, and which key does it? | `core/Objectives.ts` |
| Coach ticker | What is about to kill me? | `core/Tutorial.ts` |
| Flight checkout | Which controls have I proved I can use? | `TrainingSequence.checklist()` |
| Designation bracket | Which thing have I chosen, how far is it, what kills it? | `tactics/TargetDesignation.ts` |
| Assist annunciator | Which protection is flying the aeroplane right now? | `assistCaption()` in `renderer/HUD.ts` |

The designated target draws a solid box in the key colour (amber when the
current geometry actually supports a shot) with `NAME · RANGE · WEAPON`
underneath; off the glass it becomes a chevron on the boresight ring plus a
`TURN LEFT / RIGHT` line. That is deliberately a different shape from both the
air-contact corner brackets and the strike-target diamond, so three kinds of
"something is there" never read as one.

The assist annunciator is silent for `LEVEL` and `NONE`, and fires only once a
protection takes more than 0.02 of stick authority. Auto-levelling happens on
every frame the stick is centred; a caption for it would be permanently lit, and
a permanently lit annunciator is one the pilot has learned to ignore by the time
it says `TERRAIN — AUTO PULL-UP`.

The objective strip reserves 150 px on each side of itself so it cannot run
underneath the score chip in the same band — the two collided below ~1000 px.

Contextual coach rules outrank the training prompt. The reverse ordering — which
shipped — suppressed stall, terrain and missile warnings for a first-time
pilot's entire first sortie. The HUD also suppresses the ticker when the warning
banner already covers the same cause, so one condition never produces three
simultaneous messages.

### Carrier approach

```
glideslope   = 3.5°
desiredAlt   = 20 + tan(3.5°) · rangeToShip
ballIndex    = clamp( round( (alt − desiredAlt) / 6 ), −2, +2 )
AoA on-speed = 8.1° ± 1.2°
```

### Trap envelope and grading

| Condition | Value |
| --- | --- |
| Range to boat | < 190 m |
| Altitude | 17–30 m |
| Airspeed | < 95 m/s |

Wires modelled at `z = −120, −110, −100, −90`; touchdown outside `[−125, −85]` is a bolter.

## 7. Carrier Logistics

### State machine

```
HANGAR_MAINTENANCE  (18 s, MECHANIC)
  → ARMING_REFUELING (14 s, min of FUEL/ORDNANCE crew speed)
  → CATAPULT_READY
  → CATAPULT_LAUNCHING (2.5 s stroke)
  → AIRBORNE
  → RECOVERY_TRAP (3.0 s de-rig)
  → HANGAR_MAINTENANCE | DAMAGED_REPAIR (30 s)
```

Crew stamina scales task speed by up to 60%. `DeckManager.catapultTimer` is the
single authoritative launch clock.

### Rushing a turnaround

The deck's one real decision was made once, in the seconds it takes to set
fuel and ordnance, and everything after that was watching a progress bar with
nothing left to choose. `DeckManager.rushTurnaround()` gives the rest of the
turnaround a second axis: a choice with a cost, paid in the currency the deck
already spends.

```
crewsWorking(HANGAR_MAINTENANCE | DAMAGED_REPAIR) = { MECHANIC }
crewsWorking(ARMING_REFUELING)                    = { FUEL, ORDNANCE }
crewsWorking(anything else)                       = {}   -> NO_ACTIVE_TASK

rush, all crews above minStaminaToRush (20):
    progress += 20   (capped at 100)
    each crew.stamina -= 30
rush, any crew at or below the floor:
    refused: CREW_EXHAUSTED, nothing changes
```

Gated on stamina **headroom**, not a per-task "already rushed" flag.
`aircraftState` enters a task-bearing state from half a dozen call sites (a
clean trap, a damaged trap, a lost airframe with or without a spare, the
arcade fast-respawn path in `GameLoop.replaceAirframe()`), and a flag would
need resetting at every one - miss one and rushing either never works or
never stops working. "Can this crew's stamina absorb it right now" is the
same rule stated once instead of six times, and it composes for free with
stamina's own regeneration: a crew that has recovered past the floor can be
pushed again with no separate bookkeeping about which task it was pushed for.

The immediate `+20` is close to a free win on its own; the real cost is that
the same crews keep working the task afterward at their now-lower stamina, so
a rush trades a burst of progress now for slower throughput for the rest of
that task and the one after it. `canRush()` is the read-only half, used to
show or hide the `R  RUSH IT` hint on the deck screen - hidden rather than
greyed out once the crew is spent, since an action that would silently fail
is worse advertised than not shown at all.

### Consequence accounting

| Event | Effect |
| --- | --- |
| Tu-22M reaches the carrier | −35% hull, −1 airframe |
| MiG-23 reaches the carrier | −15% hull |
| Dry-tank trap | −1 airframe, −10% hull, → `DAMAGED_REPAIR` |
| Terrain impact / destroyed | −1 airframe |
| Hull reaches 0% | `missionState = 'FAILED'` |

### Procedural waves

Deterministic `mulberry32` PRNG. Per wave `n`:

```
packages     = min(4, 1 + ⌊n/3⌋)
baseEta      = max(80, 200 − 8n)   seconds
bomberChance = min(0.5, 0.15 + 0.03n)
migCount     = 1 + ⌊rng × min(3, 1 + ⌊n/2⌋)⌋
```

## 7b. Scenarios

*(Note: Currently, scenarios are isolated missions. Future AI-assisted updates will transition this architecture to support persistent state management for a Rogue-lite campaign.)*

Five selectable missions, each a `ScenarioDef` in `core/Scenarios.ts`.

| Mission | Setup | Ends when |
| --- | --- | --- |
| `CARRIER_DEFENSE` | Endless escalating waves; the flight checkout runs | Hull reaches 0% (no scripted phases — score chase) |
| `CANYON_STRIKE` | Quiet sky, 2x Mk.82, hardened pen at `z = 10 400`, 240s window | Pen destroyed **and** trapped aboard; fails on the window, the hull, or running the boat out of jets |
| `IRON_HAND` | Flown on `KVITOYA_RIDGES`; 12 bombs in stock, one late CAP package | All four launchers dead **and** trapped aboard |
| `LAST_STAND` | Flown on `OPEN_SEA`; five packages at once, hull at 70%, 2 spares, wave 6 escalation | Every package resolved **and** trapped aboard |
| `CARRIER_QUALS` | Flown on `OPEN_SEA`; starts airborne, no SAMs, no contacts, clean jet | 3 traps including at least one 3-wire |

### The director

```
each tick:
  while phases[i].isComplete(snapshot): i++          (monotonic; several may pass at once)
  if i >= phases.length          -> SUCCESS
  else if failure(snapshot)      -> FAILED
```

Victory is tested **before** failure: both can become true on the same tick
(landing the last sortie on the last airframe), and a completed mission cannot
retroactively fail.

A phase without `onDeck` returns no objective while the jet is on deck, so the
deck's own director speaks there; the mission clock is carried across either
way via `MissionDirector.clock()`.

### Per-mission records

`core/MissionRecords.ts` keeps `{best, completions, attempts}` per scenario id.
A finished run is folded in by a pure merge; a **losing** run still counts as an
attempt and can still set a best, because surviving nine waves before dying is
a real result. `recommendScenario(records)` returns the suggested next mission:
the flight-checkout scenario when nothing has ever been flown, otherwise the
easiest uncleared one (preferring one already attempted), and once everything is
cleared, the hardest.

### The daily sortie

`core/DailySortie.ts`. The seed is the UTC date as an integer
(`YYYY*10000 + MM*100 + DD`), fed to the existing `mulberry32` wave director,
so two players on the same day get an identical campaign and consecutive days
do not resemble each other. The sortie number counts days from 2026-01-01.
Attempts are unlimited; the stored record keeps the best run whole (not a mix
of best figures from different attempts) and counts attempts, which the card
prints.

### Hardened targets

```
hit  <=>  hypot(impact.x - target.x, impact.z - target.z) <= hitRadius
```

The pen's radius is **55 m** against a SAM site's 180 m blast radius. That gap
is the entire difficulty of the strike mission: a lob from altitude cannot do
it, so the delivery has to be low, fast and aimed.

### CCIP

`WeaponsSystem.predictBombImpact()` runs the same semi-implicit integration the
live bomb uses, from the same release state (`y - 1.5`, `vel.y - 5`), stepping
at 1/30 s until it crosses the terrain. Tested against a real dropped bomb:
agreement within 25 m, comfortably inside the 55 m hit radius.

## 7c. Maps

`tactics/TerrainProfiles.ts`. A map is `{heightAt(x,z), sams, corridorHalfWidth,
corridorLength}`. `TacticalTerrain` samples `heightAt` into its 40x50 grid at
250 m per cell, and `SensorTacticsManager` builds its launchers from `sams`.

| Map | Height function | Sites |
| --- | --- | --- |
| `FJORD` | Flat slot inside \|x\| < 500 (h ≈ 15 ± 10), walls rising as `((\|x\|−500)/2000)^1.3 × 900`, capped at 1800; passes where `sin(0.0012 z) > 0.7` cut height to 35% | 3 |
| `OPEN_SEA` | Four cosine domes (`h = peak/2 × (1 + cos(πd/r))`) plus a ±3 m swell | 2, ship-borne, on open water |
| `SHATTERED_RIDGE` | Ridges every 1800 m of z, crest 620 ± 200, gap centre walking as `1000 sin(1.7 n)`, notch `0.12 + 0.88 (d/800)²`, faded in by `clamp((z−2200)/1200)` | 4 |

Invariants enforced by `TerrainProfiles.test.ts` for every map: heights finite
and non-negative; a clear approach tube along the deck centreline; a continuous
corridor under 220 m at least 300 m wide from the boat to the far end; SAM sites
above the waterline; and somewhere on the corridor a place where terrain masks a
site. `OPEN_SEA` is exempt from the last one by design, which is why the
flight-checkout scenario is not flown there — its "descend until the RWR goes
silent" step would be unsatisfiable.

## 7d. Flight assist

`flight/FlightAssist.ts`. Pure control laws; `GameLoop.applyFlightInput()` turns
the keyboard into a `PilotInput`, resolves it, and feeds the result to the same
`applyPitchInput` / `applyRollInput` / `applyYawInput` the player was using.

```
stall limiter   gate = 0.6 × αlimit (αlimit = 0.26 rad)     SYMMETRIC
                pull, α ≤  gate     -> pass through
                pull, α >  gate     -> demand × (αlimit − α)/(αlimit − gate)
                push, α ≥ −gate     -> pass through
                push, α < −gate     -> demand × (αlimit + α)/(αlimit − gate)
                stalled, α ≥ 0      -> min(demand, −0.6)   (push to unload)
                stalled, α <  0     -> max(demand, +0.6)   (pull to unload)

terrain floor   onApproach          -> pass through
                agl ≤ 70            -> max(demand, 1)
                t_impact = (agl − 70)/sink
                byTime   = clamp((8 − t_impact)/4)
                byHeight = clamp(1 − (agl − 70)/110) × 0.6
                urgency  = max(byTime, byHeight)
                demand × (1 − urgency) + urgency

autopilot       bank    = clamp(Δψ × 1.5, ±maxBank);  roll = clamp((bank − φ) × 2.2)
                progress= 0.3 + 0.7 × min(1, |φ| / maxBank)
                rudder  = clamp(Δψ × 1.1, ±0.55) × progress
                pitch   = clamp(Δh × 0.0016 × max(0.25, cos φ), −0.8..0.9) − 0.8 θ
                throttle= clamp(ΔV × 0.05)
```

Three facts the laws are built around:

- **Time, not height, is what saves a dive.** A floor engaging at 180 m AGL has
  one second to work with at 60 m/s and a 1.35 rad/s pitch rate, which is not
  enough. Hence `t_impact`.
- **This flight model has no bank-to-turn yaw coupling.** `AircraftPhysics`
  changes `yaw` only through `applyYawInput`; banking tilts the lift vector and
  curves the flight path while the nose keeps pointing where it pointed. A
  bank-only autopilot therefore never captures a bearing, so the autopilot flies
  bank *and* rudder - but capped at 0.55 and led by the bank, because full
  deflection held for seconds at 220 m/s does not turn the aeroplane, it departs
  it: the nose leaves the velocity vector, α runs to π/2, and the wing lets go.
- **A stall has two signs.** `isStalled` is `|α| > αcritical`, so the wing can
  let go nose-low and unloaded just as readily as nose-high. Unloading means
  moving α toward *zero*; answering a negative-α stall with a push drives α
  further negative and flies the aeroplane into the ground with its own recovery
  law. Both halves of the limiter are therefore mirrored.

Order of authority: terrain floor > stall limiter > autopilot or pilot. A stall
at 2000 m is survivable; a controlled descent into a ridge is not.

**What the altitude hold does NOT do, and why.** It bleeds the pitch demand off
as bank increases, which looks backwards - a hard bank is where more back
pressure is needed to hold a flight path. It was replaced with a vertical-speed
loop that pulls whenever the jet is sinking faster than asked, and that version
flew into the sea far more reliably: in a sustained bank the pull rotates the
lift vector sideways rather than up, the sink does not stop, the loop pulls
harder, and α departs. The proportional law spirals gently instead, which the
terrain floor can catch. Bank is the variable that has to yield in a turning
descent, and it yields in whatever sets `maxBank`.

## 7d-i. Terrain following

`flight/TerrainFollowing.ts`. Ground clearance from `terrainFloor()` is
reactive - it works by pulling up once the ground is close - and a reactive law
can only ever climb OVER terrain. In a fjord that is the wrong answer: the ridge
it climbs is the one the SA-6 belt is watching.

The anticipatory half samples the track ahead and, for each sample, asks how
high the jet must be now:

```
reach        = clamp(V × 14 s, 1200 m, 7000 m)       14 samples along the heading
required_msl = elevation + clearance − climbRate × (distance / max(V, 60))
command_msl  = max(elevation_below + clearance, max over samples of required_msl)
clearance    = 200 m     climbRate = 22 m/s (assumed)
```

Near samples subtract almost nothing and dominate; far ones subtract a lot and
fall below the flat-ground answer, which is why the jet does not start climbing
for a mountain six kilometres out - and why the command collapses back to the
set clearance the moment a ridge is behind it.

Two details that are load-bearing:

- **The track is the heading, not the velocity vector.** In a banked turn the
  velocity vector is already swinging, and sampling along it makes the commanded
  altitude oscillate with the roll.
- **The assumed climb rate is below what the aeroplane can do.** A planner that
  assumes a climb rate it does not have is a crash, not a near miss. A test pins
  the relationship.

Applied as a REPLACEMENT for the commanded altitude against a ground target,
and only as a FLOOR on an air intercept - the bandit is where it is. Off
entirely on an approach, where a 200 m floor over a deck 20 m above the water is
a permanent go-around. `setClearance` sits just above `ASSIST_TUNING.floorAgl`
(180) so the follower and the floor are never arguing through the elevator.

## 7d-ii. The recovery assist

`flight/ApproachGuidance.ts`. Pure geometry; the carrier is at the world origin
with its deck along +Z, so the final approach course is a heading of zero, up
the wake from negative Z, and the wires are at Z −95..−115
(`ScoreKeeper.gradeTrap`).

```
rangeToWires  = touchdownZ − z            touchdownZ = −100 (the 3 wire)
glideslope(r) = 20 + tan(3.5°) × max(0, r)
phase         = outside corridor          -> JOIN      (a cue, not a hand-over)
                r ≤ 700                   -> HANDOVER  (the pilot lands it)
                otherwise                 -> FINAL
target_msl    = min(glideslope(r), 300)   then stepped: ≥ y − 160, or ≥ y in a turn
speed         = y > 300 + 250 ? 200 : 70
```

What the assist flies is the **ball and the speed** and nothing else: the
commanded heading is the jet's CURRENT heading, so the autopilot levels the
wings when the stick is centred and gets out of the way when it is not. Lineup
is the player's, with a `STEER LEFT` / `STEER RIGHT` call on the glass.

Four things this shape exists to avoid, each of which was observed:

1. **Levelling off at pattern altitude** rather than descending along the slope
   from wherever the jet started. A jet cannot descend steeply and decelerate at
   once - gravity down the flight path cancels the drag - so an assist that
   tried delivered the aeroplane to short final beautifully positioned and a
   hundred knots too fast for the wires. Levelling first turns one impossible
   task into two easy ones, and the slope is intercepted from below at ~4.6 km.
2. **Boards out.** The airframe has no speedbrake and settles near 170 m/s at
   idle on the slope; the weapons bay is the only drag device modelled, so the
   assist opens it above approach speed.
3. **The stepped descent**, and no descent at all beyond 0.3 rad of bank: turn,
   or come down, not both.
4. **No pattern join.** It was built, and it flew the jet into the sea from
   eight kilometres out with great consistency, for the reasons in §7d. Out of
   the corridor the assist gives directions instead.

## 7d-iii. Threat level

`core/ThreatLevel.ts`. Three settings, and the lever is where a scenario starts
on the escalation curve that wave generation already implements:

| | CADET | REGULAR | VETERAN |
| --- | --- | --- | --- |
| Wave offset | −2 | 0 | +4 |

Floored at wave 0, which is the hand-curated opening act. Deliberately not a
score multiplier - per-mission records stop meaning anything the moment the same
number can be earned three ways - and the daily sortie forces REGULAR for the
same reason it forces arcade pacing.

## 7e. Target designation

`tactics/TargetDesignation.ts`. For each candidate:

```
range     = |target − shooter|
bearing   = atan2(Δx, Δz) mod 2π            (same convention as yaw)
aspect    = (Δ · forward)/(|Δ||forward|)    (1 = dead ahead)
priority  = range / max(0.08, (aspect + 1)/2)
```

Envelopes: the Sidewinder wants an **air** target with `aspect ≥ 0.64`
(≈50° seeker FOV) at 300–8000 m; the gun wants `aspect ≥ 0.985` inside 1800 m
and never applies to a hardened structure. Ranking sorts on `priority`, ties
broken by id so the cycle order is stable frame to frame.

`pursuitNav()` turns a solution into an autopilot `NavTarget`: co-altitude for an
air intercept (floored at 260 m AGL, bank limit 1.15), 520 m AGL at 250 m/s with
a 0.8 bank limit for a ground attack run.

### What the scope is allowed to offer

`tactics/Visibility.ts` filters the candidate list before it is ranked. The rule
is per class, not uniform, because a uniform line-of-sight test would be wrong
in two directions at once:

| Class | Designatable when | Rationale |
| --- | --- | --- |
| `STRUCTURE` | always | briefed before the sortie; you know where the pen is |
| `AIR` | live line of sight | it moves, so a remembered position is stale in seconds |
| `SAM` | line of sight **or** discovered | it does not move; seeing it once, or being painted by it, is enough |

`VisibilityTracker` owns two sets: `visible`, rebuilt on each refresh, and
`discovered`, sticky for the sortie. A site enters `discovered` by being seen
with line of sight, or by appearing in `sensors.activeThreats` un-masked —
radiating at you tells you exactly where it is.

Line of sight is `SensorTacticsManager.checkLOS()` from the aircraft to the
contact: the same ray march the SAMs use against the player, which is what makes
masking symmetric. It is re-evaluated at most every `refreshSeconds` (0.12) and
cached in between — a 7 km look is ~175 terrain samples, and ten candidates every
frame at 60 Hz would be a hundred thousand lookups a second for an answer that
cannot change in 16 ms. The one exception: a contact the tracker has **never**
evaluated is resolved on the tick it appears, because the throttle may only serve
an answer it actually has. Without that, a package spawning mid-window stayed
undesignatable for up to 120 ms, long enough for the key to feel broken.

Measured in Chromium on BJORNFJORD: at 100 m AGL one of three launchers is
designatable; at 5 km, all three. Climbing buys you the picture and costs you
your own masking.

## 7f. Operational tempo

`core/Pacing.ts`. The deck-crew durations were literals inside
`DeckManager.update()`; they are now injected through `ThreatProfile.timing`
and default to the original numbers.

| | ARCADE (default) | SIM |
| --- | --- | --- |
| Hangar maintenance | 4 s | 18 s |
| Arming / refuelling | 5 s | 14 s |
| Battle-damage repair | 8 s | 30 s |
| Trap de-rig | 1.5 s | 3 s |
| Spare airframe after a loss | 3 s, straight to arming | full hangar cycle |
| Opening timeline ETAs | ×0.35 (150/280/440 → 53/98/154) | ×1 |
| Contact spawn distance | ×0.55 (8.3 km → 4.6 km) | ×1 |

Measured in Chromium, briefing to first kill: **ARCADE 9.6 s; SIM produced no
kill inside a two-minute budget.** Crew stamina still scales every task, so
these are nominal durations, not stopwatch guarantees.

## 7g. Camera shake

`renderer/CameraShake.ts`. Trauma model, applied to the camera angles in
`GameLoop.drawCockpitSim()` and to nothing else.

```
trauma' = clamp01(trauma - 1.35 dt)
shake   = trauma²
pitch   = sin(2π · 17.3 t) · 0.035 · shake
yaw     = sin(2π · 13.1 t + 1.7) · 0.030 · shake
roll    = sin(2π ·  9.7 t + 3.1) · 0.055 · shake

blast(d) = clamp01((1 - d/700)²· 0.6)
```

Squared amplitude is what separates a cannon round (0.05 trauma) from a hit
taken (0.55): linear amplitude made every event feel the same size. The three
rates are incommensurate so a sustained shake never looks like a loop.

## 7h. Audio mix

`audio/AudioMix.ts` holds the decisions; `audio/SoundFX.ts` holds the
synthesis. Every voice runs:

```
voice -> [StereoPanner] -> category gain -> master (0.85) -> compressor -> out
```

The compressor is `threshold -18 dB, knee 12, ratio 6, attack 4 ms,
release 180 ms`. Bus levels: beds (engine 0.055, airflow 0.05, threat 0.10)
sit below events (weapons 0.30, world 0.50, impacts 0.55), and alerts (0.62)
sit above everything, because an alert is an instruction.

Spatialisation, for world events only:

```
gain = 1 / (1 + (d/320)²)          , zero beyond 7 km
pan  = ((Δ · right) / |Δ_horizontal|) × 0.85
```

Beds driven from simulation state:

```
airflow(v)      = { gain: 0.05 · t, cutoff: 300 + 2400 t },  t = clamp((v-60)/280)
buffet(α)       = clamp((|α| - 0.7 α_limit) / (0.3 α_limit)) , 1 when stalled
threatBed(rwr)  = SEARCH 0.045/54 Hz · TRACK 0.08/68 Hz · LAUNCH 0.10/92 Hz
```

Measured in Chromium with the simulation paused and the beds set by hand
(peak amplitude at the output): engine 0.15, cannon 0.15, kill confirm 0.28,
RWR launch 0.38, wire catch 0.39.

## 7i. Touch mode

`core/Platform.ts` decides the scheme:

```
touchCapable  = navigator.maxTouchPoints > 0
fingerPrimary = (pointer: coarse) AND NOT (hover: hover)
TOUCH         = touchCapable AND fingerPrimary AND max(w, h) <= 1180
```

The hover test is what separates a phone from a touchscreen laptop, and the
long-edge bound is what separates a phone or tablet from a kiosk. A stored
preference (`AUTO` / `TOUCH` / `KEYBOARD`) overrides all of it.

`renderer/TouchLayout.ts` places the controls. One scale drives everything:

```
scale = clamp(min(safeW / 780, safeH / 390), 0.72, 1)
```

so a 640 px phone shrinks the set rather than rearranging it. Controls are
anchored to the bottom corners inside the safe area, at least 44 px across,
and none may enter the centre keepout (150 px x scale each side), which
belongs to the pitch ladder, the flight path marker and the designation
bracket.

Stick deflection is relative to first contact, which is what makes a virtual
stick usable:

```
pitch = clamp(-(y - originY) / r)      roll = clamp((x - originX) / r)
throttle = clamp(1 - (y - trackY) / trackH) x 1.5
```

Each pointer is bound to the control it touched down on for the life of the
gesture: re-binding mid-gesture is how a stick silently becomes a throttle in
the middle of a turn.

### What touch mode sheds, and why

`solveHudLayout` and `computeDeckLayout` both take a reserve. The side blocks
do **not** reserve the thumb columns horizontally - the controls occupy the
bottom of those columns, so lifting the instrument centre clear of the band is
what is needed, and reserving the full column width drove the pitch ladder to
its 24 px hard floor on a 568 px phone.

| Shed | Threshold | Why it is safe |
| --- | --- | --- |
| Keyboard cheat strips, keycaps | always in touch | Advice a player cannot take |
| Flight checklist | always in touch | Needs a keyboard to tick against |
| Compass tape | height < 420 | Bearing is on the objective line and the designation bracket |
| RWR scope | height < 460 | The launch banner, the spatialised launch audio and the threat drone all still fire |
| Briefing phase cards, loss line | touch or height < 430 | The mission list and the button are what you press |
| Deck panels beyond orders and turnaround | always in touch | Crew stamina and the deck plan do not fit beside a button big enough to press |

## 7j. HUD label declutter

`renderer/LabelDeclutter.ts`. Contact range tags are placed before any is
drawn, greedily, nearest first:

```
for each candidate, in ascending range:
    try RIGHT, LEFT, ABOVE, BELOW of the bracket
    reject a seat that leaves the viewport, collides with an
      already-placed tag (+4 px), or covers an instrument
    place in the first seat that survives, else drop the tag
```

The brackets are always drawn — a contact never disappears — but a tag has to
earn its place. Three MiG-23s in a loose trail used to print three tags inside
forty pixels of each other and across the altitude block, which is strictly
worse than none: no tag is readable and the instrument behind them is gone.

The instrument rectangles come from the same `HudLayout` the instruments are
drawn from, so the keepouts cannot drift from what is on screen. Left and right
alone were not enough: in a head-on merge on a phone the contacts cluster
around the boresight with both sides blocked by the systems line, and every tag
was dropped.

## 7k. Motion and flash safety

`core/Accessibility.ts`. Two separate concerns, only one of which is a
preference.

**Flash rate is capped for everyone.** WCAG 2.3.1 sets the limit at three
flashes per second, because faster flashing of a large or high-contrast area
can trigger photosensitive seizures. The stall banner shipped on a 220 ms
period and the missile-launch banner on 260 ms — 4.5 and 3.8 per second. Every
blink now goes through `blinkVisible()`, which floors the period at
`MIN_BLINK_PERIOD_MS` (400 ms, 2.5 per second) whatever the caller asks for.

**Motion is a preference.** Under `prefers-reduced-motion: reduce`:

| Effect | Normal | Reduced |
| --- | --- | --- |
| Camera shake | full | **off** |
| Impact flash | full | 25% |
| HUD blinking | 2.5 Hz | off — the warning stays **lit**, not hidden |

A warning that vanishes is worse than one that fails to flash, so switching
blinking off leaves the element visible rather than hiding it.

## 7l. Colour palettes

`renderer/Theme.ts`. Green for your own symbology against red for hostiles is
the canonical red-green confusion: to a deuteranope or a protanope - together
the most common forms of colour blindness - those two are the same muddy
yellow-brown.

| Token | CLASSIC | BLUE / AMBER |
| --- | --- | --- |
| phosphor (instruments) | `#57e39b` | `#5ad1ff` |
| hostile / alert | `#ff6363` | `#ff8a1f` |
| caution | `#ffc94d` | `#ffe066` |
| key (keycaps) | `#5fd8ff` | `#c6a6ff` |
| muted | `#93a9a4` | `#a8b6bd` |

The alternative moves the whole conversation onto the blue-yellow axis, which
both conditions leave intact, and separates the two warning tones by lightness
(8.3:1 against 15.0:1 on the ground) as well as by hue. Keycaps go violet
because cyan is the instrument colour there, and a keycap that looks like an
instrument is not an affordance.

`THEME` and `WORLD` are mutable objects swapped in place by `applyPalette()`.
Two hundred and sixty call sites read them at draw time and nothing caches a
colour between frames, so the next frame simply picks the new one up; threading
a palette argument through all of them would be a far bigger change than the
feature deserves.

Two properties are enforced per palette rather than for whichever one happens
to be loaded: every colour clears 4.5:1 on its own ground, and friendly against
hostile survives a crude deuteranopia simulation (collapse R and G toward their
mean, leave B). The classic palette is expected to fail the second one - it is
the game's identity, and it is no longer the only option.

**Discoverability.** A working, tested, invisible feature is not a shipped
feature. The palette existed for a full release behind `C` in the control
reference with nothing pointing at it. `Theme.storedPalette()` distinguishes
"never chosen" from "chose the default", which `loadPalette()` deliberately
cannot (it has to collapse both into a bootable value). The briefing's
secondary options row - `renderer/BriefingScreen.briefingSecondaryOptions()`,
a pure function so this rule is testable without a canvas - adds a `C  try
colour-blind palette` entry for as long as `storedPalette()` is `null`, and
drops it the instant a choice is made, even a re-confirmation of CLASSIC. The
same pattern already existed for the assist level (`storedAssistLevel()`,
touch-mode default) and the approach assist (`storedApproachAssist()`); this
is its third use.

## 8. Scoring

| Event | Points |
| --- | --- |
| Fighter | +100 |
| Bomber | +250 |
| SAM site | +150 |
| Trap | +75 (+150 more for a 3-wire) |
| Bolter | −25 |
| Airframe lost | −200 |
| Hull damage | −10 per % |
| Wave survived | +200 |

Ranks: NUGGET (<0) · ENSIGN (0) · LT (JG) (500) · LIEUTENANT (1,200) ·
LT COMMANDER (2,200) · COMMANDER (3,500) · CAPTAIN (5,500) · ADMIRAL (8,000).

## 9. Rendering & Post-Processing

### Display modes

Every screen effect is a field of one `DisplayModeSpec`, cycled with `P` and
persisted to `localStorage`:

| Mode | bloom | vectorGlow | τ (persistence) | scanlines | vignette |
| --- | --- | --- | --- | --- | --- |
| `CLEAN` | 0 | 0 | 0 (hard clear) | 0 | 0 |
| `MODERN` (default) | 0.42 | 0 | 0.035 s | 0 | 0.28 |
| `RETRO CRT` | 0.55 | 4 px | 0.075 s | 0.5 | 0.7 |

`vectorGlow` is the per-stroke Canvas2D shadow radius and is the single most
expensive thing the renderer does — a shadow is applied per `stroke()` and the
terrain mesh alone issues thousands per frame. Measured at 1600×900 on a software
rasteriser: **23.7 ms/frame with it, 16.7 ms without**. The bloom pass already
produces a vector glow at ¼ resolution over the whole layer, so only `RETRO` pays
for both.

### Phosphor persistence

```
α = clamp( 1 − e^(−Δt/τ), 0.02, 1 )
```

Frame-rate independent — a constant α gives 2.4× longer trails at 144 Hz than 60 Hz.
`τ = 0` means a hard clear (no trails), which is what `CLEAN` selects.

**The decay target must be strictly darker than the background.** Decaying toward a
colour equal to the background does not converge under 8-bit rounding (a channel at
6 → `round(0.757·6 + 0.243·5)` = 6 forever), leaving permanent ghosting.

**Shadow state must be cleared before the decay fill.** Canvas shadow state is
sticky: `drawLine()` armed `shadowColor`/`shadowBlur` for its glow and never reset
them, so `decayClear()`'s translucent full-screen rectangle painted a full-screen
*shadow* in whatever colour the last vector happened to be — usually SAM red. It
accumulated frame over frame to a measured median background of `rgb(107,24,21)`
against an intended `rgb(3,10,4)`, which is what made the flight screen unreadable.

### Bloom

¼-resolution downscale (bilinear filtering is the first blur), then a `multiply`
self-composite as a pseudo-threshold (squares every channel, `v → v²/255`, collapsing
the dark background while saturated phosphor survives), then a blur, then an additive
`lighter` composite at the mode's bloom strength.

### Resolution

Both the visible canvas and the offscreen world layer are sized to
`CSS px × devicePixelRatio` with their 2D contexts pre-scaled, so all layout code
works in CSS pixels while text and vectors render at native resolution. The ratio
is capped at **2×** so a 3×/4× display does not quadruple the bloom cost.

### Adaptive quality

A rolling frame-time average (EMA, α = 0.05) drives `PostProcess.nextQuality()`
every 0.5 s, and the result is clamped to the ceiling the chosen display mode
allows — so the game can back the bloom pass off on weak hardware but never
exceed what the player asked for.

### Fixed timestep

```
FIXED_DT = 1/120 s,  maxSubsteps = 8
```

Excess accumulated time beyond `maxSubsteps × FIXED_DT` is **discarded**, not queued —
a spiral-of-death guard.

## 10. Web Audio Synthesis

| Sound | Synthesis |
| --- | --- |
| Engine | Sawtooth 70→210 Hz through a lowpass (250→850 Hz cutoff) |
| Afterburner | Looping white-noise buffer through a bandpass @400 Hz, Q = 1.0 |
| RWR SEARCH | 750 Hz square, 90 ms pulse every 1200 ms |
| RWR TRACK | 1200 Hz square, 60 ms ping every 220 ms |
| RWR LAUNCH | Continuous warble alternating 1600/1100 Hz every 160 ms |
| Vulcan | Sawtooth 120→30 Hz over 40 ms |
| Missile | Sine 250→1200 Hz over 400 ms |
| Explosion | Triangle 90→20 Hz over 800 ms |
| Catapult | Sawtooth 60→140 Hz over 500 ms |

## 11. Colour Palette

All colour lives in `src/renderer/Theme.ts`. UI chrome and the 3D world are
deliberately separate sets.

### UI (`THEME`)

| Token | Value | Use |
| --- | --- | --- |
| `ground` | `#070d11` | Page and canvas ground |
| `ink` | `#eafff5` | Headline values read at a glance |
| `phosphor` | `#57e39b` | Primary instrument colour |
| `muted` | `#93a9a4` | Labels and secondary copy — neutral, **not** green |
| `key` | `#5fd8ff` | The player's agency: key names, the selected mission, the armed weapon, the designated target |
| `caution` | `#ffc94d` | Caution / ready |
| `alert` | `#ff6363` | Lethal / hostile |

### World (`WORLD`)

| Token | Value | Use |
| --- | --- | --- |
| `carrier` | `#7df0b4` | CV-68 wireframe |
| `terrain` | `#3fb97a` | Ridge lines (the thing you must fly below) |
| `valley` | `#0f4a2c` | Low terrain |
| `horizon` | `#2f9e63` | Horizon ring |
| `sea` | `#14603a` | Sea lattice |
| `hostile` | `#ff5b4a` | Enemy aircraft, SAM launchers |
| `missile` | `#ff2d2d` | SAM missile trails |

**Every UI token clears 4.5:1 contrast against `ground`**, verified in
`Theme.test.ts` and measured at the darkest point of the vignette. The previous
palette paired a saturated `#00ff66` with a desaturated `#00aa44` under a
92%-black vignette and a scanline mask, which put the most important readouts
below 3:1. The rule that replaced it: labels are neutral, values carry colour,
and cyan means "this one is yours" — a key you can press or a thing you have
chosen. Nothing the world does is cyan, which is what lets a designation bracket
read as a decision rather than as another contact.

## 12. Cockpit Voice Warning System ("Bitchin' Betty")

Deterministic priority queue dispatched with a 4.0-second de-bounce lockout per warning type:

| Priority | Callout | Trigger Condition | Audio Spec |
| :---: | :--- | :--- | :--- |
| **1** | `WARNING: MISSILE LAUNCH` | Active SAM guidance radar lock (`spikeType === 'SAM_GUIDANCE'`) | 200 Hz monotone robotic synthesis |
| **2** | `PULL UP, PULL UP` | Altitude $y < 200\text{ m}$ and vertical speed $v_y < -30\text{ m/s}$ | Urgent dual-tone cadence |
| **3** | `STALL, STALL` | Angle of attack $\|\alpha\| > 18^\circ$ and authority $\le 0.25$ | Staccato alert |
| **4** | `BINGO FUEL` | Remaining fuel $< 15\%$ capacity | Informational cue |

Implemented with zero external audio assets via the browser's native `window.speechSynthesis` or procedural phonetic formant synthesis in `src/audio/WebAudioSystem.ts`.

## 13. Padlock Tracking Camera

Smoothly rotates the camera view vector toward the designated target $\mathbf{p}_{\text{tgt}}$ while keeping the physics flight model unchanged:

```
d = (p_tgt - p_ac) / |p_tgt - p_ac|
psi_tgt   = atan2(d · right, d · forward)
theta_tgt = asin(d · up)

psi_cam   = clamp(psi_tgt, -110°, +110°)     // Human cervical rotation limit
theta_cam = clamp(theta_tgt, -30°, +60°)     // Canopy elevation limit
```

Interpolation: cubic ease-out $f(t) = 1 - (1 - t)^3$ over $\Delta t = 250\text{ ms}$.

## 14. Vector Line Debris Kinetics

Upon target destruction, the wireframe mesh decomposes into $N \in [10, 16]$ physical line entities:

```
v_radial   ∈ [15, 40] m/s
v_debris(0) = v_parent + v_radial · r_hat
omega      ∈ [-4π, +4π] rad/s (random 3D angular tumble)
tau_debris = 1.2 s (phosphor alpha decay)
```

Screen-shake impulse: $I_{\text{shake}} = I_0 / (1 + \text{distance} / 500)$, decaying exponentially over 150 ms.

## 15. Rogue-lite Campaign Fleet Constants

Initial fleet logistics baseline for the persistent Norwegian Sea campaign:

| Asset | Initial Inventory | Notes |
| :--- | :---: | :--- |
| **F-14 Tomcat Airframes** | 24 | Air superiority / fleet intercept |
| **A-6 Intruder Airframes** | 12 | Deep strike / anti-radiation |
| **JP-5 Aviation Fuel** | 150,000 L | Decremented by engine thrust $\times$ time |
| **AIM-9 Sidewinder** | 72 | Heat-seeking short-range AAM |
| **AIM-7 Sparrow** | 48 | Semi-active radar medium-range AAM |
| **GBU-12 Paveway II** | 24 | Laser-guided hard-target bomb |
| **Mk.82 Snakeye** | 48 | Retarded iron bomb for low-level strikes |
| **Carrier Hull Integrity** | 100% | Reaching 0% ends the campaign |

**Strategic Suppression:** Disabling an Early Warning Radar node reduces hostile SAM detection ranges by **40%** in all adjacent connected nodes.

## 16. Arcade Time Rewind Buffer Specifications

The flight telemetry circular buffer captures continuous flight state for deterministic rollback:

```
Buffer Depth:         5.0 seconds
Sampling Frequency:   20 Hz (dt = 0.05s)
Capacity:             100 snapshots
Budget:               2 uses per sortie (ARCADE / ASSIST only)
```

Snapshot layout per slot (zero garbage collection allocations):
```typescript
interface AircraftSnapshot {
    position: Vector3;
    velocity: Vector3;
    pitch: number;
    yaw: number;
    roll: number;
    airSpeed: number;
    throttle: number;
    fuel: number;
    damage: number;
    bayOpen: boolean;
}
```

Safety Invariant: `physics.damage = Math.min(target.damage, physics.damage)` ensures current airframe battle damage is preserved upon rewind, preventing invulnerability cheating while rescuing the pilot from controlled flight into terrain (CFIT) or flat spins.

## 17. Cockpit Voice Warning System ("Bitchin' Betty")

Synthesized avionics warning hierarchy and speech parameter tuning:

| Priority | Alert Key | Announcement Text | Trigger Condition | De-bounce Cooldown |
| :---: | :--- | :--- | :--- | :---: |
| 100 | `MISSILE_LAUNCH` | "MISSILE LAUNCH. DEFENSIVE." | Active hostile missile guidance lock | 4.0 s |
| 90 | `PULL_UP` | "PULL UP. TERRAIN." | Altitude AGL < 200m & $v_y < -30\text{ m/s}$ | 4.0 s |
| 80 | `STALL` | "STALL WARNING." | Aerodynamic stall or $|\alpha| > 18^\circ$ | 4.0 s |
| 70 | `BINGO_FUEL` | "BINGO FUEL. RECOVER TO MOTHER." | Fuel fraction < 15% capacity | 4.0 s |

Synthesis parameters for 1980s military cockpit voice synthesis:
- Rate: `1.15`
- Pitch: `1.25`
- Volume: `0.95`
- Voice filter: English (`en-US`), prioritizing female voices (`Samantha`, `Victoria`, `Zira`, or generic `female`).

## 8. Missile Guidance Math (v1.5.0)

### Lead intercept
For a missile at `m` with speed `s` and a target at `p` moving at constant `v`, the flight
time `t` satisfies `|p + v t - m| = s t`. With `r = p - m`:

    (|v|^2 - s^2) t^2 + 2 (v . r) t + |r|^2 = 0

Take the smallest strictly positive root; the aim point is `p + v t`. No positive real root
(target outrunning the missile) falls back to pure pursuit. When `|v| = s` the quadratic
degenerates to `2 (v . r) t + |r|^2 = 0`.

### Bounded turn
`rotateToward(a, b, max)`: `angle = acos(a . b)`; if `angle <= max` return `b`; else
`tangent = normalise(b - a cos(angle))` and the result is `a cos(max) + tangent sin(max)`.
Exactly antiparallel inputs have no unique tangent, so any perpendicular is built from the
world axis least aligned with `a`.

### Time to impact
`range / closing speed`, where closing speed is the missile velocity projected on the
line of sight; `null` when it is not closing (a countdown must not show).

### Turn-rate to lateral acceleration
`a = speed * omega`. 480 m/s at 0.25 rad/s = 120 m/s^2 (~12 g).

### Tuning table (250 m/s jet, 40 m fuze, closest approach)

| turn rate | straight | break at once, 3 km | break at once, 1.5 km |
| --- | --- | --- | --- |
| 0.20 rad/s | 2 m | 289 m | 123 m |
| 0.25 rad/s | 2 m | 98 m | 29 m |
| 0.30 rad/s | 2 m | 2 m | 2 m |

### Chaff coasting
A decoyed missile at 480 m/s covers ~1.7 km in the 3.5 s window - enough to overshoot.

## 19. Bank-to-Turn, Loops, Radar & Guns (v1.6.0)

### The orientation basis (the one thing everything shares)

Axes: +X east, +Y up, +Z north. Heading `yaw` is clockwise from +Z; `pitch` is nose-up; `roll` is
positive to the right (right wing down). Build the frame by yaw about Y, pitch about the wing, roll about
the nose:

```
forward = ( cosP sinY,             sinP,        cosP cosY )
right   = ( cosR cosY + sinP sinY sinR,  -cosP sinR,  -cosR sinY + sinP cosY sinR )
up      = ( sinR cosY - sinP sinY cosR,   cosP cosR,  -sinR sinY - sinP cosY cosR )
```

`AircraftPhysics.forwardVector/rightVector/upVector` and `VectorRenderer.basisVectors` are the same
formula (the renderer is kept independent of any aircraft instance, so it is duplicated) and are asserted
orthonormal and equal in tests. Lift acts along `up`, so a right bank tilts lift to +X and the path
curves right. Until 1.6.0 `up` and two components of `right` carried the *left*-roll sign.

### Body-rate pitch (bank and pull)

The stick commands a pitch rate `q` about the aircraft's own wing. Advancing the stored Euler angles:

```
dPitch = q cos(roll)
dYaw   = q sin(roll) / max(0.2, cos(pitch))
```

At 90 degrees of bank the whole pull goes into heading; wings-level it is all pitch (tested).

### Folding through vertical

If `|pitch| > pi/2`: `pitch = sign * pi - pitch; yaw += pi; roll += pi`. Same attitude, so
`forwardVector` is continuous across the fold (tested: a step over 90 degrees moves the nose < 0.05
unit). Roll is then wrapped to [-pi, pi] and yaw to [0, 2 pi).

### Directional stability (weathervane)

```
yaw += wrap(atan2(vx, vz) - yaw) * 0.8 * (horizSpeed/speed)^2 * min(1, speed/150) * dt
```
Only when horizontal speed > 30 m/s and not stalled. The `(horiz/speed)^2` weight fades it out on a
vertical flight path so it never fights a loop. It is deliberately weak (0.8/s): the rudder still holds
the nose off-axis for gunnery (equilibrium offset ~ rudder rate / gain).

### Turn assist and the alpha limiter (`turnAssist = 1`, game loop only)

- Auto back-pressure each tick: `pull = 0.8 * |sin(roll)| * margin`, `margin = max(0, 1 - |alpha| / (0.8 * 18 deg))`,
  applied when upright (`cos(roll) > -0.2`) and airspeed > 60 m/s.
- Pilot pull is limited too: `rate *= max(0.1, 1 - alpha / (0.92 * 18 deg))` when pulling with alpha > 0.
  Without it the nose outruns the wing (a 1.35 rad/s pitch rate against ~0.45 rad/s of available path
  turn), alpha passes 18 degrees within a second, authority drops to 0.22 and the loop dies at the top.
- Upright bank cap 75 degrees, decided by which side of wings-level the step *started* on. (The cap sits
  at cos 0.259; a threshold on the *result* lets the first step past it through. This shipped once.)

Measured through the game loop, 240 m/s at 3000 m: held bank alone ~9 deg/s, 90 degrees in ~10 s;
sustained 180 in ~19 s at full afterburner, ending ~96 m/s. Thrust-to-weight is 0.91 at full AB
(145 kN over 16.2 t).

### Radar projection (heading-up, `RadarMath.ts`)

```
ahead = dx sin(yaw) + dz cos(yaw)         right = dx cos(yaw) - dz sin(yaw)
scale = radiusPx / max(distance, range)   x = right * scale,  y = -ahead * scale
```
Range 12 km maps to the rim; beyond it the contact keeps its bearing and sits on the rim (`clamped`).
A contact's triangle points along `atan2(vRight, vAhead)` of its velocity. North sits on the rim at
angle `-yaw`. SAM bearings are already nose-relative (`azimuthDeg`).

### Enemy guns

| Constant | Value | Meaning |
| --- | --- | --- |
| `FIRE_RANGE` | 1600 m | solution needs range under this |
| `FIRE_CONE_DEG` | 12 | and the nose within this of the player |
| `AIM_TIME` | 0.7 s | solution must be held this long before the first burst |
| `HIT_CHANCE` | 0.6 | fraction of bursts that connect |
| `FIRE_COOLDOWN` | 1.4 s | between bursts |

`onAim` fires once when the solution is first held (the `GUNS TRACKING` warning); losing the solution
resets the timer.

### Death sequence

`DEATH_SEQUENCE_SECONDS = 2.6`, `DEATH_TIME_SCALE = 0.3`. The countdown is in real time; the world runs at
0.3x. Controls, the coach and further damage are ignored while `dying`. The cause captured at the start
is restored before the deck cut so a second hit cannot rewrite it.

---

## 20. Measured Flight & HUD Constants (v1.9.0)

Everything here was **measured on the running game in a browser**, not derived
from the source. Where a measurement contradicts a formula elsewhere in this
document, the measurement is what the player experiences.
Method: [`APPROACH_AND_METHOD.md` §10](APPROACH_AND_METHOD.md).

### 20.1 Sustained turn performance

Held input, sampled once per second. Start state: 2,500 m, 200 m/s, wings level,
full throttle, `turnAssist = 1`.

| Input | Assist law | Turn rate | 180° reversal | Final speed |
| :-- | :-- | --: | --: | --: |
| Bank only | `ASSIST` | 7.2 °/s | ~25 s | 186 m/s |
| Bank + back-stick | `ASSIST` | 9.5 °/s | ~19 s | 134 m/s |
| Bank only | `MANUAL` | 8.3 °/s | ~22 s | 166 m/s |
| Bank + back-stick | `MANUAL` | 10.3 °/s | ~17 s | 120 m/s |
| Bank + back-stick | `AUTO` | 9.6 °/s | ~19 s | 146 m/s |

**Back-stick does tighten the turn** (+2.0 to +2.3 °/s), confirming the control
reference. The cost is airspeed: ~50 m/s over eight seconds.

### 20.2 The degenerate case — turning in the vertical plane

From a nose-high, energy-bleeding state (pitch 35°, 154 m/s, throttle 1.5), eight
seconds of held bank **and** held back-stick produced **2° of heading change**
(~0.25 °/s) and ended in a stall warning.

This is correct: at 75° of bank with the nose 35° above the horizon, the turn
goes into the vertical plane and heading barely moves. It is also the state the
game reliably puts a beginner in straight off the catapult (§20.3), and before
v1.9.0 nothing on the default HUD displayed the pitch attitude that explains it.

### 20.3 Throttle behaviour with no pilot input

`FlightAssist` raises the throttle demand to 0.7 when airspeed decays below
130 m/s in `ASSIST` and never lowers it. Measured: a pilot who touches no
throttle key sits at **throttle = 1.5 (150%, full afterburner)** from the
catapult stroke onward, burning ~138 L in 25 s. Known Issues #66.

### 20.4 Roll response

`applyRollInput` rate = `2.4 · qFactor · controlAuthority` rad/s, with
`qFactor = clamp(speed/150, 0.2, 1.3)`. At 200 m/s that is ~2.9 rad/s, so the
75° upright cap (`turnAssist > 0`) is reached in **~0.45 s** and then pinned.
Measured: `roll = −75°` at t = 1 s and at every subsequent sample. There is no
proportional bank feel; the key behaves as a toggle between 0° and 75°.

### 20.5 HUD vertical band stack

Derived, not hand-picked. `BAND_GAP = 8`. `HUD.bandRects()` exports these and
`HudLayout.test.ts` asserts they are pairwise disjoint.

| Band | Height | Top | Bottom |
| :-- | --: | --: | --: |
| Objective strip | 54 | 54 | 108 |
| Compass tape (plate) | 32 | 116 | 148 |
| Warning banner | 28 | 156 | 184 |
| Coach ticker | 26 | 192 | 218 |

> Pre-v1.9.0, `BAND.compass` was 96, putting the tape's plate at 76–108 —
> entirely inside the objective strip. Both strings were unreadable on every
> frame at every resolution.

### 20.6 HUD bottom stack

Measured up from the viewport bottom, or from the top of whatever the touch
controls reserve. `HudLayout.bottomStackRects(height, reserve)`.

| Element | Offset from base | Height |
| :-- | --: | --: |
| Assist annunciator | 94 | 22 |
| Arcade pill bar | 58 | 34 |
| Keycap cheat strip (centre line) | 14 | 16 |

> Pre-v1.9.0 these were `52`/`22`, `52`/`34` and `22`/`16` — three elements in
> one 35 px band, printing through each other.

### 20.7 Arcade horizon projection

`HUD.drawArcadeHorizon` uses the same exact projection as the pitch ladder's zero
rung, so the bar sits on the true horizon rather than approximating it:

```
yOffset = fov · tan(pitch)        [px from screen centre, pre-roll-rotation]
```

Drawn only when `|pitch| ≤ 1.45 rad` (≈83°). Beyond `±0.34 · height` the bar is
clamped to that edge and drawn at 45% alpha, so a steep attitude reads as
"the horizon is that way" rather than as an empty screen. A signed pitch number
is drawn beside it whenever `|pitch| ≥ 5°`.

### 20.8 Screen inventory, 1440×900, default settings

| Quantity | Count |
| :-- | --: |
| Simultaneous cockpit draw regions (ARCADE) | ~27 |
| Distinct labelled values on the glass | 33 |
| Key bindings in the help overlay | 29 |
| Deck screen panels (desktop) | 8 |
| Deck screen panels (phone landscape) | **4** |
| Keys shown on the briefing before first flight | 14 |
| Boot → briefing | 1.8 s (`BriefingScreen.WARMUP_DURATION`) |
| Page load → first flying-like moment | ~75 s, mostly reading |

### 20.9 Build metrics (v1.9.0)

| Metric | Value |
| :-- | --: |
| Tests | 932 passing, 51 files |
| Non-test source | 19,680 lines |
| Test source | 10,971 lines |
| Runtime dependencies | 0 |
| Bundle | 235.2 kB raw / 75.8 kB gzip |

---

## 21. Airframe, Controllers and HUD Budgets (v1.10.0)

### 21.1 Ops tempo airframes

| Tempo | `liftScale` | Meaning |
| :-- | --: | :-- |
| ARCADE (default) | 1.7 | Wing area ×1.7 - lift **and** drag forces scale, so no free energy |
| SIM | 1.0 | The original airframe |

On-speed approach speed (1 g at 8.1° AoA, near sea level):
`V = sqrt(2·m·g / (ρ₀ · S · liftScale · 0.085 · 8.1))` →
**~76 m/s ARCADE**, **~100 m/s SIM** (clamped to 88 by `approachSpeedFor`).

### 21.2 Measured turn performance (unit level, 2,500 m, 200 m/s start)

| | SIM | ARCADE |
| :-- | --: | --: |
| Bank only, 16 s | 9.1 °/s, nose −10°, −284 m | 11.2 °/s, nose −6°, −126 m |
| Bank + full pull, 8 s | 11.7 °/s | 14.3 °/s |
| Running game, held `A`, default settings | — | **12.3 °/s, nose +6°** |

### 21.3 Directional stability (#71)

`β = asin(v̂ · right)`, `r = β · WEATHERVANE_GAIN (0.8) · min(1, V/150)`, applied
through the Euler kinematics `θ' = −r·sin φ`, `ψ' = r·cos φ / cos θ`. Skipped
below 30 m/s or when stalled.

### 21.4 Autopilot laws

| Law | Form | Constants |
| :-- | :-- | :-- |
| Autothrottle | `rate = (Vt − V)·speedGain − V̇·speedDamping` | 0.05, 0.3 |
| Altitude hold | `q = clamp(Δh·0.0016·bankFactor) − 0.8·damped` | |
| Damping blend | `damped = (γ − γff)·w + θ·(1 − w)`, `w = clamp(1 − |φ|/0.35)` | γ = asin(vs/V) |
| Glideslope feed-forward | `γff = −3.5°` on the slope | `NavTarget.pathAngle` |
| ASSIST burner cancel | above 180 m/s, throttle > 1.0, hands off → rate −1.0 | `burnerCancel*` |

### 21.5 HUD density budgets (`HudDensity.ts`)

| Density | Optional regions | Shown |
| :-- | --: | :-- |
| FIRST_FLIGHT | 3 | horizon, armed-weapon chip, "U / H" hint line |
| ARCADE | 8 | horizon, FPM, compass, radar, pill bar, score, corner buttons, routine annunciator |
| PRO | 7 | pitch ladder, FPM, compass, radar, score, corner buttons, routine annunciator (plus the systems panel) |

Always on at every density: objective strip, speed, altitude, warnings, coach
ticker, target brackets, callouts, landing aids on approach, the go-here cue and
missile carets.

### 21.6 Deck panel sets (`deckPanelSpecs`)

| Set | Panels |
| :-- | :-- |
| Touch | ORDERS, TURNAROUND, THREATS |
| BRIEF (FIRST_FLIGHT) | ORDERS, TURNAROUND, THREATS, LOG |
| FULL | ORDERS, TURNAROUND (with crew line), PAYLOAD, THREATS, STATUS, DECK_PLAN, LOG |

### 21.7 Struggle detector (`StruggleDetector.ts`)

Four pitch reversals, each after a press shorter than 0.6 s, inside 12 s → one
offer of the stick flip, once per session, only if the stick setting was never
touched.

### 21.8 Build metrics (v1.10.0)

| Metric | Value |
| :-- | --: |
| Tests | 989 passing, 55 files |
| Browser checks | 28 (`npm run playtest`) |
| Non-test source | ~21,000 lines |
| Runtime dependencies | 0 |
| Bundle | 246.2 kB raw / 79.6 kB gzip |

## 22. Pilot Menu, Climb Limiter and Recovery Fix (v1.11.0)

### 22.1 ASSIST climb-attitude limiter (`FlightAssist.climbLimited`)

Held nose-up demand fades out approaching a pitch-attitude limit and becomes a
gentle push beyond it - independent of the (alpha-based) stall limiter, which
is unloaded in a zoom climb and does not catch this case.

| Constant | Value | Meaning |
| :-- | --: | :-- |
| `maxClimbPitch` | 0.61 rad (~35°) | Steepest ASSIST lets a held pull reach |
| `climbPitchBlend` | 0.12 rad | Fade-out band below the limit |
| `climbPitchGain` | 3 | Push per radian past the limit |

MANUAL is untouched; loops and full aerobatics are one key (`F`) away.

### 22.2 Recovery "take me home" - two JOIN cases (`ApproachGuidance.ts`)

`inApproachCorridor(position, tuning, headingRadians?)` - heading optional,
old callers unaffected. Two distinct failure modes now get two distinct fixes:

| Case | Test | Guidance |
| :-- | :-- | :-- |
| Out of position (too far, off to one side) | `!inApproachCorridor(position, tuning)` (no heading) | Route to the join point, 9 km astern - unchanged, still a CUE under ASSIST/MANUAL |
| In position, wrong heading | position check passes, heading check fails (`> finalHeadingTolerance`, π/3) | A short, tight reversal: `bearing = finalCourse`, `airSpeed = homeTurnSpeed` (110 m/s), `maxBank = homeTurnMaxBank` (0.7 rad) |

`GameLoop.recoveryNav` distinguishes the two the same way -
`inApproachCorridor(position, tuning)` without heading - so no new
`ApproachPhase` value was needed. Only the in-position case is flown under
AUTO; the out-of-position case is still left to the player as a HUD cue.

Measured convergence from the reported failure state (640 m astern, heading
197°): `HANDOVER` within ~30 s, peak divergence ~1.4 km (was 7.9 km and
climbing, unfixed).

### 22.3 Pilot menu (`PilotMenu.ts`, `PilotMenuView.ts`)

Items, most useful first: `RESUME`, `LAUNCH` (deck only), `FLY_FOR_ME`
(labelled by current autopilot state), `TAKE_ME_HOME` (airborne only),
`CONTROLS`, `INSTRUMENTS`, `SOUND`, `RESTART`, `MISSION_SELECT`. Opened by
`ESC`, a corner `MENU (ESC)` DOM button (desktop, hidden on touch), or the
touch `MENU` control (repointed from the raw help overlay). `GameLoop.paused`
now includes `menuOpen`. Layout (`pilotMenuLayout`) is the single solver both
`drawPilotMenu` and `pilotMenuHitTest` read, matching `HudLayout` /
`DeckLayout`'s existing discipline.

### 22.4 "Step pays off" reward banner (`Scenarios.shortCallout`)

Every scripted phase's existing radio `callout` string now also produces an
on-screen PRAISE banner and a confirmation tone (`GameLoop.updateMission`),
in addition to the tactical log line it always produced. `shortCallout` strips
the speaker prefix and keeps the first sentence - reusing copy every scenario
already had, rather than writing new reward text.

### 22.5 Build metrics (v1.11.0)

| Metric | Value |
| :-- | --: |
| Tests | 1,029 passing, 57 files |
| Browser checks | 33 (`npm run playtest`) |
| Runtime dependencies | 0 |
| Bundle | 253.6 kB raw / 82.0 kB gzip |
